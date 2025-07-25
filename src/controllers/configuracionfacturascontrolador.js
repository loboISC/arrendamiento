// src/controllers/configuracionFacturacionController.js
const { ConfiguracionFacturacion } = require('../models');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENCRYPTION_KEY = process.env.CSD_ENCRYPT_KEY || 'clave-secreta-32bytes!'; // 32 bytes para AES-256
const IV = Buffer.alloc(16, 0); // Vector de inicialización

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(ENCRYPTION_KEY), IV);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
function decrypt(text) {
  const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(ENCRYPTION_KEY), IV);
  return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
}

exports.getConfiguracion = async (req, res) => {
  const config = await ConfiguracionFacturacion.findOne({ order: [['id', 'DESC']] });
  if (!config) return res.json({});
  const { csd_password_encrypted, ...safeConfig } = config.toJSON();
  res.json(safeConfig);
};

exports.saveConfiguracion = async (req, res) => {
  const { rfc, razon_social, regimen_fiscal, codigo_postal } = req.body;
  if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal) {
    return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
  }
  if (!req.files.csd_cer || !req.files.csd_key) {
    return res.status(400).json({ success: false, error: 'Archivos CSD requeridos.' });
  }
  const csd_cer_path = req.files.csd_cer[0].path;
  const csd_key_path = req.files.csd_key[0].path;
  const csd_password_encrypted = encrypt(req.body.csd_password);
  await ConfiguracionFacturacion.create({
    rfc, razon_social, regimen_fiscal, codigo_postal,
    csd_cer_path, csd_key_path, csd_password_encrypted
  });
  res.json({ success: true, message: 'Configuración guardada correctamente.' });
};

exports.probarCSD = async (req, res) => {
  if (!req.files.csd_cer || !req.files.csd_key || !req.body.csd_password) {
    return res.status(400).json({ success: false, error: 'Archivos y contraseña requeridos.' });
  }
  try {
    const cerPath = req.files.csd_cer[0].path;
    const keyPath = req.files.csd_key[0].path;
    const password = req.body.csd_password;
    await csd.validate({
      cerPath,
      keyPath,
      password
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, error: 'CSD inválido o contraseña incorrecta.' });
  }
};


