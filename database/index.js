/**
 * Puente Versátil para la Base de Datos
 * Este archivo permite que los requiere a '../../../database' (viejos) 
 * apunten automáticamente a 'src/server/config/database.js' (nuevo).
 */
const path = require('path');

try {
  // Intentamos cargar la configuración real del pool
  module.exports = require('../src/server/config/database');
} catch (error) {
  console.error('[Database Bridge] Fallo al cargar database.js desde el puente:', error.message);
  // Fallback desesperado si la estructura fuera distinta en el NAS
  throw error;
}
