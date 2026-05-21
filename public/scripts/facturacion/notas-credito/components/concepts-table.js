/* Tarjeta 3 — Conceptos acreditables de la nota de crédito. */
window.ComponenteTablaConceptosNC = {
  render(contenedor, estado) {
    if (!estado.facturaSeleccionada) {
      contenedor.innerHTML = `
        <section class="nc-card nc-placeholder-card">
          <div class="nc-card-header">
            <h3><i class="fa fa-table"></i> Conceptos</h3>
            <span class="nc-badge nc-badge-pendiente">Pendiente</span>
          </div>
          <div class="nc-card-cuerpo nc-placeholder-cuerpo">
            <i class="fa fa-table nc-placeholder-icono"></i>
            <h4>Conceptos a acreditar</h4>
            <p>Importa o edita los conceptos que se reflejarán en el CFDI de egreso.</p>
            <small>Configura primero la factura relacionada y los datos fiscales.</small>
          </div>
        </section>
      `;
      return;
    }

    const catalogoConceptos = window.CatalogosSATNotasCredito?.conceptosFrecuentes || [];
    const catalogoUnidades = window.CatalogosSATNotasCredito?.unidadesFrecuentes || [];
    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <h3><i class="fa fa-table"></i> Conceptos</h3>
          <button class="nc-btn nc-btn-secundario" id="nc-importar-conceptos"><i class="fa fa-file-import"></i>Importar conceptos originales</button>
        </div>
        <div class="nc-card-cuerpo nc-tabla-wrap">
          <table class="nc-tabla">
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Desc. fijo</th>
                <th>Desc. %</th>
                ${estado.modoAvanzado ? '<th>Clave SAT</th><th>Unidad SAT</th>' : ''}
                <th>IVA</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${estado.conceptos.map((concepto, indice) => `
                <tr>
                  <td><input class="nc-input" data-nc-campo="descripcion" data-nc-indice="${indice}" value="${concepto.descripcion || ''}"></td>
                  <td><input class="nc-input" type="number" min="0" step="0.000001" data-nc-campo="cantidad" data-nc-indice="${indice}" value="${concepto.cantidad || 0}"></td>
                  <td><input class="nc-input" type="number" min="0" step="0.01" data-nc-campo="precio_unitario" data-nc-indice="${indice}" value="${concepto.precio_unitario || 0}"></td>
                  <td><input class="nc-input" type="number" min="0" step="0.01" data-nc-campo="descuento" data-nc-indice="${indice}" value="${concepto.descuento || 0}"></td>
                  <td><input class="nc-input" type="number" min="0" max="100" step="0.01" data-nc-campo="descuento_porcentaje" data-nc-indice="${indice}" value="${concepto.descuento_porcentaje || 0}"></td>
                  ${estado.modoAvanzado ? `
                    <td>
                      <select class="nc-select" data-nc-campo="sat_product_key" data-nc-indice="${indice}">
                        ${catalogoConceptos.map((sat) => `
                          <option value="${sat.clave}" ${sat.clave === (concepto.sat_product_key || '01010101') ? 'selected' : ''}>
                            ${sat.clave} - ${sat.descripcion}
                          </option>
                        `).join('')}
                      </select>
                    </td>
                    <td>
                      <select class="nc-select" data-nc-campo="sat_unit_key" data-nc-indice="${indice}">
                        ${catalogoUnidades.map((sat) => `
                          <option value="${sat.clave}" ${sat.clave === (concepto.sat_unit_key || 'ACT') ? 'selected' : ''}>
                            ${sat.clave} - ${sat.descripcion}
                          </option>
                        `).join('')}
                      </select>
                    </td>
                  ` : ''}
                  <td>${window.NotasCreditoUI.moneda(concepto.iva)}</td>
                  <td><strong>${window.NotasCreditoUI.moneda(concepto.total)}</strong></td>
                  <td><button class="nc-btn nc-btn-peligro" data-nc-eliminar="${indice}" title="Eliminar concepto"><i class="fa fa-trash"></i></button></td>
                </tr>
              `).join('') || `<tr><td colspan="${estado.modoAvanzado ? 10 : 8}">Selecciona una factura e importa conceptos para acreditar.</td></tr>`}
            </tbody>
          </table>
          ${estado.modoAvanzado ? '<p class="nc-ayuda-sat">Las claves SAT avanzadas solo deben cambiarse cuando la factura origen tenga un error de clave de producto, servicio o unidad.</p>' : ''}
        </div>
      </section>
    `;
  }
};
