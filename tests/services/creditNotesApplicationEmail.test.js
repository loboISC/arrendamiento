const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const appService = fs.readFileSync(
  path.join(root, 'src', 'server', 'modules', 'facturacion', 'credit-notes', 'services', 'aplicacion-cobranza.service.js'),
  'utf8'
);
const controller = fs.readFileSync(
  path.join(root, 'src', 'server', 'modules', 'facturacion', 'credit-notes', 'controllers', 'credit-notes.controller.js'),
  'utf8'
);
const emailService = fs.readFileSync(
  path.join(root, 'src', 'server', 'services', 'emailService.js'),
  'utf8'
);
const repository = fs.readFileSync(
  path.join(root, 'src', 'server', 'modules', 'facturacion', 'credit-notes', 'repositories', 'credit-notes.repository.js'),
  'utf8'
);
const frontend = fs.readFileSync(
  path.join(root, 'public', 'scripts', 'facturacion', 'notas-credito', 'credit-notes.js'),
  'utf8'
);

describe('correos por aplicacion de nota de credito', () => {
  test('frontend envia tipo y correo destinatario al aplicar cobranza', () => {
    expect(frontend).toContain('tipo_aplicacion: tipo');
    expect(frontend).toContain('email_destinatario: emailDestinatario');
    expect(frontend).toContain('/api/credit-notes/${estado.notaGuardada.id}/apply-type');
  });

  test('controller pasa email_destinatario al servicio de aplicacion', () => {
    expect(controller).toContain('email_destinatario');
    expect(controller).toContain('servicioAplicacion.procesarAplicacion');
  });

  test('opciones 1 y 2 usan correos personalizados con NC PDF/XML desde servidor', () => {
    expect(appService).toContain('enviarCorreoAplicarAutomatico');
    expect(appService).toContain('enviarCorreoSaldoFavor');
    expect(appService).toContain('calcularProyeccionAplicarAutomatico');
    expect(appService).toContain('calcularProyeccionSaldoFavor');
    expect(appService).toContain('obtenerAdjuntosNotaCredito');
    expect(appService).toContain('enviarNcAplicadaAutomaticamente');
    expect(appService).toContain('enviarNcSaldoFavor');
    expect(appService).toContain('[EMAIL] No recipient specified for NC application — skipping');
  });

  test('devolucion adjunta voucher mas NC/XML sin cambiar asunto', () => {
    expect(appService).toContain('enviarComprobanteAbono(');
    expect(appService).toContain('Comprobante de Devolución -');
    expect(appService).toContain('Nota de crédito (PDF)');
    expect(appService).toContain('Nota de crédito (XML)');
  });

  test('montos financieros se calculan en repositorio desde ledger', () => {
    expect(repository).toContain('calcularDeudaCliente');
    expect(repository).toContain('calcularSaldoFacturaLedger');
    expect(repository).toContain('obtenerLimiteCredito');
  });

  test('emailService expone plantillas NC; comprobante abono sin cambiar plantilla global', () => {
    expect(emailService).toContain('enviarNcAplicadaAutomaticamente');
    expect(emailService).toContain('enviarNcSaldoFavor');
    expect(emailService).toContain('Nota de crédito aplicada a tu cuenta —');
    expect(emailService).toContain('Saldo a favor acreditado en tu cuenta —');
    expect(emailService).toContain('extraAttachments');
    expect(emailService).toContain('Comprobante de pago adjunto');
  });
});
