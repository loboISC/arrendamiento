const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const ESTADOS_COTIZACION_CIERRE = [
  'aprobada',
  'aprobado',
  'pagada',
  'pagado',
  'facturada',
  'facturado',
  'convertida a contrato',
  'convertida contrato',
  'convertido a contrato',
  'convertido contrato'
];

const KPI_CATALOG = {
  ventas: [
    { key: 'totalCotizaciones', label: 'Total de cotizaciones', format: 'integer' },
    { key: 'cotizacionesCierre', label: 'Cotizaciones cerradas', format: 'integer' },
    { key: 'cotizacionesConvertidasContrato', label: 'Convertidas a contrato', format: 'integer' },
    { key: 'cotizacionesPerdidas', label: 'Cotizaciones perdidas', format: 'integer' },
    { key: 'montoCotizado', label: 'Monto cotizado', format: 'currency' },
    { key: 'montoCierre', label: 'Monto de cierre', format: 'currency' }
  ],
  contratos: [
    { key: 'totalContratos', label: 'Total contratos', format: 'integer' },
    { key: 'contratosActivos', label: 'Contratos activos', format: 'integer' },
    { key: 'contratosPorVencer7d', label: 'Por vencer en 7 dias', format: 'integer' },
    { key: 'contratosConcluidos', label: 'Contratos concluidos', format: 'integer' },
    { key: 'montoTotal', label: 'Monto total contratos', format: 'currency' },
    { key: 'montoActivo', label: 'Monto activo contratos', format: 'currency' }
  ],
  facturacion: [
    { key: 'totalFacturas', label: 'Total facturas', format: 'integer' },
    { key: 'timbradas', label: 'Facturas timbradas', format: 'integer' },
    { key: 'pendientes', label: 'Facturas pendientes', format: 'integer' },
    { key: 'canceladas', label: 'Facturas canceladas', format: 'integer' },
    { key: 'ingresosTimbrados', label: 'Ingresos timbrados', format: 'currency' },
    { key: 'porCobrar', label: 'Por cobrar', format: 'currency' },
    { key: 'montoCancelado', label: 'Monto cancelado', format: 'currency' }
  ],
  clientes: [
    { key: 'totalClientesGlobal', label: 'Total clientes', format: 'integer' },
    { key: 'clientesNuevosPeriodo', label: 'Clientes nuevos periodo', format: 'integer' },
    { key: 'clientesConActividad', label: 'Clientes con actividad', format: 'integer' },
    { key: 'montoContratosPeriodo', label: 'Monto contratos periodo', format: 'currency' },
    { key: 'montoFacturasPeriodo', label: 'Monto facturas periodo', format: 'currency' }
  ]
};

const ESTADOS_CATALOG = {
  cotizaciones: ['BORRADOR', 'ENVIADA', 'APROBADA', 'FACTURADA', 'CONVERTIDA_CONTRATO', 'PAGADA', 'RECHAZADA', 'CANCELADA', 'OTRO'],
  contratos: ['ACTIVO', 'CONCLUIDO', 'CANCELADO', 'POR_VENCER', 'OTRO'],
  facturas: ['TIMBRADA', 'PENDIENTE', 'VENCIDA', 'CANCELADA', 'PAGADA', 'OTRO']
};

const MEXICO_STATES = [
  { id: 'MX-AGU', name: 'Aguascalientes', aliases: ['aguascalientes'] },
  { id: 'MX-BCN', name: 'Baja California', aliases: ['baja california'] },
  { id: 'MX-BCS', name: 'Baja California Sur', aliases: ['baja california sur'] },
  { id: 'MX-CAM', name: 'Campeche', aliases: ['campeche'] },
  { id: 'MX-CHP', name: 'Chiapas', aliases: ['chiapas'] },
  { id: 'MX-CHH', name: 'Chihuahua', aliases: ['chihuahua'] },
  { id: 'MX-CMX', name: 'Ciudad de Mexico', aliases: ['ciudad de mexico', 'cdmx', 'distrito federal', 'df'] },
  { id: 'MX-COA', name: 'Coahuila', aliases: ['coahuila', 'coahuila de zaragoza'] },
  { id: 'MX-COL', name: 'Colima', aliases: ['colima'] },
  { id: 'MX-DUR', name: 'Durango', aliases: ['durango'] },
  { id: 'MX-GUA', name: 'Guanajuato', aliases: ['guanajuato'] },
  { id: 'MX-GRO', name: 'Guerrero', aliases: ['guerrero'] },
  { id: 'MX-HID', name: 'Hidalgo', aliases: ['hidalgo'] },
  { id: 'MX-JAL', name: 'Jalisco', aliases: ['jalisco'] },
  { id: 'MX-MEX', name: 'Estado de Mexico', aliases: ['estado de mexico', 'edomex', 'mexico'] },
  { id: 'MX-MIC', name: 'Michoacan', aliases: ['michoacan', 'michoacan de ocampo'] },
  { id: 'MX-MOR', name: 'Morelos', aliases: ['morelos'] },
  { id: 'MX-NAY', name: 'Nayarit', aliases: ['nayarit'] },
  { id: 'MX-NLE', name: 'Nuevo Leon', aliases: ['nuevo leon'] },
  { id: 'MX-OAX', name: 'Oaxaca', aliases: ['oaxaca'] },
  { id: 'MX-PUE', name: 'Puebla', aliases: ['puebla'] },
  { id: 'MX-QUE', name: 'Queretaro', aliases: ['queretaro', 'queretaro arteaga'] },
  { id: 'MX-ROO', name: 'Quintana Roo', aliases: ['quintana roo'] },
  { id: 'MX-SLP', name: 'San Luis Potosi', aliases: ['san luis potosi'] },
  { id: 'MX-SIN', name: 'Sinaloa', aliases: ['sinaloa'] },
  { id: 'MX-SON', name: 'Sonora', aliases: ['sonora'] },
  { id: 'MX-TAB', name: 'Tabasco', aliases: ['tabasco'] },
  { id: 'MX-TAM', name: 'Tamaulipas', aliases: ['tamaulipas'] },
  { id: 'MX-TLA', name: 'Tlaxcala', aliases: ['tlaxcala'] },
  { id: 'MX-VER', name: 'Veracruz', aliases: ['veracruz', 'veracruz de ignacio de la llave'] },
  { id: 'MX-YUC', name: 'Yucatan', aliases: ['yucatan'] },
  { id: 'MX-ZAC', name: 'Zacatecas', aliases: ['zacatecas'] }
];

function parseIsoDate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(query) {
  const today = new Date();
  const fallbackStart = new Date(today);
  fallbackStart.setDate(today.getDate() - 365);

  const from = parseIsoDate(query?.desde) || fallbackStart;
  const to = parseIsoDate(query?.hasta) || today;

  if (from > to) {
    return { error: 'Rango inválido: "desde" no puede ser mayor que "hasta"' };
  }

  return {
    desde: toIsoDate(from),
    hasta: toIsoDate(to)
  };
}

function normalizeBucket(raw) {
  const value = String(raw || 'mes').toLowerCase();
  if (value === 'dia') return 'day';
  if (value === 'semana') return 'week';
  return 'month';
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intOrZero(value) {
  return parseInt(value || 0, 10) || 0;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeEstado(tipo, estadoRaw) {
  const estado = normalizeText(estadoRaw);
  if (tipo === 'cotizaciones') {
    if (estado.includes('borrador')) return 'BORRADOR';
    if (estado.includes('enviad')) return 'ENVIADA';
    if (estado.includes('aprobad')) return 'APROBADA';
    if (estado.includes('facturad')) return 'FACTURADA';
    if (estado.includes('convert') && estado.includes('contrat')) return 'CONVERTIDA_CONTRATO';
    if (estado.includes('pagad')) return 'PAGADA';
    if (estado.includes('rechazad')) return 'RECHAZADA';
    if (estado.includes('cancelad')) return 'CANCELADA';
    return 'OTRO';
  }
  if (tipo === 'contratos') {
    if (estado.includes('activ')) return 'ACTIVO';
    if (estado.includes('conclu') || estado.includes('finaliz') || estado.includes('terminad')) return 'CONCLUIDO';
    if (estado.includes('cancelad')) return 'CANCELADO';
    if (estado.includes('venc')) return 'POR_VENCER';
    return 'OTRO';
  }
  if (tipo === 'facturas') {
    if (estado.includes('timbrad')) return 'TIMBRADA';
    if (estado.includes('pendient')) return 'PENDIENTE';
    if (estado.includes('vencid')) return 'VENCIDA';
    if (estado.includes('cancelad')) return 'CANCELADA';
    if (estado.includes('pagad')) return 'PAGADA';
    return 'OTRO';
  }
  return 'OTRO';
}

function mergeEstadoRows(rows, tipo) {
  const acc = new Map();
  for (const row of rows || []) {
    const key = normalizeEstado(tipo, row.estado);
    const next = (acc.get(key) || 0) + intOrZero(row.cantidad);
    acc.set(key, next);
  }
  return Array.from(acc.entries()).map(([estado, cantidad]) => ({ estado, cantidad }));
}

function mapSerieByPeriodo(rows, valueKey) {
  const map = new Map();
  for (const row of rows || []) {
    const periodo = toIsoDate(new Date(row.periodo));
    map.set(periodo, numberOrZero(row[valueKey]));
  }
  return map;
}

const MEXICO_STATE_ALIAS_TO_ID = (() => {
  const acc = {};
  MEXICO_STATES.forEach((state) => {
    state.aliases.forEach((alias) => {
      acc[normalizeText(alias)] = state.id;
    });
  });
  return acc;
})();

function resolveMexicoStateId(rawState) {
  const normalized = normalizeText(rawState);
  if (!normalized) return null;
  if (MEXICO_STATE_ALIAS_TO_ID[normalized]) return MEXICO_STATE_ALIAS_TO_ID[normalized];
  const byInclusion = MEXICO_STATES.find((s) => s.aliases.some((alias) => normalized.includes(normalizeText(alias))));
  return byInclusion ? byInclusion.id : null;
}

// Obtener todos los análisis
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM analisis ORDER BY fecha_generado DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un análisis manualmente
router.post('/', authenticateToken, async (req, res) => {
  const { tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO analisis (tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint unificado para examinar módulos: ventas, contratos, clientes y facturación
router.get('/operativo', authenticateToken, async (req, res) => {
  try {
    const range = resolveDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }

    const { desde, hasta } = range;
    const bucket = normalizeBucket(req.query?.periodo);
    const params = [desde, hasta];

    const [
      ventasKpisResult,
      ventasEmbudoResult,
      ventasPeriodoResult,
      contratosKpisResult,
      contratosPeriodoResult,
      facturasKpisResult,
      facturasPeriodoResult,
      facturasEstadoResult,
      clientesKpisResult,
      clientesPeriodoResult,
      topClientesResult,
      clientesMapaResult,
      clientesMapaDetalleResult
    ] = await Promise.all([
      db.query(
        `
          SELECT
            COUNT(*) AS total_cotizaciones,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(c.estado, '')) = ANY($3::text[])) AS cotizaciones_cierre,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(c.estado, '')) LIKE '%convert%contrat%') AS cotizaciones_convertidas_contrato,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(c.estado, '')) LIKE 'rechazad%' OR LOWER(COALESCE(c.estado, '')) LIKE 'cancelad%') AS cotizaciones_perdidas,
            COALESCE(SUM(c.total), 0) AS monto_cotizado,
            COALESCE(SUM(c.total) FILTER (WHERE LOWER(COALESCE(c.estado, '')) = ANY($3::text[])), 0) AS monto_cierre
          FROM cotizaciones c
          WHERE c.tipo = 'VENTA'
            AND c.fecha_cotizacion::date BETWEEN $1::date AND $2::date
        `,
        [...params, ESTADOS_COTIZACION_CIERRE]
      ),
      db.query(
        `
          SELECT COALESCE(c.estado, 'Sin estado') AS estado, COUNT(*)::int AS cantidad
          FROM cotizaciones c
          WHERE c.tipo = 'VENTA'
            AND c.fecha_cotizacion::date BETWEEN $1::date AND $2::date
          GROUP BY c.estado
          ORDER BY cantidad DESC
        `,
        params
      ),
      db.query(
        `
          SELECT
            date_trunc('${bucket}', c.fecha_cotizacion)::date AS periodo,
            COUNT(*)::int AS total_cotizaciones,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(c.estado, '')) = ANY($3::text[]))::int AS cotizaciones_cierre,
            COALESCE(SUM(c.total), 0) AS monto_cotizado,
            COALESCE(SUM(c.total) FILTER (WHERE LOWER(COALESCE(c.estado, '')) = ANY($3::text[])), 0) AS monto_cierre
          FROM cotizaciones c
          WHERE c.tipo = 'VENTA'
            AND c.fecha_cotizacion::date BETWEEN $1::date AND $2::date
          GROUP BY 1
          ORDER BY 1
        `,
        [...params, ESTADOS_COTIZACION_CIERRE]
      ),
      db.query(
        `
          WITH base AS (
            SELECT
              c.*,
              COALESCE(c.fecha_contrato, c.fecha_inicio, c.fecha_creacion)::date AS fecha_base
            FROM contratos c
          )
          SELECT
            COUNT(*)::int AS total_contratos,
            COUNT(*) FILTER (
              WHERE
                COALESCE(LOWER(base.estado), '') NOT LIKE '%conclu%'
                AND COALESCE(LOWER(base.estado), '') NOT LIKE '%cancel%'
                AND (base.fecha_fin IS NULL OR base.fecha_fin::date >= CURRENT_DATE)
            )::int AS contratos_activos,
            COUNT(*) FILTER (
              WHERE
                COALESCE(LOWER(base.estado), '') NOT LIKE '%conclu%'
                AND COALESCE(LOWER(base.estado), '') NOT LIKE '%cancel%'
                AND base.fecha_fin::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
            )::int AS contratos_por_vencer_7d,
            COUNT(*) FILTER (
              WHERE
                COALESCE(LOWER(base.estado), '') LIKE '%conclu%'
                OR (base.fecha_fin IS NOT NULL AND base.fecha_fin::date < CURRENT_DATE)
            )::int AS contratos_concluidos,
            COALESCE(SUM(base.total), 0) AS monto_total,
            COALESCE(SUM(base.total) FILTER (
              WHERE
                COALESCE(LOWER(base.estado), '') NOT LIKE '%conclu%'
                AND COALESCE(LOWER(base.estado), '') NOT LIKE '%cancel%'
                AND (base.fecha_fin IS NULL OR base.fecha_fin::date >= CURRENT_DATE)
            ), 0) AS monto_activo
          FROM base
          WHERE base.fecha_base BETWEEN $1::date AND $2::date
        `,
        params
      ),
      db.query(
        `
          WITH base AS (
            SELECT
              c.*,
              COALESCE(c.fecha_contrato, c.fecha_inicio, c.fecha_creacion) AS fecha_base
            FROM contratos c
          )
          SELECT
            date_trunc('${bucket}', base.fecha_base)::date AS periodo,
            COUNT(*)::int AS total_contratos,
            COUNT(*) FILTER (
              WHERE
                COALESCE(LOWER(base.estado), '') NOT LIKE '%conclu%'
                AND COALESCE(LOWER(base.estado), '') NOT LIKE '%cancel%'
            )::int AS abiertos,
            COALESCE(SUM(base.total), 0) AS monto_total
          FROM base
          WHERE base.fecha_base::date BETWEEN $1::date AND $2::date
          GROUP BY 1
          ORDER BY 1
        `,
        params
      ),
      db.query(
        `
          SELECT
            COUNT(*)::int AS total_facturas,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Timbrad%')::int AS timbradas,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Cancelad%')::int AS canceladas,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%')::int AS pendientes,
            COALESCE(SUM(f.total) FILTER (WHERE f.estado ILIKE 'Timbrad%'), 0) AS ingresos_timbrados,
            COALESCE(SUM(f.total) FILTER (WHERE f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%'), 0) AS por_cobrar,
            COALESCE(SUM(f.total) FILTER (WHERE f.estado ILIKE 'Cancelad%'), 0) AS monto_cancelado
          FROM facturas f
          WHERE f.fecha_emision::date BETWEEN $1::date AND $2::date
        `,
        params
      ),
      db.query(
        `
          SELECT
            date_trunc('${bucket}', f.fecha_emision)::date AS periodo,
            COUNT(*)::int AS total_facturas,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Timbrad%')::int AS timbradas,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%')::int AS pendientes,
            COUNT(*) FILTER (WHERE f.estado ILIKE 'Cancelad%')::int AS canceladas,
            COALESCE(SUM(f.total), 0) AS monto_facturado
          FROM facturas f
          WHERE f.fecha_emision::date BETWEEN $1::date AND $2::date
          GROUP BY 1
          ORDER BY 1
        `,
        params
      ),
      db.query(
        `
          SELECT COALESCE(f.estado, 'Sin estado') AS estado, COUNT(*)::int AS cantidad
          FROM facturas f
          WHERE f.fecha_emision::date BETWEEN $1::date AND $2::date
          GROUP BY f.estado
          ORDER BY cantidad DESC
        `,
        params
      ),
      db.query(
        `
          WITH actividad AS (
            SELECT id_cliente FROM cotizaciones WHERE fecha_cotizacion::date BETWEEN $1::date AND $2::date
            UNION
            SELECT id_cliente FROM contratos WHERE COALESCE(fecha_contrato, fecha_inicio, fecha_creacion)::date BETWEEN $1::date AND $2::date
            UNION
            SELECT id_cliente FROM facturas WHERE fecha_emision::date BETWEEN $1::date AND $2::date
          ),
          contratos_periodo AS (
            SELECT COALESCE(SUM(total), 0) AS monto
            FROM contratos
            WHERE COALESCE(fecha_contrato, fecha_inicio, fecha_creacion)::date BETWEEN $1::date AND $2::date
          ),
          facturas_periodo AS (
            SELECT COALESCE(SUM(total) FILTER (WHERE estado ILIKE 'Timbrad%'), 0) AS monto
            FROM facturas
            WHERE fecha_emision::date BETWEEN $1::date AND $2::date
          )
          SELECT
            (SELECT COUNT(*)::int FROM clientes) AS total_clientes_global,
            (SELECT COUNT(*)::int FROM clientes WHERE fecha_creacion::date BETWEEN $1::date AND $2::date) AS clientes_nuevos,
            (SELECT COUNT(*)::int FROM actividad) AS clientes_con_actividad,
            (SELECT monto FROM contratos_periodo) AS monto_contratos_periodo,
            (SELECT monto FROM facturas_periodo) AS monto_facturas_periodo
        `,
        params
      ),
      db.query(
        `
          SELECT
            date_trunc('${bucket}', c.fecha_creacion)::date AS periodo,
            COUNT(*)::int AS nuevos_clientes
          FROM clientes c
          WHERE c.fecha_creacion::date BETWEEN $1::date AND $2::date
          GROUP BY 1
          ORDER BY 1
        `,
        params
      ),
      db.query(
        `
          WITH ventas_aprobadas AS (
            SELECT id_cliente, COALESCE(SUM(total), 0) AS monto
            FROM cotizaciones
            WHERE tipo = 'VENTA'
              AND LOWER(COALESCE(estado, '')) = ANY($3::text[])
              AND fecha_cotizacion::date BETWEEN $1::date AND $2::date
            GROUP BY id_cliente
          ),
          contratos_periodo AS (
            SELECT id_cliente, COALESCE(SUM(total), 0) AS monto
            FROM contratos
            WHERE COALESCE(fecha_contrato, fecha_inicio, fecha_creacion)::date BETWEEN $1::date AND $2::date
            GROUP BY id_cliente
          ),
          facturas_timbradas AS (
            SELECT id_cliente, COALESCE(SUM(total), 0) AS monto
            FROM facturas
            WHERE estado ILIKE 'Timbrad%'
              AND fecha_emision::date BETWEEN $1::date AND $2::date
            GROUP BY id_cliente
          )
          SELECT
            cl.id_cliente,
            COALESCE(cl.razon_social, cl.empresa, cl.nombre, 'Sin nombre') AS cliente,
            COALESCE(v.monto, 0) AS monto_ventas_cierre,
            COALESCE(ct.monto, 0) AS monto_contratos,
            COALESCE(f.monto, 0) AS monto_facturas_timbradas,
            (COALESCE(v.monto, 0) + COALESCE(ct.monto, 0) + COALESCE(f.monto, 0)) AS valor_total
          FROM clientes cl
          LEFT JOIN ventas_aprobadas v ON cl.id_cliente = v.id_cliente
          LEFT JOIN contratos_periodo ct ON cl.id_cliente = ct.id_cliente
          LEFT JOIN facturas_timbradas f ON cl.id_cliente = f.id_cliente
          WHERE (COALESCE(v.monto, 0) + COALESCE(ct.monto, 0) + COALESCE(f.monto, 0)) > 0
          ORDER BY valor_total DESC
          LIMIT 20
        `,
        [...params, ESTADOS_COTIZACION_CIERRE]
      ),
      db.query(
        `
          SELECT
            COALESCE(NULLIF(TRIM(c.estado_direccion), ''), 'Sin estado') AS estado_raw,
            COALESCE(NULLIF(TRIM(c.ciudad), ''), NULLIF(TRIM(c.localidad), ''), 'Sin ciudad') AS ciudad_raw,
            COUNT(*)::int AS cantidad
          FROM clientes c
          GROUP BY 1, 2
        `
      ),
      db.query(
        `
          SELECT
            c.id_cliente,
            COALESCE(NULLIF(TRIM(c.estado_direccion), ''), 'Sin estado') AS estado_raw,
            COALESCE(NULLIF(TRIM(c.ciudad), ''), NULLIF(TRIM(c.localidad), ''), 'Sin ciudad') AS ciudad_raw,
            COALESCE(NULLIF(TRIM(c.razon_social), ''), NULLIF(TRIM(c.empresa), ''), NULLIF(TRIM(c.nombre), ''), CONCAT('Cliente #', c.id_cliente::text)) AS cliente
          FROM clientes c
        `
      )
    ]);

    const ventasKpisRaw = ventasKpisResult.rows[0] || {};
    const contratosKpisRaw = contratosKpisResult.rows[0] || {};
    const facturasKpisRaw = facturasKpisResult.rows[0] || {};
    const clientesKpisRaw = clientesKpisResult.rows[0] || {};

    const ventasKpis = {
      totalCotizaciones: intOrZero(ventasKpisRaw.total_cotizaciones),
      cotizacionesCierre: intOrZero(ventasKpisRaw.cotizaciones_cierre),
      cotizacionesConvertidasContrato: intOrZero(ventasKpisRaw.cotizaciones_convertidas_contrato),
      cotizacionesPerdidas: intOrZero(ventasKpisRaw.cotizaciones_perdidas),
      montoCotizado: numberOrZero(ventasKpisRaw.monto_cotizado),
      montoCierre: numberOrZero(ventasKpisRaw.monto_cierre)
    };

    const contratosKpis = {
      totalContratos: intOrZero(contratosKpisRaw.total_contratos),
      contratosActivos: intOrZero(contratosKpisRaw.contratos_activos),
      contratosPorVencer7d: intOrZero(contratosKpisRaw.contratos_por_vencer_7d),
      contratosConcluidos: intOrZero(contratosKpisRaw.contratos_concluidos),
      montoTotal: numberOrZero(contratosKpisRaw.monto_total),
      montoActivo: numberOrZero(contratosKpisRaw.monto_activo)
    };

    const facturacionKpis = {
      totalFacturas: intOrZero(facturasKpisRaw.total_facturas),
      timbradas: intOrZero(facturasKpisRaw.timbradas),
      pendientes: intOrZero(facturasKpisRaw.pendientes),
      canceladas: intOrZero(facturasKpisRaw.canceladas),
      ingresosTimbrados: numberOrZero(facturasKpisRaw.ingresos_timbrados),
      porCobrar: numberOrZero(facturasKpisRaw.por_cobrar),
      montoCancelado: numberOrZero(facturasKpisRaw.monto_cancelado)
    };

    const clientesKpis = {
      totalClientesGlobal: intOrZero(clientesKpisRaw.total_clientes_global),
      clientesNuevosPeriodo: intOrZero(clientesKpisRaw.clientes_nuevos),
      clientesConActividad: intOrZero(clientesKpisRaw.clientes_con_actividad),
      montoContratosPeriodo: numberOrZero(clientesKpisRaw.monto_contratos_periodo),
      montoFacturasPeriodo: numberOrZero(clientesKpisRaw.monto_facturas_periodo)
    };

    const ventasEmbudo = mergeEstadoRows(ventasEmbudoResult.rows, 'cotizaciones');
    const facturasEstados = mergeEstadoRows(facturasEstadoResult.rows, 'facturas');
    const estadosMap = new Map(MEXICO_STATES.map((s) => [s.id, { id: s.id, name: s.name, cantidad: 0 }]));
    const ciudadesPorEstadoMap = new Map();

    for (const row of clientesMapaResult.rows || []) {
      const stateId = resolveMexicoStateId(row.estado_raw);
      if (!stateId) continue;
      const cantidad = intOrZero(row.cantidad);
      const ciudad = String(row.ciudad_raw || 'Sin ciudad').trim() || 'Sin ciudad';
      const stateData = estadosMap.get(stateId);
      stateData.cantidad += cantidad;
      if (!ciudadesPorEstadoMap.has(stateId)) {
        ciudadesPorEstadoMap.set(stateId, new Map());
      }
      const cityMap = ciudadesPorEstadoMap.get(stateId);
      cityMap.set(ciudad, (cityMap.get(ciudad) || 0) + cantidad);
    }

    const clientesMapaEstados = Array.from(estadosMap.values());
    const clientesMapaCiudadesPorEstado = {};
    const clientesMapaClientesPorEstado = {};
    for (const [stateId, cityMap] of ciudadesPorEstadoMap.entries()) {
      clientesMapaCiudadesPorEstado[stateId] = Array.from(cityMap.entries())
        .map(([ciudad, cantidad]) => ({ ciudad, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
    }
    for (const row of clientesMapaDetalleResult.rows || []) {
      const stateId = resolveMexicoStateId(row.estado_raw);
      if (!stateId) continue;
      if (!clientesMapaClientesPorEstado[stateId]) {
        clientesMapaClientesPorEstado[stateId] = [];
      }
      clientesMapaClientesPorEstado[stateId].push({
        idCliente: intOrZero(row.id_cliente),
        cliente: String(row.cliente || '').trim() || `Cliente #${intOrZero(row.id_cliente)}`,
        ciudad: String(row.ciudad_raw || 'Sin ciudad').trim() || 'Sin ciudad'
      });
    }
    Object.keys(clientesMapaClientesPorEstado).forEach((stateId) => {
      clientesMapaClientesPorEstado[stateId].sort((a, b) => a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' }));
    });
    const maxClientesEstado = clientesMapaEstados.reduce((max, row) => Math.max(max, intOrZero(row.cantidad)), 0);

    const ventasSerieMap = mapSerieByPeriodo(ventasPeriodoResult.rows, 'monto_cierre');
    const contratosSerieMap = mapSerieByPeriodo(contratosPeriodoResult.rows, 'monto_total');
    const facturasSerieMap = mapSerieByPeriodo(facturasPeriodoResult.rows, 'monto_facturado');
    const periodosSet = new Set([
      ...Array.from(ventasSerieMap.keys()),
      ...Array.from(contratosSerieMap.keys()),
      ...Array.from(facturasSerieMap.keys())
    ]);
    const periodosOrdenados = Array.from(periodosSet).sort();
    const serieComparativa = periodosOrdenados.map((periodo) => ({
      periodo,
      ventas: numberOrZero(ventasSerieMap.get(periodo)),
      contratos: numberOrZero(contratosSerieMap.get(periodo)),
      facturas: numberOrZero(facturasSerieMap.get(periodo))
    }));

    const resumenGlobal = {
      periodo: { desde, hasta, bucket },
      pipelineComercial: {
        cotizaciones: ventasKpis.totalCotizaciones,
        contratos: contratosKpis.totalContratos,
        facturas: facturacionKpis.totalFacturas
      },
      montos: {
        cotizado: ventasKpis.montoCotizado,
        cierreComercial: ventasKpis.montoCierre,
        contratos: contratosKpis.montoTotal,
        facturadoTimbrado: facturacionKpis.ingresosTimbrados,
        porCobrar: facturacionKpis.porCobrar
      },
      ratios: {
        conversionCotizacionACierre: ventasKpis.totalCotizaciones > 0
          ? Number((ventasKpis.cotizacionesCierre / ventasKpis.totalCotizaciones).toFixed(4))
          : 0,
        conversionCotizacionAContrato: ventasKpis.totalCotizaciones > 0
          ? Number((ventasKpis.cotizacionesConvertidasContrato / ventasKpis.totalCotizaciones).toFixed(4))
          : 0
      }
    };

    return res.json({
      success: true,
      data: {
        filtros: { desde, hasta, periodo: bucket },
        resumenGlobal,
        ventas: {
          kpis: ventasKpis,
          embudo: ventasEmbudo,
          serie: ventasPeriodoResult.rows
        },
        contratos: {
          kpis: contratosKpis,
          serie: contratosPeriodoResult.rows
        },
        facturacion: {
          kpis: facturacionKpis,
          estados: facturasEstados,
          serie: facturasPeriodoResult.rows
        },
        clientes: {
          kpis: clientesKpis,
          serieNuevos: clientesPeriodoResult.rows,
          topClientesValor: topClientesResult.rows,
          mapa: {
            estados: clientesMapaEstados,
            ciudadesPorEstado: clientesMapaCiudadesPorEstado,
            clientesPorEstado: clientesMapaClientesPorEstado,
            maxClientesEstado
          }
        },
        comparativas: {
          serieOperativa: serieComparativa
        },
        catalogos: {
          kpis: KPI_CATALOG,
          estados: ESTADOS_CATALOG
        }
      }
    });
  } catch (err) {
    console.error('Error en /api/analisis/operativo:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Generar análisis de utilización de equipo en un periodo
router.post('/generar', authenticateToken, async (req, res) => {
  const { id_equipo, fecha_inicio, fecha_fin } = req.body;
  if (!id_equipo || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'id_equipo, fecha_inicio y fecha_fin son requeridos' });
  }
  try {
    // 1. Consultar movimientos del equipo en el periodo
    const { rows: movimientos } = await db.query(
      `SELECT * FROM movimientos_inventario WHERE id_equipo = $1 AND fecha >= $2 AND fecha < $3`,
      [id_equipo, fecha_inicio, fecha_fin]
    );
    // 2. Procesar datos (ejemplo: contar entradas/salidas)
    const totalEntradas = movimientos.filter(m => m.tipo_movimiento === 'Entrada').length;
    const totalSalidas = movimientos.filter(m => m.tipo_movimiento === 'Salida').length;
    // 3. Guardar el análisis
    const { rows } = await db.query(
      `INSERT INTO analisis (tipo, fecha_inicio, fecha_fin, id_equipo, resultado, generado_por, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        'Utilización',
        fecha_inicio,
        fecha_fin,
        id_equipo,
        JSON.stringify({ totalEntradas, totalSalidas }),
        req.user ? req.user.nombre : 'sistema',
        'Reporte de utilización generado automáticamente'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
