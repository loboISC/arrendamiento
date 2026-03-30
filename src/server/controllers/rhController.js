const db = require('../config/database');

// --- EMPLEADOS ---

// Obtener lista resumida de empleados para la tabla principal
exports.getEmployees = async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id, e.nombre, e.apellidos, e.estado, e.curp, e.rfc, e.fecha_ingreso,
                p.nombre as puesto,
                d.nombre as departamento
            FROM rh_empleados e
            LEFT JOIN rh_puestos p ON e.puesto_id = p.id
            LEFT JOIN rh_departamentos d ON p.departamento_id = d.id
            ORDER BY e.nombre ASC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error en getEmployees:', err);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
};

// Obtener detalle completo de un empleado
exports.getEmployeeById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                e.*,
                n.nss, n.reg_patronal, n.tipo_prestaciones, n.salario_diario, n.sdi, n.nomina_asignada, n.tipo_contrato,
                d.telefono, d.direccion, d.tipo_sangre, d.contacto_emergencia
            FROM rh_empleados e
            LEFT JOIN rh_empleados_nomina n ON e.id = n.empleado_id
            LEFT JOIN rh_empleados_detalles d ON e.id = d.empleado_id
            WHERE e.id = $1
        `;
        const { rows } = await db.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Error en getEmployeeById:', err);
        res.status(500).json({ error: 'Error al obtener detalle del empleado' });
    }
};

// Guardar o actualizar empleado
exports.saveEmployee = async (req, res) => {
    const empleado = req.body;
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Insertar/Actualizar rh_empleados
        const upsertEmpleado = `
            INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, turno_id, fecha_ingreso, bio_id, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos, fecha_nac = EXCLUDED.fecha_nac,
                curp = EXCLUDED.curp, rfc = EXCLUDED.rfc, puesto_id = EXCLUDED.puesto_id,
                turno_id = EXCLUDED.turno_id, fecha_ingreso = EXCLUDED.fecha_ingreso,
                bio_id = EXCLUDED.bio_id, estado = EXCLUDED.estado
            RETURNING id
        `;
        await client.query(upsertEmpleado, [
            empleado.id, empleado.nombre, empleado.apellidos, empleado.fecha_nac || null,
            empleado.curp, empleado.rfc, empleado.puesto_id || null, empleado.turno_id || null,
            empleado.fecha_ingreso || null, empleado.bio_id || null, empleado.estado || 'Activo'
        ]);

        // 2. Insertar/Actualizar rh_empleados_nomina
        const upsertNomina = `
            INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (empleado_id) DO UPDATE SET
                nss = EXCLUDED.nss, reg_patronal = EXCLUDED.reg_patronal, 
                tipo_prestaciones = EXCLUDED.tipo_prestaciones, salario_diario = EXCLUDED.salario_diario,
                sdi = EXCLUDED.sdi, nomina_asignada = EXCLUDED.nomina_asignada, 
                tipo_contrato = EXCLUDED.tipo_contrato
        `;
        await client.query(upsertNomina, [
            empleado.id, empleado.nss, empleado.reg_patronal, empleado.tipo_prestaciones,
            empleado.salario_diario || 0, empleado.sdi || 0, empleado.nomina_asignada, empleado.tipo_contrato
        ]);

        // 3. Insertar/Actualizar rh_empleados_detalles
        const upsertDetalles = `
            INSERT INTO rh_empleados_detalles (empleado_id, telefono, direccion, tipo_sangre, contacto_emergencia)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (empleado_id) DO UPDATE SET
                telefono = EXCLUDED.telefono, direccion = EXCLUDED.direccion,
                tipo_sangre = EXCLUDED.tipo_sangre, contacto_emergencia = EXCLUDED.contacto_emergencia
        `;
        await client.query(upsertDetalles, [
            empleado.id, empleado.telefono, empleado.direccion, empleado.tipo_sangre, empleado.contacto_emergencia
        ]);

        await client.query('COMMIT');
        res.json({ message: 'Empleado guardado correctamente', id: empleado.id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error en saveEmployee:', err);
        res.status(500).json({ error: 'Error al guardar empleado: ' + err.message });
    } finally {
        client.release();
    }
};

// --- CATÁLOGOS ---

exports.getConfig = async (req, res) => {
    try {
        const deptos = await db.query('SELECT * FROM rh_departamentos ORDER BY nombre');
        const puestos = await db.query('SELECT * FROM rh_puestos ORDER BY nombre');
        const turnos = await db.query('SELECT * FROM rh_turnos ORDER BY nombre');
        
        res.json({
            departamentos: deptos.rows,
            puestos: puestos.rows,
            turnos: turnos.rows
        });
    } catch (err) {
        console.error('Error en getConfig:', err);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// --- ASISTENCIA ---

exports.getAsistencia = async (req, res) => {
    const { inicio, fin } = req.query;
    try {
        let sql = `
            SELECT a.*, e.nombre, e.apellidos, e.bio_id
            FROM rh_asistencia a
            JOIN rh_empleados e ON a.empleado_id = e.id
        `;
        const params = [];
        if (inicio && fin) {
            sql += ` WHERE a.fecha BETWEEN $1 AND $2`;
            params.push(inicio, fin);
        }
        sql += ` ORDER BY a.fecha DESC, a.hora DESC`;
        
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Error en getAsistencia:', err);
        res.status(500).json({ error: 'Error al obtener asistencia' });
    }
};

exports.saveAsistencia = async (req, res) => {
    const registros = req.body; // Array de registros
    try {
        for (const reg of registros) {
            await db.query(`
                INSERT INTO rh_asistencia (empleado_id, fecha, hora, tipo, metodo, status)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [reg.empleado_id, reg.fecha, reg.hora, reg.tipo, reg.metodo || 'Biométrico', reg.status || 'OK']);
        }
        res.json({ message: 'Asistencias guardadas' });
    } catch (err) {
        console.error('Error en saveAsistencia:', err);
        res.status(500).json({ error: 'Error al guardar asistencia' });
    }
};

// --- IMPORTACIÓN MASIVA ---

exports.importarCSV = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const fs = require('fs');
    const client = await db.pool.connect();
    
    try {
        const content = fs.readFileSync(req.file.path, 'utf8');
        const lines = content.split('\n');
        const dataRows = lines.slice(1); // Omitir header
        
        let procesados = 0;
        let errores = [];

        await client.query('BEGIN');

        for (const line of dataRows) {
            if (!line.trim()) continue;
            const parts = line.split(',');
            if (parts.length < 15) continue;

            const [id, full_name, dob, curp, rfc, nss, reg_pat, prest, ingreso, sd, sdi, puesto, depto, nomina, contrato] = parts.map(p => p.trim());
            if (!id || !full_name) continue;

            // 1. Manejo de Departamento (AUTO-CREAR)
            let deptoId;
            const resDepto = await client.query('SELECT id FROM rh_departamentos WHERE nombre = $1', [depto]);
            if (resDepto.rows.length === 0) {
                const newDepto = await client.query('INSERT INTO rh_departamentos (nombre) VALUES ($1) RETURNING id', [depto]);
                deptoId = newDepto.rows[0].id;
            } else {
                deptoId = resDepto.rows[0].id;
            }

            // 2. Manejo de Puesto (NO AUTO-CREAR)
            const resPuesto = await client.query('SELECT id FROM rh_puestos WHERE nombre = $1 AND departamento_id = $2', [puesto, deptoId]);
            if (resPuesto.rows.length === 0) {
                errores.push(`Empleado ${id}: Puesto "${puesto}" no existe en depto "${depto}"`);
                continue; // Saltar este registro
            }
            const puestoId = resPuesto.rows[0].id;

            // 3. Procesar Nombre
            const nameParts = full_name.split(' ');
            const first_name = nameParts[0];
            const last_name = nameParts.slice(1).join(' ');

            const formatD = (d) => {
                if(!d || !d.includes('/')) return null;
                const [dd, mm, yyyy] = d.split('/');
                return `${yyyy}-${mm}-${dd}`;
            };

            // 4. Upsert Empleado
            await client.query(`
                INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, fecha_ingreso, estado)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET 
                    nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos, curp = EXCLUDED.curp, rfc = EXCLUDED.rfc,
                    puesto_id = EXCLUDED.puesto_id, fecha_ingreso = EXCLUDED.fecha_ingreso, fecha_nac = EXCLUDED.fecha_nac
            `, [id, first_name, last_name, formatD(dob), curp, rfc, puestoId, formatD(ingreso), 'Activo']);

            // 5. Upsert Nómina
            await client.query(`
                INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (empleado_id) DO UPDATE SET
                    nss = EXCLUDED.nss, reg_patronal = EXCLUDED.reg_patronal, tipo_prestaciones = EXCLUDED.tipo_prestaciones,
                    salario_diario = EXCLUDED.salario_diario, sdi = EXCLUDED.sdi, nomina_asignada = EXCLUDED.nomina_asignada,
                    tipo_contrato = EXCLUDED.tipo_contrato
            `, [id, nss, reg_pat, prest, parseFloat(sd) || 0, parseFloat(sdi) || 0, nomina, contrato]);

            // 6. Asegurar detalles
            await client.query('INSERT INTO rh_empleados_detalles (empleado_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);

            procesados++;
        }

        await client.query('COMMIT');
        
        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);

        res.json({ 
            message: 'Importación terminada', 
            procesados, 
            errores: errores.length > 0 ? errores : null 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error en importarCSV:', err);
        res.status(500).json({ error: 'Error durante la importación: ' + err.message });
    } finally {
        client.release();
    }
};

exports.exportarCSV = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const path = require('path');
        const fs = require('fs');

        const query = `
            SELECT 
                e.id, e.nombre, e.apellidos, e.fecha_nac, e.curp, e.rfc, 
                n.nss, n.reg_patronal, n.tipo_prestaciones, e.fecha_ingreso,
                n.salario_diario, n.sdi, p.nombre as puesto, d.nombre as departamento,
                n.nomina_asignada, n.tipo_contrato
            FROM rh_empleados e
            LEFT JOIN rh_empleados_nomina n ON e.id = n.empleado_id
            LEFT JOIN rh_puestos p ON e.puesto_id = p.id
            LEFT JOIN rh_departamentos d ON p.departamento_id = d.id
            ORDER BY e.id ASC
        `;
        const { rows } = await db.query(query);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Empleados');

        // 1. Logotipo
        const logoPath = path.join(process.cwd(), 'public/assets/images/logo-demo.jpg');
        if (fs.existsSync(logoPath)) {
            const logo = workbook.addImage({
                filename: logoPath,
                extension: 'jpeg',
            });
            sheet.addImage(logo, {
                tl: { col: 0.1, row: 0.1 },
                ext: { width: 140, height: 100 }
            });
        }

        // 2. Títulos Principales (Movidos un poco a la derecha y abajo)
        sheet.mergeCells('D2:M2');
        const title1 = sheet.getCell('D2');
        title1.value = 'ANDAMIOS Y PROYECTOS TORRES, S.A. DE C.V.';
        title1.font = { name: 'Arial', size: 16, bold: true };
        title1.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.mergeCells('D3:M3');
        const title2 = sheet.getCell('D3');
        title2.value = 'BASE DE DATOS EMPLEADOS';
        title2.font = { name: 'Arial', size: 12, bold: true };
        title2.alignment = { vertical: 'middle', horizontal: 'center' };

        // 3. Espacio considerable para el logo (4 filas vacías)
        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);

        // 4. Encabezados de Tabla (Ahora empezarán en la fila 6 o 7 aprox)
        const headers = [
            'ID', 'NOMBRE', 'FECHA NAC.', 'CURP', 'RFC', 'NSS', 'REGISTRO PATRONAL', 
            'TIPO DE PRESTACIONES', 'FECHA DE INGRESO', 'SALARIO DIARIO ACTUAL', 
            'SALARIO DIARIO INTEGRADO', 'PUESTO', 'DEPARTAMENTO', 'NOMINA ASIGNADA', 'TIPO DE CONTRATO'
        ];
        const headerRow = sheet.addRow(headers);
        
        // Estilo de Encabezados (Verde oscuro, Estilo medio 4)
        headerRow.height = 30; // Más alto para elegancia
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF375623' } // Verde Oscuro Estándar Excel
            };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });

        // 5. Datos
        rows.forEach((r, index) => {
            const rowData = [
                r.id,
                `${r.nombre} ${r.apellidos || ''}`.trim(),
                r.fecha_nac ? new Date(r.fecha_nac) : '',
                r.curp,
                r.rfc,
                r.nss,
                r.reg_patronal,
                r.tipo_prestaciones,
                r.fecha_ingreso ? new Date(r.fecha_ingreso) : '',
                r.salario_diario,
                r.sdi,
                r.puesto,
                r.departamento,
                r.nomina_asignada,
                r.tipo_contrato
            ];
            const newRow = sheet.addRow(rowData);
            newRow.height = 20;

            // Estilo de datos (Cebreado Medio 4)
            const isGray = index % 2 === 1;
            newRow.eachCell((cell) => {
                if (isGray) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE2EFDA' } // Verde pálido Estándar Excel
                    };
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
                };
                cell.alignment = { vertical: 'middle' };
            });
            
            // Formatos de fecha y número
            newRow.getCell(3).numFmt = 'dd/mm/yyyy';
            newRow.getCell(9).numFmt = 'dd/mm/yyyy';
            newRow.getCell(10).numFmt = '"$"#,##0.00';
            newRow.getCell(11).numFmt = '"$"#,##0.00';
            
            // Centrar ID y fechas
            newRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            newRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            newRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Auto-filtros (Ajustar fila según nueva posición)
        const headerRowNumber = headerRow.number;
        sheet.autoFilter = { from: `A${headerRowNumber}`, to: `O${headerRowNumber}` };

        sheet.columns.forEach(column => {
            column.width = 22; // Un poco más de ancho para legibilidad
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=empleados_torres_2026.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error en exportarExcel:', err);
        res.status(500).json({ error: 'Error al generar el Excel: ' + err.message });
    }
};
