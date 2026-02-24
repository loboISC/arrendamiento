const db = require('../db');

/**
 * Actualiza automáticamente el estado de contratos cuya fecha_fin
 * ya pasó y no están en estado 'Concluido' o 'Cancelado'.
 */
async function actualizarContratosVencidos() {
    console.log('[ContractScheduler] Verificando contratos vencidos...');
    try {
        const result = await db.query(`
            UPDATE contratos
            SET estado = 'Concluido'
            WHERE fecha_fin < CURRENT_DATE
              AND estado NOT IN ('Concluido', 'Cancelado')
            RETURNING id_contrato, numero_contrato, fecha_fin
        `);

        if (result.rowCount > 0) {
            console.log(`[ContractScheduler] ${result.rowCount} contrato(s) marcado(s) como Concluido:`);
            result.rows.forEach(c => {
                console.log(`  - ${c.numero_contrato} (vencido: ${c.fecha_fin})`);
            });
        } else {
            console.log('[ContractScheduler] Sin contratos vencidos pendientes.');
        }
    } catch (error) {
        console.error('[ContractScheduler] Error al actualizar contratos vencidos:', error);
    }
}

function init() {
    console.log('[ContractScheduler] Servicio de contratos iniciado.');

    // Ejecutar una vez al arrancar el servidor
    actualizarContratosVencidos();

    // Luego cada 24 horas (86 400 000 ms)
    setInterval(actualizarContratosVencidos, 86_400_000);
}

module.exports = { init, actualizarContratosVencidos };
