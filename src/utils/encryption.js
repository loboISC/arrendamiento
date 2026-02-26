// src/utils/encryption.js
const crypto = require('crypto');

// Generar una clave de 32 bytes para AES-256
const ENCRYPTION_KEY = process.env.CSD_ENCRYPT_KEY || 'mi-clave-secreta-de-32-bytes-12345';
// Asegurar que la clave tenga exactamente 32 bytes
const KEY_32_BYTES = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
const IV = Buffer.alloc(16, 0); // Vector de inicialización

function encrypt(text) {
    if (!text) return null;
    try {
        const cipher = crypto.createCipheriv('aes-256-ctr', KEY_32_BYTES, IV);
        return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    } catch (error) {
        console.error('Error encriptando:', error);
        throw error;
    }
}

function decrypt(text) {
    if (!text) return null;
    try {
        // Verificar si parece ser un hash hexadecimal (AES-256-CTR genera hex)
        // y tiene una longitud par mínima razonable. "default" tiene longitud 7 (impar).
        const isHex = /^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0;

        if (!isHex) {
            // Si no es hex, probablemente es texto plano heredado
            return text;
        }

        const decipher = crypto.createDecipheriv('aes-256-ctr', KEY_32_BYTES, IV);
        return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
    } catch (error) {
        console.warn('Error derivado en desencriptación (posible texto plano):', error.message);
        // Retornar el texto original como fallback para no romper el flujo
        return text;
    }
}

module.exports = { encrypt, decrypt };
