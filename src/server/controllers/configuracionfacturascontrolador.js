// src/controllers/configuracionFacturacionController.js
const db = require('../../../database');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Credential } = require('@nodecfdi/credentials');

const { encrypt, decrypt } = require('../../utils/encryption');

exports.getConfiguracion = async (req, res) => {
  try {
    // Busca la configuración más reciente en la tabla emisores
    const result = await db.query(
      'SELECT rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, csd_password, activo FROM emisores ORDER BY id_emisor DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      const config = result.rows[0];
      let certData = null;

      // Si tiene archivos configurados, intentar extraer info actual
      if (config.csd_cer && config.csd_key && config.csd_password) {
        try {
          const cerPath = config.csd_cer;
          const keyPath = config.csd_key;
          const password = decrypt(config.csd_password);

          if (fs.existsSync(cerPath) && fs.existsSync(keyPath)) {
            const validation = await validarCSD(cerPath, keyPath, password);
            certData = validation.certificate;
          }
        } catch (certError) {
          console.warn('[CSD] No se pudo leer info del certificado existente:', certError.message);
        }
      }

      res.json({
        success: true,
        data: {
          rfc: config.rfc,
          razon_social: config.razon_social,
          regimen_fiscal: config.regimen_fiscal,
          codigo_postal: config.codigo_postal,
          csd_cer_path: config.csd_cer,
          csd_key_path: config.csd_key,
          certificate: certData,
          activo: config.activo
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

    // Obtener fechas de vigencia de forma segura
    const cert = credential.certificate();
    const vFrom = cert.validFrom();
    const vTo = cert.validTo();

    // Función auxiliar interna para extraer tiempo en ms de forma universal
    const getMs = (node) => {
      if (!node) return 0;
      if (typeof node.toMillis === 'function') return node.toMillis();
      if (typeof node.toJSDate === 'function') return node.toJSDate().getTime();
      const d = new Date(node);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Función auxiliar interna para extraer ISO string de forma universal
    const getIso = (node) => {
      if (!node) return null;
      if (typeof node.toISO === 'function') return node.toISO();
      if (typeof node.toISOString === 'function') return node.toISOString();
      const d = new Date(node);
      return isNaN(d.getTime()) ? String(node) : d.getTime() === 0 ? String(node) : d.toISOString();
    };

    // Validar expiración
    if (getMs(vTo) < Date.now()) {
      throw new Error('El certificado ha expirado.');
    }

    return {
      success: true,
      certificate: {
        rfc: cert.rfc(),
        legalName: cert.legalName(),
        serialNumber: cert.serialNumber().bytes(),
        validFrom: getIso(vFrom),
        validTo: getIso(vTo),
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

      // Upsert en tabla emisores (Lógica para un solo emisor)
      const checkRes = await db.query('SELECT id_emisor FROM emisores ORDER BY id_emisor DESC LIMIT 1');
      if (checkRes.rows.length > 0) {
        const id_emisor = checkRes.rows[0].id_emisor;
        await db.query(`
          UPDATE emisores SET 
              rfc = $1, 
              razon_social = $2, 
              regimen_fiscal = $3, 
              codigo_postal = $4, 
              csd_cer = $5, 
              csd_key = $6, 
              csd_password = $7, 
              activo = true
          WHERE id_emisor = $8
        `, [rfc || certData.rfc, razon_social || certData.legalName, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted, id_emisor]);
      } else {
        await db.query(`
          INSERT INTO emisores (rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, csd_password, activo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        `, [rfc || certData.rfc, razon_social || certData.legalName, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted]);
      }

      res.json({
        success: true,
        message: 'Configuración y CSD guardados correctamente.' + syncMessage,
        data: certData
      });

    } else {
      // Caso: Guardar solo datos del emisor
      const { rfc, razon_social, regimen_fiscal, codigo_postal } = req.body;

      if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
      }

      const checkRes = await db.query('SELECT id_emisor FROM emisores ORDER BY id_emisor DESC LIMIT 1');
      if (checkRes.rows.length > 0) {
        const id_emisor = checkRes.rows[0].id_emisor;
        await db.query(`
          UPDATE emisores SET 
              rfc = $1, 
              razon_social = $2, 
              regimen_fiscal = $3, 
              codigo_postal = $4, 
              activo = true
          WHERE id_emisor = $5
        `, [rfc, razon_social, regimen_fiscal, codigo_postal, id_emisor]);
      } else {
        await db.query(`
          INSERT INTO emisores (rfc, razon_social, regimen_fiscal, codigo_postal, activo)
          VALUES ($1, $2, $3, $4, true)
        `, [rfc, razon_social, regimen_fiscal, codigo_postal]);
      }

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


