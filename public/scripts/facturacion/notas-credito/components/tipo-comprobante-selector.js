/* Tarjeta 2 — Datos Fiscales: configuración y selección del tipo de nota de crédito. */
window.ComponenteDatosFiscalesNC = {
  render(contenedor, estado) {
    if (!estado.facturaSeleccionada) {
      contenedor.innerHTML = `
        <section class="nc-card nc-placeholder-card">
          <div class="nc-card-header">
            <h3><i class="fa fa-sliders"></i> Datos Fiscales</h3>
            <span class="nc-badge nc-badge-pendiente">Pendiente</span>
          </div>
          <div class="nc-card-cuerpo nc-placeholder-cuerpo">
            <i class="fa fa-sliders nc-placeholder-icono"></i>
            <h4>Configuración de la nota de crédito</h4>
            <p>Selecciona motivo, tipo de relación SAT, tipo de comprobante, pago y descripción.</p>
            <small>Disponible después de elegir una factura relacionada.</small>
          </div>
        </section>
      `;
      return;
    }

    const motivos = [
      { valor: 'DEVOLUCION', icono: 'fa-rotate-left', titulo: 'Devolución', descripcion: 'Retornos de mercancía o servicio', tipoRelacion: '03', tipoComprobante: 'E', clase: 'devolucion' },
      { valor: 'DESCUENTO', icono: 'fa-tag', titulo: 'Descuento', descripcion: 'Rebajas acordadas con clientes', tipoRelacion: '01', tipoComprobante: 'E', clase: 'descuento' },
      { valor: 'BONIFICACION', icono: 'fa-gift', titulo: 'Bonificación', descripcion: 'Premio o bonos comerciales', tipoRelacion: '01', tipoComprobante: 'E', clase: 'bonificacion' },
      { valor: 'CORRECCION_PARCIAL', icono: 'fa-pen-to-square', titulo: 'Corrección parcial', descripcion: 'Ajustar montos por errores', tipoRelacion: '04', tipoComprobante: 'E', clase: 'correccion' },
      { valor: 'AJUSTE_ADMINISTRATIVO', icono: 'fa-sliders', titulo: 'Ajuste administrativo', descripcion: 'Conciliación y cierres internos', tipoRelacion: '01', tipoComprobante: 'E', clase: 'ajuste' }
    ];

    const tarjetas = motivos.map((m) => {
      const activo = estado.motivo === m.valor;
      return `
        <button
          type="button"
          class="nc-motivo-tarjeta-inline nc-motivo-${m.clase}${activo ? ' nc-motivo-activo-inline' : ''}"
          data-nc-motivo="${m.valor}"
          data-nc-tipo-relacion="${m.tipoRelacion}"
          data-nc-tipo-comprobante="${m.tipoComprobante}"
        >
          <span class="nc-motivo-inline-icono"><i class="fa ${m.icono}"></i></span>
          <span class="nc-motivo-inline-texto">
            <strong>${m.titulo}</strong>
            <small>${m.descripcion}</small>
          </span>
        </button>
      `;
    }).join('');

    const tiposRelacion = window.CatalogosSATNotasCredito?.tiposRelacion || [];
    const tiposComprobante = window.CatalogosSATNotasCredito?.tiposComprobante || [];
    const formasPago = window.CatalogosSATNotasCredito?.formasPago || [];
    const metodosPago = window.CatalogosSATNotasCredito?.metodosPago || [];
    const metodoPpd = String(estado.metodoPago || '').toUpperCase() === 'PPD';
    const formaPago = metodoPpd ? '99' : (estado.formaPago || '03');
    const opcionesForma = metodoPpd ? formasPago.filter((f) => f.clave === '99') : formasPago;
    const tipoComprobante = estado.tipoComprobante || 'E';
    const etiquetaComprobante = tipoComprobante === 'I' ? 'Ingreso' : 'Egreso';
    const relacionActiva = tiposRelacion.find((t) => t.clave === estado.tipoRelacion) || tiposRelacion[0];
    const avisoTraslado = ['05', '06'].includes(estado.tipoRelacion)
      ? '<small class="nc-ayuda-traslado"><i class="fa fa-circle-info"></i> El SAT suele usar comprobante <strong>Traslado (T)</strong> para esta relación; aquí puedes elegir Ingreso o Egreso según tu caso.</small>'
      : '';

    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <h3><i class="fa fa-sliders"></i> Datos Fiscales</h3>
          <span class="nc-badge nc-badge-cfdi">CFDI 4.0 · ${etiquetaComprobante}</span>
        </div>
        <div class="nc-card-cuerpo">
          <div class="nc-seccion-form">
            <label class="nc-etiqueta-seccion">
              <i class="fa fa-list-check"></i> Tipo de corrección (motivo de egreso)
            </label>
            <div class="nc-motivos-inline-grid">
              ${tarjetas}
            </div>
          </div>

          <div class="nc-form-grupo nc-form-grupo-relacion">
            <label for="nc-tipo-relacion"><i class="fa fa-link"></i> Tipo de relación SAT (catálogo c_RelacionTipo)</label>
            <select class="nc-select" id="nc-tipo-relacion">
              ${tiposRelacion.map((tipo) => `
                <option
                  value="${tipo.clave}"
                  ${tipo.clave === estado.tipoRelacion ? 'selected' : ''}
                  title="${tipo.tipoCfdiComun || ''} — ${tipo.detalle || ''}"
                >
                  ${tipo.clave} — ${tipo.descripcion}
                </option>
              `).join('')}
            </select>
            ${relacionActiva ? `
              <div class="nc-relacion-detalle" id="nc-relacion-detalle">
                <span class="nc-relacion-detalle-codigo">${relacionActiva.clave}</span>
                <div>
                  <strong>${relacionActiva.descripcion}</strong>
                  <p><span class="nc-relacion-etiqueta">CFDI común:</span> ${relacionActiva.tipoCfdiComun}</p>
                  <p>${relacionActiva.detalle}</p>
                </div>
              </div>
            ` : ''}
            ${avisoTraslado}
          </div>

          <div class="nc-fiscal-grid">
            <div class="nc-form-grupo">
              <label for="nc-tipo-comprobante"><i class="fa fa-file-invoice"></i> Tipo de comprobante</label>
              <select class="nc-select" id="nc-tipo-comprobante">
                ${tiposComprobante.map((t) => `
                  <option value="${t.clave}" ${t.clave === tipoComprobante ? 'selected' : ''}>
                    ${t.clave} - ${t.descripcion}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="nc-form-grupo">
              <label><i class="fa fa-file-signature"></i> Uso de CFDI</label>
              <select class="nc-select" disabled>
                <option value="G02" selected>G02 - Devoluciones, descuentos o bonificaciones</option>
              </select>
            </div>
            <div class="nc-form-grupo">
              <label for="nc-metodo-pago"><i class="fa fa-clock"></i> Método de pago</label>
              <select class="nc-select" id="nc-metodo-pago">
                ${metodosPago.map((m) => `
                  <option value="${m.clave}" ${m.clave === estado.metodoPago ? 'selected' : ''}>
                    ${m.clave} - ${m.descripcion}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="nc-form-grupo">
              <label for="nc-forma-pago"><i class="fa fa-money-bill-wave"></i> Forma de pago</label>
              <select class="nc-select" id="nc-forma-pago" ${metodoPpd ? 'disabled' : ''}>
                ${opcionesForma.map((f) => `
                  <option value="${f.clave}" ${f.clave === formaPago ? 'selected' : ''}>
                    ${f.clave} - ${f.descripcion}
                  </option>
                `).join('')}
              </select>
              ${metodoPpd ? '<small class="nc-ayuda-ppd">Con PPD la forma de pago debe ser 99 - Por definir (SAT).</small>' : ''}
            </div>
          </div>

          <div class="nc-form-grupo">
            <label for="nc-descripcion-concepto"><i class="fa fa-pen"></i> Descripción del concepto en el CFDI</label>
            <input
              type="text"
              id="nc-descripcion-concepto"
              class="nc-input"
              placeholder="Ej: Descuento comercial por volumen de compra…"
              value="${estado.descripcionConcepto || ''}"
            >
          </div>

          <div class="nc-modo-avanzado-fila">
            <label class="nc-check-avanzado">
              <input type="checkbox" id="nc-modo-avanzado" ${estado.modoAvanzado ? 'checked' : ''}>
              <span>Modo avanzado: editar claves SAT de producto y unidad en conceptos</span>
            </label>
          </div>
        </div>
      </section>
    `;
  }
};
