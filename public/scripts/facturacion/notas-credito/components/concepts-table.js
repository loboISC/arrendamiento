/* Tarjeta 3 — Formulario de concepto (estilo SAT) + tabla con scroll. */
window.ComponenteTablaConceptosNC = {
  escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[caracter]));
  },

  calcularImporteFormulario(f, estado) {
    const cantidad = Number(f.cantidad || 0);
    const precio = Number(f.precio_unitario || 0);
    const descFijo = Number(f.descuento || 0);
    const descPct = Number(f.descuento_porcentaje || 0);
    const bruto = cantidad * precio;
    const descuento = descFijo + bruto * (descPct / 100);
    const base = Math.max(bruto - descuento, 0);
    let iva = 0;
    if (f.iva_manual != null && f.iva_manual !== '' && Number.isFinite(Number(f.iva_manual))) {
      iva = Number(f.iva_manual);
    } else {
      const tasa = Number(f.tasa_iva ?? estado?.tasaIvaFactura ?? 0.16);
      iva = base * tasa;
    }
    return { base, iva, total: base + iva };
  },

  etiquetaCatalogo(items, clave) {
    const item = (items || []).find((i) => i.clave === clave);
    return item ? `${item.clave} ${item.descripcion}` : clave;
  },

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
            <p>Captura cada concepto en el formulario y agrégalo a la tabla, como en el portal del SAT.</p>
            <small>Configura primero la factura relacionada y los datos fiscales.</small>
          </div>
        </section>
      `;
      return;
    }

    const f = estado.conceptoFormulario || {};
    const catalogoConceptos = window.CatalogosSATNotasCredito?.conceptosFrecuentes || [];
    const catalogoUnidades = window.CatalogosSATNotasCredito?.unidadesFrecuentes || [];
    const importeForm = window.ComponenteTablaConceptosNC.calcularImporteFormulario(f, estado);
    const mf = (v) => window.NotasCreditoUI.moneda(v);
    const desgloseFactura = window.NotasCreditoDesglose
      ? window.NotasCreditoDesglose(estado.facturaSeleccionada)
      : null;
    const colspanTabla = 11;

    const filasTabla = estado.conceptos.length
      ? estado.conceptos.map((c, indice) => {
          const prod = catalogoConceptos.find((p) => p.clave === (c.sat_product_key || '01010101'));
          const uni = catalogoUnidades.find((u) => u.clave === (c.sat_unit_key || 'ACT'));
          const lineaCalc = window.ComponenteTablaConceptosNC.calcularImporteFormulario(c, estado);
          return `
            <tr>
              <td class="nc-celda-clave" title="${prod ? `${prod.clave} ${prod.descripcion}` : c.sat_product_key}">
                <span class="nc-clave-num">${c.sat_product_key || '—'}</span>
                <small>${prod?.descripcion || ''}</small>
              </td>
              <td class="nc-celda-num">${c.cantidad ?? '—'}</td>
              <td>${c.unidad || uni?.descripcion || '—'}</td>
              <td class="nc-celda-clave">
                <span class="nc-clave-num">${c.sat_unit_key || '—'}</span>
                <small>${uni?.descripcion || ''}</small>
              </td>
              <td>${c.numero_identificacion || '—'}</td>
              <td class="nc-celda-desc">${c.descripcion || '—'}</td>
              <td class="nc-celda-monto">${mf(c.precio_unitario)}</td>
              <td class="nc-celda-monto">${mf(lineaCalc.base)}</td>
              <td class="nc-celda-monto">${mf(c.iva)}</td>
              <td class="nc-celda-monto"><strong>${mf(c.total)}</strong></td>
              <td class="nc-celda-accion">
                <button type="button" class="nc-btn nc-btn-peligro nc-btn-icono" data-nc-eliminar="${indice}" title="Eliminar concepto">
                  <i class="fa fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="${colspanTabla}" class="nc-tabla-vacia-fila">Sin conceptos. Completa el formulario y pulsa <strong>Agregar</strong>.</td></tr>`;

    contenedor.innerHTML = `
      <section class="nc-card nc-card-conceptos">
        <div class="nc-card-header nc-card-header-acciones">
          <h3><i class="fa fa-table"></i> Conceptos</h3>
          <div class="nc-header-botones">
            <button type="button" class="nc-btn nc-btn-secundario" id="nc-importar-conceptos">
              <i class="fa fa-file-import"></i> Cargar montos factura
            </button>
            <button type="button" class="nc-btn nc-btn-primario" id="nc-btn-acreditar-total-exacto" title="Subtotal e IVA idénticos al CFDI origen">
              <i class="fa fa-check-double"></i> Acreditar total exacto
            </button>
          </div>
        </div>
        ${desgloseFactura ? `
          <p class="nc-ayuda-factura-origen">
            <i class="fa fa-circle-info"></i>
            Factura origen: Subtotal ${mf(desgloseFactura.subtotal)} + IVA (${desgloseFactura.etiquetaTasa}) ${mf(desgloseFactura.iva)} =
            <strong>${mf(desgloseFactura.total)}</strong>
          </p>
        ` : ''}
        <div class="nc-card-cuerpo">
          <div class="nc-concepto-formulario">
            <h4 class="nc-concepto-form-titulo"><i class="fa fa-pen-to-square"></i> Concepto</h4>
            <p class="nc-concepto-form-leyenda"><span class="nc-req">*</span> Campos obligatorios</p>

            <div class="nc-concepto-form-grid">
              <div class="nc-form-grupo nc-form-grupo-req">
                <label for="nc-form-clave-producto">Clave de producto o servicio <span class="nc-req">*</span></label>
                <select class="nc-select" id="nc-form-clave-producto" data-nc-form-campo="sat_product_key">
                  ${catalogoConceptos.map((sat) => `
                    <option value="${window.ComponenteTablaConceptosNC.escapeHtml(sat.clave)}"
                      data-nc-service-id="${window.ComponenteTablaConceptosNC.escapeHtml(sat.servicio_id || '')}"
                      data-nc-service-price="${window.ComponenteTablaConceptosNC.escapeHtml(sat.precio_unitario ?? '')}"
                      data-nc-service-unit="${window.ComponenteTablaConceptosNC.escapeHtml(sat.clave_unidad || '')}"
                      data-nc-service-name="${window.ComponenteTablaConceptosNC.escapeHtml(sat.nombre_servicio || sat.descripcion || '')}"
                      ${sat.clave === (f.sat_product_key || '84111506') ? 'selected' : ''}>
                      ${window.ComponenteTablaConceptosNC.escapeHtml(sat.clave)} ${window.ComponenteTablaConceptosNC.escapeHtml(sat.descripcion)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="nc-form-grupo nc-form-grupo-req">
                <label for="nc-form-clave-unidad">Clave de unidad <span class="nc-req">*</span></label>
                <select class="nc-select" id="nc-form-clave-unidad" data-nc-form-campo="sat_unit_key">
                  ${catalogoUnidades.map((sat) => `
                    <option value="${sat.clave}" ${sat.clave === (f.sat_unit_key || 'ACT') ? 'selected' : ''}>
                      ${sat.clave} ${sat.descripcion}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="nc-form-grupo nc-form-grupo-req">
                <label for="nc-form-cantidad">Cantidad <span class="nc-req">*</span></label>
                <input class="nc-input" type="number" id="nc-form-cantidad" min="0" step="0.000001"
                  data-nc-form-campo="cantidad" value="${f.cantidad ?? 1}">
              </div>
              <div class="nc-form-grupo">
                <label for="nc-form-unidad">Unidad</label>
                <input class="nc-input" type="text" id="nc-form-unidad" data-nc-form-campo="unidad"
                  value="${f.unidad || ''}" placeholder="Ej: Actividad">
              </div>
              <div class="nc-form-grupo">
                <label for="nc-form-no-identificacion">Número de identificación</label>
                <input class="nc-input" type="text" id="nc-form-no-identificacion" data-nc-form-campo="numero_identificacion"
                  value="${f.numero_identificacion || ''}">
              </div>
              <div class="nc-form-grupo nc-form-grupo-full nc-form-grupo-req">
                <label for="nc-form-descripcion">Descripción <span class="nc-req">*</span></label>
                <input class="nc-input" type="text" id="nc-form-descripcion" data-nc-form-campo="descripcion"
                  value="${f.descripcion || ''}" placeholder="Ej: Descuento conforme acuerdo con el cliente" autocomplete="off">
              </div>
              <div class="nc-form-grupo nc-form-grupo-req">
                <label for="nc-form-valor-unitario">Valor unitario <span class="nc-req">*</span></label>
                <input class="nc-input" type="number" id="nc-form-valor-unitario" min="0" step="0.01"
                  data-nc-form-campo="precio_unitario" value="${f.precio_unitario ?? 0}">
              </div>
              <div class="nc-form-grupo">
                <label for="nc-form-importe">Importe (base)</label>
                <input class="nc-input nc-input-readonly" type="text" id="nc-form-importe" readonly
                  value="${mf(importeForm.base)}">
              </div>
              <div class="nc-form-grupo">
                <label>IVA estimado</label>
                <input class="nc-input nc-input-readonly" type="text" readonly value="${mf(importeForm.iva)}">
              </div>
              <div class="nc-form-grupo">
                <label>Total línea</label>
                <input class="nc-input nc-input-readonly nc-input-total-linea" type="text" readonly
                  value="${mf(importeForm.total)}">
              </div>
              <div class="nc-form-grupo">
                <label for="nc-form-descuento">Descuento</label>
                <input class="nc-input" type="number" id="nc-form-descuento" min="0" step="0.01"
                  data-nc-form-campo="descuento" value="${f.descuento ?? 0}">
              </div>
              <div class="nc-form-grupo">
                <label for="nc-form-descuento-pct">Descuento %</label>
                <input class="nc-input" type="number" id="nc-form-descuento-pct" min="0" max="100" step="0.01"
                  data-nc-form-campo="descuento_porcentaje" value="${f.descuento_porcentaje ?? 0}">
              </div>
            </div>

            <div class="nc-concepto-form-acciones">
              <button type="button" class="nc-btn nc-btn-primario" id="nc-btn-agregar-concepto">
                <i class="fa fa-plus"></i> Agregar
              </button>
              <button type="button" class="nc-btn nc-btn-secundario" id="nc-btn-cancelar-concepto">
                Cancelar
              </button>
            </div>
          </div>

          <div class="nc-conceptos-tabla-seccion">
            <div class="nc-conceptos-tabla-header">
              <h4>Conceptos agregados (${estado.conceptos.length})</h4>
            </div>
            <div class="nc-tabla-wrap nc-tabla-conceptos-scroll">
              <table class="nc-tabla nc-tabla-conceptos-sat">
                <thead>
                  <tr>
                    <th>Clave producto/servicio</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Clave unidad</th>
                    <th>No. identificación</th>
                    <th>Descripción</th>
                    <th>Valor unitario</th>
                    <th>Importe</th>
                    <th>IVA</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${filasTabla}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `;
  }
};
