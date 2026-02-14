// src/controllers/configuracionFacturacionController.js
const db = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Credential } = require('@nodecfdi/credentials');

const { encrypt, decrypt } = require('../utils/encryption');

exports.getConfiguracion = async (req, res) => {
  try {
    // Busca la configuración más reciente en la tabla emisores
    const result = await db.query(
      'SELECT rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, activo FROM emisores ORDER BY id_emisor DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      // Mapear nombres de columnas si es necesario para el frontend
      const config = result.rows[0];
      res.json({
        success: true,
        data: {
          rfc: config.rfc,
          razon_social: config.razon_social,
          regimen_fiscal: config.regimen_fiscal,
          codigo_postal: config.codigo_postal,
          csd_cer_path: config.csd_cer, // El frontend espera csd_cer_path, aunque en DB es csd_cer
          csd_key_path: config.csd_key
        }
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

/**
 * Valida los archivos CSD usando @nodecfdi/credentials
 */
async function validarCSD(cerPath, keyPath, password) {
  try {
    const credential = Credential.openFiles(cerPath, keyPath, password);

    // Validar que el certificado no haya expirado
    if (credential.certificate().isExpired()) {
      throw new Error('El certificado ha expirado.');
    }

    return {
      success: true,
      certificate: {
        rfc: credential.certificate().rfc(),
        legalName: credential.certificate().legalName(),
        serialNumber: credential.certificate().serialNumber().bytes(),
        validFrom: credential.certificate().validFrom().format(),
        validTo: credential.certificate().validTo().format(),
      }
    };
  } catch (err) {
    console.error('Error en validación CSD:', err.message);
    throw new Error('Certificado, llave privada o contraseña incorrectos: ' + err.message);
  }
}

const { uploadCsdToFacturama } = require('../services/facturamaservice');

exports.saveConfiguracion = async (req, res) => {
  try {
    // Verificar si hay archivos CSD
    const hasCSDFiles = req.files && req.files.csd_cer && req.files.csd_key;

    if (hasCSDFiles) {
      const { rfc, razon_social, regimen_fiscal, codigo_postal, csd_password } = req.body;
      const csd_cer_path = req.files.csd_cer[0].path;
      const csd_key_path = req.files.csd_key[0].path;

      // VALIDACIÓN REAL con @nodecfdi/credentials
      let certData = null;
      try {
        const validation = await validarCSD(csd_cer_path, csd_key_path, csd_password);
        certData = validation.certificate;
      } catch (validationError) {
        // Eliminar archivos si la validación falla
        if (fs.existsSync(csd_cer_path)) fs.unlinkSync(csd_cer_path);
        if (fs.existsSync(csd_key_path)) fs.unlinkSync(csd_key_path);
        return res.status(400).json({ success: false, error: validationError.message });
      }

      const csd_password_encrypted = encrypt(csd_password);

      // --- SINCRONIZACIÓN CON FACTURAMA (MULTI-EMISOR) ---
      let syncMessage = '';
      try {
        const targetRfc = rfc || certData.rfc;
        await uploadCsdToFacturama(targetRfc, csd_cer_path, csd_key_path, csd_password);
        syncMessage = ' Sincronizado con Facturama.';
      } catch (facturamaError) {
        console.warn('[Facturama] Error de sincronización:', facturamaError.message);
        syncMessage = ' Error al sincronizar con Facturama: ' + facturamaError.message;
      }

      // Upsert en tabla emisores
      // Si no hay rfc explícito en body, tratamos de actualizar el existente
      if (!rfc) {
        const result = await db.query('SELECT id_emisor FROM emisores ORDER BY id_emisor DESC LIMIT 1');
        if (result.rows.length > 0) {
          const id_emisor = result.rows[0].id_emisor;
          await db.query(
            `UPDATE emisores SET 
                    csd_cer = $1, 
                    csd_key = $2, 
                    csd_password = $3 
                WHERE id_emisor = $4`,
            [csd_cer_path, csd_key_path, csd_password_encrypted, id_emisor]
          );
        } else {
          return res.status(400).json({ success: false, error: 'No existe emisor configurado para actualizar sellos.' });
        }
      } else {
        // Insertar o actualizar por RFC
        await db.query(`
            INSERT INTO emisores (rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, csd_password, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            ON CONFLICT (rfc) DO UPDATE SET
                razon_social = EXCLUDED.razon_social,
                regimen_fiscal = EXCLUDED.regimen_fiscal,
                codigo_postal = EXCLUDED.codigo_postal,
                csd_cer = EXCLUDED.csd_cer,
                csd_key = EXCLUDED.csd_key,
                csd_password = EXCLUDED.csd_password,
                activo = true
          `, [rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted]);
      }

      res.json({
        success: true,
        message: 'Configuración y CSD guardados correctamente en emisores.' + syncMessage,
        data: certData
      });

    } else {
      // Caso: Guardar solo datos del emisor
      const { rfc, razon_social, regimen_fiscal, codigo_postal } = req.body;

      if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
      }

      await db.query(`
        INSERT INTO emisores (rfc, razon_social, regimen_fiscal, codigo_postal, activo)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (rfc) DO UPDATE SET
            razon_social = EXCLUDED.razon_social,
            regimen_fiscal = EXCLUDED.regimen_fiscal,
            codigo_postal = EXCLUDED.codigo_postal,
            activo = true
      `, [rfc, razon_social, regimen_fiscal, codigo_postal]);

      res.json({ success: true, message: 'Datos del emisor guardados correctamente.' });
    }
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor: ' + error.message });
  }
};

exports.probarCSD = async (req, res) => {
  if (!req.files || !req.files.csd_cer || !req.files.csd_key || !req.body.csd_password) {
    return res.status(400).json({ success: false, error: 'Archivos (.cer, .key) y contraseña requeridos.' });
  }

  const cerPath = req.files.csd_cer[0].path;
  const keyPath = req.files.csd_key[0].path;
  const password = req.body.csd_password;

  try {
    const result = await validarCSD(cerPath, keyPath, password);

    // Si la validación pasa, devolvemos info útil
    return res.json({
      success: true,
      message: 'CSD válido y contraseña correcta.',
      data: result.certificate
    });
  } catch (err) {
    // Si falla, eliminamos los archivos temporales subidos por probar-csd
    if (fs.existsSync(cerPath)) fs.unlinkSync(cerPath);
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);

    return res.status(400).json({ success: false, error: err.message });
  }
};


