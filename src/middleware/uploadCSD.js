// src/middleware/uploadCSD.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'csd_files/'); // Carpeta segura fuera del webroot
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'csd_cer' && path.extname(file.originalname) !== '.cer') return cb(null, false);
    if (file.fieldname === 'csd_key' && path.extname(file.originalname) !== '.key') return cb(null, false);
    cb(null, true);
  }
});

module.exports = upload;