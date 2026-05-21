/* Componente Tarjeta 1 — Factura Relacionada. */
window.ComponenteDocumentosRelacionadosNC = {
  render(contenedor, estado) {
    if (!estado.facturaSeleccionada) {
      contenedor.innerHTML = `
        <section class="nc-card nc-placeholder-card">
          <div class="nc-card-header">
            <h3><i class="fa fa-file-invoice-dollar"></i> Factura Relacionada</h3>
            <span class="nc-badge nc-badge-pendiente">Pendiente</span>
          </div>
          <div class="nc-card-cuerpo nc-placeholder-cuerpo">
            <i class="fa fa-file-invoice nc-placeholder-icono"></i>
            <h4>Factura origen del egreso</h4>
            <p>Busca y selecciona una factura timbrada con saldo acreditable disponible.</p>
            <small>Usa el buscador superior para localizar el CFDI relacionado.</small>
          </div>
        </section>
      `;
      return;
    }

    const f = estado.facturaSeleccionada;
    const total = Number(f.total || 0);
    const saldo = Number(f.saldo_disponible || 0);

    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <h3><i class="fa fa-file-invoice-dollar"></i> Factura Relacionada</h3>
          <span class="nc-badge nc-badge-vigente">Vigente</span>
        </div>
        <div class="nc-card-cuerpo">
          <div class="nc-factura-grid">
            <div class="nc-factura-campo">
              <span class="nc-factura-etiqueta">Folio</span>
              <div class="nc-factura-valor">${f.folio || '—'}</div>
            </div>
            <div class="nc-factura-campo">
              <span class="nc-factura-etiqueta">UUID fiscal</span>
              <div class="nc-uuid" title="${f.uuid || ''}">${f.uuid || '—'}</div>
            </div>
            <div class="nc-factura-campo">
              <span class="nc-factura-etiqueta">Cliente</span>
              <div class="nc-factura-valor">${f.customer_name || '—'}</div>
              <small class="nc-factura-rfc">${f.customer_rfc || ''}</small>
            </div>
            <div class="nc-factura-campo">
              <span class="nc-factura-etiqueta">Total facturado</span>
              <div class="nc-factura-valor">${window.NotasCreditoUI.moneda(total)}</div>
            </div>
            <div class="nc-factura-campo">
              <span class="nc-factura-etiqueta">Saldo acreditable</span>
              <div class="nc-factura-valor nc-factura-saldo">${window.NotasCreditoUI.moneda(saldo)}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }
};
