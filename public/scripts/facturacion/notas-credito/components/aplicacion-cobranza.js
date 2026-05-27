/* Modal post-timbrado: aplicación a cobranza, descarga CFDI y correo. */
window.ComponenteAplicacionCobranzaNC = {
  normalizarMotivo(valor) {
    const v = String(valor || '').toUpperCase();
    const abreviados = {
      DEV: 'DEVOLUCION',
      DESC: 'DESCUENTO',
      BON: 'BONIFICACION',
      AJUS: 'AJUSTE_ADMINISTRATIVO',
      CORR: 'CORRECCION_PARCIAL'
    };
    return abreviados[v] || v;
  },

  calcularPlazoDevolucion(monto) {
    const total = Number(monto) || 0;
    const diasHabiles = total <= 10000 ? 5 : 8;
    const fecha = new Date();
    let agregados = 0;
    while (agregados < diasHabiles) {
      fecha.setDate(fecha.getDate() + 1);
      const dia = fecha.getDay();
      if (dia !== 0 && dia !== 6) agregados += 1;
    }
    return {
      dias_habiles: diasHabiles,
      fecha_estimada: fecha,
      fecha_texto: fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  },

  mensajeExitoPorMotivo(motivo, estado) {
    const tipo = this.normalizarMotivo(motivo);
    const folio = estado.notaGuardada?.folio || estado.notaGuardada?.uuid || '';
    const total = window.NotasCreditoUI.moneda(estado.totales?.total ?? estado.notaGuardada?.total ?? 0);

    const mensajes = {
      DEVOLUCION: {
        icono: 'fa-rotate-left',
        clase: 'devolucion',
        titulo: 'CFDI timbrado exitosamente',
        texto: `La nota de crédito por devolución quedó vigente ante el SAT (${folio || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
      },
      DESCUENTO: {
        icono: 'fa-tag',
        clase: 'descuento',
        titulo: 'CFDI timbrado exitosamente',
        texto: `El descuento comercial fue emitido como CFDI de egreso (${folio || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
      },
      BONIFICACION: {
        icono: 'fa-gift',
        clase: 'bonificacion',
        titulo: 'CFDI timbrado exitosamente',
        texto: `La bonificación comercial quedó registrada fiscalmente (${folio || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
      },
      CORRECCION_PARCIAL: {
        icono: 'fa-pen-to-square',
        clase: 'correccion',
        titulo: 'CFDI timbrado exitosamente',
        texto: `La corrección parcial está vigente (UUID: ${estado.notaGuardada?.uuid || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
      },
      AJUSTE_ADMINISTRATIVO: {
        icono: 'fa-sliders',
        clase: 'ajuste',
        titulo: 'CFDI timbrado exitosamente',
        texto: `El ajuste administrativo se timbró correctamente (${folio || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
      }
    };

    return mensajes[tipo] || {
      icono: 'fa-check-circle',
      clase: 'generico',
      titulo: 'CFDI timbrado exitosamente',
      texto: `La nota de crédito quedó vigente ante el SAT (UUID: ${estado.notaGuardada?.uuid || 'N/A'}, ${total}). Seleccione cómo aplicar el saldo acreditado.`
    };
  },

  actualizarUiOpciones() {
    const monto = Number(document.getElementById('nc-aplicacion-monto')?.dataset?.monto || 0);
    const plazo = this.calcularPlazoDevolucion(monto);
    const plazoEl = document.getElementById('nc-devolucion-plazo');
    const saldoEl = document.getElementById('nc-saldo-favor-detalle');
    const tipo = document.querySelector('input[name="nc-tipo-aplicacion"]:checked')?.value || 'APLICAR';

    if (plazoEl) {
      const regla = monto <= 10000 ? 'Montos hasta $10,000' : 'Montos mayores a $10,000';
      plazoEl.innerHTML = `
        <small>
          <i class="fa fa-clock"></i>
          ${regla}: plazo estimado de <strong>${plazo.dias_habiles} días hábiles</strong>
          (fecha estimada: <strong>${plazo.fecha_texto}</strong>).
        </small>
      `;
      plazoEl.style.display = tipo === 'DEVOLUCION' ? 'block' : 'none';
    }

    if (saldoEl) {
      saldoEl.innerHTML = `
        <small>
          <i class="fa fa-info-circle"></i>
          Se sumarán <strong>${window.NotasCreditoUI.moneda(monto)}</strong> al campo
          <strong>limite_credito</strong> del cliente, incrementando su crédito disponible.
        </small>
      `;
      saldoEl.style.display = tipo === 'SALDO_FAVOR' ? 'block' : 'none';
    }
  },

  render(contenedor, estado) {
    const motivo = estado.motivo || estado.notaGuardada?.reason || '';
    const exito = this.mensajeExitoPorMotivo(motivo, estado);
    const monto = Number(estado.totales?.total ?? estado.notaGuardada?.total ?? 0);
    const plazo = this.calcularPlazoDevolucion(monto);
    const emailCliente = String(
      estado.notaGuardada?.customer_email
      || estado.facturaSeleccionada?.customer_email
      || ''
    ).trim();

    contenedor.innerHTML = `
      <div class="nc-modal" id="nc-modal-aplicacion-cobranza" aria-hidden="true">
        <div class="nc-modal-panel nc-modal-lg">
          <button class="nc-modal-cerrar" type="button" data-nc-cerrar-aplicacion>&times;</button>

          <div class="nc-card">
            <div class="nc-card-header">
              <h3><i class="fa ${exito.icono}"></i> ${exito.titulo}</h3>
              <p class="nc-subtitulo">UUID: ${estado.notaGuardada?.uuid || 'N/A'}</p>
            </div>

            <div class="nc-card-cuerpo">
              <section class="nc-alerta-exito nc-alerta-exito-${exito.clase}">
                <p>${exito.texto}</p>
              </section>

              <section class="nc-seccion-info">
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Nota de Crédito:</span>
                  <span class="nc-info-valor">${estado.notaGuardada?.folio || 'NC-' + estado.notaGuardada?.id}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Cliente:</span>
                  <span class="nc-info-valor">${estado.notaGuardada?.customer_name || estado.facturaSeleccionada?.customer_name || 'N/A'}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Monto Total:</span>
                  <span class="nc-info-valor nc-moneda-grande" id="nc-aplicacion-monto" data-monto="${monto}">${window.NotasCreditoUI.moneda(monto)}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Factura Relacionada:</span>
                  <span class="nc-info-valor">${estado.facturaSeleccionada?.folio || estado.notaGuardada?.invoice_folio_origen || 'N/A'}</span>
                </div>
              </section>

              <section class="nc-seccion-aplicacion">
                <h4><i class="fa fa-credit-card"></i> ¿Cómo deseas aplicar esta nota de crédito?</h4>
                <p class="nc-ayuda-seccion">Elige una opción para gestionar el saldo acreditado:</p>

                <div class="nc-opciones-aplicacion">
                  <div class="nc-opcion-card">
                    <div class="nc-opcion-header">
                      <input type="radio" name="nc-tipo-aplicacion" id="nc-aplicar-automatico" value="APLICAR" checked class="nc-radio-opcion">
                      <label for="nc-aplicar-automatico" class="nc-opcion-titulo">
                        <i class="fa fa-bolt"></i> Aplicar Automáticamente
                      </label>
                    </div>
                    <p class="nc-opcion-descripcion">
                      La nota de crédito se aplicará automáticamente al saldo pendiente de la factura relacionada,
                      reduciendo la deuda del cliente.
                    </p>
                    <div class="nc-opcion-detalles">
                      <small><i class="fa fa-info-circle"></i> El movimiento se registrará en cuentas por cobrar.</small>
                    </div>
                  </div>

                  <div class="nc-opcion-card">
                    <div class="nc-opcion-header">
                      <input type="radio" name="nc-tipo-aplicacion" id="nc-saldo-favor" value="SALDO_FAVOR" class="nc-radio-opcion">
                      <label for="nc-saldo-favor" class="nc-opcion-titulo">
                        <i class="fa fa-piggy-bank"></i> Dejar como Saldo a Favor
                      </label>
                    </div>
                    <p class="nc-opcion-descripcion">
                      El monto se agregará al límite de crédito del cliente como saldo a favor disponible.
                    </p>
                    <div class="nc-opcion-detalles nc-opcion-detalles-info" id="nc-saldo-favor-detalle" style="display:none;">
                      <small><i class="fa fa-info-circle"></i> Se sumarán <strong>${window.NotasCreditoUI.moneda(monto)}</strong> al <strong>limite_credito</strong> del cliente.</small>
                    </div>
                  </div>

                  <div class="nc-opcion-card">
                    <div class="nc-opcion-header">
                      <input type="radio" name="nc-tipo-aplicacion" id="nc-generar-devolucion" value="DEVOLUCION" class="nc-radio-opcion">
                      <label for="nc-generar-devolucion" class="nc-opcion-titulo">
                        <i class="fa fa-undo"></i> Generar Devolución
                      </label>
                    </div>
                    <p class="nc-opcion-descripcion">
                      Se generará un comprobante de devolución de efectivo y se enviará por correo al destinatario indicado.
                    </p>
                    <div class="nc-opcion-detalles nc-opcion-detalles-warning" id="nc-devolucion-plazo" style="display:none;">
                      <small>
                        <i class="fa fa-clock"></i>
                        Plazo estimado: <strong>${plazo.dias_habiles} días hábiles</strong>
                        (fecha estimada: <strong>${plazo.fecha_texto}</strong>).
                        ${monto <= 10000 ? 'Aplica para montos hasta $10,000.' : 'Aplica para montos mayores a $10,000.'}
                      </small>
                    </div>
                  </div>
                </div>
              </section>

              <section class="nc-seccion-email">
                <h4><i class="fa fa-envelope"></i> Correo del destinatario</h4>
                <p class="nc-ayuda-seccion">Obligatorio para devolución. Opcional para enviar el CFDI en las demás opciones.</p>
                <label class="nc-campo-label" for="nc-email-destinatario">Correo electrónico</label>
                <input
                  type="email"
                  id="nc-email-destinatario"
                  class="nc-input"
                  placeholder="cliente@empresa.com"
                  value="${emailCliente.replace(/"/g, '&quot;')}"
                  autocomplete="email"
                />
                <button class="nc-btn nc-btn-info nc-btn-enviar-email" id="nc-enviar-email" type="button">
                  <i class="fa fa-paper-plane"></i> Enviar CFDI por correo
                </button>
              </section>

              <section class="nc-seccion-confirmacion">
                <label class="nc-checkbox-label">
                  <input type="checkbox" id="nc-confirmar-entiendo">
                  <span class="nc-checkbox-custom"></span>
                  Entiendo que esta acción modificará la cobranza del cliente.
                </label>
              </section>

              <div class="nc-acciones nc-acciones-triple">
                <button class="nc-btn nc-btn-secundario" type="button" data-nc-cerrar-aplicacion>
                  <i class="fa fa-times"></i> Cancelar
                </button>
                <button class="nc-btn nc-btn-info" id="nc-descargar-cfdi" type="button">
                  <i class="fa fa-download"></i> Descargar CFDI
                </button>
                <button class="nc-btn nc-btn-primario" id="nc-confirmar-aplicacion" type="button" disabled>
                  <i class="fa fa-check"></i> Confirmar y Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.actualizarUiOpciones();
  }
};
