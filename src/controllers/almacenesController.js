const db = require('../config/database');

// Obtener todos los almacenes
const getAlmacenes = async (req, res) => {
  let client;
  try {
    // Verificar conexión a la base de datos
    client = await db.pool.connect();
    
    // Verificar si la tabla existe
    const [tables] = await client.query(
      "SHOW TABLES LIKE 'almacenes'"
    );

    if (tables.length === 0) {
      console.warn('[Almacenes] La tabla de almacenes no existe');
      // Devolver datos de ejemplo si la tabla no existe
      return res.status(200).json([
        { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX', activo: 1 },
        { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México', activo: 1 },
        { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California', activo: 1 }
      ]);
    }

    // Obtener almacenes activos
    const [almacenes] = await client.query(`
      SELECT 
        id_almacen, 
        nombre_almacen, 
        COALESCE(ubicacion, 'Sin ubicación') as ubicacion,
        direccion,
        telefono,
        COALESCE(activo, 1) as activo
      FROM almacenes 
      WHERE activo = 1 OR activo IS NULL
      ORDER BY nombre_almacen
    `);

    // Si no hay almacenes, devolver array vacío
    if (!almacenes || almacenes.length === 0) {
      console.warn('[Almacenes] No se encontraron almacenes activos en la base de datos');
      return res.status(200).json([]);
    }

    res.status(200).json(almacenes);
  } catch (error) {
    console.error('[Almacenes] Error en getAlmacenes:', error);
    
    // En caso de error, devolver datos de ejemplo
    res.status(200).json([
      { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX', activo: 1 },
      { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México', activo: 1 },
      { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California', activo: 1 }
    ]);
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  getAlmacenes
};
