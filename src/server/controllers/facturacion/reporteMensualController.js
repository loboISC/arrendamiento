'use strict';
/**
 * src/server/controllers/facturacion/reporteMensualController.js
 *
 * Reporte Mensual — streams an .xlsx file directly to the response.
 * Uses exceljs (already in package.json). No file is stored on disk.
 *
 * Exported helpers (pure functions) are tested independently in TDD suite.
 */

const ExcelJS = require('exceljs');
const db = require('../../config/database');
const { crearNotificacion } = require('../../services/facturacionNotifService');

// ─── Pure helpers (exported for unit tests) ────────────────────────────────

/**
 * Derive SAT tipo-comprobante code from the stored folio prefix.
 *  P-XXXXX  → 'P' (Complemento de Pago)
 *  NC-XXXXX → 'E' (Egreso / Nota de Crédito)
 *  anything → 'I' (Ingreso / Factura)
 */
function deriveType(folio) {
  const f = String(folio || '').toUpperCase();
  if (f.startsWith('P-')) return 'P';
  if (f.startsWith('NC-')) return 'E';
  return 'I';
}

/**
 * Build the .xlsx filename.
 * Reporte_<RFC>_<MES>_<AÑO>.xlsx
 */
function buildFilename(rfc, mes, anio) {
  const rfcClean = String(rfc || 'RFC').replace(/[^A-Z0-9]/gi, '');
  const anioStr = String(anio || new Date().getFullYear());
  let mesStr;
  if (!mes || String(mes).toLowerCase() === 'todos') {
    mesStr = 'TODOS';
  } else {
    mesStr = String(parseInt(mes, 10) || 0).padStart(2, '0');
  }
  return `Reporte_${rfcClean}_${mesStr}_${anioStr}.xlsx`;
}

/**
 * Build the parameterised SQL query + values array.
 * Returns { query, values }.
 *
 * @param {object} p
 * @param {string}   p.emisor_rfc   - Required. Filters by emisor RFC.
 * @param {string[]} p.estatus      - Optional. ['VIGENTE','CANCELADA','APLICADA']
 * @param {string}   p.tipo_comprobante - 'emitidas'|'recibidas' (recibidas not stored, returns none)
 * @param {string[]} p.tipo_factura - Optional. ['I','E','P'] SAT codes
 * @param {string}   p.tipo_relacion - 'solo_facturas'|'complementos_facturas'
 * @param {string}   p.mes          - '1'-'12' or null/'todos'
 * @param {string}   p.anio         - e.g. '2026'
 * @param {string}   p.fecha_inicio - ISO date (when todos)
 * @param {string}   p.fecha_fin    - ISO date (when todos)
 */


function buildReportQuery(p = {}) {
  const {
    emisor_rfc,
    estatus,
    tipo_comprobante,
    tipo_factura,
    tipo_relacion,
    mes,
    anio,
    fecha_inicio,
    fecha_fin,
  } = p;

  const values = [emisor_rfc];
  let whereClause = 'WHERE t.rfc_emisor = $1';

  // ── Recibidas: not stored → impossible filter → add impossible condition
  if (tipo_comprobante === 'recibidas') {
    whereClause += ' AND 1=0';
  }

  // ── Estatus filter
  const estatusArr = Array.isArray(estatus) ? estatus : (estatus ? [estatus] : []);
  if (estatusArr.length > 0) {
    const conds = estatusArr.map(s => {
      const su = (s || '').toUpperCase();
      if (su === 'VIGENTE') {
        return `(UPPER(COALESCE(t.estado,'')) NOT LIKE 'CANCEL%'`
          + ` AND UPPER(COALESCE(t.estado,'')) NOT LIKE 'BORRADOR%'`
          + ` AND UPPER(COALESCE(t.estado,'')) != 'ERROR')`;
      }
      if (su === 'CANCELADA') return `UPPER(COALESCE(t.estado,'')) LIKE 'CANCEL%'`;
      if (su === 'APLICADA')  return `UPPER(COALESCE(t.estado,'')) LIKE 'APLICAD%'`;
      return null;
    }).filter(Boolean);
    if (conds.length > 0) {
      whereClause += ` AND (${conds.join(' OR ')})`;
    }
  }

  // ── Tipo factura filter (I / E / P mapped to tipo_comprobante column)
  const tipoArr = Array.isArray(tipo_factura)
    ? tipo_factura
    : (tipo_factura ? [tipo_factura] : []);
  if (tipoArr.length > 0 && tipoArr.length < 3) {
    const tipoConds = tipoArr.map(t => {
      const tu = (t || '').toUpperCase();
      if (tu === 'P') return `t.tipo_comprobante = 'P'`;
      if (tu === 'E') return `t.tipo_comprobante = 'E'`;
      if (tu === 'I') return `t.tipo_comprobante = 'I'`;
      return null;
    }).filter(Boolean);
    if (tipoConds.length > 0) {
      whereClause += ` AND (${tipoConds.join(' OR ')})`;
    }
  }

  // ── Tipo relación: "solo_facturas" excludes P-type complementos
  if (tipo_relacion === 'solo_facturas') {
    whereClause += ` AND t.tipo_comprobante != 'P'`;
  }

  // ── Date filter
  const mesNorm = String(mes || '').toLowerCase();
  if (mes && mesNorm !== 'todos') {
    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anio || new Date().getFullYear(), 10);
    values.push(mesNum);
    whereClause += ` AND EXTRACT(MONTH FROM t.fecha) = $${values.length}`;
    values.push(anioNum);
    whereClause += ` AND EXTRACT(YEAR FROM t.fecha) = $${values.length}`;
  } else if (fecha_inicio && fecha_fin) {
    values.push(fecha_inicio);
    whereClause += ` AND t.fecha >= $${values.length}`;
    values.push(fecha_fin);
    whereClause += ` AND t.fecha <= $${values.length}`;
  } else if (anio) {
    const anioNum = parseInt(anio, 10);
    values.push(anioNum);
    whereClause += ` AND EXTRACT(YEAR FROM t.fecha) = $${values.length}`;
  }

  const query = `
    WITH all_cfdis AS (
      SELECT
        CASE
          WHEN f.folio ILIKE 'P-%'  THEN 'P'
          WHEN f.folio ILIKE 'NC-%' THEN 'E'
          ELSE 'I'
        END AS tipo_comprobante,
        COALESCE(f.estado, '')  AS estado,
        f.fecha_emision         AS fecha,
        SPLIT_PART(COALESCE(f.folio, ''), '-', 1) AS serie,
        SPLIT_PART(COALESCE(f.folio, ''), '-', 2) AS folio_num,
        f.uuid::text            AS uuid,
        CASE
          WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL'
          ELSE COALESCE(c.razon_social, c.nombre, '')
        END AS receptor,
        COALESCE(e.razon_social, '') AS emisor,
        COALESCE(e.rfc, '')          AS rfc_emisor,
        fc.descripcion               AS concepto,
        COALESCE(f.total, 0)         AS monto_del_pago,
        COALESCE(f.moneda, 'MXN')    AS moneda,
        COALESCE(f.forma_pago,  '')  AS forma_pago,
        COALESCE(f.metodo_pago, '')  AS metodo_pago
      FROM facturas f
      LEFT JOIN clientes c  ON c.id_cliente  = f.id_cliente
      LEFT JOIN emisores e  ON e.id_emisor   = f.id_emisor
      LEFT JOIN LATERAL (
        SELECT COALESCE(descripcion, '') AS descripcion
        FROM   conceptos_factura
        WHERE  id_factura = f.id_factura
        ORDER BY id_concepto ASC
        LIMIT 1
      ) fc ON true

      UNION ALL

      SELECT
        'E' AS tipo_comprobante,
        COALESCE(cn.status, '') AS estado,
        cn.created_at AS fecha,
        SPLIT_PART(COALESCE(cn.folio, ''), '-', 1) AS serie,
        SPLIT_PART(COALESCE(cn.folio, ''), '-', 2) AS folio_num,
        cn.uuid::text AS uuid,
        CASE
          WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL'
          ELSE COALESCE(c.razon_social, c.nombre, '')
        END AS receptor,
        COALESCE(e.razon_social, '') AS emisor,
        COALESCE(e.rfc, '')          AS rfc_emisor,
        cni.descripcion              AS concepto,
        COALESCE(cn.total, 0)        AS monto_del_pago,
        COALESCE(f_orig.moneda, 'MXN') AS moneda,
        '' AS forma_pago,
        '' AS metodo_pago
      FROM credit_notes cn
      LEFT JOIN clientes c ON c.id_cliente = cn.customer_id
      LEFT JOIN facturas f_orig ON f_orig.id_factura = cn.id_factura_origen
      LEFT JOIN emisores e ON e.id_emisor = f_orig.id_emisor
      LEFT JOIN LATERAL (
        SELECT COALESCE(description, '') AS descripcion
        FROM   credit_note_items
        WHERE  credit_note_id = cn.id
        ORDER BY created_at ASC
        LIMIT 1
      ) cni ON true
    )
    SELECT *
    FROM all_cfdis t
    ${whereClause}
    ORDER BY t.fecha DESC
  `;

  return { query, values };
}

/**
 * Build an ExcelJS workbook with the 21-column report.
 * Returns a Workbook instance (not yet written to any stream).
 *
 * @param {object[]} rows         - DB result rows
 * @param {object}   options
 * @param {boolean}  options.incluirConcepto
 */
function buildReportWorkbook(rows, options = {}) {
  const { incluirConcepto = true } = options;

  const HEADERS = [
    'TipoComprobante', 'Estado',    'Fecha',          'Serie',        'Folio',
    'UUID',            'Receptor',  'Emisor',          'RFC',           'Concepto',
    'MontoDelPago',    'Moneda',    'UUIDRelacionado', 'FechaPago',    'NumParcialidad',
    'MonedaRel',       'FormaPago', 'MetodoPago',      'SaldoAnterior','TotalPagado',
    'SaldoInsoluto',
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAPT - Reporte Mensual';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte Mensual', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // ── Header row
  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A56A0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // ── Column widths
  const colWidths = [14,12,12,8,14,38,35,35,16,40,14,8,38,12,14,10,10,12,13,13,14];
  sheet.columns = HEADERS.map((h, i) => ({ header: h, width: colWidths[i] || 14 }));
  // Re-apply header fill after setting columns (exceljs resets fill on column set)
  const headerRow2 = sheet.getRow(1);
  headerRow2.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56A0' } };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };

  // ── Data rows
  for (const row of rows) {
    const fechaStr = row.fecha
      ? new Date(row.fecha).toISOString().split('T')[0]
      : '';

    sheet.addRow([
      row.tipo_comprobante  || '',
      row.estado            || '',
      fechaStr,
      row.serie             || '',
      row.folio_num         || '',
      row.uuid              || '',
      row.receptor          || '',
      row.emisor            || '',
      row.rfc_emisor        || '',
      incluirConcepto ? (row.concepto || '') : '',   // Concepto
      row.monto_del_pago    != null ? Number(row.monto_del_pago) : 0,
      row.moneda            || 'MXN',
      '',  // UUIDRelacionado — not in DB
      '',  // FechaPago       — not in DB
      '',  // NumParcialidad  — not in DB
      '',  // MonedaRel       — not in DB
      row.forma_pago        || '',
      row.metodo_pago       || '',
      '',  // SaldoAnterior   — not in DB
      '',  // TotalPagado     — not in DB
      '',  // SaldoInsoluto   — not in DB
    ]);
  }

  // ── Alternating row colours for readability
  for (let i = 2; i <= sheet.rowCount; i++) {
    const r = sheet.getRow(i);
    if (i % 2 === 0) {
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } };
    }
    r.alignment = { vertical: 'middle' };
  }

  return workbook;
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/facturas/reporte-mensual
 *
 * Query params (all optional except emisor_rfc):
 *   emisor_rfc, estatus[], tipo_comprobante, tipo_factura[], tipo_relacion,
 *   mes, anio, fecha_inicio, fecha_fin, incluir_concepto
 */
exports.generarReporteMensual = async (req, res) => {
  try {
    const {
      emisor_rfc,
      estatus,
      tipo_comprobante,
      tipo_factura,
      tipo_relacion,
      mes,
      anio,
      fecha_inicio,
      fecha_fin,
      incluir_concepto,
    } = req.query;

    if (!emisor_rfc) {
      return res.status(400).json({ success: false, error: 'emisor_rfc es requerido' });
    }

    const { query, values } = buildReportQuery({
      emisor_rfc,
      estatus,
      tipo_comprobante,
      tipo_factura,
      tipo_relacion,
      mes,
      anio,
      fecha_inicio,
      fecha_fin,
    });

    const result = await db.query(query, values);
    const rows = result.rows;

    const incluirConcepto = incluir_concepto === 'true' || incluir_concepto === '1' || incluir_concepto === true;

    const workbook = buildReportWorkbook(rows, { incluirConcepto });
    const filename  = buildFilename(emisor_rfc, mes, anio);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    await workbook.xlsx.write(res);
    
    // Registrar notificación de generación de reporte
    crearNotificacion({
        tipo: 'REPORTE_GENERADO',
        mensaje: `Reporte mensual generado para RFC: ${emisor_rfc}. Periodo: ${mes || 'TODOS'}/${anio || new Date().getFullYear()}`,
        modulo: 'reportes',
        referencia_tipo: 'reporte',
        referencia_id: filename,
        id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
        metadata: {
            emisor_rfc,
            mes,
            anio,
            filename
        }
    }).catch(err => console.error('[DEBUG] Error al crear notificación de reporte:', err));

    res.end();
  } catch (error) {
    console.error('[ReporteMensual] Error generando reporte:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Error interno al generar el reporte' });
    }
  }
};

// ── Named exports for unit testing
exports.deriveType        = deriveType;
exports.buildFilename     = buildFilename;
exports.buildReportQuery  = buildReportQuery;
exports.buildReportWorkbook = buildReportWorkbook;
