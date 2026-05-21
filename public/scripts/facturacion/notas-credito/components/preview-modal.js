/* Componente de vista previa fiscal antes de timbrar. */
window.ComponenteVistaPreviaNC = {
  render(contenedor, estado) {
    contenedor.innerHTML = `
      <div class="nc-modal" id="nc-modal-preview" aria-hidden="true">
        <div class="nc-modal-panel">
          <button class="nc-modal-cerrar" type="button" data-nc-cerrar-preview>&times;</button>
          <h3>Vista previa CFDI de egreso</h3>
          <p>Revisa importes, UUID relacionado y motivo antes de timbrar.</p>
          <div class="nc-linea-total"><span>Factura origen</span><strong>${estado.facturaSeleccionada?.folio || '-'}</strong></div>
          <div class="nc-linea-total"><span>UUID relacionado</span><strong class="nc-uuid">${estado.facturaSeleccionada?.uuid || '-'}</strong></div>
          <div class="nc-linea-total"><span>TipoRelacion SAT</span><strong>${estado.tipoRelacion || '01'}</strong></div>
          <div class="nc-linea-total"><span>Motivo</span><strong>${estado.motivo || '-'}</strong></div>
          <div class="nc-linea-total"><span>Total a acreditar</span><strong>${window.NotasCreditoUI.moneda(estado.totales.total)}</strong></div>
          <div class="nc-acciones">
            <button class="nc-btn nc-btn-secundario" type="button" id="nc-ver-pdf"><i class="fa fa-file-pdf"></i>Ver PDF</button>
            <button class="nc-btn nc-btn-secundario" type="button"><i class="fa fa-code"></i>Ver XML</button>
            <button class="nc-btn nc-btn-secundario" type="button"><i class="fa fa-check-double"></i>Validar CFDI</button>
            <button class="nc-btn nc-btn-primario" type="button" id="nc-confirmar-timbrado"><i class="fa fa-stamp"></i>Timbrar CFDI</button>
          </div>
        </div>
      </div>
    `;
  }
};
