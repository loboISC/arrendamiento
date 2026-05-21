/* Componente Paso 1 — Buscar factura para generar nota de crédito. */
window.ComponenteBuscadorFacturasNC = {
  render(contenedor, estado) {
    const filas = estado.facturas.map((f) => {
      const saldo = Number(f.saldo_disponible || 0);
      const total = Number(f.total || 0);
      const saldoPct = total > 0 ? Math.round((saldo / total) * 100) : 0;
      const vigente = saldo > 0.01;
      const estadoBadge = vigente
        ? `<span class="nc-badge-estado nc-estado-vigente"><i class="fa fa-circle-check"></i> Vigente</span>`
        : `<span class="nc-badge-estado nc-estado-agotado"><i class="fa fa-ban"></i> Saldo agotado</span>`;

      const uuidCorto = f.uuid ? f.uuid.substring(0, 8) + '…' : '—';

      return `
        <tr class="nc-fila-factura${estado.facturaSeleccionada?.invoice_id === f.invoice_id ? ' nc-fila-seleccionada' : ''}">
          <td>
            <div class="nc-folio-wrap">
              <span class="nc-folio">${f.folio || '—'}</span>
              <small class="nc-uuid-short" title="${f.uuid || ''}">${uuidCorto}</small>
            </div>
          </td>
          <td>
            <div class="nc-cliente-cell">
              <span class="nc-cliente-nombre">${f.customer_name || '—'}</span>
              <small>${f.customer_rfc || ''}</small>
            </div>
          </td>
          <td class="nc-col-moneda">${window.NotasCreditoUI.moneda(f.total)}</td>
          <td>
            <div class="nc-saldo-wrap">
              <span class="nc-saldo-valor${vigente ? ' nc-saldo-ok' : ' nc-saldo-cero'}">${window.NotasCreditoUI.moneda(saldo)}</span>
              <div class="nc-saldo-barra">
                <div class="nc-saldo-progreso" style="width:${saldoPct}%"></div>
              </div>
            </div>
          </td>
          <td>${estadoBadge}</td>
          <td>
            ${vigente
              ? `<button class="nc-btn nc-btn-accion" data-nc-generar="${f.invoice_id}">
                   <i class="fa fa-file-circle-plus"></i> Generar NC
                 </button>`
              : `<button class="nc-btn nc-btn-disabled" disabled title="No hay saldo acreditable">
                   <i class="fa fa-ban"></i> Sin saldo
                 </button>`
            }
          </td>
        </tr>`;
    }).join('');

    const vacioBanner = `
      <tr>
        <td colspan="6" class="nc-tabla-vacia">
          <div class="nc-vacio-wrap">
            <i class="fa fa-file-invoice nc-vacio-icono"></i>
            <p>Busca una factura timbrada con saldo disponible para comenzar.</p>
            <small>Puedes buscar por folio, UUID, RFC o nombre del cliente.</small>
          </div>
        </td>
      </tr>`;

    contenedor.innerHTML = `
      <section class="nc-card nc-paso1-card">
        <div class="nc-card-header nc-paso1-header">
          <div class="nc-paso-numero">1</div>
          <div>
            <h3><i class="fa fa-search"></i> Buscar factura original</h3>
            <p class="nc-subtitulo">Localiza el CFDI timbrado al cual deseas generar un egreso</p>
          </div>
          <span class="nc-badge" style="background:#ecfdf3;color:#067647;margin-left:auto;">CFDI relacionado obligatorio</span>
        </div>

        <div class="nc-card-cuerpo">
          <div class="nc-buscador-grid">
            <div class="nc-search-input-wrap">
              <i class="fa fa-search nc-search-icon"></i>
              <input
                class="nc-input nc-search-input"
                id="nc-busqueda-factura"
                placeholder="Buscar por folio, UUID, RFC o cliente…"
                value="${estado.filtros.search || ''}"
                autocomplete="off"
              >
            </div>
            <input class="nc-input" id="nc-fecha-factura" type="date" value="${estado.filtros.fecha || ''}" title="Filtrar por fecha">
            <button class="nc-btn nc-btn-primario" id="nc-btn-buscar-factura">
              <i class="fa fa-magnifying-glass"></i> Buscar
            </button>
          </div>

          <div class="nc-tabla-wrap">
            <table class="nc-tabla nc-tabla-buscador">
              <thead>
                <tr>
                  <th>Folio / UUID</th>
                  <th>Cliente</th>
                  <th>Total facturado</th>
                  <th>Saldo acreditable</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${filas || vacioBanner}
              </tbody>
            </table>
          </div>
        </div>
      </section>`;
  }
};
