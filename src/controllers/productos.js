const pool = require('../db/index');
const { toDataURL, toBuffer } = require('./usuarios');
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch(_) { PDFDocument = null; }

// Listar productos desde public.productos (venta/renta)
const listarProductos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre, p.descripcion, p.categoria,
              p.tarifa_renta AS precio_renta, p.precio_venta, p.imagen, p.estado,
              p.venta, p.renta,
              COALESCE(SUM(pc.cantidad_stock),0) AS stock_producto,
              COALESCE(SUM(pc.cantidad_stock),0) AS total_componentes
       FROM public.productos p
       LEFT JOIN public.productos_componentes pc ON pc.id_producto = p.id_producto
       WHERE p.estado = $1
       GROUP BY p.id_producto
       ORDER BY p.nombre ASC`,
      ['Activo']
    );

    const productos = result.rows.map(row => {
      let imagen = null;
      if (row.imagen) {
        try { imagen = toDataURL(row.imagen); } catch { imagen = null; }
      }
      return {
        id: row.id_producto,
        id_producto: row.id_producto,
        nombre: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria,
        precio_renta: Number(row.precio_renta) || 0,
        precio_venta: Number(row.precio_venta) || 0,
        imagen,
        estado: row.estado || 'Activo',
        venta: !!row.venta,
        renta: !!row.renta,
        stock_producto: Number(row.stock_producto)||0,
        total_componentes: Number(row.total_componentes)||0
      };
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Búsqueda simple por nombre/descripcion/categoria
const buscarProductos = async (req, res) => {
  const { q } = req.query;
  const term = `%${q || ''}%`;
  try {
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre, p.descripcion, p.categoria,
              p.tarifa_renta AS precio_renta, p.precio_venta, p.imagen, p.estado,
              p.venta, p.renta,
              COALESCE(SUM(pc.cantidad_stock),0) AS stock_producto,
              COALESCE(SUM(pc.cantidad_stock),0) AS total_componentes
       FROM public.productos p
       LEFT JOIN public.productos_componentes pc ON pc.id_producto = p.id_producto
       WHERE p.estado = 'Activo' AND (
         p.nombre ILIKE $1 OR p.descripcion ILIKE $1 OR p.categoria ILIKE $1
       )
       GROUP BY p.id_producto
       ORDER BY p.nombre ASC`,
      [term]
    );

    const productos = result.rows.map(row => {
      let imagen = null;
      if (row.imagen) {
        try { imagen = toDataURL(row.imagen); } catch { imagen = null; }
      }
      return {
        id: row.id_producto,
        id_producto: row.id_producto,
        nombre: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria,
        precio_renta: Number(row.precio_renta) || 0,
        precio_venta: Number(row.precio_venta) || 0,
        imagen,
        estado: row.estado || 'Activo',
        venta: !!row.venta,
        renta: !!row.renta,
        total_componentes: Number(row.total_componentes)||0
      };
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear producto con componentes, accesorios e imágenes
const crearProducto = async (req, res) => {
  const {
    nombre,
    descripcion,
    categoria,
    venta = false,
    renta = false,
    precio_venta = 0,
    tarifa_renta = 0,
    componentes = [],
    imagenes = [], // array de DataURLs para imágenes adicionales
    imagen_portada // opcional DataURL
  } = req.body || {};

  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });

  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');

    if (imagen_portada) {
      console.log('[crearProducto] imagen_portada length=', typeof imagen_portada==='string'?imagen_portada.length:0, 'prefix=', typeof imagen_portada==='string'?imagen_portada.slice(0,30):null);
    } else {
      console.log('[crearProducto] imagen_portada no enviada');
    }
    const portadaBuf = toBuffer && imagen_portada ? toBuffer(imagen_portada) : null;
    console.log('[crearProducto] portadaBuf bytes=', portadaBuf ? portadaBuf.length : 0);

    const insProd = await client.query(
      `INSERT INTO public.productos
        (nombre, descripcion, categoria, venta, renta, precio_venta, tarifa_renta, imagen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bytea)
       RETURNING id_producto`,
      [nombre, descripcion || null, categoria || null, !!venta, !!renta, precio_venta||0, tarifa_renta||0, portadaBuf]
    );
    const { id_producto } = insProd.rows[0];
    // Verificar que DB recibió portada
    try {
      const chk = await client.query(`SELECT LENGTH(imagen) AS len FROM public.productos WHERE id_producto=$1`, [id_producto]);
      console.log('[crearProducto] DB productos.imagen length=', chk.rows?.[0]?.len || 0);
    } catch (e) { console.log('[crearProducto] no se pudo leer productos.imagen', e?.message); }


    // Componentes snapshot
    if (Array.isArray(componentes) && componentes.length) {
      for (const c of componentes) {
        if (c.imagen) {
          console.log('[crearProducto] componente imagen length=', typeof c.imagen==='string'?c.imagen.length:0, 'prefix=', typeof c.imagen==='string'?c.imagen.slice(0,30):null);
        }
        const imgBuf = c.imagen ? (toBuffer ? toBuffer(c.imagen) : null) : null;
        console.log('[crearProducto] componente imgBuf bytes=', imgBuf ? imgBuf.length : 0);
        const inserted = await client.query(
          `INSERT INTO public.productos_componentes
            (id_producto, id_componente, clave, nombre, descripcion, precio, tarifa, cantidad, cantidad_stock, cantidad_precio, peso, garantia, ubicacion, imagen)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::bytea)
            RETURNING id_producto_componente, LENGTH(imagen) AS len`,
          [id_producto, c.id_componente || null, c.clave || null, c.nombre || null, c.descripcion || null,
           Number(c.precio)||0, Number(c.tarifa)||0, Number(c.cantidad_precio)||0, Number(c.cantidad_stock)||0, Number(c.cantidad_precio)||0,
           Number(c.peso)||0, Number(c.garantia)||0, (c.ubicacion||null), imgBuf]
        );
        console.log('[crearProducto] DB productos_componentes.imagen length=', inserted.rows?.[0]?.len || 0);
      }
    }

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

module.exports = { listarProductos, buscarProductos, crearProducto };
// Obtener producto por ID (con componentes básicos)
const obtenerProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const pr = await pool.query(
      `SELECT id_producto, nombre, descripcion, categoria, venta, renta, precio_venta, tarifa_renta, imagen, estado
       FROM public.productos WHERE id_producto=$1`,
      [id]
    );
    if (!pr.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const p = pr.rows[0];
    let portada = null;
    if (p.imagen) { try { portada = toDataURL(p.imagen); } catch { portada = null; } }
    const comp = await pool.query(
      `SELECT id_producto_componente, id_componente, clave, nombre, descripcion, precio, tarifa,
              cantidad, cantidad_stock, cantidad_precio, peso, garantia, ubicacion, imagen
       FROM public.productos_componentes WHERE id_producto=$1 ORDER BY id_producto_componente ASC`,
      [id]
    );
    const componentes = comp.rows.map(r => ({
      id_producto_componente: r.id_producto_componente,
      id_componente: r.id_componente,
      clave: r.clave,
      nombre: r.nombre,
      descripcion: r.descripcion,
      precio: Number(r.precio)||0,
      tarifa: Number(r.tarifa)||0,
      cantidad: Number(r.cantidad)||0,
      cantidad_stock: Number(r.cantidad_stock)||0,
      cantidad_precio: Number(r.cantidad_precio)||0,
      peso: Number(r.peso)||0,
      garantia: Number(r.garantia)||0,
      ubicacion: r.ubicacion || null,
      imagen: r.imagen ? (toDataURL ? toDataURL(r.imagen) : null) : null
    }));
    res.json({
      id_producto: p.id_producto,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      venta: !!p.venta,
      renta: !!p.renta,
      precio_venta: Number(p.precio_venta)||0,
      tarifa_renta: Number(p.tarifa_renta)||0,
      imagen_portada: portada,
      componentes
    });
  } catch (error) {
    console.error('Error obtener producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar producto y snapshot de componentes
const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    descripcion,
    categoria,
    venta = false,
    renta = false,
    precio_venta = 0,
    tarifa_renta = 0,
    componentes = [],
    imagen_portada
  } = req.body || {};
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    const portadaBuf = imagen_portada ? (toBuffer ? toBuffer(imagen_portada) : null) : undefined;
    // Update base
    if (portadaBuf !== undefined) {
      await client.query(
        `UPDATE public.productos SET nombre=$1, descripcion=$2, categoria=$3, venta=$4, renta=$5,
          precio_venta=$6, tarifa_renta=$7, imagen=$8::bytea WHERE id_producto=$9`,
        [nombre||null, descripcion||null, categoria||null, !!venta, !!renta, Number(precio_venta)||0, Number(tarifa_renta)||0, portadaBuf, id]
      );
    } else {
      await client.query(
        `UPDATE public.productos SET nombre=$1, descripcion=$2, categoria=$3, venta=$4, renta=$5,
          precio_venta=$6, tarifa_renta=$7 WHERE id_producto=$8`,
        [nombre||null, descripcion||null, categoria||null, !!venta, !!renta, Number(precio_venta)||0, Number(tarifa_renta)||0, id]
      );
    }
    // Reemplazar snapshot de componentes si viene en payload
    if (Array.isArray(componentes)) {
      await client.query(`DELETE FROM public.productos_componentes WHERE id_producto=$1`, [id]);
      for (const c of componentes) {
        const imgBuf = c.imagen ? (toBuffer ? toBuffer(c.imagen) : null) : null;
        await client.query(
          `INSERT INTO public.productos_componentes
            (id_producto, id_componente, clave, nombre, descripcion, precio, tarifa, cantidad, cantidad_stock, cantidad_precio, peso, garantia, ubicacion, imagen)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::bytea)`,
          [id, c.id_componente || null, c.clave || null, c.nombre || null, c.descripcion || null,
           Number(c.precio)||0, Number(c.tarifa)||0, Number(c.cantidad)||0, Number(c.cantidad_stock)||0, Number(c.cantidad_precio)||0,
           Number(c.peso)||0, Number(c.garantia)||0, (c.ubicacion||null), imgBuf]
        );
      }
    }
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
const eliminarProducto = async (req, res) => {
  const { id } = req.params;
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM public.productos_componentes WHERE id_producto=$1`, [id]);
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
const exportarProductosSQL = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_producto, nombre, descripcion, categoria, venta, renta, precio_venta, tarifa_renta
       FROM public.productos WHERE estado='Activo' ORDER BY id_producto ASC`
    );
    const lines = [];
    lines.push('-- Export productos');
    for (const r of result.rows) {
      const vals = [r.nombre, r.descripcion, r.categoria].map(v => v? v.replace(/'/g, "''") : null);
      lines.push(
        `INSERT INTO public.productos (id_producto, nombre, descripcion, categoria, venta, renta, precio_venta, tarifa_renta) VALUES (${r.id_producto}, '${vals[0]||''}', ${vals[1]!==null?`'${vals[1]}'`:'NULL'}, ${vals[2]!==null?`'${vals[2]}'`:'NULL'}, ${r.venta? 'TRUE':'FALSE'}, ${r.renta? 'TRUE':'FALSE'}, ${Number(r.precio_venta)||0}, ${Number(r.tarifa_renta)||0});`
      );
    }
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.sql"');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Error exportar SQL:', error);
    res.status(500).json({ error: 'Error al exportar SQL' });
  }
};

// Exportar PDF simple de catálogo de productos
const exportarProductosPDF = async (req, res) => {
  try {
    if (!PDFDocument) return res.status(501).json({ error: 'PDF no disponible en el servidor' });
    const result = await pool.query(
      `SELECT id_producto, nombre, categoria, precio_venta, tarifa_renta, venta, renta
       FROM public.productos WHERE estado='Activo' ORDER BY nombre ASC`
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.pdf"');
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text('Catálogo de Productos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    result.rows.forEach(r => {
      doc.text(`#${r.id_producto} - ${r.nombre} [${r.categoria||'N/A'}]`);
      const parts = [];
      if (r.venta) parts.push(`Venta: $${Number(r.precio_venta||0).toFixed(2)}`);
      if (r.renta) parts.push(`Renta: $${Number(r.tarifa_renta||0).toFixed(2)}/día`);
      doc.text(parts.join('    '));
      doc.moveDown(0.5);
    });
    doc.end();
  } catch (error) {
    console.error('Error exportar PDF:', error);
    res.status(500).json({ error: 'Error al exportar PDF' });
  }
};

module.exports = { listarProductos, buscarProductos, crearProducto, obtenerProducto, actualizarProducto, eliminarProducto, exportarProductosSQL, exportarProductosPDF };
