const crypto = require('crypto');

// Obtener clave de encriptación (debe ser 32 bytes = 64 caracteres hex)
function getEncryptionKey() {
    // Buscar la clave en las variables de entorno (usamos la que está en el .env)
    const envKey = process.env.CSD_ENCRYPT_KEY || process.env.ENCRYPTION_KEY;

    // Si la clave existe y tiene el formato hex de 32 bytes (64 chars) o es la de 32 chars
    if (envKey) {
        return envKey.padEnd(64, '0').substring(0, 64);
    }
    // Clave por defecto para desarrollo (64 caracteres hex)
    const finalKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    console.log(`[smtpEncryption] Usando llave de seguridad que empieza en: ${finalKey.substring(0, 4)}...`);
    return finalKey;
}

// Cifrar contraseña (usa AES-256-CBC)
function cifrarContrasena(contrasena) {
    const algoritmo = 'aes-256-cbc';
    const clave = getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algoritmo, Buffer.from(clave, 'hex'), iv);
    let cifrado = cipher.update(contrasena, 'utf8', 'hex');
    cifrado += cipher.final('hex');

    return iv.toString('hex') + ':' + cifrado;
}

// Descifrar contraseña
function descifrarContrasena(contrasena_cifrada) {
    try {
        const algoritmo = 'aes-256-cbc';
        const clave = getEncryptionKey();
        const partes = contrasena_cifrada.split(':');

        if (partes.length !== 2) {
            throw new Error('Formato de contraseña cifrada inválido');
        }

        const iv = Buffer.from(partes[0], 'hex');
        const cifrado = partes[1];

        const decipher = crypto.createDecipheriv(algoritmo, Buffer.from(clave, 'hex'), iv);
        let descifrado = decipher.update(cifrado, 'hex', 'utf8');
        descifrado += decipher.final('utf8');

        return descifrado;
    } catch (err) {
        console.error('❌ ERROR FATAL DESCIFRANDO CONTRASEÑA:', err.message);
        console.error('Si ves este error, Hostinger rechazará el login porque recibirá basura hexadecimal.');
        // Si falla, retornar la contraseña tal cual
        return contrasena_cifrada;
    }
}

module.exports = {
    cifrarContrasena,
    descifrarContrasena
};
