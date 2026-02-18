const bcrypt = require('bcrypt');
const db = require('../db/index');

async function emergencyReset() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Uso: node src/scripts/emergency-reset.js <correo> <nueva_password>');
        process.exit(1);
    }

    const [correo, nuevaPassword] = args;

    try {
        console.log(`Iniciando reset de emergencia para: ${correo}...`);

        const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

        const result = await db.query(
            'UPDATE usuarios SET password_hash = $1, estado = \'Activo\' WHERE correo = $2 RETURNING id_usuario, nombre',
            [hashedPassword, correo]
        );

        if (result.rowCount === 0) {
            console.error('ERROR: No se encontró ningún usuario con ese correo.');
            process.exit(1);
        }

        console.log('--------------------------------------------------');
        console.log('¡ÉXITO! Protocolo de Emergencia CLI completado.');
        console.log(`Usuario: ${result.rows[0].nombre} (${correo})`);
        console.log('La contraseña ha sido actualizada y el usuario activado.');
        console.log('--------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('FATAL: Error durante el reset de emergencia:', error);
        process.exit(1);
    }
}

emergencyReset();
