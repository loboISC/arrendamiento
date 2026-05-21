/**
 * Servicio de saldo acreditable.
 * Usa la factura original menos notas de credito timbradas/aplicadas no canceladas.
 */
class ServicioSaldoAcreditable {
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  async obtenerSaldoFactura(invoiceId) {
    const factura = await this.repositorio.obtenerFacturaPorId(invoiceId);
    if (!factura) return null;

    const totalFactura = Number(factura.total || 0);
    const acreditado = await this.repositorio.obtenerTotalNotasAplicadas(invoiceId);
    const saldoDisponible = Number(Math.max(totalFactura - acreditado, 0).toFixed(2));

    return {
      factura,
      totalFactura,
      acreditado,
      saldoDisponible
    };
  }
}

module.exports = ServicioSaldoAcreditable;
