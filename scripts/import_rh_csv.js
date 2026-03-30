const fs = require('fs');
const path = require('path');
const { query } = require('../src/server/config/database');

async function importRH() {
    console.log('--- Iniciando Importación de RH ---');
    const csvPath = path.join(__dirname, '../BASE DE DATOS EMPLEADOS_2026.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    
    // Headers: ID,NOMBRE,FECHA NAC.,CURP,RFC,NSS,REGISTRO PATRONAL,TIPO DE PRESTACIONES,FECHA DE INGRESO,SALARIO DIARIO ACTUAL,SALARIO DIARIO INTEGRADO,PUESTO,DEPARTAMENTO,NOMINA ASIGNADA,TIPO DE CONTRATO
    const dataRows = lines.slice(1);
    let imported = 0;

    for (const line of dataRows) {
        if (!line.trim()) continue;
        
        // Split manual para evitar CSV-parsing dependencies
        const parts = line.split(',');
        if (parts.length < 15) continue;

        const [id, full_name, dob, curp, rfc, nss, reg_pat, prest, ingreso, sd, sdi, puesto, depto, nomina, contrato] = parts.map(p => p.trim());

        if (!id || !full_name) continue;

        try {
            // 1. Manejo de Departamento
            let deptoResult = await query('SELECT id FROM rh_departamentos WHERE nombre = $1', [depto]);
            let deptoId;
            if (deptoResult.rows.length === 0) {
                const newDepto = await query('INSERT INTO rh_departamentos (nombre) VALUES ($1) RETURNING id', [depto]);
                deptoId = newDepto.rows[0].id;
            } else {
                deptoId = deptoResult.rows[0].id;
            }

            // 2. Manejo de Puesto
            let puestoResult = await query('SELECT id FROM rh_puestos WHERE nombre = $1 AND departamento_id = $2', [puesto, deptoId]);
            let puestoId;
            if (puestoResult.rows.length === 0) {
                const newPuesto = await query('INSERT INTO rh_puestos (nombre, departamento_id) VALUES ($1, $2) RETURNING id', [puesto, deptoId]);
                puestoId = newPuesto.rows[0].id;
            } else {
                puestoId = puestoResult.rows[0].id;
            }

            // 3. Procesar Nombre (Separar del apellido)
            const nameParts = full_name.split(' ');
            const first_name = nameParts[0];
            const last_name = nameParts.slice(1).join(' ');

            // 4. Formatear Fechas (DD/MM/YYYY -> YYYY-MM-DD)
            const formatD = (d) => {
                if(!d || !d.includes('/')) return null;
                const [dd, mm, yyyy] = d.split('/');
                return `${yyyy}-${mm}-${dd}`;
            };

            // 5. Insertar Empleado Principal
            await query(`
                INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, puesto_id, fecha_ingreso, estado)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET 
                    nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos, curp = EXCLUDED.curp, rfc = EXCLUDED.rfc
            `, [id, first_name, last_name, formatD(dob), curp, rfc, puestoId, formatD(ingreso), 'Activo']);

            // 6. Insertar Nómina
            await query(`
                INSERT INTO rh_empleados_nomina (empleado_id, nss, reg_patronal, tipo_prestaciones, salario_diario, sdi, nomina_asignada, tipo_contrato)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (empleado_id) DO UPDATE SET
                    nss = EXCLUDED.nss, salario_diario = EXCLUDED.salario_diario, sdi = EXCLUDED.sdi
            `, [id, nss, reg_pat, prest, parseFloat(sd) || 0, parseFloat(sdi) || 0, nomina, contrato]);

            // 7. Insertar Detalles Vacíos
            await query(`
                INSERT INTO rh_empleados_detalles (empleado_id)
                VALUES ($1) ON CONFLICT DO NOTHING
            `, [id]);

            imported++;
            if (imported % 10 === 0) console.log(`Cargados: ${imported}...`);

        } catch (err) {
            console.error(`Error importando ID ${id}:`, err.message);
        }
    }

    console.log(`--- Importación Finalizada: ${imported} registros procesados ---`);
    process.exit(0);
}

importRH();
