/**
 * tests/controllers/reporte-mensual.test.js
 * TDD tests for Reporte Mensual feature.
 * Covers: helper functions (unit) + route integration (supertest, DB mocked).
 */

// ─── Mock DB before any imports ───────────────────────────────────────────────
const mockQueryFn = jest.fn();
jest.mock('../../src/server/config/database', () => ({
  query: mockQueryFn,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
const {
  deriveType,
  buildFilename,
  buildReportQuery,
  buildReportWorkbook,
} = require('../../src/server/controllers/facturacion/reporteMensualController');

// ─── Unit tests: pure helper functions ────────────────────────────────────────

describe('deriveType(folio)', () => {
  it('returns P for P-XXXXXXXX folios', () => {
    expect(deriveType('P-1A2B3C4D')).toBe('P');
  });

  it('returns E for NC-XXXXXXXX folios', () => {
    expect(deriveType('NC-ABCD1234')).toBe('E');
  });

  it('returns I for regular B-XXXXXXXX folios', () => {
    expect(deriveType('B-ABCD1234')).toBe('I');
  });

  it('returns I when folio is null or empty', () => {
    expect(deriveType(null)).toBe('I');
    expect(deriveType('')).toBe('I');
    expect(deriveType(undefined)).toBe('I');
  });

  it('is case-insensitive for NC- prefix', () => {
    expect(deriveType('nc-ABCD')).toBe('E');
  });
});

describe('buildFilename(rfc, mes, anio)', () => {
  it('returns correct filename for specific month', () => {
    expect(buildFilename('AAP123456789', '3', '2026')).toBe('Reporte_AAP123456789_03_2026.xlsx');
  });

  it('pads single-digit month with leading zero', () => {
    expect(buildFilename('RFC', '1', '2025')).toBe('Reporte_RFC_01_2025.xlsx');
  });

  it('uses TODOS when mes is null or "todos"', () => {
    expect(buildFilename('RFC', null, '2026')).toBe('Reporte_RFC_TODOS_2026.xlsx');
    expect(buildFilename('RFC', 'todos', '2026')).toBe('Reporte_RFC_TODOS_2026.xlsx');
  });

  it('strips non-alphanumeric chars from RFC', () => {
    expect(buildFilename('A&B-123!', '6', '2025')).toBe('Reporte_AB123_06_2025.xlsx');
  });
});

describe('buildReportQuery(params)', () => {
  it('always includes WHERE t.rfc_emisor = $1', () => {
    const { query, values } = buildReportQuery({ emisor_rfc: 'RFC001' });
    expect(query).toContain('WHERE');
    expect(query).toContain('t.rfc_emisor = $1');
    expect(values[0]).toBe('RFC001');
  });

  it('adds estatus condition for VIGENTE', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC', estatus: ['VIGENTE'] });
    expect(query.toUpperCase()).toContain('CANCEL');
  });

  it('adds estatus condition for CANCELADA', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC', estatus: ['CANCELADA'] });
    expect(query.toUpperCase()).toContain("CANCEL");
  });

  it('filters P-type folios when tipo_factura is ["P"]', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC', tipo_factura: ['P'] });
    expect(query).toContain("t.tipo_comprobante = 'P'");
  });

  it('filters NC-type folios when tipo_factura is ["E"]', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC', tipo_factura: ['E'] });
    expect(query).toContain("t.tipo_comprobante = 'E'");
  });

  it('excludes P-type folios when tipo_relacion is solo_facturas', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC', tipo_relacion: 'solo_facturas' });
    expect(query).toContain("t.tipo_comprobante != 'P'");
  });

  it('adds month/year filter when mes is numeric', () => {
    const { query, values } = buildReportQuery({ emisor_rfc: 'RFC', mes: '3', anio: '2026' });
    expect(query).toContain('EXTRACT(MONTH');
    expect(values).toContain(3);
    expect(values).toContain(2026);
  });

  it('adds date range filter when mes is todos and fecha_inicio/fin provided', () => {
    const { query, values } = buildReportQuery({
      emisor_rfc: 'RFC',
      mes: 'todos',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-06-30',
    });
    expect(query).toContain('t.fecha >=');
    expect(values).toContain('2026-01-01');
    expect(values).toContain('2026-06-30');
  });

  it('includes conceptos_factura lateral join', () => {
    const { query } = buildReportQuery({ emisor_rfc: 'RFC' });
    expect(query).toContain('conceptos_factura');
  });

  it('returns no extra conditions when no filters supplied', () => {
    const { query, values } = buildReportQuery({ emisor_rfc: 'RFC_ONLY' });
    expect(values).toHaveLength(1);
    expect(values[0]).toBe('RFC_ONLY');
  });
});

describe('buildReportWorkbook(rows, options)', () => {
  const EXPECTED_HEADERS = [
    'TipoComprobante', 'Estado', 'Fecha', 'Serie', 'Folio', 'UUID',
    'Receptor', 'Emisor', 'RFC', 'Concepto', 'MontoDelPago', 'Moneda',
    'UUIDRelacionado', 'FechaPago', 'NumParcialidad', 'MonedaRel',
    'FormaPago', 'MetodoPago', 'SaldoAnterior', 'TotalPagado', 'SaldoInsoluto',
  ];

  const sampleRow = {
    tipo_comprobante: 'I',
    estado: 'APLICADA',
    fecha: new Date('2026-03-15'),
    serie: 'B',
    folio_num: 'ABCD1234',
    uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    receptor: 'EMPRESA RECEPTORA SA',
    emisor: 'EMISOR SA',
    rfc_emisor: 'EMI123456789',
    concepto: 'Servicio de arrendamiento mes marzo',
    monto_del_pago: 10000,
    moneda: 'MXN',
    forma_pago: '03',
    metodo_pago: 'PPD',
  };

  it('produces exactly 21 header columns in correct order', async () => {
    const wb = buildReportWorkbook([], { incluirConcepto: true });
    const sheet = wb.getWorksheet('Reporte Mensual');
    const headerRow = sheet.getRow(1).values.slice(1); // slice removes leading undefined
    expect(headerRow).toEqual(EXPECTED_HEADERS);
  });

  it('populates Concepto when incluirConcepto is true', async () => {
    const wb = buildReportWorkbook([sampleRow], { incluirConcepto: true });
    const sheet = wb.getWorksheet('Reporte Mensual');
    const dataRow = sheet.getRow(2).values;
    const conceptoIdx = EXPECTED_HEADERS.indexOf('Concepto') + 1;
    expect(dataRow[conceptoIdx]).toBe('Servicio de arrendamiento mes marzo');
  });

  it('leaves Concepto empty when incluirConcepto is false', async () => {
    const wb = buildReportWorkbook([sampleRow], { incluirConcepto: false });
    const sheet = wb.getWorksheet('Reporte Mensual');
    const dataRow = sheet.getRow(2).values;
    const conceptoIdx = EXPECTED_HEADERS.indexOf('Concepto') + 1;
    expect(dataRow[conceptoIdx]).toBe('');
  });

  it('always leaves complemento fields empty', async () => {
    const wb = buildReportWorkbook([sampleRow], { incluirConcepto: true });
    const sheet = wb.getWorksheet('Reporte Mensual');
    const dataRow = sheet.getRow(2).values;
    const emptyFields = ['UUIDRelacionado', 'FechaPago', 'NumParcialidad', 'MonedaRel', 'SaldoAnterior', 'TotalPagado', 'SaldoInsoluto'];
    emptyFields.forEach(field => {
      const idx = EXPECTED_HEADERS.indexOf(field) + 1;
      expect(dataRow[idx]).toBe('');
    });
  });

  it('creates exactly header + N data rows', async () => {
    const wb = buildReportWorkbook([sampleRow, sampleRow], { incluirConcepto: true });
    const sheet = wb.getWorksheet('Reporte Mensual');
    expect(sheet.rowCount).toBe(3); // 1 header + 2 data
  });

  it('formats fecha as YYYY-MM-DD string', async () => {
    const wb = buildReportWorkbook([sampleRow], { incluirConcepto: false });
    const sheet = wb.getWorksheet('Reporte Mensual');
    const dataRow = sheet.getRow(2).values;
    const fechaIdx = EXPECTED_HEADERS.indexOf('Fecha') + 1;
    expect(dataRow[fechaIdx]).toBe('2026-03-15');
  });
});

const request = require('supertest');
const express = require('express');
const { generarReporteMensual } = require('../../src/server/controllers/facturacion/reporteMensualController');

const app = express();
app.get('/api/facturas/reporte-mensual', (req, res, next) => {
  // Mock middleware behavior for authentication
  const auth = req.headers.authorization;
  const token = req.query.token;
  if (!auth && !token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  req.user = { id: 1, nombre: 'Test Admin', rol: 'Admin' };
  next();
}, generarReporteMensual);

const binaryParser = (res, callback) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
};

describe('GET /api/facturas/reporte-mensual (Integration)', () => {
  afterEach(() => {
    mockQueryFn.mockReset();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .get('/api/facturas/reporte-mensual')
      .query({ emisor_rfc: 'EMI123456789' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when emisor_rfc is missing', async () => {
    const res = await request(app)
      .get('/api/facturas/reporte-mensual')
      .set('Authorization', 'Bearer valid_mock_token');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('emisor_rfc es requerido');
  });

  it('returns 200 and streams xlsx file when query is valid', async () => {
    mockQueryFn.mockResolvedValueOnce({
      rows: [
        {
          tipo_comprobante: 'I',
          estado: 'VIGENTE',
          fecha: new Date('2026-03-01'),
          serie: 'B',
          folio_num: '101',
          uuid: 'uuid-1',
          receptor: 'CLIENTE',
          emisor: 'EMISOR',
          rfc_emisor: 'EMI123456789',
          concepto: 'Renta',
          monto_del_pago: 5000,
          moneda: 'MXN',
          forma_pago: '03',
          metodo_pago: 'PUE',
        }
      ],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/api/facturas/reporte-mensual')
      .set('Authorization', 'Bearer valid_mock_token')
      .query({ emisor_rfc: 'EMI123456789', mes: '3', anio: '2026' })
      .parse(binaryParser);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('filename="Reporte_EMI123456789_03_2026.xlsx"');
    expect(res.body).toBeInstanceOf(Buffer);
  });
});



