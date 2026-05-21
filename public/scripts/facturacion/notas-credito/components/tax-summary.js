/* Componente de resumen fiscal de impuestos. */
window.ComponenteResumenImpuestosNC = {
  render(contenedor, estado) {
    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <h3><i class="fa fa-percent"></i> Resumen de impuestos</h3>
        </div>
        <div class="nc-card-cuerpo">
          <div class="nc-linea-total"><span>Base IVA 16%</span><strong>${window.NotasCreditoUI.moneda(estado.totales.subtotal)}</strong></div>
          <div class="nc-linea-total"><span>IVA trasladado</span><strong>${window.NotasCreditoUI.moneda(estado.totales.iva)}</strong></div>
          <div class="nc-linea-total"><span>Retenciones</span><strong>${window.NotasCreditoUI.moneda(estado.totales.retenciones)}</strong></div>
        </div>
      </section>
    `;
  }
};
