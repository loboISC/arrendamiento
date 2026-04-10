const db = require('../config/database');
const { DateTime } = require('luxon');

exports.syncBiometric = async (req, res) => {
    let zkInstance = null;
    try {
        // 1. Obtener configuración del biométrico
        const configRes = await db.query('SELECT * FROM rh_config_global WHERE id = 1');
        const config = configRes.rows[0];

        if (!config || !config.bio_ip) {
            return res.status(400).json({ error: 'Configuración biométrica no encontrada' });
        }

        // 2. Conectar al Biométrico (Aumentado timeout a 30s por logs grandes)
        zkInstance = new ZKLib(config.bio_ip, config.bio_port || 4370, 30000, 4000);
        await zkInstance.createSocket();
        
        // 3. Obtener asistencias del reloj
        const logs = await zkInstance.getAttendances();
        
        if (!logs || !logs.data) {
            throw new Error('No se pudieron recuperar los datos del reloj (Respuesta vacía)');
        }

        // 4. Obtener mapeo de empleados (bio_id -> id_empleado) y sus turnos
        const empsRes = await db.query(`
            SELECT e.id, e.bio_id, t.entrada, t.tolerancia_minutos 
            FROM rh_empleados e
            LEFT JOIN rh_turnos t ON e.turno_id = t.id
            WHERE e.bio_id IS NOT NULL
        `);
        
        const empMap = {};
        empsRes.rows.forEach(e => {
            empMap[e.bio_id] = e;
        });

        let nuevosRegistros = 0;

        // 5. Procesar cada log
        for (const log of logs.data) {
            const bioId = parseInt(log.deviceUserId);
            const emp = empMap[bioId];

            const dt = DateTime.fromJSDate(new Date(log.recordTime));
            const fechaStr = dt.toISODate(); // 'YYYY-MM-DD'
            const horaStr = dt.toFormat('HH:mm:ss');

            // 6. Verificar si ya existe el registro (usamos bio_id_registro si no hay emp)
            const queryExiste = emp 
                ? 'SELECT id FROM rh_asistencia WHERE empleado_id = $1 AND fecha = $2 AND hora = $3'
                : 'SELECT id FROM rh_asistencia WHERE bio_id_registro = $1 AND fecha = $2 AND hora = $3';
            
            const paramsExiste = emp ? [emp.id, fechaStr, horaStr] : [bioId, fechaStr, horaStr];
            const existe = await db.query(queryExiste, paramsExiste);

            if (existe.rows.length === 0) {
                // 7. Determinar estatus (OK / Retardo)
                let status = 'OK';
                if (emp && emp.entrada) {
                    const [hTurno, mTurno] = emp.entrada.split(':').map(Number);
                    const hLog = dt.hour;
                    const mLog = dt.minute;

                    const minutosTarde = (hLog * 60 + mLog) - (hTurno * 60 + mTurno);
                    if (minutosTarde > (emp.tolerancia_minutos || 0)) {
                        status = 'Retardo';
                    }
                } else if (!emp) {
                    status = 'Sin Vincular';
                }

                await db.query(`
                    INSERT INTO rh_asistencia (empleado_id, fecha, hora, tipo, metodo, status, bio_id_registro)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [emp ? emp.id : null, fechaStr, horaStr, 'Entrada/Salida', 'Biométrico', status, bioId]);
                nuevosRegistros++;
            }
        }

        // Liberar conexión
        try { await zkInstance.disconnect(); } catch(e) {}

        res.json({ 
            message: `Sincronización completada. ${nuevosRegistros} nuevos registros añadidos.`,
            total_logs_reloj: logs.data.length
        });

    } catch (err) {
        console.error('Error en syncBiometric:', err);
        if (zkInstance) try { await zkInstance.disconnect(); } catch(e) {}
        res.status(500).json({ error: 'Error al conectar con el biométrico: ' + err.message });
    }
};

exports.previewBiometric = async (req, res) => {
    let zkInstance = null;
    try {
        const configRes = await db.query('SELECT * FROM rh_config_global WHERE id = 1');
        const config = configRes.rows[0];
        
        zkInstance = new ZKLib(config.bio_ip, config.bio_port || 4370, 30000, 4000);
        await zkInstance.createSocket();
        const logs = await zkInstance.getAttendances();

        // Obtener empleados para el mapeo visual
        const empsRes = await db.query('SELECT id, nombre, apellidos, bio_id FROM rh_empleados');
        const empMap = {};
        empsRes.rows.forEach(e => { empMap[e.bio_id] = e; });

        const hoy = DateTime.now().toISODate();
        const preview = logs.data
            .filter(log => DateTime.fromJSDate(new Date(log.recordTime)).toISODate() === hoy)
            .map(log => {
                const bioId = parseInt(log.deviceUserId);
                const emp = empMap[bioId];
                return {
                    bio_id_registro: bioId,
                    nombre: emp ? `${emp.nombre} ${emp.apellidos || ''}` : `ID Desconocido: ${bioId}`,
                    hora: DateTime.fromJSDate(new Date(log.recordTime)).toFormat('HH:mm:ss'),
                    status: emp ? 'Listo para Sincronizar' : 'VINCULACIÓN PENDIENTE',
                    metodo: 'Vista Previa (En Memoria)'
                };
            });

        await zkInstance.disconnect();
        res.json(preview);

    } catch (err) {
        if (zkInstance) try { await zkInstance.disconnect(); } catch(e) {}
        res.status(500).json({ error: 'Error en vista previa: ' + err.message });
    }
};

exports.getAsistencias = async (req, res) => {
    const { inicio, fin, empleado_id } = req.query;
    try {
        let query = `
            SELECT 
                a.*, 
                COALESCE(e.nombre, 'ID Desconocido: ' || a.bio_id_registro) as nombre, 
                e.apellidos, 
                d.nombre as departamento
            FROM rh_asistencia a
            LEFT JOIN rh_empleados e ON a.empleado_id = e.id
            LEFT JOIN rh_puestos p ON e.puesto_id = p.id
            LEFT JOIN rh_departamentos d ON p.departamento_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (inicio && fin) {
            query += ` AND a.fecha BETWEEN $${params.length + 1} AND $${params.length + 2}`;
            params.push(inicio, fin);
        } else {
            query += ` AND a.fecha = CURRENT_DATE`;
        }

        if (empleado_id) {
            query += ` AND a.empleado_id = $${params.length + 1}`;
            params.push(empleado_id);
        }

        query += ` ORDER BY a.fecha DESC, a.hora DESC`;

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error en getAsistencias:', err);
        res.status(500).json({ error: 'Error al obtener asistencias' });
    }
};

exports.testConnection = async (req, res) => {
    const { ip, port } = req.body;
    let zkInstance = null;
    try {
        zkInstance = new ZKLib(ip, port || 4370, 10000, 4000);
        await zkInstance.createSocket();
        
        const [name, time, info] = await Promise.all([
            zkInstance.getDeviceName(),
            zkInstance.getTime(),
            zkInstance.getInfo()
        ]);

        await zkInstance.disconnect();
        
        res.json({ 
            success: true, 
            device: name,
            currentTime: time,
            stats: info || { logCounts: 'N/D' } // Manejo defensivo si getInfo falla
        });
    } catch (err) {
        if (zkInstance) try { await zkInstance.disconnect(); } catch(e) {}
        res.status(500).json({ error: 'Error de comunicación: ' + err.message });
    }
};
