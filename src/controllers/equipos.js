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
    nombre, clave, partida, peso, garantia, descripcion, imagen, venta, renta, componentes
  } = req.body;

  // Asignar valores por defecto si no vienen
  const categoria = 'Andamios'; // Puedes hacerlo más dinámico si quieres
  const estado = 'Disponible';
  const ubicacion = 'Almacén Principal';
  const condicion = 'Excelente';
  const tarifa_dia = parseFloat(garantia) / 100 || 25; // Lógica de ejemplo para tarifa

  try {
    const photoBuffer = toBuffer(imagen);
    // Al guardar componentes, asegúrate de que cada objeto tenga los nombres correctos:
    // id_componente, id_equipo, nombre, clave, partida, peso, garantia, cantidad, descripcion, imagen_url
    // Si recibes 'imagen', mapea a 'imagen_url' antes de guardar en la base de datos.
    if (componentes && Array.isArray(componentes)) {
      for (let c of componentes) {
        if (c.imagen && !c.imagen_url) {
          c.imagen_url = c.imagen;
          delete c.imagen;
        }
      }
    }
    const { rows } = await db.query(
      `INSERT INTO equipos (nombre, clave, partida, peso, garantia, descripcion, imagen, venta, renta, componentes, categoria, estado, ubicacion, condicion, tarifa_dia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [nombre, clave, partida, peso, garantia, descripcion, photoBuffer, venta, renta, JSON.stringify(componentes || []), categoria, estado, ubicacion, condicion, tarifa_dia]
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
  const { nombre, codigo, categoria, estado, ubicacion, condicion, tarifa_dia, proximo_mantenimiento, imagen } = req.body;
  try {
    const photoBuffer = toBuffer(imagen);
    const { rows } = await db.query(
      `UPDATE equipos SET nombre=$1, codigo=$2, categoria=$3, estado=$4, ubicacion=$5, condicion=$6, tarifa_dia=$7, proximo_mantenimiento=$8, imagen=$9
       WHERE id_equipo=$10 RETURNING *`,
      [nombre, codigo, categoria, estado, ubicacion, condicion, tarifa_dia, proximo_mantenimiento, photoBuffer, id]
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

