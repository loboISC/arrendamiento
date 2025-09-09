// src/controllers/configuracionFacturacionController.js
const db = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generar una clave de 32 bytes para AES-256
const ENCRYPTION_KEY = process.env.CSD_ENCRYPT_KEY || 'mi-clave-secreta-de-32-bytes-12345';
// Asegurar que la clave tenga exactamente 32 bytes
const KEY_32_BYTES = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
const IV = Buffer.alloc(16, 0); // Vector de inicialización

function encrypt(text) {
  try {
    const cipher = crypto.createCipheriv('aes-256-ctr', KEY_32_BYTES, IV);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  } catch (error) {
    console.error('Error encriptando:', error);
    throw error;
  }
}

function decrypt(text) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-ctr', KEY_32_BYTES, IV);
    return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error('Error desencriptando:', error);
    throw error;
  }
}

exports.getConfiguracion = async (req, res) => {
  try {
    // Busca la configuración más reciente
    const result = await db.query(
      'SELECT rfc, razon_social, regimen_fiscal, codigo_postal FROM configuracion_facturacion ORDER BY fecha_actualizacion DESC LIMIT 1'
    );
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0]
      });
    } else {
      res.json({
        success: true,
        data: {}
      });
    }
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.saveConfiguracion = async (req, res) => {
  try {
    console.log('Datos recibidos:', {
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'No files'
    });

    // Verificar si hay archivos CSD
    const hasCSDFiles = req.files && req.files.csd_cer && req.files.csd_key;
    
    if (hasCSDFiles) {
      // Caso: Guardar con archivos CSD
      const { rfc, razon_social, regimen_fiscal, codigo_postal, csd_password } = req.body;
      
      // Si no hay datos del emisor, intentar obtenerlos de la base de datos
      if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
        const result = await db.query(
          'SELECT rfc, razon_social, regimen_fiscal, codigo_postal FROM configuracion_facturacion ORDER BY fecha_actualizacion DESC LIMIT 1'
        );
        
        if (result.rows.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Primero debes guardar los datos del emisor antes de subir los archivos CSD.' 
          });
        }
        
        // Usar los datos existentes del emisor
        const existingData = result.rows[0];
        const csd_cer_path = req.files.csd_cer[0].path;
        const csd_key_path = req.files.csd_key[0].path;
        const csd_password_encrypted = encrypt(csd_password);
        
        // Actualizar la configuración existente con los archivos CSD
        await db.query(
          'UPDATE configuracion_facturacion SET csd_cer_path = $1, csd_key_path = $2, csd_password_encrypted = $3, fecha_actualizacion = CURRENT_TIMESTAMP WHERE rfc = $4',
          [csd_cer_path, csd_key_path, csd_password_encrypted, existingData.rfc]
        );
        
        res.json({ success: true, message: 'Archivos CSD guardados correctamente.' });
      } else {
        // Caso: Guardar datos del emisor + archivos CSD
        const csd_cer_path = req.files.csd_cer[0].path;
        const csd_key_path = req.files.csd_key[0].path;
        const csd_password_encrypted = encrypt(csd_password);
        
        await db.query(
          'INSERT INTO configuracion_facturacion (rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted]
        );
        
        res.json({ success: true, message: 'Configuración completa guardada correctamente.' });
      }
    } else {
      // Caso: Guardar solo datos del emisor (sin archivos CSD)
      const { rfc, razon_social, regimen_fiscal, codigo_postal } = req.body;
      
      // Validar campos obligatorios
      if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
      }
      
      await db.query(
        'INSERT INTO configuracion_facturacion (rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted) VALUES ($1, $2, $3, $4, NULL, NULL, NULL)',
        [rfc, razon_social, regimen_fiscal, codigo_postal]
      );
      
      res.json({ success: true, message: 'Datos del emisor guardados correctamente.' });
    }
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor: ' + error.message });
  }
};

exports.probarCSD = async (req, res) => {
  if (!req.files.csd_cer || !req.files.csd_key || !req.body.csd_password) {
    return res.status(400).json({ success: false, error: 'Archivos y contraseña requeridos.' });
  }
  try {
    const cerPath = req.files.csd_cer[0].path;
    const keyPath = req.files.csd_key[0].path;
    const password = req.body.csd_password;
    
    // Aquí puedes agregar validación real del CSD
    // Por ahora simulamos que es válido
    console.log('Validando CSD:', { cerPath, keyPath, password });
    
    return res.json({ success: true, message: 'CSD válido' });
  } catch (err) {
    console.error('Error al validar CSD:', err);
    return res.status(400).json({ success: false, error: 'CSD inválido o contraseña incorrecta.' });
  }
};


