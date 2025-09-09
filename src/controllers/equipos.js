const pool = require('../db/index');

// Importar la función toDataURL mejorada desde usuarios.js
const { toDataURL } = require('./usuarios');

// Listar accesorios de renta (tipo='renta') públicamente
const getAccesoriosRenta = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_equipo, nombre, clave, categoria, estado, stock, precio_unitario, descripcion, imagen, tipo, tarifa, venta, renta
       FROM accesorios
       WHERE (tipo = 'renta' OR tipo IS NULL) AND (estado = 'Disponible' OR estado IS NULL)
       ORDER BY nombre`
    );

    const accesorios = result.rows.map(row => {
      let imagen = null;
      if (row.imagen) {
        try { imagen = toDataURL(row.imagen); } catch { imagen = null; }
      }
      return {
        id_equipo: row.id_equipo,
        clave: row.clave,
        nombre: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria,
        estado: row.estado || 'Disponible',
        stock: Number(row.stock) || 0,
        precio_unitario: Number(row.precio_unitario) || 0,
        tarifa: row.tarifa !== undefined && row.tarifa !== null ? Number(row.tarifa) || 0 : 0,
        tipo: row.tipo || 'renta',
        venta: row.venta !== undefined && row.venta !== null ? !!row.venta : false,
        renta: row.renta !== undefined && row.renta !== null ? !!row.renta : true,
        imagen
      };
    });

    res.json(accesorios);
  } catch (error) {
    console.error('Error al listar accesorios de renta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener todos los equipos
const getAllEquipos = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accesorios ORDER BY nombre');
    
    // Procesar las imágenes de cada equipo y agregar campos renta/venta por defecto
    const equipos = result.rows.map(equipo => {
      if (equipo.imagen) {
        // Convertir la imagen a data URL usando la función toDataURL
        equipo.imagen = toDataURL(equipo.imagen);
      }
      
      // Asignar valores por defecto para renta y venta
      // Si el campo no existe o es null/undefined, usar valores por defecto
      if (equipo.renta === undefined || equipo.renta === null || equipo.renta === false) {
        equipo.renta = true; // Por defecto, todos los accesorios están disponibles para renta
      }
      if (equipo.venta === undefined || equipo.venta === null) {
        equipo.venta = false; // Por defecto, no están disponibles para venta
      }
      
      return equipo;
    });
    
    console.log('Equipos procesados con renta/venta:', equipos.length);
    console.log('Primeros 3 equipos:', equipos.slice(0, 3).map(e => ({ nombre: e.nombre, renta: e.renta, venta: e.venta })));
    
    res.json(equipos);
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear nuevo equipo
const createEquipo = async (req, res) => {
  const { 
    nombre, clave, categoria, estado, stock, precio_unitario, descripcion, 
    imagen, ubicacion, condicion, peso, garantia, tipo, tarifa, venta, renta 
  } = req.body;
  
  try {
    // Convertir imagen de data URL a Buffer si está presente
    let imagenBuffer = null;
    if (imagen && imagen.startsWith('data:image')) {
      imagenBuffer = Buffer.from(imagen.split(',')[1], 'base64');
    }
    
    const result = await pool.query(
      `INSERT INTO accesorios (
        nombre, clave, categoria, estado, stock, precio_unitario, descripcion,
        imagen, ubicacion, condicion, peso, garantia, tipo, tarifa, venta, renta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [nombre, clave, categoria, estado, stock, precio_unitario, descripcion,
       imagenBuffer, ubicacion, condicion, peso, garantia, (tipo||null), Number(tarifa)||0, !!venta, !!renta]
    );
    
    // Procesar la imagen del equipo creado
    const equipo = result.rows[0];
    if (equipo.imagen) {
      equipo.imagen = toDataURL(equipo.imagen);
    }
    
    // Agregar campos renta y venta por defecto si no existen
    if (equipo.renta === undefined || equipo.renta === null) {
      equipo.renta = true;
    }
    if (equipo.venta === undefined || equipo.venta === null) {
      equipo.venta = false;
    }
    // Normalizar tarifa
    if (equipo.tarifa === undefined || equipo.tarifa === null) {
      equipo.tarifa = equipo.tarifa_dia ? Number(equipo.tarifa_dia) : 0;
    } else {
      equipo.tarifa = Number(equipo.tarifa) || 0;
    }
    
    res.status(201).json(equipo);
  } catch (error) {
    console.error('Error al crear equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener equipo por ID
const getEquipoById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM accesorios WHERE id_equipo = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    
    // Procesar la imagen del equipo
    const equipo = result.rows[0];
    if (equipo.imagen) {
      equipo.imagen = toDataURL(equipo.imagen);
    }
    
    // Agregar campos renta y venta por defecto si no existen
    if (equipo.renta === undefined || equipo.renta === null) {
      equipo.renta = true;
    }
    if (equipo.venta === undefined || equipo.venta === null) {
      equipo.venta = false;
    }
    if (equipo.tarifa === undefined || equipo.tarifa === null) {
      equipo.tarifa = equipo.tarifa_dia ? Number(equipo.tarifa_dia) : 0;
    } else {
      equipo.tarifa = Number(equipo.tarifa) || 0;
    }
    if (equipo.tipo === undefined || equipo.tipo === null) {
      equipo.tipo = 'null';
    }
    
    res.json(equipo);
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar equipo
const updateEquipo = async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, clave, categoria, estado, stock, precio_unitario, descripcion,
    imagen, ubicacion, condicion, peso, garantia, tipo, tarifa, venta, renta 
  } = req.body;
  
  try {
    // Convertir imagen de data URL a Buffer si está presente
    let imagenBuffer = null;
    if (imagen && imagen.startsWith('data:image')) {
      imagenBuffer = Buffer.from(imagen.split(',')[1], 'base64');
    }
    
    const result = await pool.query(
      `UPDATE accesorios SET 
        nombre = $1, clave = $2, categoria = $3, estado = $4, stock = $5, 
        precio_unitario = $6, descripcion = $7, imagen = $8, ubicacion = $9,
        condicion = $10, peso = $11, garantia = $12, tipo = $13, tarifa = $14, venta = $15, renta = $16
        WHERE id_equipo = $17 RETURNING *`,
      [nombre, clave, categoria, estado, stock, precio_unitario, descripcion,
       imagenBuffer, ubicacion, condicion, peso, garantia, (tipo||null), Number(tarifa)||0, !!venta, !!renta, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    
    // Procesar la imagen del equipo actualizado
    const equipo = result.rows[0];
    if (equipo.imagen) {
      equipo.imagen = toDataURL(equipo.imagen);
    }
    
    // Agregar campos renta y venta por defecto si no existen
    if (equipo.renta === undefined || equipo.renta === null) {
      equipo.renta = true;
    }
    if (equipo.venta === undefined || equipo.venta === null) {
      equipo.venta = false;
    }
    
    res.json(equipo);
  } catch (error) {
    console.error('Error al actualizar equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar equipo
const deleteEquipo = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM accesorios WHERE id_equipo = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    res.json({ message: 'Equipo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Buscar producto por clave
const buscarPorClave = async (req, res) => {
  const { clave } = req.params;
  
  try {
    console.log('Buscando producto con clave:', clave);
    
    // Buscar por clave o nombre
    const result = await pool.query(
      'SELECT * FROM accesorios WHERE clave ILIKE $1 OR nombre ILIKE $1 ORDER BY stock DESC LIMIT 1',
      [`%${clave}%`]
    );
    
    if (result.rows.length === 0) {
      console.log('Producto no encontrado');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const producto = result.rows[0];
    console.log('Producto encontrado:', {
      id: producto.id_equipo,
      clave: producto.clave,
      nombre: producto.nombre,
      tieneImagen: !!producto.imagen,
      tipoImagen: producto.imagen ? typeof producto.imagen : 'null'
    });
    
    // Procesar la imagen si existe
    let imagen = null;
    if (producto.imagen) {
      console.log('Procesando imagen del producto...');
      imagen = toDataURL(producto.imagen);
      console.log('Imagen procesada:', imagen ? 'Válida' : 'Null');
    } else {
      console.log('Producto no tiene imagen');
    }
    
    // Formatear respuesta para el frontend
    const productoFormateado = {
      id: producto.id_equipo,
      clave: producto.clave,
      codigo: producto.clave, // Usar clave como código para compatibilidad
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      categoria: producto.categoria,
      stock: parseInt(producto.stock) || 0,
      cantidad: parseInt(producto.stock) || 0,
      precio: parseFloat(producto.precio_unitario) || 0,
      tarifa: producto.tarifa !== undefined && producto.tarifa !== null
        ? Number(producto.tarifa) || 0
        : (producto.tarifa_dia ? Number(producto.tarifa_dia) : 0),
      estado: producto.estado || 'Disponible',
      imagen: imagen,
      renta: producto.renta !== undefined ? producto.renta : true,
      venta: producto.venta !== undefined ? producto.venta : false
    };
    
    console.log('Respuesta final:', {
      clave: productoFormateado.clave,
      nombre: productoFormateado.nombre,
      tieneImagen: !!productoFormateado.imagen
    });
    
    res.json(productoFormateado);
  } catch (error) {
    console.error('Error al buscar producto por clave:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener productos disponibles con stock
const getProductosDisponibles = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_equipo, clave, nombre, categoria, stock, precio_unitario, estado FROM accesorios WHERE stock > 0 AND estado = $1 ORDER BY nombre',
      ['Disponible']
    );
    
    const productos = result.rows.map(producto => {
      // Procesar la imagen si existe
      let imagen = null;
      if (producto.imagen) {
        imagen = toDataURL(producto.imagen);
      }
      
      return {
        id: producto.id_equipo,
        clave: producto.clave,
        codigo: producto.clave, // Usar clave como código para compatibilidad
        nombre: producto.nombre,
        categoria: producto.categoria,
        stock: parseInt(producto.stock) || 0,
        precio: parseFloat(producto.precio_unitario) || 0,
        estado: producto.estado,
        imagen: imagen,
        renta: producto.renta !== undefined ? producto.renta : true,
        venta: producto.venta !== undefined ? producto.venta : false
      };
    });
    
    res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos disponibles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAccesoriosRenta,
  getAllEquipos,
  createEquipo,
  getEquipoById,
  updateEquipo,
  deleteEquipo,
  buscarPorClave,
  getProductosDisponibles
};

