const crypto = require('crypto');

// Obtener clave de encriptación (debe ser 32 bytes = 64 caracteres hex)
function getEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
        return envKey;
    }
    // Clave por defecto para desarrollo (cambiar en producción)
    return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
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
        console.error('Error descifrando contraseña:', err);
        // Si falla, retornar la contraseña tal cual
        return contrasena_cifrada;
    }
}

module.exports = {
    cifrarContrasena,
    descifrarContrasena
};
