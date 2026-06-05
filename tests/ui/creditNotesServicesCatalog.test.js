const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const creditNotes = fs.readFileSync(
  path.join(root, 'public', 'scripts', 'facturacion', 'notas-credito', 'credit-notes.js'),
  'utf8'
);
const conceptsTable = fs.readFileSync(
  path.join(root, 'public', 'scripts', 'facturacion', 'notas-credito', 'components', 'concepts-table.js'),
  'utf8'
);

describe('servicios inventario en catalogo SAT de NC', () => {
  test('carga servicios reales desde inventario al catalogo de conceptos NC', () => {
    expect(creditNotes).toContain("fetch('/api/servicios'");
    expect(creditNotes).toContain('cargarServiciosInventarioNC');
    expect(creditNotes).toContain('clave_sat_servicios');
    expect(creditNotes).toContain('CatalogosSATNotasCredito.conceptosFrecuentes');
  });

  test('select de clave producto/servicio conserva metadatos de servicio y escapa salida', () => {
    expect(conceptsTable).toContain('data-nc-service-id');
    expect(conceptsTable).toContain('data-nc-service-price');
    expect(conceptsTable).toContain('data-nc-service-unit');
    expect(conceptsTable).toContain('escapeHtml');
  });

  test('al elegir servicio en select conserva descripcion manual y solo rellena unidad y precio', () => {
    expect(creditNotes).toContain('selectedOptions[0]');
    expect(creditNotes).toContain('dataset.ncServiceId');
    expect(creditNotes).toContain('dataset.ncServicePrice');
    const cuerpo = creditNotes.match(/function actualizarCampoFormularioConcepto\(input\) \{[\s\S]*?\n  \}/)?.[0] || '';
    expect(cuerpo).not.toContain('estado.conceptoFormulario.descripcion = opcion.dataset.ncServiceName');
    expect(cuerpo).not.toContain('estado.descripcionConcepto = estado.conceptoFormulario.descripcion');
  });
});
