/* Barra fija inferior: totales y acciones principales. */
window.ComponenteTotalesNC = {
  render(contenedor, estado) {
    const saldo = Number(estado.facturaSeleccionada?.saldo_disponible || 0);
    const restante = Math.max(saldo - Number(estado.totales.total || 0), 0);
    const tieneFactura = Boolean(estado.facturaSeleccionada);

    contenedor.innerHTML = `
      <section class="nc-card nc-totales${tieneFactura ? '' : ' nc-totales-vacio'}">
        <div class="nc-card-header">
          <h3><i class="fa fa-calculator"></i> Totales</h3>
        </div>
        <div class="nc-card-cuerpo">
          <div class="nc-total-grande" title="Total a acreditar">
            ${window.NotasCreditoUI.moneda(estado.totales.total)}
          </div>
          <div class="nc-totales-resumen">
            <div class="nc-linea-total"><span>Subtotal</span><strong>${window.NotasCreditoUI.moneda(estado.totales.subtotal)}</strong></div>
            <div class="nc-linea-total"><span>IVA</span><strong>${window.NotasCreditoUI.moneda(estado.totales.iva)}</strong></div>
            <div class="nc-linea-total"><span>Retenciones</span><strong>${window.NotasCreditoUI.moneda(estado.totales.retenciones)}</strong></div>
            <div class="nc-linea-total"><span>Saldo restante</span><strong>${window.NotasCreditoUI.moneda(restante)}</strong></div>
          </div>
          <div class="nc-acciones">
            <button type="button" class="nc-btn nc-btn-secundario" id="nc-btn-vista-previa" ${tieneFactura ? '' : 'disabled'}>
              <i class="fa fa-eye"></i> Vista previa
            </button>
            <button type="button" class="nc-btn nc-btn-primario" id="nc-btn-guardar-borrador" ${tieneFactura ? '' : 'disabled'}>
              <i class="fa fa-save"></i> Guardar borrador
            </button>
          </div>
        </div>
      </section>
    `;
  }
};
