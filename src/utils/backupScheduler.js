const fs = require('fs');
const path = require('path');
const db = require('../db');
const { performBackup } = require('../controllers/backupController');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const PURGE_DAYS = 90; // El usuario pidió 3 meses (90 días)

async function runAutoPurge() {
    console.log('[Scheduler] Iniciando limpieza automática (Purge)...');
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - PURGE_DAYS);

        // Obtener respaldos antiguos de la base de datos
        const query = 'SELECT * FROM respaldos WHERE fecha_creacion < $1';
        const result = await db.query(query, [thresholdDate]);

        for (const backup of result.rows) {
            console.log(`[Scheduler] Eliminando respaldo antiguo: ${backup.nombre_archivo}`);

            // Eliminar archivo físico
            if (fs.existsSync(backup.ruta)) {
                try {
                    fs.unlinkSync(backup.ruta);
                } catch (e) {
                    console.error(`[Scheduler] Error al borrar archivo ${backup.ruta}:`, e);
                }
            }

            // Eliminar registro de la base de datos
            await db.query('DELETE FROM respaldos WHERE id = $1', [backup.id]);
        }
        console.log('[Scheduler] Limpieza completada.');
    } catch (error) {
        console.error('[Scheduler] Error en limpieza automática:', error);
    }
}

async function checkAndRunBackup() {
    console.log('[Scheduler] Verificando si toca respaldo automático...');
    try {
        const configRes = await db.query('SELECT respaldo_automatico, respaldo_frecuencia FROM configuracion_sistema WHERE id = 1');
        if (configRes.rows.length === 0 || !configRes.rows[0].respaldo_automatico) {
            console.log('[Scheduler] Respaldos automáticos desactivados.');
            return;
        }

        const { respaldo_frecuencia } = configRes.rows[0];

        // Obtener el último respaldo automático
        const lastBackupRes = await db.query(
            "SELECT fecha_creacion FROM respaldos WHERE tipo = 'automatico' ORDER BY fecha_creacion DESC LIMIT 1"
        );

        let shouldBackup = false;
        const now = new Date();

        if (lastBackupRes.rows.length === 0) {
            shouldBackup = true; // Primer respaldo
        } else {
            const lastDate = new Date(lastBackupRes.rows[0].fecha_creacion);
            const diffHours = (now - lastDate) / (1000 * 60 * 60);

            if (respaldo_frecuencia === 'Diario' && diffHours >= 24) shouldBackup = true;
            else if (respaldo_frecuencia === 'Semanal' && diffHours >= 168) shouldBackup = true;
            else if (respaldo_frecuencia === 'Mensual' && diffHours >= 720) shouldBackup = true;
        }

        if (shouldBackup) {
            console.log(`[Scheduler] Iniciando respaldo automático (${respaldo_frecuencia})...`);
            await performBackup();
            console.log('[Scheduler] Respaldo automático completado con éxito.');
        } else {
            console.log('[Scheduler] Aún no es tiempo del próximo respaldo.');
        }
    } catch (error) {
        console.error('[Scheduler] Error en verificación de respaldo:', error);
    }
}

function init() {
    console.log('[Scheduler] Servicio de automatización iniciado.');

    // Ejecutar inmediatamente al arrancar y luego cada hora
    checkAndRunBackup();
    runAutoPurge();

    // El intervalo es de 1 hora (3600000 ms)
    setInterval(() => {
        checkAndRunBackup();
    }, 3600000);

    // Limpieza diaria (cada 24 horas)
    setInterval(() => {
        runAutoPurge();
    }, 86400000);
}

module.exports = { init };
