const db = require('../db');

// --- Helpers para imágenes (similares a usuarios.js) ---
const toDataURL = (dbData) => {
  if (dbData instanceof Buffer) {
    return `data:image/jpeg;base64,${dbData.toString('base64')}`;
  }
  if (typeof dbData === 'string' && dbData.startsWith('data:image')) {
    return dbData;
  }
  return null;
};

const toBuffer = (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return null;
  }
  return Buffer.from(dataUrl.split(',')[1], 'base64');
};

// --- CRUD para Inventario ---

// CREATE: Añadir un nuevo producto al inventario
exports.create = async (req, res) => {
  const {
    nombre, clave, peso, descripcion, precio_unitario, garantia, importe, imagen, venta, renta, stock, categoria, ubicacion, condicion
  } = req.body;

  try {
    const photoBuffer = toBuffer(imagen);
    const { rows } = await db.query(
      `INSERT INTO equipos (nombre, clave, peso, descripcion, precio_unitario, garantia, importe, imagen, venta, renta, stock, categoria, ubicacion, condicion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [nombre, clave, peso, descripcion, precio_unitario, garantia, importe, photoBuffer, venta, renta, stock, categoria, ubicacion, condicion]
    );
    const nuevoProducto = { ...rows[0], imagen: toDataURL(rows[0].imagen) };
    res.status(201).json(nuevoProducto);
  } catch (err) {
    console.error('Error al crear producto de inventario:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: `La clave de producto '${clave}' ya existe.` });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// READ: Obtener todos los productos del inventario
exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM equipos ORDER BY nombre ASC');
    const productos = rows.map(p => ({ ...p, imagen: toDataURL(p.imagen) }));
    res.json(productos);
  } catch (err) {
    console.error('Error al obtener inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// READ ONE: Obtener un producto por su ID
exports.getOne = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query('SELECT * FROM equipos WHERE id_equipo = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        const producto = { ...rows[0], imagen: toDataURL(rows[0].imagen) };
        res.json(producto);
    } catch (err) {
        console.error(`Error al obtener producto ${id}:`, err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// UPDATE: Actualizar un producto del inventario
exports.update = async (req, res) => {
  const { id } = req.params;
  const { nombre, clave, peso, descripcion, precio_unitario, garantia, importe, imagen, venta, renta, stock, categoria, ubicacion, condicion } = req.body;
  try {
    const photoBuffer = toBuffer(imagen);
    const { rows } = await db.query(
      `UPDATE equipos SET nombre=$1, clave=$2, peso=$3, descripcion=$4, precio_unitario=$5, garantia=$6, importe=$7, imagen=$8, venta=$9, renta=$10, stock=$11, categoria=$12, ubicacion=$13, condicion=$14
       WHERE id_equipo=$15 RETURNING *`,
      [nombre, clave, peso, descripcion, precio_unitario, garantia, importe, photoBuffer, venta, renta, stock, categoria, ubicacion, condicion, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    const productoActualizado = { ...rows[0], imagen: toDataURL(rows[0].imagen) };
    res.json(productoActualizado);
  } catch (err) {
    console.error(`Error al actualizar producto ${id}:`, err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// DELETE: Eliminar un producto del inventario
exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM equipos WHERE id_equipo=$1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.status(200).json({ message: 'Producto eliminado exitosamente.' });
  } catch (err) {
    console.error(`Error al eliminar producto ${id}:`, err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

