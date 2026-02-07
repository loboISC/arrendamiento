const pool = require('../db/index');
const { toDataURL, toBuffer } = require('../controllers/usuarios');
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (_) { PDFDocument = null; }
let XLSX;
try { XLSX = require('xlsx'); } catch (_) { XLSX = null; }

// Listar productos desde public.productos (venta/renta)
exports.listarProductos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (p.id_producto)
              p.id_producto, p.nombre_del_producto AS nombre, p.descripcion,
              c.nombre_categoria AS categoria,
              p.tarifa_renta, p.precio_venta, p.estado, p.condicion,
              ip.imagen_data AS imagen_portada,
              (p.precio_venta > 0) AS venta, (p.tarifa_renta > 0) AS renta,
              p.stock_total, p.stock_venta, p.en_renta, p.reservado, p.en_mantenimiento,
              p.clave, p.marca, p.modelo, p.material, p.peso, p.capacidad_de_carga, p.largo, p.ancho, p.alto, p.codigo_de_barras, p.url_producto,
              p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria
       FROM public.productos p
       LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN public.imagenes_producto ip ON p.id_producto = ip.id_producto AND ip.nombre_archivo = 'portada'
       LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen
       LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria
       ORDER BY p.id_producto, p.nombre_del_producto ASC`
    );
    console.log(`[listarProductos] Filas obtenidas de la DB: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`[listarProductos] Primer producto (estado): ${result.rows[0].estado}, (condicion): ${result.rows[0].condicion}`);
    }
    const productos = result.rows.map(row => {
      let imagen = null;
      if (row.imagen_portada) {
        try { imagen = toDataURL(row.imagen_portada); } catch { imagen = null; }
      }
      return {
        id: row.id_producto,
        id_producto: row.id_producto,
        nombre: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria, // Ahora es el nombre de la categoría
        tarifa_renta: Number(row.tarifa_renta) || 0,
        precio_venta: Number(row.precio_venta) || 0,
        imagen,
        estado: row.estado || 'Activo',
        venta: !!row.venta,
        renta: !!row.renta,
        stock_total: Number(row.stock_total) || 0,
        stock_venta: Number(row.stock_venta) || 0, // Renombrado de stock_disponible
        en_renta: Number(row.en_renta) || 0,
        reservado: Number(row.reservado) || 0,
        en_mantenimiento: Number(row.en_mantenimiento) || 0,
        clave: row.clave,
        marca: row.marca,
        modelo: row.modelo,
        material: row.material,
        peso: Number(row.peso) || 0,
        capacidad_de_carga: Number(row.capacidad_de_carga) || 0,
        largo: Number(row.largo) || 0,
        ancho: Number(row.ancho) || 0,
        alto: Number(row.alto) || 0,
        capacidad_de_carga: Number(row.capacidad_de_carga) || 0,
        largo: Number(row.largo) || 0,
        ancho: Number(row.ancho) || 0,
        alto: Number(row.alto) || 0,
        codigo_de_barras: row.codigo_de_barras,
        url_producto: row.url_producto, // Nuevo campo URL
        id_almacen: row.id_almacen,
        nombre_almacen: row.nombre_almacen,
        condicion: row.condicion || 'N/A', // Asegurar que la condición se mapee
        id_subcategoria: row.id_subcategoria || null, // Mapear id_subcategoria
        nombre_subcategoria: row.nombre_subcategoria || null, // Mapear nombre_subcategoria
      };
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al listar productos:', error);
    // Fallback si alguna tabla no existe en la DB del amigo
    if (error && (error.code === '42P01' /* undefined_table */)) {
      try {
        console.warn('[listarProductos] Tablas relacionadas faltan. Usando consulta simplificada.');
        const simple = await pool.query(
          `SELECT id_producto,
                  nombre_del_producto AS nombre,
                  descripcion,
                  tarifa_renta,
                  precio_venta,
                  estado,
                  condicion,
                  stock_total,
                  stock_venta,
                  en_renta,
                  reservado,
                  en_mantenimiento,
                  clave, marca, modelo, material,
                  peso, capacidad_de_carga, largo, ancho, alto,
                  codigo_de_barras,
                  id_almacen, id_subcategoria
           FROM public.productos
           ORDER BY nombre_del_producto ASC`
        );
        const productos = simple.rows.map(row => ({
          id: row.id_producto,
          id_producto: row.id_producto,
          nombre: row.nombre,
          descripcion: row.descripcion,
          categoria: null,
          tarifa_renta: Number(row.tarifa_renta) || 0,
          precio_venta: Number(row.precio_venta) || 0,
          imagen: null,
          estado: row.estado || 'Activo',
          venta: Number(row.precio_venta) > 0,
          renta: Number(row.tarifa_renta) > 0,
          stock_total: Number(row.stock_total) || 0,
          stock_venta: Number(row.stock_venta) || 0,
          en_renta: Number(row.en_renta) || 0,
          reservado: Number(row.reservado) || 0,
          en_mantenimiento: Number(row.en_mantenimiento) || 0,
          clave: row.clave,
          marca: row.marca,
          modelo: row.modelo,
          material: row.material,
          peso: Number(row.peso) || 0,
          capacidad_de_carga: Number(row.capacidad_de_carga) || 0,
          largo: Number(row.largo) || 0,
          ancho: Number(row.ancho) || 0,
          alto: Number(row.alto) || 0,
          codigo_de_barras: row.codigo_de_barras,
          id_almacen: row.id_almacen,
          nombre_almacen: null,
          condicion: row.condicion || 'N/A',
          id_subcategoria: row.id_subcategoria || null,
          nombre_subcategoria: null,
        }));
        return res.json(productos);
      } catch (e2) {
        console.error('[listarProductos] Fallback también falló:', e2);
      }
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Búsqueda simple por nombre/descripcion/categoria
exports.buscarProductos = async (req, res) => {
  const { q, id_almacen } = req.query; // Obtener id_almacen de los query params
  const term = `%${q || ''}%`;
  try {
    let query = `
      SELECT p.id_producto, p.nombre_del_producto AS nombre, p.descripcion,
              c.nombre_categoria AS categoria, -- Usar el nombre de la categoría
              p.tarifa_renta, p.precio_venta, p.estado, p.condicion, -- Incluir condicion aquí
              ip.imagen_data AS imagen_portada, -- Obtener imagen de imagenes_producto
              (p.precio_venta > 0) AS venta, (p.tarifa_renta > 0) AS renta,
              p.stock_total, p.stock_venta, p.en_renta, p.reservado, p.en_mantenimiento, -- Nuevas columnas de stock
              p.clave, p.marca, p.modelo, p.material, p.peso, p.capacidad_de_carga, p.largo, p.ancho, p.alto, p.codigo_de_barras, p.tipo_de_producto, p.url_producto, -- Added url_producto
              p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria -- Nuevas columnas de almacén y subcategoría
       FROM public.productos p
       LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN public.imagenes_producto ip ON p.id_producto = ip.id_producto AND ip.nombre_archivo = 'portada' -- JOIN para la imagen principal
       LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen -- JOIN para el almacén
       LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria -- JOIN para subcategoría
       WHERE (
         p.nombre_del_producto ILIKE $1 OR p.descripcion ILIKE $1 OR c.nombre_categoria ILIKE $1 -- Buscar por nombre de categoría
       )
    `;
    const params = [term];

    if (id_almacen) {
      query += ` AND p.id_almacen = $2`;
      params.push(id_almacen);
    }

    query += `
       GROUP BY p.id_producto, c.nombre_categoria, ip.imagen_data, a.nombre_almacen, p.estado, p.condicion, s.nombre_subcategoria, p.id_subcategoria, p.stock_total, p.stock_venta, p.en_renta, p.url_producto -- Agrupar también por url_producto
       ORDER BY p.nombre_del_producto ASC`;

    const result = await pool.query(query, params);

    const productos = result.rows.map(row => {
      let imagen = null;
      if (row.imagen_portada) {
        try { imagen = toDataURL(row.imagen_portada); } catch { imagen = null; }
      }
      return {
        id: row.id_producto,
        id_producto: row.id_producto,
        nombre: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria, // Ahora es el nombre de la categoría
        tarifa_renta: Number(row.tarifa_renta) || 0,
        precio_venta: Number(row.precio_venta) || 0,
        imagen,
        estado: row.estado || 'Activo',
        venta: !!row.venta,
        renta: !!row.renta,
        stock_total: Number(row.stock_total) || 0,
        stock_venta: Number(row.stock_venta) || 0, // Renombrado de stock_disponible
        en_renta: Number(row.en_renta) || 0,
        reservado: Number(row.reservado) || 0,
        en_mantenimiento: Number(row.en_mantenimiento) || 0,
        clave: row.clave,
        marca: row.marca,
        modelo: row.modelo,
        material: row.material,
        peso: Number(row.peso) || 0,
        capacidad_de_carga: Number(row.capacidad_de_carga) || 0,
        largo: Number(row.largo) || 0,
        ancho: Number(row.ancho) || 0,
        alto: Number(row.alto) || 0,
        codigo_de_barras: row.codigo_de_barras,
        tipo_de_producto: row.tipo_de_producto,
        url_producto: row.url_producto, // Nuevo campo URL
        id_almacen: row.id_almacen,
        nombre_almacen: row.nombre_almacen,
        condicion: row.condicion || 'N/A', // Asegurar que la condición se mapee
        id_subcategoria: row.id_subcategoria || null, // Mapear id_subcategoria
        nombre_subcategoria: row.nombre_subcategoria || null, // Mapear nombre_subcategoria
      };
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    if (error && (error.code === '42P01')) {
      try {
        console.warn('[buscarProductos] Tablas relacionadas faltan. Usando consulta simplificada.');
        let simpleQuery = `
          SELECT id_producto,
                  nombre_del_producto AS nombre,
                  descripcion,
                  tarifa_renta,
                  precio_venta,
                  estado,
                  condicion,
                  stock_total,
                  stock_venta,
                  en_renta,
                  reservado,
                  en_mantenimiento,
                  clave, marca, modelo, material,
                  peso, capacidad_de_carga, largo, ancho, alto,
                  codigo_de_barras, tipo_de_producto,
                  id_almacen, id_subcategoria
           FROM public.productos
           WHERE (nombre_del_producto ILIKE $1 OR descripcion ILIKE $1)
        `;
        const simpleParams = [term];

        if (id_almacen) {
          simpleQuery += ` AND id_almacen = $2`;
          simpleParams.push(id_almacen);
        }

        simpleQuery += ` ORDER BY nombre_del_producto ASC`;

        const simple = await pool.query(simpleQuery, simpleParams);
        const productos = simple.rows.map(row => ({
          id: row.id_producto,
          id_producto: row.id_producto,
          nombre: row.nombre,
          descripcion: row.descripcion,
          categoria: null,
          tarifa_renta: Number(row.tarifa_renta) || 0,
          precio_venta: Number(row.precio_venta) || 0,
          imagen: null,
          estado: row.estado || 'Activo',
          venta: Number(row.precio_venta) > 0,
          renta: Number(row.tarifa_renta) > 0,
          stock_total: Number(row.stock_total) || 0,
          stock_venta: Number(row.stock_venta) || 0,
          en_renta: Number(row.en_renta) || 0,
          reservado: Number(row.reservado) || 0,
          en_mantenimiento: Number(row.en_mantenimiento) || 0,
          clave: row.clave,
          marca: row.marca,
          modelo: row.modelo,
          material: row.material,
          peso: Number(row.peso) || 0,
          capacidad_de_carga: Number(row.capacidad_de_carga) || 0,
          largo: Number(row.largo) || 0,
          ancho: Number(row.ancho) || 0,
          alto: Number(row.alto) || 0,
          codigo_de_barras: row.codigo_de_barras,
          tipo_de_producto: row.tipo_de_producto,
          id_almacen: row.id_almacen,
          nombre_almacen: null,
          condicion: row.condicion || 'N/A',
          id_subcategoria: row.id_subcategoria || null,
          nombre_subcategoria: null,
        }));
        return res.json(productos);
      } catch (e2) {
        console.error('[buscarProductos] Fallback también falló:', e2);
      }
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear producto
exports.crearProducto = async (req, res) => {
  const {
    nombre_del_producto, // Cambiado de 'nombre'
    descripcion,
    id_categoria,
    precio_venta = 0,
    tarifa_renta = 0,
    stock_total = 0,
    stock_venta = 0, // Renombrado de stock_disponible
    en_renta = 0,
    reservado = 0,
    en_mantenimiento = 0,
    clave,
    marca,
    modelo,
    material,
    peso = 0,
    capacidad_de_carga = 0,
    largo = 0,
    ancho = 0,
    alto = 0,
    codigo_de_barras, // Ya no es NOT NULL, se puede auto-generar
    componentes = [],
    imagenes = [],
    imagen_portada,
    id_almacen, // Nuevo campo para el ID del almacén
    estado = 'Activo', // Añadir estado
    condicion = 'Nuevo', // Añadir condición
    id_subcategoria, // Nuevo campo para el ID de la subcategoría
    url_producto // Nuevo campo para la URL del producto
  } = req.body || {};

  // Auto-generar codigo_de_barras si no se proporciona
  const final_codigo_de_barras = codigo_de_barras || `BAR-${Date.now()}`;

  if (!nombre_del_producto) return res.status(400).json({ error: 'nombre_del_producto requerido' });

  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');

    if (imagen_portada) {
      console.log('[crearProducto] imagen_portada length=', typeof imagen_portada === 'string' ? imagen_portada.length : 0, 'prefix=', typeof imagen_portada === 'string' ? imagen_portada.slice(0, 30) : null);
    } else {
      console.log('[crearProducto] imagen_portada no enviada');
    }
    const portadaBuf = toBuffer && imagen_portada ? toBuffer(imagen_portada) : null;
    console.log('[crearProducto] portadaBuf bytes=', portadaBuf ? portadaBuf.length : 0);

    const insProd = await client.query(
      `INSERT INTO public.productos
        (nombre_del_producto, descripcion, id_categoria, precio_venta, tarifa_renta,
         stock_total, stock_venta, en_renta, reservado, en_mantenimiento,
         clave, marca, modelo, material, peso, capacidad_de_carga, largo, ancho, alto, codigo_de_barras, id_almacen, estado, condicion, id_subcategoria, url_producto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING id_producto`,
      [nombre_del_producto, descripcion || null, id_categoria || null,
        precio_venta || 0, tarifa_renta || 0,
        stock_total || 0, stock_venta || 0, en_renta || 0, reservado || 0, en_mantenimiento || 0,
        clave || null, marca || null, modelo || null, material || null,
        peso || 0, capacidad_de_carga || 0, largo || 0, ancho || 0, alto || 0,
        final_codigo_de_barras, id_almacen || null, estado, condicion, id_subcategoria || null, url_producto || null
      ]
    );
    const { id_producto } = insProd.rows[0];

    // Insertar imagen principal en la tabla imagenes_producto
    if (portadaBuf) {
      await client.query(
        `INSERT INTO public.imagenes_producto (id_producto, imagen_data, nombre_archivo)
         VALUES ($1, $2::bytea, $3)`,
        [id_producto, portadaBuf, 'portada']
      );
    }

    // productos_componentes table no longer exists - components are not stored separately
    // Componentes are ignored in this version

    // Accesorios: ya no se ligan a productos. La API ignora accesorios.

    await client.query('COMMIT');
    res.status(201).json({ id_producto });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error interno al crear el producto' });
  } finally {
    client.release();
  }
};

// Obtener producto por ID (con componentes básicos)
exports.obtenerProducto = async (req, res) => {
  const { id } = req.params;
  const { id_almacen } = req.query; // Obtener id_almacen de los query params
  try {
    let query = `
      SELECT p.id_producto, p.nombre_del_producto AS nombre, p.descripcion,
              c.nombre_categoria AS categoria, -- Usar el nombre de la categoría
              p.tarifa_renta, p.precio_venta, p.estado, p.condicion,
              ip.imagen_data AS imagen_portada, -- Obtener imagen de imagenes_producto
              (p.precio_venta > 0) AS venta, (p.tarifa_renta > 0) AS renta,
              p.stock_total, p.stock_venta, p.en_renta, p.reservado, p.en_mantenimiento, -- Nuevas columnas de stock
              p.clave, p.marca, p.modelo, p.material, p.peso, p.capacidad_de_carga, p.largo, p.ancho, p.alto, p.codigo_de_barras, p.url_producto, -- Added url_producto
              p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria -- Nuevas columnas de almacén y subcategoría
       FROM public.productos p
       LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN public.imagenes_producto ip ON p.id_producto = ip.id_producto AND ip.nombre_archivo = 'portada' -- JOIN para la imagen principal
       LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen -- JOIN para el almacén
       LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria -- JOIN para subcategoría
       WHERE p.id_producto=$1
    `;
    const params = [id];

    if (id_almacen) {
      query += ` AND p.id_almacen = $2`;
      params.push(id_almacen);
    }

    query += `
       GROUP BY p.id_producto, c.nombre_categoria, ip.imagen_data, a.nombre_almacen, p.estado, p.condicion, s.nombre_subcategoria, p.id_subcategoria, p.stock_total, p.stock_venta, p.en_renta, p.url_producto -- Agrupar también por url_producto
      `;
    const pr = await pool.query(query, params);
    if (!pr.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const p = pr.rows[0];
    let portada = null;
    if (p.imagen_portada) { try { portada = toDataURL(p.imagen_portada); } catch { portada = null; } }
    // productos_componentes table no longer exists - components are not stored separately
    const componentes = [];
    res.json({
      id_producto: p.id_producto,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria, // Ahora es el nombre de la categoría
      venta: !!p.venta,
      renta: !!p.renta,
      precio_venta: Number(p.precio_venta) || 0,
      tarifa_renta: Number(p.tarifa_renta) || 0,
      imagen_portada: portada,
      componentes,
      stock_total: Number(p.stock_total) || 0,
      stock_venta: Number(p.stock_venta) || 0, // Renombrado de stock_disponible
      en_renta: Number(p.en_renta) || 0,
      reservado: Number(p.reservado) || 0,
      en_mantenimiento: Number(p.en_mantenimiento) || 0,
      clave: p.clave,
      marca: p.marca,
      modelo: p.modelo,
      material: p.material,
      peso: Number(p.peso) || 0,
      capacidad_de_carga: Number(p.capacidad_de_carga) || 0,
      largo: Number(p.largo) || 0,
      ancho: Number(p.ancho) || 0,
      alto: Number(p.alto) || 0,
      alto: Number(p.alto) || 0,
      codigo_de_barras: p.codigo_de_barras,
      url_producto: p.url_producto,
      id_almacen: p.id_almacen,
      nombre_almacen: p.nombre_almacen,
      condicion: p.condicion || 'N/A', // Asegurar que la condición se mapee
      id_subcategoria: p.id_subcategoria || null, // Mapear id_subcategoria
      nombre_subcategoria: p.nombre_subcategoria || null, // Mapear nombre_subcategoria
    });
  } catch (error) {
    console.error('Error obtener producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar producto y snapshot de componentes
exports.actualizarProducto = async (req, res) => {
  const { id } = req.params;
  console.log(`[actualizarProducto] Recibida petición para actualizar producto ${id}`);
  console.log(`[actualizarProducto] Datos recibidos:`, req.body);
  const {
    nombre_del_producto, // Cambiado de 'nombre'
    descripcion,
    id_categoria,
    precio_venta = 0,
    tarifa_renta = 0,
    stock_total = 0,
    stock_venta = 0, // Renombrado de stock_disponible
    en_renta = 0,
    reservado = 0,
    en_mantenimiento = 0,
    clave,
    marca,
    modelo,
    material,
    peso = 0,
    capacidad_de_carga = 0,
    largo = 0,
    ancho = 0,
    alto = 0,
    codigo_de_barras,
    componentes = [],
    imagen_portada,
    id_almacen, // Nuevo campo para el ID del almacén
    estado, // Añadir estado
    condicion, // Añadir condición
    id_subcategoria, // Nuevo campo para el ID de la subcategoría
    url_producto // Nuevo campo para la URL del producto
  } = req.body || {};
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    const portadaBuf = imagen_portada ? (toBuffer ? toBuffer(imagen_portada) : null) : undefined;
    // Update base
    if (portadaBuf !== undefined) {
      await client.query(
        `UPDATE public.productos SET 
          nombre_del_producto=$1, descripcion=$2, id_categoria=$3, 
          precio_venta=$4, tarifa_renta=$5, 
          stock_total=$6, stock_venta=$7, en_renta=$8, reservado=$9, en_mantenimiento=$10, 
          clave=$11, marca=$12, modelo=$13, material=$14, 
          peso=$15, capacidad_de_carga=$16, largo=$17, ancho=$18, alto=$19, 
          codigo_de_barras=$20, id_almacen=$21, estado=$22, condicion=$23, id_subcategoria=$24, url_producto=$25 
        WHERE id_producto=$26`,
        [nombre_del_producto || null, descripcion || null, id_categoria || null,
        Number(precio_venta) || 0, Number(tarifa_renta) || 0,
        Number(stock_total) || 0, Number(stock_venta) || 0, Number(en_renta) || 0, Number(reservado) || 0, Number(en_mantenimiento) || 0,
        clave || null, marca || null, modelo || null, material || null,
        Number(peso) || 0, Number(capacidad_de_carga) || 0, Number(largo) || 0, Number(ancho) || 0, Number(alto) || 0,
        codigo_de_barras || null, id_almacen || null, estado || null, condicion || null, id_subcategoria || null, url_producto || null,
          id
        ]
      );
      // Actualizar o insertar imagen_portada en imagenes_producto
      if (portadaBuf) {
        const existingImage = await client.query(
          `SELECT id_imagen FROM public.imagenes_producto WHERE id_producto=$1 AND nombre_archivo='portada'`,
          [id]
        );
        if (existingImage.rows.length > 0) {
          await client.query(
            `UPDATE public.imagenes_producto SET imagen_data=$1 WHERE id_imagen=$2`,
            [portadaBuf, existingImage.rows[0].id_imagen]
          );
        } else {
          await client.query(
            `INSERT INTO public.imagenes_producto (id_producto, imagen_data, nombre_archivo)
             VALUES ($1, $2::bytea, 'portada')`,
            [id, portadaBuf]
          );
        }
      }
    } else {
      // Obtener el codigo_de_barras existente si no se envía en la actualización
      let current_codigo_de_barras = codigo_de_barras;
      if (!current_codigo_de_barras) {
        const existingProduct = await client.query(
          `SELECT codigo_de_barras FROM public.productos WHERE id_producto = $1`,
          [id]
        );
        current_codigo_de_barras = existingProduct.rows[0]?.codigo_de_barras || null;
      }

      await client.query(
        `UPDATE public.productos SET 
          nombre_del_producto=$1, descripcion=$2, id_categoria=$3, 
          precio_venta=$4, tarifa_renta=$5, 
          stock_total=$6, stock_venta=$7, en_renta=$8, reservado=$9, en_mantenimiento=$10, 
          clave=$11, marca=$12, modelo=$13, material=$14, 
          peso=$15, capacidad_de_carga=$16, largo=$17, ancho=$18, alto=$19, 
          codigo_de_barras=$20, id_almacen=$21, estado=$22, condicion=$23, id_subcategoria=$24, url_producto=$25
        WHERE id_producto=$26`,
        [nombre_del_producto || null, descripcion || null, id_categoria || null,
        Number(precio_venta) || 0, Number(tarifa_renta) || 0,
        Number(stock_total) || 0, Number(stock_venta) || 0, Number(en_renta) || 0, Number(reservado) || 0, Number(en_mantenimiento) || 0,
        clave || null, marca || null, modelo || null, material || null,
        Number(peso) || 0, Number(capacidad_de_carga) || 0, Number(largo) || 0, Number(ancho) || 0, Number(alto) || 0,
          current_codigo_de_barras, id_almacen || null, estado || null, condicion || null, id_subcategoria || null, url_producto || null,
          id
        ]
      );
    }
    // productos_componentes table no longer exists - components are not stored separately
    // Componentes are ignored in this version
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error interno al actualizar' });
  } finally {
    client.release();
  }
};

// Eliminar producto (y sus componentes)
exports.eliminarProducto = async (req, res) => {
  const { id } = req.params;
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    // productos_componentes table no longer exists
    // Eliminar imágenes asociadas
    await client.query(`DELETE FROM public.imagenes_producto WHERE id_producto=$1`, [id]);
    const del = await client.query(`DELETE FROM public.productos WHERE id_producto=$1`, [id]);
    await client.query('COMMIT');
    if (del.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno al eliminar' });
  } finally {
    client.release();
  }
};

// Exportar SQL simple de productos activos
exports.exportarProductosSQL = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre_del_producto AS nombre, p.descripcion,
              c.nombre_categoria AS categoria,
              p.precio_venta, p.tarifa_renta, 
              p.stock_total, p.stock_venta, p.en_renta, p.reservado, p.en_mantenimiento, 
              p.clave, p.marca, p.modelo, p.material, p.peso, p.capacidad_de_carga, p.largo, p.ancho, p.alto, p.codigo_de_barras,
              p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria, p.estado, p.condicion -- Nuevas columnas de almacén, subcategoría, estado y condicion
       FROM public.productos p
       LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen -- JOIN para el almacén
       LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria -- JOIN para subcategoría
       GROUP BY p.id_producto, c.nombre_categoria, a.nombre_almacen, s.nombre_subcategoria, p.estado, p.condicion, p.stock_total, p.stock_venta, p.en_renta -- Agrupar también por stock
       ORDER BY p.id_producto ASC`
    );
    const lines = [];
    lines.push('-- Export productos');
    for (const r of result.rows) {
      const vals = [r.nombre, r.descripcion, r.categoria, r.nombre_almacen, r.estado, r.condicion, r.nombre_subcategoria].map(v => v ? v.replace(/'/g, "''") : null);
      lines.push(
        `INSERT INTO public.productos (
          id_producto, nombre_del_producto, descripcion, id_categoria,
          precio_venta, tarifa_renta, 
          stock_total, stock_venta, en_renta, reservado, en_mantenimiento, 
          clave, marca, modelo, material, peso, capacidad_de_carga, largo, ancho, alto, codigo_de_barras, id_almacen, estado, condicion, id_subcategoria
        ) VALUES (
          ${r.id_producto}, '${vals[0] || ''}', ${vals[1] !== null ? `'${vals[1]}'` : 'NULL'}, (SELECT id_categoria FROM public.categorias WHERE nombre_categoria = ${vals[2] !== null ? `'${vals[2]}'` : 'NULL'}),
          ${Number(r.precio_venta) || 0}, ${Number(r.tarifa_renta) || 0},
          ${Number(r.stock_total) || 0}, ${Number(r.stock_venta) || 0}, ${Number(r.en_renta) || 0}, ${Number(r.reservado) || 0}, ${Number(r.en_mantenimiento) || 0},
          ${r.clave !== null ? `'${r.clave}'` : 'NULL'}, ${r.marca !== null ? `'${r.marca}'` : 'NULL'}, ${r.modelo !== null ? `'${r.modelo}'` : 'NULL'}, ${r.material !== null ? `'${r.material}'` : 'NULL'},
          ${Number(r.peso) || 0}, ${Number(r.capacidad_de_carga) || 0}, ${Number(r.largo) || 0}, ${Number(r.ancho) || 0}, ${Number(r.alto) || 0},
          ${r.codigo_de_barras !== null ? `'${r.codigo_de_barras}'` : 'NULL'}, (SELECT id_almacen FROM public.almacenes WHERE nombre_almacen = ${vals[3] !== null ? `'${vals[3]}'` : 'NULL'}),
          ${r.estado !== null ? `'${vals[4]}'` : 'NULL'}, ${r.condicion !== null ? `'${vals[5]}'` : 'NULL'}, (SELECT id_subcategoria FROM public.subcategorias WHERE nombre_subcategoria = ${vals[6] !== null ? `'${vals[6]}'` : 'NULL'})
        );`
      );
    }
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.sql"');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Error al exportar productos SQL:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Exportar PDF simple de catálogo de productos
exports.exportarProductosPDF = async (req, res) => {
  try {
    if (!PDFDocument) return res.status(501).json({ error: 'PDF no disponible en el servidor' });
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre_del_producto AS nombre, c.nombre_categoria AS categoria,
              p.precio_venta, p.tarifa_renta, (p.precio_venta > 0) AS venta, (p.tarifa_renta > 0) AS renta,
              p.stock_total, p.stock_venta, p.en_renta,
              ip.imagen_data AS imagen_portada, -- Obtener imagen de imagenes_producto
              p.estado, p.condicion, -- Incluir estado y condición en la consulta
              p.clave, -- Asegurar que la clave se selecciona
              p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria -- Nuevas columnas de almacén y subcategoría
       FROM public.productos p
       LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN public.imagenes_producto ip ON p.id_producto = ip.id_producto AND ip.nombre_archivo = 'portada' -- JOIN para la imagen principal
       LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen -- JOIN para el almacén
       LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria -- JOIN para subcategoría
       -- WHERE p.estado='Activo' -- Eliminado para exportar todos los productos
       GROUP BY p.id_producto, c.nombre_categoria, ip.imagen_data, a.nombre_almacen, s.nombre_subcategoria, p.estado, p.condicion, p.stock_total, p.stock_venta, p.en_renta -- Agrupar también por stock
       ORDER BY p.nombre_del_producto ASC`
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.pdf"');
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text('Catálogo de Productos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);

    // Definir las columnas de la tabla
    const tableHeaders = ['Clave', 'Nombre', 'Precio Venta', 'Tarifa Renta', 'Almacén', 'Imagen'];
    const colWidths = [60, 150, 70, 70, 80, 50]; // Ajustar anchos de columna
    let startX = 40; // Margen izquierdo
    let startY = doc.y; // Posición Y inicial de la tabla
    const rowHeight = 60; // Aumentar altura de la fila para la imagen
    const imageSize = 50; // Tamaño de la imagen
    const headerColor = '#CCCCCC'; // Color de fondo para el encabezado

    // Dibujar encabezados de tabla
    doc.font('Helvetica-Bold');
    doc.fillColor('#000000'); // Color de texto para el encabezado
    tableHeaders.forEach((header, i) => {
      doc.rect(startX, startY, colWidths[i], rowHeight).fill(headerColor);
      doc.fillColor('black').text(header, startX + 2, startY + 5, { width: colWidths[i] - 4, align: 'center' });
      startX += colWidths[i];
    });
    doc.moveDown();

    // Dibujar filas de datos
    doc.font('Helvetica');
    startY = doc.y; // Reiniciar Y después del encabezado
    result.rows.forEach(r => {
      console.log('[exportarProductosPDF] Procesando producto:', r);
      if (startY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        startY = doc.page.margins.top; // Reiniciar startY para la nueva página

        // Volver a dibujar encabezados en la nueva página
        startX = 40;
        doc.font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
          doc.rect(startX, startY, colWidths[i], rowHeight).fill(headerColor);
          doc.fillColor('black').text(header, startX + 2, startY + 5, { width: colWidths[i] - 4, align: 'center' });
          startX += colWidths[i];
        });
        doc.moveDown();
        startY = doc.y; // Reiniciar startY para los datos después de los nuevos encabezados
      }

      startX = 40; // Reiniciar startX para cada fila de datos
      doc.font('Helvetica');
      doc.fillColor('black');

      // Columnas de datos
      const rowData = [
        r.clave || 'N/A',
        r.nombre,
        r.venta ? `$${Number(r.precio_venta || 0).toFixed(2)}` : 'N/A',
        r.renta ? `$${Number(r.tarifa_renta || 0).toFixed(2)}/día` : 'N/A',
        r.nombre_almacen || 'N/A',
        '' // Espacio para la imagen
      ];
      console.log('[exportarProductosPDF] rowData:', rowData);

      rowData.forEach((dataItem, i) => {
        doc.rect(startX, startY, colWidths[i], rowHeight).stroke();
        const lineHeight = isNaN(doc.currentLineHeight) ? 10 : doc.currentLineHeight; // Fallback para NaN
        doc.text(String(dataItem), startX + 2, startY + (rowHeight / 2) - lineHeight / 2, { width: colWidths[i] - 4, align: 'center' }); // Centrar texto verticalmente
        startX += colWidths[i];
      });

      // Añadir imagen si existe
      if (r.imagen_portada) {
        try {
          // Convertir la imagen_portada a Data URL aquí, antes de usarla
          const imageDataURL = toDataURL(r.imagen_portada);
          if (imageDataURL && typeof imageDataURL === 'string' && imageDataURL.includes(',')) { // Verificar que imageDataURL es una cadena válida con la coma esperada
            const imageBuffer = Buffer.from(imageDataURL.split(',')[1], 'base64');
            const imageX = (startX - colWidths[colWidths.length - 1]) + (colWidths[colWidths.length - 1] / 2) - (imageSize / 2); // Centrar imagen en la última columna
            doc.image(imageBuffer, imageX, startY + (rowHeight - imageSize) / 2, { fit: [imageSize, imageSize] });
          } else {
            console.warn('[exportarProductosPDF] No se pudo procesar la imagen (formato inválido o nulo): ', r.id_producto);
            // Opcional: dibujar un placeholder o un mensaje de error en la celda de la imagen
          }
        } catch (e) {
          console.error('Error al añadir imagen al PDF:', e?.message);
        }
      }

      startY += rowHeight; // Mover a la siguiente fila
    });
    doc.end();
  } catch (error) {
    console.error('Error exportar PDF:', error);
    res.status(500).json({ error: 'Error al exportar PDF' });
  }
};

// Listar categorías
exports.listarCategorias = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_categoria, nombre_categoria FROM public.categorias ORDER BY nombre_categoria ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar categorías:', error);
    res.status(500).json({ error: 'Error interno del servidor al listar categorías' });
  }
};

// Listar almacenes
exports.listarAlmacenes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_almacen, nombre_almacen, ubicacion FROM public.almacenes ORDER BY nombre_almacen ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar almacenes:', error);
    res.status(500).json({ error: 'Error interno del servidor al listar almacenes' });
  }
};

// Nueva función para listar subcategorías
exports.listarSubcategorias = async (req, res) => {
  const { id_categoria_padre } = req.query; // Puede venir un ID de categoría padre para filtrar
  console.log(`[listarSubcategorias] Recibida petición para id_categoria_padre: ${id_categoria_padre}`);
  try {
    let query = `SELECT id_subcategoria, nombre_subcategoria, id_categoria FROM public.subcategorias`;
    const params = [];
    if (id_categoria_padre) {
      // Asegurarse de que id_categoria_padre es un número para la consulta SQL
      const parsedId = parseInt(id_categoria_padre, 10);
      if (isNaN(parsedId)) {
        console.error(`[listarSubcategorias] id_categoria_padre no es un número válido: ${id_categoria_padre}`);
        return res.status(400).json({ error: 'ID de categoría padre inválido' });
      }
      query += ` WHERE id_categoria = $1`;
      params.push(parsedId);
    }
    query += ` ORDER BY nombre_subcategoria ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar subcategorías:', error);
    res.status(500).json({ error: 'Error interno del servidor al listar subcategorías' });
  }
};

// Exportar productos a Excel
exports.exportarProductosExcel = async (req, res) => {
  try {
    // Asegurar que XLSX esté disponible (carga diferida si no se resolvió arriba)
    if (!XLSX) {
      try { XLSX = require('xlsx'); } catch (_) {
        return res.status(501).json({ error: 'Exportación a Excel no disponible: falta dependencia xlsx en el servidor.' });
      }
    }
    const { items } = req.body; // Obtener items del cuerpo de la solicitud
    let productsToExport = items; // Usar items si están presentes

    if (!productsToExport || productsToExport.length === 0) {
      // Si no hay items en el body, obtener todos los productos de la base de datos
      const result = await pool.query(
        `SELECT p.id_producto, p.nombre_del_producto AS nombre, p.descripcion,
                c.nombre_categoria AS categoria,
                p.precio_venta, p.tarifa_renta,
                p.stock_total, p.stock_venta, p.en_renta, p.reservado, p.en_mantenimiento,
                p.clave, p.marca, p.modelo, p.material, p.peso, p.capacidad_de_carga, p.largo, p.ancho, p.alto, p.codigo_de_barras,
                p.id_almacen, a.nombre_almacen, p.id_subcategoria, s.nombre_subcategoria, p.estado, p.condicion
         FROM public.productos p
         LEFT JOIN public.categorias c ON p.id_categoria = c.id_categoria
         LEFT JOIN public.almacenes a ON p.id_almacen = a.id_almacen
         LEFT JOIN public.subcategorias s ON p.id_subcategoria = s.id_subcategoria
         GROUP BY p.id_producto, c.nombre_categoria, a.nombre_almacen, s.nombre_subcategoria, p.estado, p.condicion, p.stock_total, p.stock_venta, p.en_renta
         ORDER BY p.id_producto ASC`
      );
      productsToExport = result.rows;
    }

    // Crear datos para Excel
    const data = productsToExport.map(row => ({
      'ID': row.id_producto,
      'Nombre': row.nombre,
      'Descripción': row.descripcion,
      'Categoría': row.categoria,
      'Precio Venta': Number(row.precio_venta) || 0,
      'Tarifa Renta': Number(row.tarifa_renta) || 0,
      'Stock Total': Number(row.stock_total) || 0,
      'Stock Venta': Number(row.stock_venta) || 0,
      'En Renta': Number(row.en_renta) || 0,
      'Reservado': Number(row.reservado) || 0,
      'En Mantenimiento': Number(row.en_mantenimiento) || 0,
      'Clave': row.clave,
      'Marca': row.marca,
      'Modelo': row.modelo,
      'Material': row.material,
      'Peso': Number(row.peso) || 0,
      'Capacidad de Carga': Number(row.capacidad_de_carga) || 0,
      'Largo': Number(row.largo) || 0,
      'Ancho': Number(row.ancho) || 0,
      'Alto': Number(row.alto) || 0,
      'Código de Barras': row.codigo_de_barras,
      'Almacén': row.nombre_almacen,
      'Subcategoría': row.nombre_subcategoria,
      'Estado': row.estado,
      'Condición': row.condicion
    }));

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 8 },  // ID
      { wch: 25 }, // Nombre
      { wch: 30 }, // Descripción
      { wch: 15 }, // Categoría
      { wch: 12 }, // Precio Venta
      { wch: 12 }, // Tarifa Renta
      { wch: 10 }, // Stock Total
      { wch: 10 }, // Stock Venta
      { wch: 10 }, // En Renta
      { wch: 10 }, // Reservado
      { wch: 15 }, // En Mantenimiento
      { wch: 12 }, // Clave
      { wch: 15 }, // Marca
      { wch: 15 }, // Modelo
      { wch: 15 }, // Material
      { wch: 8 },  // Peso
      { wch: 15 }, // Capacidad de Carga
      { wch: 8 },  // Largo
      { wch: 8 },  // Ancho
      { wch: 8 },  // Alto
      { wch: 15 }, // Código de Barras
      { wch: 20 }, // Almacén
      { wch: 20 }, // Subcategoría
      { wch: 10 }, // Estado
      { wch: 12 }  // Condición
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar productos Excel:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};