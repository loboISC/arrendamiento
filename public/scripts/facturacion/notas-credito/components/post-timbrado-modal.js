/* Modal personalizada post-timbrado con opción a descargar CFDI y enviar por email */
window.ComponenteModalPostTimbradoNC = {
  render(contenedor, estado, datosRespuesta) {
    if (!datosRespuesta) return;

    // Mapa de mensajes personalizados por tipo de relación/motivo
    const mensajesPorMotivo = {
      'DEVOLUCION': {
        icono: '↩️',
        titulo: 'Devolución Registrada',
        descripcion: 'La devolución de mercancía ha sido timbrada exitosamente. El CFDI de egreso se ha generado y está disponible para descargar.',
        color: '#3b82f6'
      },
      'DESCUENTO': {
        icono: '🏷️',
        titulo: 'Descuento Aplicado',
        descripcion: 'El descuento ha sido timbrado como CFDI de egreso. Puedes descargar el comprobante y enviarlo al cliente si es necesario.',
        color: '#10b981'
      },
      'BONIFICACION': {
        icono: '🎁',
        titulo: 'Bonificación Registrada',
        descripcion: 'La bonificación ha sido timbrada y registrada fiscalmente. Descarga el CFDI para tu control interno.',
        color: '#f59e0b'
      },
      'AJUSTE_ADMINISTRATIVO': {
        icono: '⚙️',
        titulo: 'Ajuste Administrativo Aplicado',
        descripcion: 'El ajuste administrativo ha sido timbrado correctamente. El CFDI se encuentra disponible para descargar.',
        color: '#8b5cf6'
      },
      'CORRECCION_PARCIAL': {
        icono: '✏️',
        titulo: 'Corrección Registrada',
        descripcion: 'La corrección parcial de factura ha sido timbrada. Puedes descargar el comprobante de egreso.',
        color: '#ec4899'
      }
    };

    const motivo = estado.motivo || 'DESCUENTO';
    const config = mensajesPorMotivo[motivo] || mensajesPorMotivo['DESCUENTO'];
    const uuid = datosRespuesta.uuid || '';
    const total = datosRespuesta.total || 0;

    // Estado para el formulario de email
    window.ModalPostTimbradoEstado = {
      enviando: false,
      correoDestino: '',
      mensajePersonalizado: ''
    };

    let modalWrapper = document.getElementById('nc-modal-post-timbrado-wrapper');
    if (!modalWrapper) {
      modalWrapper = document.createElement('div');
      modalWrapper.id = 'nc-modal-post-timbrado-wrapper';
      contenedor.appendChild(modalWrapper);
    }

    modalWrapper.innerHTML = `
      <div class="nc-modal-post-timbrado" id="nc-modal-post-timbrado" aria-hidden="false">
        <div class="nc-modal-post-panel" role="dialog" aria-labelledby="nc-post-titulo">
          <button class="nc-modal-cerrar-post" type="button" data-cerrar-post-timbrado aria-label="Cerrar">&times;</button>
          
          <!-- Sección superior: Confirmación y resumen -->
          <div class="nc-post-confirmacion" style="border-bottom: 2px solid ${config.color}; padding-bottom: 20px; margin-bottom: 25px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <div style="font-size: 48px; margin-bottom: 10px;">${config.icono}</div>
              <h2 id="nc-post-titulo" style="margin: 0; color: ${config.color}; font-size: 24px; font-weight: 700;">
                ${config.titulo}
              </h2>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 15px; margin: 0 0 20px 0; line-height: 1.5;">
              ${config.descripcion}
            </p>

            <!-- Resumen de datos -->
            <div class="nc-resumen-post" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid ${config.color};">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <div style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">UUID CFDI</div>
                  <div style="font-size: 13px; color: #000; font-family: monospace; word-break: break-all; font-weight: 500;">
                    ${uuid}
                  </div>
                </div>
                <div>
                  <div style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Total Acreditado</div>
                  <div style="font-size: 20px; color: ${config.color}; font-weight: 700;">
                    ${window.NotasCreditoUI ? window.NotasCreditoUI.moneda(total) : '$' + Number(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección de acciones: Descargar y Enviar Email -->
          <div class="nc-post-acciones">
            <div style="margin-bottom: 25px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #000; text-transform: uppercase;">
                Descargar Comprobante
              </h3>
              <div style="display: flex; gap: 10px;">
                <button class="nc-btn-post nc-btn-post-descargar" type="button" data-descargar-pdf>
                  <i style="font-weight: bold; margin-right: 6px;">📄</i>
                  Descargar PDF
                </button>
                <button class="nc-btn-post nc-btn-post-descargar-xml" type="button" data-descargar-xml>
                  <i style="font-weight: bold; margin-right: 6px;">⚙️</i>
                  Descargar XML
                </button>
              </div>
            </div>

            <!-- Formulario de Email -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
              <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 700; color: #000; text-transform: uppercase;">
                📧 Enviar por Correo Electrónico
              </h3>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #333;">
                  Correo del Cliente
                </label>
                <input 
                  type="email" 
                  class="nc-input-post-email" 
                  placeholder="cliente@empresa.com"
                  style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Arial, sans-serif; box-sizing: border-box;"
                  id="nc-post-email-destino"
                >
              </div>

              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #333;">
                  Mensaje Personalizado (opcional)
                </label>
                <textarea 
                  class="nc-textarea-post-mensaje"
                  placeholder="Escribe un mensaje personalizado para acompañar el CFDI..."
                  style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Arial, sans-serif; resize: vertical; min-height: 80px; box-sizing: border-box;"
                  id="nc-post-mensaje"
                ></textarea>
                <small style="display: block; margin-top: 5px; color: #999; font-size: 12px;">
                  Si dejas esto en blanco, se enviará el mensaje predeterminado.
                </small>
              </div>

              <button 
                class="nc-btn-post nc-btn-post-enviar-email" 
                type="button" 
                data-enviar-email
                style="width: 100%; background: ${config.color}; color: white; padding: 12px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;"
              >
                <i style="margin-right: 8px;">✉️</i>
                Enviar CFDI por Correo
              </button>
            </div>
          </div>

          <!-- Pie de modal -->
          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
            <button 
              class="nc-btn-post nc-btn-post-cerrar" 
              type="button" 
              data-cerrar-post-timbrado-final
              style="width: 100%; background: #6b7280; color: white; padding: 10px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;"
            >
              Cerrar
            </button>
          </div>
        </div>

        <!-- Loading indicator -->
        <div class="nc-post-loading" id="nc-post-loading" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px; animation: spin 1s linear infinite;">⏳</div>
          <p style="margin: 0; color: #666; font-weight: 600;">Enviando...</p>
        </div>
      </div>

      <!-- Toast para mensajes -->
      <div class="nc-post-toast" id="nc-post-toast" style="display: none; position: fixed; bottom: 20px; right: 20px; padding: 15px 20px; background: #10b981; color: white; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; max-width: 400px;">
        <span id="nc-post-toast-mensaje"></span>
      </div>

      <style>
        .nc-modal-post-timbrado {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .nc-modal-post-panel {
          background: white;
          border-radius: 12px;
          padding: 30px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
          position: relative;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .nc-modal-cerrar-post {
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          font-size: 28px;
          color: #999;
          cursor: pointer;
          padding: 5px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .nc-modal-cerrar-post:hover {
          color: #333;
        }

        .nc-btn-post {
          padding: 10px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          background: white;
          color: #333;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .nc-btn-post:hover {
          border-color: #999;
          background: #f3f4f6;
        }

        .nc-btn-post-descargar,
        .nc-btn-post-descargar-xml {
          flex: 1;
        }

        .nc-btn-post-enviar-email:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .nc-input-post-email,
        .nc-textarea-post-mensaje {
          font-family: 'Arial', sans-serif;
          transition: border-color 0.2s;
        }

        .nc-input-post-email:focus,
        .nc-textarea-post-mensaje:focus {
          outline: none;
          border-color: ${config.color};
          box-shadow: 0 0 0 3px ${config.color}15;
        }

        @media (max-width: 600px) {
          .nc-modal-post-panel {
            padding: 20px;
            max-height: none;
          }

          .nc-resumen-post {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;

    // Registrar manejadores de eventos después de renderizar
    setTimeout(() => {
      window.ComponenteModalPostTimbradoNC.registrarEventos(datosRespuesta, config);
    }, 0);
  },

  registrarEventos(datosRespuesta, config) {
    // Cerrar modal
    const btnCerrar = document.querySelector('[data-cerrar-post-timbrado], [data-cerrar-post-timbrado-final]');
    if (btnCerrar) {
      btnCerrar.addEventListener('click', () => {
        const modal = document.getElementById('nc-modal-post-timbrado-wrapper');
        if (modal) modal.remove();
      });
    }

    // Descargar PDF
    const btnDescargarPdf = document.querySelector('[data-descargar-pdf]');
    if (btnDescargarPdf) {
      btnDescargarPdf.addEventListener('click', async () => {
        const notaId = datosRespuesta.id;
        if (!notaId) {
          window.ComponenteModalPostTimbradoNC.mostrarToast('❌ No se pudo identificar la nota de crédito', '#ef4444');
          return;
        }
        try {
          btnDescargarPdf.disabled = true;
          const textoOrig = btnDescargarPdf.innerHTML;
          btnDescargarPdf.innerHTML = '⏳ Descargando...';
          const token = document.querySelector('[data-token]')?.getAttribute('data-token') || localStorage.getItem('token') || '';
          const resp = await fetch(`/api/credit-notes/${notaId}/pdf?download=true&_=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            throw new Error(json.error || 'No se pudo descargar el PDF.');
          }
          const blob = await resp.blob();
          if (!blob.size) throw new Error('El PDF recibido está vacío.');
          const uuid = String(datosRespuesta.uuid || notaId).replace(/[^a-zA-Z0-9-]/g, '');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `NOTA_CREDITO-${uuid}.pdf`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 2000);
          btnDescargarPdf.innerHTML = textoOrig;
        } catch (err) {
          window.ComponenteModalPostTimbradoNC.mostrarToast(`❌ ${err.message}`, '#ef4444');
        } finally {
          btnDescargarPdf.disabled = false;
        }
      });
    }

    // Descargar XML
    const btnDescargarXml = document.querySelector('[data-descargar-xml]');
    if (btnDescargarXml) {
      btnDescargarXml.addEventListener('click', async () => {
        const notaId = datosRespuesta.id;
        if (!notaId) {
          window.ComponenteModalPostTimbradoNC.mostrarToast('❌ No se pudo identificar la nota de crédito', '#ef4444');
          return;
        }
        try {
          btnDescargarXml.disabled = true;
          const textoOrig = btnDescargarXml.innerHTML;
          btnDescargarXml.innerHTML = '⏳ Descargando...';
          const token = document.querySelector('[data-token]')?.getAttribute('data-token') || localStorage.getItem('token') || '';
          const resp = await fetch(`/api/credit-notes/${notaId}/xml?_=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => ({}));
            throw new Error(json.error || 'No se pudo descargar el XML.');
          }
          const blob = await resp.blob();
          if (!blob.size) throw new Error('El XML recibido está vacío.');
          const uuid = String(datosRespuesta.uuid || notaId).replace(/[^a-zA-Z0-9-]/g, '');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `NOTA_CREDITO-${uuid}.xml`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 2000);
          btnDescargarXml.innerHTML = textoOrig;
        } catch (err) {
          window.ComponenteModalPostTimbradoNC.mostrarToast(`❌ ${err.message}`, '#ef4444');
        } finally {
          btnDescargarXml.disabled = false;
        }
      });
    }

    // Enviar por email
    const btnEnviarEmail = document.querySelector('[data-enviar-email]');
    if (btnEnviarEmail) {
      btnEnviarEmail.addEventListener('click', async () => {
        const correo = document.getElementById('nc-post-email-destino')?.value?.trim() || '';
        const mensaje = document.getElementById('nc-post-mensaje')?.value?.trim() || '';

        if (!correo) {
          window.ComponenteModalPostTimbradoNC.mostrarToast('⚠️ Por favor ingresa el correo del cliente', '#f59e0b');
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          window.ComponenteModalPostTimbradoNC.mostrarToast('⚠️ Correo inválido', '#f59e0b');
          return;
        }

        await window.ComponenteModalPostTimbradoNC.enviarNotaCreditoPorEmail(
          datosRespuesta.uuid,
          correo,
          mensaje,
          datosRespuesta,
          btnEnviarEmail,
          config
        );
      });
    }
  },

  async enviarNotaCreditoPorEmail(uuid, correo, mensaje, datosRespuesta, btnEnviar, config) {
    const token = document.querySelector('[data-token]')?.getAttribute('data-token') || localStorage.getItem('token') || '';
    
    btnEnviar.disabled = true;
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.innerHTML = '<i style="margin-right: 8px; animation: spin 1s linear infinite;">⏳</i>Enviando...';

    try {
      // Construir mensaje predeterminado si no se proporciona uno
      let mensajeFinal = mensaje;
      if (!mensaje) {
        const tiposMotivo = {
          'DEVOLUCION': 'Adjunto encontrarás el comprobante fiscal de la devolución registrada conforme a tu factura.',
          'DESCUENTO': 'Adjunto encontrarás el comprobante fiscal del descuento aplicado. Por favor revísalo y guárdalo para tus registros fiscales.',
          'BONIFICACION': 'Adjunto encontrarás el comprobante fiscal de la bonificación registrada. Agradecemos tu preferencia.',
          'AJUSTE_ADMINISTRATIVO': 'Adjunto encontrarás el comprobante fiscal del ajuste administrativo realizado.',
          'CORRECCION_PARCIAL': 'Adjunto encontrarás el comprobante fiscal de la corrección parcial registrada.'
        };
        mensajeFinal = tiposMotivo[window.NotasCreditoModal?.estado?.motivo || 'DESCUENTO'] || 
                       'Adjunto encontrarás el comprobante fiscal de nota de crédito registrado correctamente.';
      }

      const response = await fetch(`/api/credit-notes/${datosRespuesta.id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uuid,
          destinatario: correo,
          asunto: `Nota de Crédito CFDI - ${uuid.substring(0, 8).toUpperCase()}`,
          mensaje: mensajeFinal,
          pdfPath: datosRespuesta.pdfPath,
          xmlPath: datosRespuesta.xmlPath
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.ComponenteModalPostTimbradoNC.mostrarToast('✅ Nota de crédito enviada exitosamente', '#10b981');
        setTimeout(() => {
          document.getElementById('nc-modal-post-timbrado-wrapper')?.remove();
        }, 2000);
      } else {
        throw new Error(data.error || 'Error al enviar email');
      }
    } catch (error) {
      console.error('Error enviando email:', error);
      window.ComponenteModalPostTimbradoNC.mostrarToast(`❌ ${error.message}`, '#ef4444');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginal;
    }
  },

  mostrarToast(mensaje, color = '#10b981') {
    const toast = document.getElementById('nc-post-toast');
    if (toast) {
      const msgEl = document.getElementById('nc-post-toast-mensaje');
      if (msgEl) msgEl.textContent = mensaje;
      toast.style.background = color;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 4000);
    }
  }
};
