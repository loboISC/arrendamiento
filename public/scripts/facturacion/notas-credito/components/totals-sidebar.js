/* Componente de totales flotantes en tiempo real. */
window.ComponenteTotalesNC = {
  render(contenedor, estado) {
    const saldo = Number(estado.facturaSeleccionada?.saldo_disponible || 0);
    const restante = Math.max(saldo - Number(estado.totales.total || 0), 0);
    contenedor.innerHTML = `
      <section class="nc-card nc-totales">
        <div class="nc-card-header">
          <h3><i class="fa fa-calculator"></i> Totales</h3>
        </div>
        <div class="nc-card-cuerpo">
          <div class="nc-total-grande">${window.NotasCreditoUI.moneda(estado.totales.total)}</div>
          <div class="nc-linea-total"><span>Subtotal</span><strong>${window.NotasCreditoUI.moneda(estado.totales.subtotal)}</strong></div>
          <div class="nc-linea-total"><span>IVA</span><strong>${window.NotasCreditoUI.moneda(estado.totales.iva)}</strong></div>
          <div class="nc-linea-total"><span>Retenciones</span><strong>${window.NotasCreditoUI.moneda(estado.totales.retenciones)}</strong></div>
          <div class="nc-linea-total"><span>Saldo restante</span><strong>${window.NotasCreditoUI.moneda(restante)}</strong></div>
          <div class="nc-acciones">
            <button class="nc-btn nc-btn-secundario" id="nc-btn-vista-previa"><i class="fa fa-eye"></i>Vista previa</button>
            <button class="nc-btn nc-btn-primario" id="nc-btn-guardar-borrador"><i class="fa fa-save"></i>Guardar borrador</button>
          </div>
        </div>
      </section>
    `;
  }
};
