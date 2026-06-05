const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const modal = fs.readFileSync(
  path.join(root, 'public', 'scripts', 'facturacion', 'notas-credito', 'components', 'aplicacion-cobranza.js'),
  'utf8'
);

describe('modal de aplicacion a cobranza NC', () => {
  test('consulta APIs de cliente y credit notes para resumen financiero en vivo', () => {
    expect(modal).toContain('cargarResumenFinanciero');
    expect(modal).toContain('/api/clientes/credito/${clienteId}/detalle');
    expect(modal).toContain('/api/clientes/${clienteId}/credit-notes');
    expect(modal).toContain('/api/credit-notes/${notaId}');
    expect(modal).toContain('Authorization');
    expect(modal).toContain('Bearer ${this.obtenerToken()}');
  });

  test('muestra proyecciones para aplicar deuda y saldo a favor', () => {
    expect(modal).toContain('nc-aplicar-detalle-financiero');
    expect(modal).toContain('nc-saldo-favor-detalle');
    expect(modal).toContain('Deuda despues de aplicar');
    expect(modal).toContain('Limite despues de agregar saldo');
  });
});
