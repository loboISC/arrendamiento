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
            <p>Selecciona el motivo de egreso, tipo de relación SAT, uso CFDI y descripción del concepto.</p>
            <small>Disponible después de elegir una factura relacionada.</small>
          </div>
        </section>
      `;
      return;
    }

    const motivos = [
      { valor: 'DEVOLUCION', icono: 'fa-rotate-left', titulo: 'Devolución', descripcion: 'Retornos de mercancía o servicio', tipoRelacion: '03', clase: 'devolucion' },
      { valor: 'DESCUENTO', icono: 'fa-tag', titulo: 'Descuento', descripcion: 'Rebajas acordadas con clientes', tipoRelacion: '01', clase: 'descuento' },
      { valor: 'BONIFICACION', icono: 'fa-gift', titulo: 'Bonificación', descripcion: 'Premio o bonos comerciales', tipoRelacion: '01', clase: 'bonificacion' },
      { valor: 'CORRECCION_PARCIAL', icono: 'fa-pen-to-square', titulo: 'Corrección parcial', descripcion: 'Ajustar montos por errores', tipoRelacion: '04', clase: 'correccion' },
      { valor: 'AJUSTE_ADMINISTRATIVO', icono: 'fa-sliders', titulo: 'Ajuste administrativo', descripcion: 'Conciliación y cierres internos', tipoRelacion: '01', clase: 'ajuste' }
    ];

    const tarjetas = motivos.map((m) => {
      const activo = estado.motivo === m.valor;
      return `
        <button
          type="button"
          class="nc-motivo-tarjeta-inline nc-motivo-${m.clase}${activo ? ' nc-motivo-activo-inline' : ''}"
          data-nc-motivo="${m.valor}"
          data-nc-tipo-relacion="${m.tipoRelacion}"
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

    contenedor.innerHTML = `
      <section class="nc-card">
        <div class="nc-card-header">
          <h3><i class="fa fa-sliders"></i> Datos Fiscales</h3>
          <span class="nc-badge nc-badge-cfdi">CFDI 4.0 · Egreso</span>
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

          <div class="nc-fiscal-grid">
            <div class="nc-form-grupo">
              <label for="nc-tipo-relacion"><i class="fa fa-link"></i> Tipo de relación SAT</label>
              <select class="nc-select" id="nc-tipo-relacion" ${estado.modoAvanzado ? '' : 'disabled'}>
                ${tiposRelacion.map((tipo) => `
                  <option value="${tipo.clave}" ${tipo.clave === estado.tipoRelacion ? 'selected' : ''}>
                    ${tipo.clave} - ${tipo.descripcion}
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
              <label><i class="fa fa-file-invoice"></i> Tipo de comprobante</label>
              <select class="nc-select" disabled>
                <option value="E" selected>E - Egreso</option>
              </select>
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
              <span>Modo avanzado: desbloquear relación SAT y claves de producto</span>
            </label>
            ${estado.modoAvanzado ? '<span class="nc-aviso-avanzado"><i class="fa fa-triangle-exclamation"></i> Relación SAT editable</span>' : ''}
          </div>
        </div>
      </section>
    `;
  }
};
