const db = require('../../../../config/database');

/**
 * Repositorio de notas de credito.
 * Estructura de tablas actualizada (20260519):
 * credit_notes: id (UUID), customer_id, tax, relation_type, reason, status, created_at, etc.
 */
class RepositorioNotasCredito {
  async buscarFacturas(filtros = {}) {
    const valores = [];
    const condiciones = ["UPPER(COALESCE(f.estado, '')) NOT LIKE 'CANCEL%'"];

    if (filtros.search) {
      valores.push(`%${filtros.search}%`);
      condiciones.push(`(
        COALESCE(f.folio, f.id_factura::text) ILIKE $${valores.length}
        OR COALESCE(f.uuid::text, '') ILIKE $${valores.length}
        OR COALESCE(c.rfc, '') ILIKE $${valores.length}
        OR COALESCE(c.razon_social, c.nombre, '') ILIKE $${valores.length}
      )`);
    }

    if (filtros.fecha) {
      valores.push(filtros.fecha);
      condiciones.push(`f.fecha_emision::date = $${valores.length}::date`);
    }

    const consulta = `
      SELECT
        f.id_factura AS invoice_id,
        f.id_cliente AS customer_id,
        COALESCE(f.folio, f.id_factura::text) AS folio,
        f.uuid::text AS uuid,
        f.fecha_emision,
        COALESCE(f.subtotal, 0) AS subtotal,
        COALESCE(f.total_iva, 0) AS tax,
        COALESCE(f.total, 0) AS total,
        COALESCE(f.estado, 'TIMBRADA') AS sat_status,
        COALESCE(c.razon_social, c.nombre, 'Cliente sin nombre') AS customer_name,
        COALESCE(c.rfc, '') AS customer_rfc,
        COALESCE(f.forma_pago, '99') AS forma_pago,
        COALESCE(f.metodo_pago, 'PUE') AS metodo_pago,
        GREATEST(COALESCE(f.total, 0) - COALESCE(nc.total_acreditado, 0), 0) AS saldo_disponible
      FROM facturas f
      LEFT JOIN clientes c ON c.id_cliente = f.id_cliente
      LEFT JOIN (
        SELECT id_factura_origen, COALESCE(SUM(total), 0) AS total_acreditado
        FROM credit_notes
        WHERE UPPER(COALESCE(status, '')) NOT IN ('CANCELADA', 'ERROR')
        GROUP BY id_factura_origen
      ) nc ON nc.id_factura_origen = f.id_factura
      WHERE ${condiciones.join(' AND ')}
      ORDER BY f.fecha_emision DESC NULLS LAST, f.id_factura DESC
      LIMIT 50
    `;

    const resultado = await db.query(consulta, valores);
    return resultado.rows;
  }

  async obtenerFacturaPorId(invoiceId) {
    const resultado = await db.query(
      `
        SELECT
          f.id_factura AS invoice_id,
          f.id_cliente AS customer_id,
          COALESCE(f.folio, f.id_factura::text) AS folio,
          f.uuid::text AS uuid,
          f.fecha_emision,
          COALESCE(f.subtotal, 0) AS subtotal,
          COALESCE(f.total_iva, 0) AS tax,
          COALESCE(f.total, 0) AS total,
          COALESCE(f.estado, 'TIMBRADA') AS sat_status,
          COALESCE(c.razon_social, c.nombre, 'Cliente sin nombre') AS customer_name,
          COALESCE(c.rfc, '') AS customer_rfc,
          COALESCE(c.regimen_fiscal, '') AS tax_regime,
          COALESCE(c.codigo_postal, '') AS postal_code,
          COALESCE(c.uso_cfdi, 'G02') AS cfdi_use,
          COALESCE(f.forma_pago, '99') AS forma_pago,
          COALESCE(f.metodo_pago, 'PUE') AS metodo_pago,
          COALESCE(f.moneda, 'MXN') AS moneda
        FROM facturas f
        LEFT JOIN clientes c ON c.id_cliente = f.id_cliente
        WHERE f.id_factura = $1
        LIMIT 1
      `,
      [invoiceId]
    );
    return resultado.rows[0] || null;
  }

  async obtenerConceptosFactura(invoiceId) {
    const resultado = await db.query(
      `
        SELECT
          id_producto AS product_id,
          COALESCE(cantidad, 1) AS cantidad,
          COALESCE(valor_unitario, precio_unitario, importe, 0) AS precio_unitario,
          COALESCE(descuento, 0) AS descuento,
          COALESCE(iva, impuesto, 0) AS iva,
          COALESCE(total, importe, 0) AS total,
          COALESCE(clave_producto_servicio, clave_sat, '01010101') AS sat_product_key,
          COALESCE(clave_unidad, unidad_sat, 'H87') AS sat_unit_key,
          COALESCE(descripcion, concepto, 'Concepto de factura') AS descripcion
        FROM factura_conceptos
        WHERE id_factura = $1
        ORDER BY id_factura_concepto ASC
      `,
      [invoiceId]
    ).catch(() => ({ rows: [] }));

    if (resultado.rows.length > 0) return resultado.rows;

    const factura = await this.obtenerFacturaPorId(invoiceId);
    if (!factura) return [];
    const subtotal = Number(factura.subtotal || factura.total / 1.16 || 0);
    return [{
      product_id: null,
      cantidad: 1,
      precio_unitario: subtotal,
      descuento: 0,
      iva: Number(factura.tax || 0),
      total: Number(factura.total || 0),
      sat_product_key: '01010101',
      sat_unit_key: 'ACT',
      descripcion: `Acreditacion de factura ${factura.folio}`
    }];
  }

  async obtenerTotalNotasAplicadas(invoiceId) {
    const resultado = await db.query(
      `
        SELECT COALESCE(SUM(total), 0) AS total
        FROM credit_notes
        WHERE id_factura_origen = $1
          AND UPPER(COALESCE(status, '')) IN ('BORRADOR', 'TIMBRANDO', 'TIMBRADA', 'APLICADA', 'PARCIAL')
      `,
      [invoiceId]
    );
    return Number(resultado.rows[0]?.total || 0);
  }

  async listar(filtros = {}) {
    const valores = [];
    let consulta = `
      SELECT
        cn.*,
        c.nombre AS customer_name,
        c.razon_social,
        f.uuid::text AS invoice_uuid_origen
      FROM credit_notes cn
      LEFT JOIN clientes c ON c.id_cliente = cn.customer_id
      LEFT JOIN facturas f ON f.id_factura = cn.id_factura_origen
      WHERE 1=1
    `;

    if (filtros.status) {
      valores.push(String(filtros.status).toUpperCase());
      consulta += ` AND UPPER(REPLACE(COALESCE(cn.status, ''), ' ', '_')) = $${valores.length}`;
    }

    consulta += ' ORDER BY cn.created_at DESC LIMIT 100';
    const resultado = await db.query(consulta, valores);
    return resultado.rows;
  }

  async obtenerPorId(id) {
    const nota = await db.query(
      `
        SELECT
          cn.*,
          c.nombre AS customer_name,
          c.razon_social,
          c.rfc AS customer_rfc,
          c.regimen_fiscal AS tax_regime,
          c.codigo_postal AS postal_code,
          f.uuid::text AS invoice_uuid_origen
        FROM credit_notes cn
        LEFT JOIN clientes c ON c.id_cliente = cn.customer_id
        LEFT JOIN facturas f ON f.id_factura = cn.id_factura_origen
        WHERE cn.id = $1
      `,
      [id]
    );

    if (nota.rows.length === 0) return null;

    const items = await db.query(
      `
        SELECT
          *,
          quantity AS cantidad,
          unit_price AS precio_unitario,
          discount AS descuento,
          tax AS iva,
          description AS descripcion
        FROM credit_note_items
        WHERE credit_note_id = $1
        ORDER BY id ASC
      `,
      [id]
    ).catch(() => ({ rows: [] }));

    const relaciones = await db.query(
      'SELECT * FROM credit_note_relations WHERE credit_note_id = $1',
      [id]
    ).catch(() => ({ rows: [] }));

    const notaCompleta = { ...nota.rows[0], items: items.rows, relaciones: relaciones.rows };
    const fiscalUi = await this.obtenerFiscalUiDesdeLog(id);
    if (fiscalUi.forma_pago) notaCompleta.forma_pago = fiscalUi.forma_pago;
    if (fiscalUi.metodo_pago) notaCompleta.metodo_pago = fiscalUi.metodo_pago;
    if (fiscalUi.tipo_comprobante) notaCompleta.tipo_comprobante = fiscalUi.tipo_comprobante;
    return notaCompleta;
  }

  async obtenerRespuestaTimbrado(creditNoteId) {
    const resultado = await db.query(
      `
        SELECT response_sat
        FROM credit_note_logs
        WHERE credit_note_id = $1
          AND event = 'RESPONSE_TIMBRADO'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [creditNoteId]
    ).catch(() => ({ rows: [] }));

    const response = resultado.rows[0]?.response_sat;
    if (!response) return null;
    if (typeof response !== 'string') return response;
    try {
      return JSON.parse(response);
    } catch (error) {
      console.warn('[NotasCredito] response_sat JSON invalido:', creditNoteId, error.message);
      return null;
    }
  }

  async obtenerFiscalUiDesdeLog(creditNoteId) {
    const resultado = await db.query(
      `
        SELECT request_sat
        FROM credit_note_logs
        WHERE credit_note_id = $1
          AND event = 'CREAR_BORRADOR'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [creditNoteId]
    ).catch(() => ({ rows: [] }));

    const request = resultado.rows[0]?.request_sat;
    const datos = typeof request === 'string' ? JSON.parse(request) : request;
    if (!datos || typeof datos !== 'object') return {};

    const payload = datos.request || datos;
    const metodo = String(payload.metodo_pago || '').toUpperCase();
    const forma = String(payload.forma_pago || '').trim();
    const tipoComprobante = String(payload.tipo_comprobante || '').toUpperCase();
    return {
      metodo_pago: metodo || undefined,
      forma_pago: forma ? forma.padStart(2, '0') : undefined,
      tipo_comprobante: tipoComprobante === 'I' ? 'I' : (tipoComprobante === 'E' ? 'E' : undefined)
    };
  }

  /** @deprecated use obtenerFiscalUiDesdeLog */
  async obtenerPagoFiscalDesdeLog(creditNoteId) {
    return this.obtenerFiscalUiDesdeLog(creditNoteId);
  }

  async crearBorrador(datos) {
    const uuidBorrador = `BORRADOR-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const resultado = await db.query(
      `
        INSERT INTO credit_notes (
          uuid, folio, customer_id, id_factura_origen, subtotal, tax, total,
          reason, relation_type, status, created_by, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        uuidBorrador,
        datos.folio,
        datos.customer_id,
        datos.invoice_id,
        Number(datos.subtotal ?? 0),
        Number(datos.tax ?? 0),
        Number(datos.total ?? 0),
        datos.reason || 'Nota de Crédito',
        datos.relation_type || '01',
        'BORRADOR',
        datos.user_id || null
      ]
    );

    const nota = resultado.rows[0];
    for (const item of datos.items) {
      await db.query(
        `
          INSERT INTO credit_note_items (
            credit_note_id, product_id, quantity, unit_price, discount, tax, total,
            sat_product_key, sat_unit_key, description
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          nota.id,
          item.product_id || null,
          Number(item.cantidad ?? item.quantity ?? 0),
          Number(item.precio_unitario ?? item.unit_price ?? 0),
          Number(item.descuento ?? item.discount ?? 0),
          Number(item.iva ?? item.tax ?? 0),
          Number(item.total ?? 0),
          item.sat_product_key || item.clave_sat_producto || '01010101',
          item.sat_unit_key || item.clave_sat_unidad || 'H87',
          item.descripcion
        ]
      ).catch((error) => console.warn('[NotasCredito] No se pudo guardar concepto de nota:', error.message));
    }

    await db.query(
      'INSERT INTO credit_note_relations (credit_note_id, invoice_uuid, relation_type) VALUES ($1,$2,$3)',
      [nota.id, datos.invoice_uuid, datos.relation_type]
    ).catch(() => null);

    await this.registrarLog(nota.id, 'CREAR_BORRADOR', { request: datos, user_id: datos.user_id });
    return this.obtenerPorId(nota.id);
  }

  async actualizarEstado(id, status, extra = {}) {
    const resultado = await db.query(
      `
        UPDATE credit_notes
        SET status = $1::varchar,
            uuid = COALESCE($2::text, uuid),
            stamped_at = CASE WHEN $3::timestamp IS NULL THEN stamped_at ELSE $3::timestamp END,
            updated_at = CURRENT_TIMESTAMP,
            sat_status = COALESCE($4::varchar, sat_status)
        WHERE id = $5::uuid
        RETURNING id
      `,
      [status, extra.uuid ?? null, extra.stamped_at ?? null, extra.sat_status ?? null, id]
    );
    return this.obtenerPorId(resultado.rows[0]?.id || id);
  }

  async aplicarSaldo(id, usuarioId) {
    const nota = await this.obtenerPorId(id);
    if (!nota) return null;

    await this.registrarMovimientoCobranza({
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'NC',
      descripcion: `Aplicacion de nota de credito ${nota.folio || nota.uuid || nota.id}`,
      referencia_tipo: 'credit_note',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null
    }).catch((err) => console.error('[RepositorioNotasCredito] Error in aplicarSaldo:', err.message));

    return this.actualizarEstado(id, 'APLICADA');
  }

  async registrarMovimientoCobranza(movimiento) {
    let refId = movimiento.referencia_id;
    let metadata = movimiento.metadata_json || {};

    if (typeof refId === 'string' && (refId.includes('-') || isNaN(Number(refId)))) {
      try {
        const cnQuery = await db.query(
          'SELECT id_factura_origen FROM credit_notes WHERE id = $1::uuid',
          [refId]
        );
        if (cnQuery.rows.length > 0 && cnQuery.rows[0].id_factura_origen) {
          refId = cnQuery.rows[0].id_factura_origen;
        } else {
          refId = Math.floor(Date.now() / 1000);
        }
      } catch (err) {
        console.warn('[RepositorioNotasCredito] Error looking up credit note by UUID:', err.message);
        refId = Math.floor(Date.now() / 1000);
      }
      metadata.credit_note_id = movimiento.referencia_id;
    } else {
      refId = Number(refId) || Math.floor(Date.now() / 1000);
    }

    if (movimiento.notas) metadata.notas = movimiento.notas;
    if (movimiento.estado_devolucion) metadata.estado_devolucion = movimiento.estado_devolucion;

    const query = `
      INSERT INTO customer_ledger (
        id_cliente, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono, metadata_json, usuario_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const values = [
      movimiento.id_cliente,
      movimiento.fecha || new Date(),
      movimiento.tipo_mov,
      movimiento.descripcion,
      movimiento.referencia_tipo,
      refId,
      movimiento.cargo || 0,
      movimiento.abono || 0,
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      movimiento.usuario_id || null
    ];

    const resultado = await db.query(query, values);
    return resultado.rows[0]?.id;
  }

  async registrarLog(creditNoteId, evento, datos = {}) {
    await db.query(
      `
        INSERT INTO credit_note_logs (credit_note_id, event, request_sat, response_sat, error, user_id)
        VALUES ($1::uuid,$2::varchar,$3::jsonb,$4::jsonb,$5::jsonb,$6::integer)
      `,
      [
        creditNoteId,
        evento,
        datos.request ? JSON.stringify(datos.request) : null,
        datos.response ? JSON.stringify(datos.response) : null,
        datos.error ? JSON.stringify(datos.error) : null,
        datos.user_id ?? null
      ]
    ).catch(() => null);
  }

  async obtenerConfigEmisor() {
    try {
      const resultado = await db.query(
        `
          SELECT rfc, razon_social, regimen_fiscal, codigo_postal
          FROM emisores
          ORDER BY id_emisor DESC
          LIMIT 1
        `
      );
      if (resultado.rows.length > 0) return resultado.rows[0];
    } catch (error) {
      console.warn('[NotasCredito] No se pudo leer emisor desde BD:', error.message);
    }
    return null;
  }

  convertirEstadoPersistencia(status) {
    const mapa = {
      BORRADOR: 'BORRADOR',
      TIMBRANDO: 'TIMBRANDO',
      TIMBRADA: 'TIMBRADA',
      ERROR: 'ERROR',
      CANCELADA: 'CANCELADA',
      APLICADA: 'APLICADA',
      PARCIAL: 'PARCIAL'
    };
    return mapa[String(status || '').toUpperCase()] || 'BORRADOR';
  }

  convertirMotivoPersistencia(reason) {
    const mapa = {
      DEVOLUCION: 'DEV',
      DESCUENTO: 'DESC',
      BONIFICACION: 'BON',
      AJUSTE_ADMINISTRATIVO: 'AJUS',
      CORRECCION_PARCIAL: 'CORR'
    };
    const valor = String(reason || '').toUpperCase();
    return mapa[valor] || valor.slice(0, 5) || 'NC';
  }
}

module.exports = RepositorioNotasCredito;
