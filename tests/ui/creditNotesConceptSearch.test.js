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

describe('conceptos en notas de credito', () => {
  test('descripcion del concepto NC queda como captura manual sin busqueda inventario', () => {
    expect(conceptsTable).toContain('nc-form-descripcion');
    expect(conceptsTable).not.toContain('nc-concept-search-results');
    expect(conceptsTable).not.toContain('data-nc-concept-search');
  });

  test('boton acreditar total exacto solo altera resumen financiero', () => {
    const cuerpo = creditNotes.match(/function agregarMontosExactosFactura\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
    expect(cuerpo).toContain('totalesOverride');
    expect(cuerpo).not.toContain('estado.conceptos =');
    expect(cuerpo).not.toContain('estado.conceptos.push');
    expect(cuerpo).not.toContain('descripcion');
    expect(cuerpo).not.toContain('sat_product_key');
  });

  test('descripcion del formulario no re-renderiza mientras se escribe', () => {
    const inputHandler = creditNotes.match(/document\.addEventListener\('input', \(ev\) => \{[\s\S]*?\n    \}\);/)?.[0] || '';
    const indiceDescripcion = inputHandler.indexOf("ev.target.id === 'nc-form-descripcion'");
    const indiceGenerico = inputHandler.indexOf('ev.target.dataset.ncFormCampo');

    expect(indiceDescripcion).toBeGreaterThanOrEqual(0);
    expect(indiceGenerico).toBeGreaterThanOrEqual(0);
    expect(indiceDescripcion).toBeLessThan(indiceGenerico);
    expect(inputHandler).toContain('return;');
  });
});
