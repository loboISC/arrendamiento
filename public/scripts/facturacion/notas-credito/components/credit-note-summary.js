/* Tarjeta 4 — Impuestos y totales: desglose fiscal, comparativa y validación de saldo. */
window.ComponenteResumenNotaCreditoNC = {
  render(contenedor, estado) {
    const factura = estado.facturaSeleccionada;
    const totales = estado.totales;

    if (!factura) {
      contenedor.innerHTML = `
        <section class="nc-card nc-placeholder-card">
          <div class="nc-card-header">
            <h3><i class="fa fa-calculator"></i> Impuestos y Totales</h3>
            <span class="nc-badge nc-badge-pendiente">Pendiente</span>
          </div>
          <div class="nc-card-cuerpo nc-placeholder-cuerpo">
            <i class="fa fa-calculator nc-placeholder-icono"></i>
            <h4>Resumen fiscal y comparativa</h4>
            <p>Revisa IVA, retenciones, total a acreditar y saldo disponible del CFDI origen.</p>
            <small>Se calcula automáticamente al definir los conceptos.</small>
          </div>
        </section>
      `;
      return;
    }

    const desgloseOrigen = window.NotasCreditoDesglose
      ? window.NotasCreditoDesglose(factura)
      : null;
    const totalFactura = desgloseOrigen?.totalTimbrado ?? Number(factura.total || 0);
    const subtotalFact = desgloseOrigen?.subtotal ?? Number(factura.subtotal || totalFactura / 1.16);
    const ivaFact = desgloseOrigen?.iva ?? Number(factura.tax || totalFactura - subtotalFact);
    const etiquetaTasaOrigen = desgloseOrigen?.etiquetaTasa
      || (subtotalFact > 0 ? `${((ivaFact / subtotalFact) * 100).toFixed(2)}%` : '16%');
    const etiquetaTasaNc = totales.subtotal > 0
      ? `${((totales.iva / totales.subtotal) * 100).toFixed(2)}%`
      : etiquetaTasaOrigen;

    const saldoDisp = Number(factura.saldo_disponible || 0);
    const ncTotal = totales.total;
    const ncSubtotal = totales.subtotal;
    const ncIva = totales.iva;

    const excede = ncTotal > saldoDisp + 0.01;
    const pctUsado = saldoDisp > 0
      ? Math.min(100, Math.round((ncTotal / saldoDisp) * 100))
      : 0;

    const mf = (v) => window.NotasCreditoUI.moneda(v);

    // Etiqueta del tipo de corrección
    const etiquetaMotivo = {
      DEVOLUCION:           { label: 'Devolución',            color: '#dc2626', icono: 'fa-rotate-left' },
      DESCUENTO:            { label: 'Descuento',             color: '#2563eb', icono: 'fa-tag' },
      BONIFICACION:         { label: 'Bonificación',          color: '#7c3aed', icono: 'fa-gift' },
      CORRECCION_PARCIAL:   { label: 'Corrección parcial',    color: '#d97706', icono: 'fa-pen-to-square' },
      AJUSTE_ADMINISTRATIVO:{ label: 'Ajuste administrativo', color: '#059669', icono: 'fa-sliders' }
    }[estado.motivo] || { label: estado.motivo || 'Pendiente', color: '#64748b', icono: 'fa-question-circle' };

    // Concepto rows para factura original (generadas desde estado.facturaSeleccionada)
    const filasOrigen = factura.items?.length
      ? factura.items.map(it => `
          <div class="nc-comp-fila">
            <span>${it.descripcion || 'Concepto'}</span>
            <span class="nc-comp-valor">${mf(it.importe || it.total || 0)}</span>
          </div>`).join('')
      : `<div class="nc-comp-fila">
           <span>Subtotal servicios</span>
           <span class="nc-comp-valor">${mf(subtotalFact)}</span>
         </div>`;

    // Concepto rows para la nota de crédito
    const filasNC = estado.conceptos.length
      ? estado.conceptos.map((c) => {
          const base = Number(c.subtotal ?? 0);
          return `
          <div class="nc-comp-fila nc-comp-fila-nc">
            <span>${c.descripcion || 'Concepto'}</span>
            <span class="nc-comp-valor nc-nc-monto">-${mf(base)}</span>
          </div>`;
        }).join('')
      : `<div class="nc-comp-fila nc-comp-fila-vacia">
           <span>Sin conceptos aún</span>
           <span>—</span>
         </div>`;

    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <div>
            <h3><i class="fa fa-calculator"></i> Impuestos y Totales</h3>
            <p class="nc-subtitulo">Desglose fiscal y comparativa contra la factura origen</p>
          </div>
          <span class="nc-badge nc-badge-motivo" style="color:${etiquetaMotivo.color};background:${etiquetaMotivo.color}18;">
            <i class="fa ${etiquetaMotivo.icono}"></i> ${etiquetaMotivo.label}
          </span>
        </div>

        <div class="nc-card-cuerpo">
          <div class="nc-impuestos-resumen-grid">
            <div class="nc-impuestos-panel">
              <h4><i class="fa fa-percent"></i> Desglose de la nota</h4>
              <div class="nc-linea-total"><span>Subtotal (base)</span><strong>${mf(totales.subtotal)}</strong></div>
              <div class="nc-linea-total"><span>IVA trasladado (${etiquetaTasaNc})</span><strong>${mf(totales.iva)}</strong></div>
              <div class="nc-linea-total"><span>Retenciones</span><strong>${mf(totales.retenciones)}</strong></div>
              <div class="nc-linea-total nc-linea-total-final"><span>Total a acreditar</span><strong class="nc-total-acreditar">${mf(ncTotal)}</strong></div>
            </div>
            <div class="nc-impuestos-panel nc-impuestos-panel-saldo">
              <h4><i class="fa fa-wallet"></i> Saldo del CFDI origen</h4>
              <div class="nc-linea-total"><span>Total factura</span><strong>${mf(totalFactura)}</strong></div>
              <div class="nc-linea-total"><span>NC aplicadas</span><strong>-${mf(totalFactura - saldoDisp)}</strong></div>
              <div class="nc-linea-total"><span>Saldo disponible</span><strong class="nc-factura-saldo">${mf(saldoDisp)}</strong></div>
              <div class="nc-linea-total"><span>Restante tras esta NC</span><strong>${mf(Math.max(saldoDisp - ncTotal, 0))}</strong></div>
            </div>
          </div>

          <!-- Tabla comparativa -->
          <div class="nc-comparativo-tabla">
            <!-- Cabecera -->
            <div class="nc-comp-cabecera nc-comp-orig-header">
              <i class="fa fa-file-invoice"></i>
              <span>Factura original</span>
              <span class="nc-comp-folio">${factura.folio || '—'}</span>
            </div>
            <div class="nc-comp-cabecera nc-comp-nc-header">
              <i class="fa fa-file-circle-minus"></i>
              <span>Nota de crédito</span>
              <span class="nc-comp-folio">Borrador</span>
            </div>

            <!-- Conceptos lado izquierdo -->
            <div class="nc-comp-cuerpo nc-comp-orig">
              ${filasOrigen}
              <div class="nc-comp-fila nc-comp-fila-impuesto">
                <span>IVA (${etiquetaTasaOrigen})</span>
                <span class="nc-comp-valor">${mf(ivaFact)}</span>
              </div>
            </div>

            <!-- Conceptos lado derecho -->
            <div class="nc-comp-cuerpo nc-comp-nc">
              ${filasNC}
              ${ncIva > 0 ? `
              <div class="nc-comp-fila nc-comp-fila-impuesto nc-comp-fila-nc">
                <span>IVA (${etiquetaTasaNc})</span>
                <span class="nc-comp-valor nc-nc-monto">-${mf(ncIva)}</span>
              </div>` : ''}
            </div>

            <!-- Totales -->
            <div class="nc-comp-total nc-comp-orig-total">
              <span>TOTAL</span>
              <span>${mf(totalFactura)}</span>
            </div>
            <div class="nc-comp-total nc-comp-nc-total">
              <span>TOTAL A ACREDITAR</span>
              <span class="nc-nc-monto">${ncTotal > 0 ? '-' : ''}${mf(ncTotal)}</span>
            </div>
          </div>

          <!-- Saldo disponible -->
          <div class="nc-saldo-seccion${excede ? ' nc-saldo-alerta' : ''}">
            <div class="nc-saldo-info-fila">
              <span><i class="fa fa-receipt"></i> Factura original</span>
              <strong>${mf(totalFactura)}</strong>
            </div>
            <div class="nc-saldo-info-fila">
              <span><i class="fa fa-minus-circle"></i> NC aplicadas anteriormente</span>
              <strong>-${mf(totalFactura - saldoDisp)}</strong>
            </div>
            <div class="nc-saldo-info-fila nc-saldo-disponible-fila">
              <span><i class="fa fa-wallet"></i> <strong>Saldo acreditable disponible</strong></span>
              <strong class="nc-saldo-ok">${mf(saldoDisp)}</strong>
            </div>
            <div class="nc-saldo-barra-grande">
              <div class="nc-saldo-progreso-grande${excede ? ' nc-saldo-excedido' : ''}" style="width:${pctUsado}%"></div>
            </div>
            <div class="nc-saldo-info-fila nc-saldo-nc-fila">
              <span><i class="fa fa-file-circle-minus"></i> Esta nota de crédito</span>
              <strong class="nc-nc-monto">-${mf(ncTotal)}</strong>
            </div>

            ${excede ? `
            <div class="nc-alerta nc-alerta-excede">
              <i class="fa fa-triangle-exclamation"></i>
              <div>
                <strong>El monto excede el saldo disponible del CFDI</strong>
                <p>Subtotal + IVA debe ser ≤ ${mf(saldoDisp)}. Factura origen: ${mf(subtotalFact)} + ${mf(ivaFact)} = ${mf(totalFactura)}. Usa <strong>Acreditar total exacto</strong> en Conceptos.</p>
              </div>
            </div>` : ncTotal > 0 ? `
            <div class="nc-alerta nc-alerta-ok">
              <i class="fa fa-circle-check"></i>
              <div>
                <strong>Monto dentro del saldo disponible</strong>
                <p>Saldo restante tras aplicar esta nota: ${mf(saldoDisp - ncTotal)}</p>
              </div>
            </div>` : ''}
          </div>

        </div>
      </section>`;
  }
};
