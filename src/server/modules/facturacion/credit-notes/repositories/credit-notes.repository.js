const db = require('../../../../config/database');

const LEDGER_TIPOS_CARGO = ['CARGO', 'COBRO_CREDITO', 'COBRO'];
const LEDGER_TIPOS_ABONO = ['ABONO', 'PAGO', 'NC'];

/**
 * Repositorio de notas de credito.
 * Estructura de tablas actualizada (20260519):
 * credit_notes: id (UUID), customer_id, tax, relation_type, reason, status, created_at, etc.
 */
class RepositorioNotasCredito {
  async asegurarColumnaResponsableTimbrado() {
    if (this.columnaResponsableTimbradoLista) return;
    await db.query(`
      ALTER TABLE public.credit_notes
      ADD COLUMN IF NOT EXISTS stamped_by INTEGER NULL
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_credit_notes_stamped_by
      ON public.credit_notes(stamped_by)
    `).catch(() => null);
    this.columnaResponsableTimbradoLista = true;
  }

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
        COALESCE(c.email, '') AS customer_email,
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
          NULL AS product_id,
          COALESCE(cantidad, 1) AS cantidad,
          COALESCE(valor_unitario, importe, 0) AS precio_unitario,
          COALESCE(descuento, 0) AS descuento,
          COALESCE(iva_importe, 0) AS iva,
          COALESCE(importe, 0) AS total,
          COALESCE(clave_prod_serv, '01010101') AS sat_product_key,
          COALESCE(clave_unidad, 'H87') AS sat_unit_key,
          COALESCE(descripcion, 'Concepto de factura') AS descripcion
        FROM conceptos_factura
        WHERE id_factura = $1
        ORDER BY id_concepto ASC
      `,
      [invoiceId]
    )

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
          AND UPPER(COALESCE(status, '')) IN ('TIMBRADA', 'APLICADA', 'PARCIAL')
      `,
      [invoiceId]
    );
    return Number(resultado.rows[0]?.total || 0);
  }

  _construirFiltrosListado(filtros = {}) {
    const valores = [];
    let where = ' WHERE 1=1';

    if (filtros.customer_id) {
      valores.push(Number(filtros.customer_id));
      where += ` AND cn.customer_id = $${valores.length}`;
    }

    if (filtros.status) {
      valores.push(String(filtros.status).toUpperCase());
      where += ` AND UPPER(REPLACE(COALESCE(cn.status, ''), ' ', '_')) = $${valores.length}`;
    }

    if (filtros.search) {
      const busqueda = `%${String(filtros.search).trim()}%`;
      if (busqueda !== '%%') {
        valores.push(busqueda);
        where += ` AND (
          COALESCE(cn.folio, '') ILIKE $${valores.length}
          OR COALESCE(cn.uuid, '') ILIKE $${valores.length}
          OR cn.id::text ILIKE $${valores.length}
          OR COALESCE(c.nombre, '') ILIKE $${valores.length}
          OR COALESCE(c.razon_social, '') ILIKE $${valores.length}
          OR COALESCE(c.rfc, '') ILIKE $${valores.length}
          OR COALESCE(f.folio, '') ILIKE $${valores.length}
          OR COALESCE(f.uuid::text, '') ILIKE $${valores.length}
          OR COALESCE(u_stamped.nombre, '') ILIKE $${valores.length}
          OR COALESCE(u_created.nombre, '') ILIKE $${valores.length}
        )`;
      }
    }

    if (filtros.dateFrom) {
      valores.push(filtros.dateFrom);
      where += ` AND COALESCE(cn.stamped_at, cn.created_at)::date >= $${valores.length}::date`;
    }

    if (filtros.dateTo) {
      valores.push(filtros.dateTo);
      where += ` AND COALESCE(cn.stamped_at, cn.created_at)::date <= $${valores.length}::date`;
    }

    return { where, valores };
  }

  _consultaNotasPorClienteBase() {
    return `
      SELECT
        cn.id,
        cn.uuid,
        cn.folio,
        cn.status,
        cn.sat_status,
        cn.reason AS motivo_sat,
        cn.total,
        cn.subtotal,
        cn.tax,
        cn.relation_type,
        cn.created_at AS fecha_creacion,
        cn.stamped_at,
        cn.id_factura_origen,
        cn.pdf_path,
        cn.xml_path,
        f.folio AS invoice_folio_origen,
        f.uuid::text AS invoice_uuid_origen,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM customer_ledger cl
            WHERE cl.id_cliente = cn.customer_id
              AND UPPER(cl.tipo_mov) = 'SALDO_FAVOR'
              AND (
                cl.metadata_json->>'credit_note_id' = cn.id::text
                OR cl.descripcion ILIKE '%' || COALESCE(cn.folio, cn.uuid, cn.id::text) || '%'
              )
          ) THEN 'SALDO_FAVOR'
          WHEN EXISTS (
            SELECT 1 FROM customer_ledger cl
            WHERE cl.id_cliente = cn.customer_id
              AND UPPER(cl.tipo_mov) = 'DEVOLUCION'
              AND (
                cl.metadata_json->>'credit_note_id' = cn.id::text
                OR cl.descripcion ILIKE '%' || COALESCE(cn.folio, cn.uuid, cn.id::text) || '%'
              )
          ) THEN 'DEVOLUCION'
          WHEN EXISTS (
            SELECT 1 FROM customer_ledger cl
            WHERE cl.id_cliente = cn.customer_id
              AND UPPER(cl.tipo_mov) IN ('ABONO', 'NC')
              AND (
                cl.metadata_json->>'credit_note_id' = cn.id::text
                OR (
                  cl.referencia_tipo ILIKE '%credit_note%'
                  AND cl.descripcion ILIKE '%' || COALESCE(cn.folio, cn.uuid, cn.id::text) || '%'
                )
              )
          ) OR UPPER(COALESCE(cn.status, '')) = 'APLICADA' THEN 'APLICAR'
          ELSE NULL
        END AS apply_type,
        EXISTS (
          SELECT 1 FROM customer_ledger cl
          WHERE cl.id_cliente = cn.customer_id
            AND UPPER(cl.tipo_mov) = 'SALDO_FAVOR'
            AND (
              cl.metadata_json->>'credit_note_id' = cn.id::text
              OR cl.descripcion ILIKE '%' || COALESCE(cn.folio, cn.uuid, cn.id::text) || '%'
            )
        ) AS saldo_favor_aplicado
      FROM credit_notes cn
      LEFT JOIN facturas f ON f.id_factura = cn.id_factura_origen
    `;
  }

  async listarPorCliente(customerId) {
    const clienteId = Number(customerId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) return [];

    const consulta = `
      ${this._consultaNotasPorClienteBase()}
      WHERE cn.customer_id = $1
      ORDER BY cn.created_at DESC
    `;
    const resultado = await db.query(consulta, [clienteId]);
    return resultado.rows;
  }

  async listar(filtros = {}) {
    await this.asegurarColumnaResponsableTimbrado();

    const limit = Math.min(Math.max(Number.parseInt(filtros.limit, 10) || 15, 1), 100);
    const page = Math.max(Number.parseInt(filtros.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    const { where, valores } = this._construirFiltrosListado(filtros);

    const consultaBase = `
      FROM credit_notes cn
      LEFT JOIN clientes c ON c.id_cliente = cn.customer_id
      LEFT JOIN facturas f ON f.id_factura = cn.id_factura_origen
      LEFT JOIN usuarios u_stamped ON u_stamped.id_usuario = cn.stamped_by
      LEFT JOIN usuarios u_created ON u_created.id_usuario = cn.created_by
      ${where}
    `;

    const totalResultado = await db.query(
      `SELECT COUNT(*)::int AS total ${consultaBase}`,
      valores
    );
    const total = Number(totalResultado.rows[0]?.total || 0);

    const consultaDatos = `
      SELECT
        cn.*,
        c.nombre AS customer_name,
        c.razon_social,
        COALESCE(u_stamped.nombre, u_stamped.correo, '') AS stamped_by_name,
        COALESCE(u_created.nombre, u_created.correo, '') AS created_by_name,
        f.uuid::text AS invoice_uuid_origen,
        f.folio AS invoice_folio_origen,
        (
          SELECT json_build_object(
            'id', sibling.id,
            'pdf_path', sibling.pdf_path,
            'xml_path', sibling.xml_path,
            'folio', sibling.folio,
            'total', sibling.total
          )
          FROM credit_notes sibling
          WHERE sibling.id_factura_origen = cn.id_factura_origen
            AND sibling.status = 'TIMBRADA'
            AND sibling.id != cn.id
          ORDER BY sibling.created_at DESC
          LIMIT 1
        ) AS stamped_sibling
      ${consultaBase}
      ORDER BY cn.created_at DESC
      LIMIT $${valores.length + 1}
      OFFSET $${valores.length + 2}
    `;

    const resultado = await db.query(consultaDatos, [...valores, limit, offset]);

    return {
      items: resultado.rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async obtenerPorId(id) {
    const nota = await db.query(
      `
        SELECT
          cn.*,
          c.nombre AS customer_name,
          c.razon_social,
          c.rfc AS customer_rfc,
          c.email AS customer_email,
          c.regimen_fiscal AS tax_regime,
          c.codigo_postal AS postal_code,
          COALESCE(c.limite_credito, 0) AS limite_credito,
          f.uuid::text AS invoice_uuid_origen,
          f.folio AS invoice_folio_origen,
          COALESCE(f.subtotal, 0) AS invoice_subtotal_origen,
          COALESCE(f.total_iva, 0) AS invoice_tax_origen,
          COALESCE(f.total, 0) AS invoice_total_origen,
          GREATEST(COALESCE(f.total, 0) - COALESCE(nc.total_acreditado, 0), 0) AS invoice_saldo_disponible_origen,
          (
            SELECT json_build_object(
              'id', sibling.id,
              'pdf_path', sibling.pdf_path,
              'xml_path', sibling.xml_path,
              'folio', sibling.folio,
              'total', sibling.total
            )
            FROM credit_notes sibling
            WHERE sibling.id_factura_origen = cn.id_factura_origen
              AND sibling.status = 'TIMBRADA'
              AND sibling.id != $1::uuid
            ORDER BY sibling.created_at DESC
            LIMIT 1
          ) AS stamped_sibling
        FROM credit_notes cn
        LEFT JOIN clientes c ON c.id_cliente = cn.customer_id
        LEFT JOIN facturas f ON f.id_factura = cn.id_factura_origen
        LEFT JOIN (
          SELECT id_factura_origen, COALESCE(SUM(total), 0) AS total_acreditado
          FROM credit_notes
          WHERE UPPER(COALESCE(status, '')) NOT IN ('CANCELADA', 'ERROR')
            AND id != $1::uuid
          GROUP BY id_factura_origen
        ) nc ON nc.id_factura_origen = cn.id_factura_origen
        WHERE cn.id = $1::uuid
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

  async actualizarBorrador(id, datos) {
    await db.query(
      `
        UPDATE credit_notes
        SET subtotal = $1,
            tax = $2,
            total = $3,
            reason = $4,
            relation_type = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6::uuid
      `,
      [
        Number(datos.subtotal ?? 0),
        Number(datos.tax ?? 0),
        Number(datos.total ?? 0),
        datos.reason || 'Nota de Crédito',
        datos.relation_type || '01',
        id
      ]
    );

    // Eliminar items existentes
    await db.query('DELETE FROM credit_note_items WHERE credit_note_id = $1::uuid', [id]);

    // Insertar nuevos items
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
          id,
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

    // Actualizar relación
    await db.query('DELETE FROM credit_note_relations WHERE credit_note_id = $1::uuid', [id]);
    await db.query(
      'INSERT INTO credit_note_relations (credit_note_id, invoice_uuid, relation_type) VALUES ($1,$2,$3)',
      [id, datos.invoice_uuid, datos.relation_type]
    ).catch(() => null);

    await this.registrarLog(id, 'ACTUALIZAR_BORRADOR', { request: datos, user_id: datos.user_id });
    return this.obtenerPorId(id);
  }

  async eliminarOtrosBorradores(idFacturaOrigen, idExcluido) {
    if (!idFacturaOrigen) return;
    await db.query(
      `
        DELETE FROM credit_notes
        WHERE id_factura_origen = $1
          AND status = 'BORRADOR'
          AND id != $2::uuid
      `,
      [idFacturaOrigen, idExcluido]
    );
  }

  async actualizarEstado(id, status, extra = {}) {
    if (extra.stamped_by != null) {
      await this.asegurarColumnaResponsableTimbrado();
    }

    const resultado = await db.query(
      `
        UPDATE credit_notes
        SET status = $1::varchar,
            uuid = COALESCE($2::text, uuid),
            stamped_at = CASE WHEN $3::timestamp IS NULL THEN stamped_at ELSE $3::timestamp END,
            updated_at = CURRENT_TIMESTAMP,
            sat_status = COALESCE($4::varchar, sat_status),
            pdf_path = COALESCE($5::text, pdf_path),
            xml_path = COALESCE($6::text, xml_path),
            stamped_by = COALESCE($7::integer, stamped_by),
            updated_by = COALESCE($8::integer, updated_by),
            cancellation_reason = COALESCE($10::varchar, cancellation_reason),
            cancellation_uuid_sust = COALESCE($11::uuid, cancellation_uuid_sust)
        WHERE id = $9::uuid
        RETURNING id
      `,
      [
        status,
        extra.uuid ?? null,
        extra.stamped_at ?? null,
        extra.sat_status ?? null,
        extra.pdf_path ?? null,
        extra.xml_path ?? null,
        extra.stamped_by ?? null,
        extra.updated_by ?? extra.stamped_by ?? null,
        id,
        extra.cancellation_reason ?? null,
        extra.cancellation_uuid_sust ?? null
      ]
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

  async incrementarLimiteCredito(customerId, monto) {
    const resultado = await db.query(
      `
        UPDATE clientes
        SET limite_credito = COALESCE(limite_credito, 0) + $2
        WHERE id_cliente = $1
        RETURNING COALESCE(limite_credito, 0) AS limite_credito
      `,
      [customerId, Number(monto) || 0]
    );
    return Number(resultado.rows[0]?.limite_credito || 0);
  }

  async obtenerEmailCliente(customerId) {
    const resultado = await db.query(
      'SELECT COALESCE(email, \'\') AS email FROM clientes WHERE id_cliente = $1 LIMIT 1',
      [customerId]
    );
    return String(resultado.rows[0]?.email || '').trim();
  }

  async calcularDeudaCliente(clienteId) {
    const deudaResult = await db.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN tipo_mov = ANY($2::text[]) THEN cargo ELSE 0 END), 0) AS total_cargo,
          COALESCE(SUM(CASE WHEN tipo_mov = ANY($3::text[]) THEN abono ELSE 0 END), 0) AS total_abono
        FROM customer_ledger
        WHERE id_cliente = $1
      `,
      [clienteId, LEDGER_TIPOS_CARGO, LEDGER_TIPOS_ABONO]
    );
    const row = deudaResult.rows[0] || {};
    const totalCargo = parseFloat(row.total_cargo || 0);
    const totalAbono = parseFloat(row.total_abono || 0);
    return Number((totalCargo - totalAbono).toFixed(2));
  }

  async calcularSaldoFacturaLedger(clienteId, facturaOrigenId) {
    const saldoFacturaRes = await db.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN tipo_mov = ANY($3::text[]) THEN cargo ELSE 0 END), 0) AS cargo,
          COALESCE(SUM(CASE WHEN tipo_mov = ANY($4::text[]) THEN abono ELSE 0 END), 0) AS abono
        FROM customer_ledger
        WHERE id_cliente = $1 AND referencia_id = $2
      `,
      [clienteId, facturaOrigenId, LEDGER_TIPOS_CARGO, LEDGER_TIPOS_ABONO]
    );
    const cargo = Number(saldoFacturaRes.rows[0]?.cargo || 0);
    const abono = Number(saldoFacturaRes.rows[0]?.abono || 0);
    return Number((cargo - abono).toFixed(2));
  }

  async obtenerLimiteCredito(clienteId) {
    const resultado = await db.query(
      'SELECT COALESCE(limite_credito, 0) AS limite_credito FROM clientes WHERE id_cliente = $1 LIMIT 1',
      [clienteId]
    );
    return Number(resultado.rows[0]?.limite_credito || 0);
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
