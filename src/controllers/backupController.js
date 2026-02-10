const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Detectar si estamos en Linux (Docker/NAS) o Windows
const isLinux = process.platform === 'linux';
const PG_DUMP_PATH = isLinux ? 'pg_dump' : 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Función interna para realizar el respaldo (compartida entre manual y automático)
async function performBackup(userId = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);
    const zipName = `${fileName}.zip`;
    const zipPath = path.join(BACKUP_DIR, zipName);

    // Configuración desde DATABASE_URL o variables individuales
    let host = process.env.DB_HOST || '192.168.100.5';
    let port = process.env.DB_PORT || '5433';
    let database = process.env.DB_NAME || 'torresdb';
    let user = process.env.DB_USER || 'postgres';
    let password = process.env.DB_PASSWORD || 'irving';

    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            host = url.hostname;
            port = url.port || '5432';
            database = url.pathname.split('/')[1];
            user = url.username;
            password = url.password;
        } catch (e) { }
    }

    // Comando de pg_dump adaptable por plataforma
    const command = isLinux
        ? `PGPASSWORD="${password}" "${PG_DUMP_PATH}" -h ${host} -p ${port} -U ${user} -d ${database} -f "${filePath}"`
        : `set PGPASSWORD=${password}&& "${PG_DUMP_PATH}" -h ${host} -p ${port} -U ${user} -d ${database} -f "${filePath}"`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error al ejecutar pg_dump:', stderr);
                return reject(new Error('Error al generar respaldo de base de datos'));
            }

            // Comando de compresión adaptable
            const zipCommand = isLinux
                ? `zip -j "${zipPath}" "${filePath}"`
                : `powershell Compress-Archive -Path "${filePath}" -DestinationPath "${zipPath}" -Force`;

            exec(zipCommand, async (zipErr) => {
                if (!zipErr) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                }

                const finalFile = zipErr ? fileName : zipName;
                const finalPath = zipErr ? filePath : zipPath;
                const stats = fs.statSync(finalPath);

                try {
                    const query = `
                        INSERT INTO respaldos (nombre_archivo, ruta, tamano, tipo, creado_por)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING *
                    `;
                    const tipoRespaldo = userId ? 'manual' : 'automatico';
                    const result = await db.query(query, [finalFile, finalPath, stats.size, tipoRespaldo, userId]);
                    resolve(result.rows[0]);
                } catch (dbErr) {
                    console.error('Error al registrar respaldo en DB:', dbErr);
                    reject(dbErr);
                }
            });
        });
    });
}

exports.performBackup = performBackup;

// Crear respaldo manual
exports.createBackup = async (req, res) => {
    const userId = req.user ? req.user.id_usuario : null;
    try {
        const result = await performBackup(userId);
        res.json({ success: true, message: 'Respaldo creado exitosamente', backup: result });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Error al generar respaldo' });
    }
};

// Listar historial de respaldos
exports.listBackups = async (req, res) => {
    try {
        const result = await db.query('SELECT r.*, u.nombre as creado_por_nombre FROM respaldos r LEFT JOIN usuarios u ON r.creado_por = u.id_usuario ORDER BY r.fecha_creacion DESC LIMIT 20');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar respaldos:', error);
        res.status(500).json({ error: 'Error al obtener historial de respaldos' });
    }
};

// Descargar archivo de respaldo
exports.downloadBackup = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM respaldos WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Respaldo no encontrado' });

        const backup = result.rows[0];
        if (!fs.existsSync(backup.ruta)) return res.status(404).json({ error: 'El archivo físico no existe' });

        res.download(backup.ruta, backup.nombre_archivo);
    } catch (error) {
        console.error('Error al descargar respaldo:', error);
        res.status(500).json({ error: 'Error al procesar descarga' });
    }
};
