const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const frontend = fs.readFileSync(
  path.join(root, 'public', 'scripts', 'facturacion', 'notas-credito', 'credit-notes.js'),
  'utf8'
);
const repository = fs.readFileSync(
  path.join(root, 'src', 'server', 'modules', 'facturacion', 'credit-notes', 'repositories', 'credit-notes.repository.js'),
  'utf8'
);

describe('historial de notas de credito', () => {
  test('muestra uuid copiable, responsable y filtros en la tabla', () => {
    expect(frontend).toContain('nc-historial-busqueda');
    expect(frontend).toContain('nc-historial-estado');
    expect(frontend).toContain('nc-historial-fecha-desde');
    expect(frontend).toContain('nc-historial-fecha-hasta');
    expect(frontend).toContain('data-nc-copiar-uuid');
    expect(frontend).toContain('Responsable');
    expect(frontend).toContain('UUID');
  });

  test('envia filtros del historial NC al backend', () => {
    expect(frontend).toContain("params.set('search'");
    expect(frontend).toContain("params.set('status'");
    expect(frontend).toContain("params.set('dateFrom'");
    expect(frontend).toContain("params.set('dateTo'");
  });

  test('backend lista responsable, filtra y guarda usuario que timbra', () => {
    expect(repository).toContain('LEFT JOIN usuarios u_stamped');
    expect(repository).toContain('stamped_by_name');
    expect(repository).toContain('created_by_name');
    expect(repository).toContain('stamped_by = COALESCE');
    expect(repository).toContain('filtros.search');
    expect(repository).toContain('filtros.dateFrom');
    expect(repository).toContain('filtros.dateTo');
  });
});
