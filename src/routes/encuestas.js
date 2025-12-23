const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');
const nodemailer = require('nodemailer');const crypto = require('crypto');const {
  crearEncuesta,
  obtenerEncuestas,
  obtenerEncuestaPorId,
  guardarRespuesta,
  obtenerEstadisticasEncuestas,
  obtenerRespuestasEncuesta,
  actualizarEstadoEncuesta
} = require('../controllers/encuestas');

function getSurveyPublicBaseUrl(req) {
  const envBase = process.env.SURVEY_PUBLIC_BASE_URL;
  if (envBase && String(envBase).trim()) return String(envBase).replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')).toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

// Obtener clave de encriptación
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return envKey;
  }
  return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Descifrar contraseña
function descifrarContrasena(contrasena_cifrada) {
  try {
    const algoritmo = 'aes-256-cbc';
    const clave = getEncryptionKey();
    const partes = contrasena_cifrada.split(':');
    
    if (partes.length !== 2) {
      throw new Error('Formato de contraseña cifrada inválido');
    }
    
    const iv = Buffer.from(partes[0], 'hex');
    const cifrado = partes[1];
    
    const decipher = crypto.createDecipheriv(algoritmo, Buffer.from(clave, 'hex'), iv);
    let descifrado = decipher.update(cifrado, 'hex', 'utf8');
    descifrado += decipher.final('utf8');
    
    return descifrado;
  } catch (err) {
    console.error('Error descifrando contraseña:', err);
    return contrasena_cifrada;
  }
}

// Obtener transporte SMTP desde la base de datos y retornar configuración
async function getSmtpTransportFromDB() {
  try {
    // Obtener la primera configuración SMTP guardada
    const result = await pool.query(
      'SELECT id_config_smtp, host, puerto, usa_ssl, usuario, contrasena, correo_from FROM configuracion_smtp ORDER BY fecha_creacion DESC LIMIT 1'
    );
    
    if (!result.rows.length) {
      return { transport: null, config: null };
    }
    
    const config = result.rows[0];
    const contrasena_plana = descifrarContrasena(config.contrasena);
    
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.puerto,
      secure: config.usa_ssl !== false,
      auth: {
        user: config.usuario,
        pass: contrasena_plana
      }
    });
    
    return { transport, config };
  } catch (err) {
    console.error('Error obteniendo transporte SMTP desde BD:', err);
    return { transport: null, config: null };
  }
}

// Rutas protegidas (requieren autenticación)
router.post('/desde-origen', authenticateToken, async (req, res) => {
  try {
    const {
      origen_tipo,
      origen_id,
      metodo_envio,
      email_cliente,
      telefono_cliente,
      notas,
      fecha_vencimiento
    } = req.body || {};

    if (!origen_tipo || !origen_id) {
      return res.status(400).json({ error: 'origen_tipo y origen_id son requeridos' });
    }

    let cliente = null;
    if (origen_tipo === 'venta') {
      const q = `
        SELECT co.id_cotizacion, co.id_cliente, co.numero_folio,
               c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono
        FROM public.cotizaciones co
        LEFT JOIN public.clientes c ON c.id_cliente = co.id_cliente
        WHERE co.id_cotizacion = $1 AND co.numero_folio LIKE 'VEN-%'
      `;
      const r = await pool.query(q, [origen_id]);
      if (!r.rows.length) {
        return res.status(404).json({ error: 'Venta no encontrada o no es un folio VEN-*' });
      }
      cliente = r.rows[0];
    } else if (origen_tipo === 'contrato') {
      const q = `
        SELECT ct.id_contrato, ct.id_cliente,
               c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono
        FROM public.contratos ct
        LEFT JOIN public.clientes c ON c.id_cliente = ct.id_cliente
        WHERE ct.id_contrato = $1
      `;
      const r = await pool.query(q, [origen_id]);
      if (!r.rows.length) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }
      cliente = r.rows[0];
    } else {
      return res.status(400).json({ error: 'origen_tipo inválido. Use "venta" o "contrato"' });
    }

    const finalEmail = email_cliente || cliente.cliente_email || null;
    const finalTel = telefono_cliente || cliente.cliente_telefono || null;
    const finalMetodo = metodo_envio || 'link';
    const notasFinal = notas || `origen_tipo=${origen_tipo};origen_id=${origen_id}`;

    const baseUrl = getSurveyPublicBaseUrl(req);
    const tmpUrl = `${baseUrl}/sastifaccion_clienteSG.html?encuesta=${Date.now()}_${cliente.id_cliente || ''}`;

    const insertQuery = `
      INSERT INTO public.encuestas_satisfaccionSG
      (id_cliente, id_proyecto, url_encuesta, email_cliente, telefono_cliente, metodo_envio, notas, fecha_vencimiento, enviada_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const insertValues = [
      cliente.id_cliente || null,
      Number(origen_id) || null,
      tmpUrl,
      finalEmail,
      finalTel,
      finalMetodo,
      notasFinal,
      fecha_vencimiento || null,
      req.user?.id || null
    ];

    const created = await pool.query(insertQuery, insertValues);
    const encuesta = created.rows[0];

    const urlEncuesta = `${baseUrl}/sastifaccion_clienteSG.html?id_encuesta=${encuesta.id_encuesta}`;
    const updated = await pool.query(
      'UPDATE public.encuestas_satisfaccionSG SET url_encuesta = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_encuesta = $2 RETURNING *',
      [urlEncuesta, encuesta.id_encuesta]
    );

    return res.status(201).json({
      success: true,
      data: {
        encuesta: updated.rows[0],
        cliente: {
          id_cliente: cliente.id_cliente || null,
          nombre: cliente.cliente_nombre || null,
          email: finalEmail,
          telefono: finalTel
        },
        origen: { tipo: origen_tipo, id: origen_id }
      }
    });
  } catch (error) {
    console.error('Error en /encuestas/desde-origen:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/enviar-email', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, to } = req.body || {};

    const { transport, config } = await getSmtpTransportFromDB();
    if (!transport || !config) {
      return res.status(400).json({ error: 'SMTP no configurado. Por favor, configura las credenciales SMTP en Configuración > Correo/SMTP' });
    }

    const q = `
      SELECT e.*, c.nombre as cliente_nombre, c.empresa as cliente_empresa, c.email as cliente_email
      FROM public.encuestas_satisfaccionSG e
      LEFT JOIN public.clientes c ON c.id_cliente = e.id_cliente
      WHERE e.id_encuesta = $1
    `;
    const r = await pool.query(q, [id]);
    if (!r.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }

    const encuesta = r.rows[0];
    const destino = to || encuesta.email_cliente || encuesta.cliente_email;
    if (!destino) {
      return res.status(400).json({ error: 'No hay email destino para el cliente' });
    }

    const from = config.correo_from || config.usuario;
    const asunto = subject || 'Encuesta de satisfacción';
    const clienteNombre = encuesta.cliente_nombre || 'cliente';
    const empresa = encuesta.cliente_empresa ? ` (${encuesta.cliente_empresa})` : '';
    const url = encuesta.url_encuesta;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <p>Hola ${clienteNombre}${empresa},</p>
        <p>Te invitamos a contestar nuestra encuesta de satisfacción. Te tomará menos de 2 minutos.</p>
        <p><a href="${url}" target="_blank" rel="noopener">Abrir encuesta</a></p>
        <p>Gracias.</p>
      </div>
    `;

    await transport.sendMail({
      from,
      to: destino,
      subject: asunto,
      html
    });

    await pool.query(
      `UPDATE public.encuestas_satisfaccionSG
       SET metodo_envio = 'email', estado = 'enviada', fecha_envio = CURRENT_TIMESTAMP, email_cliente = $1, fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id_encuesta = $2`,
      [destino, id]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error en /encuestas/:id/enviar-email:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authenticateToken, crearEncuesta);
router.get('/', authenticateToken, obtenerEncuestas);
router.get('/estadisticas', authenticateToken, obtenerEstadisticasEncuestas);

router.get('/publico/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      SELECT e.*, c.nombre as cliente_nombre, c.empresa as cliente_empresa, c.email as cliente_email
      FROM public.encuestas_satisfaccionSG e
      LEFT JOIN public.clientes c ON c.id_cliente = e.id_cliente
      WHERE e.id_encuesta = $1
    `;
    const r = await pool.query(q, [id]);
    if (!r.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }

    const encuesta = r.rows[0];
    const estado = String(encuesta.estado || '').toLowerCase();
    const permitido = estado === 'enviada' || estado === 'pendiente';
    if (!permitido) {
      return res.status(409).json({
        error: 'Encuesta no disponible para responder',
        estado: encuesta.estado
      });
    }

    return res.json({
      success: true,
      data: {
        id_encuesta: encuesta.id_encuesta,
        estado: encuesta.estado,
        fecha_vencimiento: encuesta.fecha_vencimiento,
        cliente: {
          id_cliente: encuesta.id_cliente,
          nombre: encuesta.cliente_nombre,
          empresa: encuesta.cliente_empresa,
          email: encuesta.email_cliente || encuesta.cliente_email || null
        }
      }
    });
  } catch (error) {
    console.error('Error en /encuestas/publico/:id:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/publico/:id/responder', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_cliente,
      email_cliente,
      q1_atencion_ventas,
      q2_calidad_productos,
      q3_tiempo_entrega,
      q4_servicio_logistica,
      q5_experiencia_compra,
      sugerencias
    } = req.body || {};

    const encuestaQuery = `
      SELECT * FROM public.encuestas_satisfaccionSG
      WHERE id_encuesta = $1 AND estado IN ('enviada','pendiente')
    `;
    const encuestaResult = await pool.query(encuestaQuery, [id]);
    if (!encuestaResult.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada o no disponible' });
    }

    const respuestaExistente = await pool.query(
      'SELECT id_respuesta FROM public.respuestas_encuestaSG WHERE id_encuesta = $1',
      [id]
    );
    if (respuestaExistente.rows.length > 0) {
      return res.status(400).json({ error: 'Esta encuesta ya ha sido respondida' });
    }

    const insert = `
      INSERT INTO public.respuestas_encuestaSG
      (id_encuesta, nombre_cliente, email_cliente, q1_atencion_ventas,
       q2_calidad_productos, q3_tiempo_entrega, q4_servicio_logistica,
       q5_experiencia_compra, sugerencias, ip_address, user_agent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `;

    const values = [
      id,
      nombre_cliente || null,
      email_cliente || null,
      q1_atencion_ventas || null,
      q2_calidad_productos || null,
      q3_tiempo_entrega || null,
      q4_servicio_logistica || null,
      q5_experiencia_compra || null,
      sugerencias || null,
      req.ip,
      req.get('User-Agent')
    ];

    const saved = await pool.query(insert, values);

    await pool.query(
      `UPDATE public.encuestas_satisfaccionSG
       SET estado = 'respondida', fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id_encuesta = $1`,
      [id]
    );

    return res.status(201).json({ success: true, data: saved.rows[0] });
  } catch (error) {
    console.error('Error en /encuestas/publico/:id/responder:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', authenticateToken, obtenerEncuestaPorId);
router.get('/:id/respuestas', authenticateToken, obtenerRespuestasEncuesta);
router.put('/:id/estado', authenticateToken, actualizarEstadoEncuesta);

// Ruta pública para guardar respuestas (no requiere autenticación)
router.post('/:id/respuesta', guardarRespuesta);

module.exports = router;




