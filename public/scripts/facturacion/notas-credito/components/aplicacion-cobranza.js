/* Componente para aplicación automática a cobranza post-timbrado. */
window.ComponenteAplicacionCobranzaNC = {
  render(contenedor, estado) {
    contenedor.innerHTML = `
      <div class="nc-modal" id="nc-modal-aplicacion-cobranza" aria-hidden="true">
        <div class="nc-modal-panel nc-modal-lg">
          <button class="nc-modal-cerrar" type="button" data-nc-cerrar-aplicacion>&times;</button>
          
          <div class="nc-card">
            <div class="nc-card-header">
              <h3><i class="fa fa-check-circle"></i> CFDI Timbrado Exitosamente</h3>
              <p class="nc-subtitulo">UUID: ${estado.notaGuardada?.uuid || 'N/A'}</p>
            </div>
            
            <div class="nc-card-cuerpo">
              <!-- Resumen de la NC -->
              <section class="nc-seccion-info">
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Nota de Crédito:</span>
                  <span class="nc-info-valor">${estado.notaGuardada?.folio || 'NC-' + estado.notaGuardada?.id}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Cliente:</span>
                  <span class="nc-info-valor">${estado.notaGuardada?.customer_name || 'N/A'}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Monto Total:</span>
                  <span class="nc-info-valor nc-moneda-grande">${window.NotasCreditoUI.moneda(estado.totales.total)}</span>
                </div>
                <div class="nc-info-fila">
                  <span class="nc-info-etiqueta">Factura Relacionada:</span>
                  <span class="nc-info-valor">${estado.facturaSeleccionada?.folio || 'N/A'}</span>
                </div>
              </section>

              <!-- Opciones de Aplicación -->
              <section class="nc-seccion-aplicacion">
                <h4><i class="fa fa-credit-card"></i> ¿Cómo deseas aplicar esta nota de crédito?</h4>
                <p class="nc-ayuda-seccion">Elige una opción para gestionar el saldo acreditado:</p>

                <div class="nc-opciones-aplicacion">
                  <!-- Opcion 1: Aplicar Automáticamente -->
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

                  <!-- Opcion 2: Dejar como Saldo a Favor -->
                  <div class="nc-opcion-card">
                    <div class="nc-opcion-header">
                      <input type="radio" name="nc-tipo-aplicacion" id="nc-saldo-favor" value="SALDO_FAVOR" class="nc-radio-opcion">
                      <label for="nc-saldo-favor" class="nc-opcion-titulo">
                        <i class="fa fa-piggy-bank"></i> Dejar como Saldo a Favor
                      </label>
                    </div>
                    <p class="nc-opcion-descripcion">
                      El cliente tendrá un saldo a favor que podrá aplicar manualmente a futuras facturas 
                      o solicitar devolución.
                    </p>
                    <div class="nc-opcion-detalles">
                      <small><i class="fa fa-info-circle"></i> Aparecerá en el estado de cuenta del cliente.</small>
                    </div>
                  </div>

                  <!-- Opcion 3: Generar Devolución -->
                  <div class="nc-opcion-card">
                    <div class="nc-opcion-header">
                      <input type="radio" name="nc-tipo-aplicacion" id="nc-generar-devolucion" value="DEVOLUCION" class="nc-radio-opcion">
                      <label for="nc-generar-devolucion" class="nc-opcion-titulo">
                        <i class="fa fa-undo"></i> Generar Devolución
                      </label>
                    </div>
                    <p class="nc-opcion-descripcion">
                      Se generará un comprobante de devolución de efectivo. El cliente recibirá 
                      los fondos según su forma de pago registrada.
                    </p>
                    <div class="nc-opcion-detalles">
                      <small><i class="fa fa-warning"></i> Esta acción no puede deshacerse fácilmente.</small>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Confirmación de Acción -->
              <section class="nc-seccion-confirmacion">
                <label class="nc-checkbox-label">
                  <input type="checkbox" id="nc-confirmar-entiendo" required>
                  <span class="nc-checkbox-custom"></span>
                  Entiendo que esta acción modificará la cobranza del cliente.
                </label>
              </section>

              <!-- Acciones -->
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
  }
};
