// src/controllers/configuracionFacturacionController.js
const db = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Credential } = require('@nodecfdi/credentials');

const { encrypt, decrypt } = require('../utils/encryption');

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

    // Validar que el RFC del certificado coincida con el emisor (opcional pero recomendado)
    // const rfcCertificado = credential.certificate().rfc();

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

      // Si no hay rfc en el body, es una actualización de CSD para un emisor existente
      if (!rfc) {
        const result = await db.query(
          'SELECT rfc FROM configuracion_facturacion ORDER BY fecha_actualizacion DESC LIMIT 1'
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Primero debes guardar los datos del emisor antes de subir los archivos CSD.'
          });
        }

        const existingRfc = result.rows[0].rfc;
        await db.query(
          'UPDATE configuracion_facturacion SET csd_cer_path = $1, csd_key_path = $2, csd_password_encrypted = $3, fecha_actualizacion = CURRENT_TIMESTAMP WHERE rfc = $4',
          [csd_cer_path, csd_key_path, csd_password_encrypted, existingRfc]
        );

        res.json({
          success: true,
          message: 'Archivos CSD validados y guardados correctamente.',
          data: certData
        });
      } else {
        // Guardar todo un nuevo registro (o actualizar si el RFC ya existe)
        await db.query(
          `INSERT INTO configuracion_facturacion (rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (rfc) DO UPDATE SET 
            razon_social = EXCLUDED.razon_social,
            regimen_fiscal = EXCLUDED.regimen_fiscal,
            codigo_postal = EXCLUDED.codigo_postal,
            csd_cer_path = EXCLUDED.csd_cer_path,
            csd_key_path = EXCLUDED.csd_key_path,
            csd_password_encrypted = EXCLUDED.csd_password_encrypted,
            fecha_actualizacion = CURRENT_TIMESTAMP`,
          [rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer_path, csd_key_path, csd_password_encrypted]
        );

        res.json({
          success: true,
          message: 'Configuración de facturación y CSD guardados correctamente.',
          data: certData
        });
      }
    } else {
      // Caso: Guardar solo datos del emisor
      const { rfc, razon_social, regimen_fiscal, codigo_postal } = req.body;

      if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
      }

      await db.query(
        `INSERT INTO configuracion_facturacion (rfc, razon_social, regimen_fiscal, codigo_postal) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (rfc) DO UPDATE SET 
          razon_social = EXCLUDED.razon_social,
          regimen_fiscal = EXCLUDED.regimen_fiscal,
          codigo_postal = EXCLUDED.codigo_postal,
          fecha_actualizacion = CURRENT_TIMESTAMP`,
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


