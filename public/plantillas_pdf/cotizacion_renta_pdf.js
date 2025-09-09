// Variables globales para el flujo de trabajo
    let currentStep = 1;
    let totalSteps = 11;
    let cotizacionData = {
      tipo: '',
      productos: [],
      accesorios: [],
      metodoEntrega:  '',
      direccionEntrega: {},
      datosContacto: {},
      garantia: {},
      // Detalle completo de selección para persistencia y PDF
      productosDetalle: {}, // key: 'prod-<id>' -> {id, nombre, descripcion, imagen, precio}
      accesoriosDetalle: {} // key: 'acc-<id>' -> {id, nombre, descripcion, imagen, precio}
    };
    
    // Datos de la empresa
    const empresa = {
      nombre: 'ANDAMIOS Y PROYECTOS TORRES, S.A. DE C.V.',
      direccion: 'Oriente 174 No. 290, Col. Moctezuma 2a Sección c.p. 15330, Venustiano Carranza, CDMX, MEXICO',
      telefono: '(01) 55-55-71-71-05, 55-26-46-00-24',
      celular: '55-62-55-78-19',
      email: 'ventas@andamiostorres.com',
      certificacion: 'ISO 9001:2015 CERTIFIED'
    };
    // Función para generar PDF
    async function generarPDF() {
      // Precaptura y sincronización para garantizar datos actualizados en el PDF
      try { if (typeof window.capturarDatosWorkflow === 'function') window.capturarDatosWorkflow(); } catch {}
      try { if (typeof window.syncEquiposWorkflow === 'function') window.syncEquiposWorkflow(); } catch {}
      try {
        // Asegurar que workflowData tenga la direccionEntrega del sessionStorage si estuviera vacía
        const wfStore = JSON.parse(sessionStorage.getItem('workflowClienteData') || '{}');
        if (!window.workflowData) window.workflowData = {};
        if (!window.workflowData.direccionEntrega || Object.keys(window.workflowData.direccionEntrega || {}).length === 0) {
          if (wfStore && wfStore.direccionEntrega) {
            window.workflowData.direccionEntrega = wfStore.direccionEntrega;
          }
        }
        // Asegurar método/tipo de envío si existe en el formulario
        try {
          const tipoEnvio = document.getElementById('tipo-envio')?.value || '';
          if (tipoEnvio) window.workflowData.metodoEntrega = tipoEnvio;
        } catch {}
      } catch {}
      // Intentar primero con jsPDF (más confiable)
      if (window.jspdf) {
        console.log('Usando jsPDF para generar PDF...');
        await generarPDFConJsPDF();
        return;
      }

      // Fallback a html2pdf si jsPDF no está disponible
      try {
        console.log('Iniciando generación de PDF con html2pdf...');
        
        // Crear contenido del PDF
        const pdfContent = crearContenidoPDF();
        console.log('Contenido PDF generado:', pdfContent);
        
        // Crear un elemento temporal para el contenido
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pdfContent;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        document.body.appendChild(tempDiv);
        
        // Configuración mejorada para html2pdf
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `Cotizacion_${document.getElementById('cotizacion-numero').value}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true
          }
        };

        console.log('Configuración PDF:', opt);
        
        // Generar PDF
        html2pdf()
          .set(opt)
          .from(tempDiv)
          .save()
          .then(() => {
            console.log('PDF generado exitosamente con html2pdf');
            document.body.removeChild(tempDiv);
          })
          .catch(async error => {
            console.error('Error al generar PDF con html2pdf:', error);
            document.body.removeChild(tempDiv);
            
            // Si html2pdf falla, intentar con jsPDF
            if (window.jspdf) {
              console.log('Intentando con jsPDF como fallback...');
              await generarPDFConJsPDF();
            } else {
              alert('Error al generar el PDF. Por favor intente nuevamente.');
            }
          });
          
      } catch (error) {
        console.error('Error en generarPDF:', error);
        
        // Último intento con jsPDF
        if (window.jspdf) {
          console.log('Intentando con jsPDF como último recurso...');
          await generarPDFConJsPDF();
        } else {
          alert('Error al generar el PDF. Por favor intente nuevamente.');
        }
      }
    }

    // Función para limpiar formulario
    function limpiarFormulario() {
      // Limpiar campos del cliente
      document.getElementById('cliente-nombre').value = '';
      document.getElementById('cliente-domicilio').value = '';
      document.getElementById('cliente-telefono').value = '';
      document.getElementById('cliente-ciudad').value = '';
      document.getElementById('cliente-email').value = '';
      
      // Limpiar lista de equipos
      const equipmentList = document.getElementById('equipment-list');
      equipmentList.innerHTML = `
        <div class="equipment-item">
          <div class="equipment-image">
            <img src="img/default.jpg" alt="Producto" style="width: 60px; height: 60px; object-fit: contain; border-radius: 4px; border: 1px solid #e3e8ef;">
          </div>
          <input type="text" placeholder="Descripción del equipo" class="equipment-description">
          <input type="number" placeholder="Cantidad" class="quantity" min="1" value="1">
          <input type="number" placeholder="Precio unitario" class="price" min="0" step="0.01">
          <span class="subtotal">$0.00</span>
          <button type="button" class="remove-equipment-btn" onclick="removeEquipment(this)">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      `;
      
      // Ocultar resultado de búsqueda
      document.getElementById('resultado-busqueda').style.display = 'none';
      
      // Generar nuevo número de cotización
      document.getElementById('cotizacion-numero').value = generarNumeroCotizacion();
      
      // Recalcular totales
      calcularTotales();
      
      console.log('🧹 Formulario limpiado');
    }

    // Crear contenido del PDF
    function crearContenidoPDF() {
      try {
        const numeroCotizacion = document.getElementById('cotizacion-numero').value;
        const fecha = document.getElementById('cotizacion-fecha').value;
        const clienteNombre = document.getElementById('cliente-nombre').value;
        const clienteTelefono = document.getElementById('cliente-telefono').value;
        const clienteEmail = document.getElementById('cliente-email').value;
        const clienteDomicilio = document.getElementById('cliente-domicilio').value;
        const clienteCiudad = document.getElementById('cliente-ciudad').value;
        const condiciones = document.getElementById('cliente-condiciones').value;
        const descripcion = document.getElementById('cotizacion-descripcion').value;
        const dias = document.getElementById('cotizacion-dias').value;
        const condicionesPago = document.getElementById('condiciones-pago').value;
        const documentacion = document.getElementById('documentacion-requerida').value;

        // Fecha de entrega (opcional): leer del DOM o de sessionStorage
        let fechaEntrega = '';
        try {
          const elFechaEntrega = document.getElementById('fecha-entrega');
          if (elFechaEntrega && elFechaEntrega.value) {
            fechaEntrega = elFechaEntrega.value;
          } else {
            const wf = JSON.parse(sessionStorage.getItem('workflowClienteData') || '{}');
            if (wf && wf.fechaEntrega) fechaEntrega = wf.fechaEntrega;
          }
        } catch {}

        // Obtener equipos
        const equipos = [];
        document.querySelectorAll('.equipment-item').forEach(item => {
          const descripcion = item.querySelector('.equipment-description').value;
          const cantidad = item.querySelector('.quantity').value;
          const precio = item.querySelector('.price').value;
          if (descripcion && cantidad && precio) {
            equipos.push({
              descripcion: descripcion,
              cantidad: parseInt(cantidad),
              precio: parseFloat(precio),
              subtotal: parseFloat(cantidad) * parseFloat(precio)
            });
          }
        });

        // Calcular totales
        const totalEquipos = equipos.reduce((sum, eq) => sum + eq.subtotal, 0);
        const rentaDia = totalEquipos;
        const totalDias = rentaDia * parseInt(dias);
        let costoEnvio = 0;
        try {
          costoEnvio = calcularEnvio();
        } catch {
          // Fallback: obtener costo de envío desde sessionStorage o workflowData
          try {
            const wf = JSON.parse(sessionStorage.getItem('workflowClienteData') || '{}');
            if (wf.ubicacion && wf.ubicacion.distancia) {
              const distancia = parseFloat(wf.ubicacion.distancia) || 0;
              costoEnvio = distancia * 50; // $50 por km como en el cálculo original
            }
          } catch {}
          
          if (!costoEnvio && window.workflowData && window.workflowData.ubicacion) {
            const distancia = parseFloat(window.workflowData.ubicacion.distancia) || 0;
            costoEnvio = distancia * 50;
          }
        }
        const subtotal = totalDias + costoEnvio;
        const iva = subtotal * 0.16;
        const totalFinal = subtotal + iva;
        const garantia = totalEquipos * 2;

        const fechaFormateada = new Date(fecha).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const fechaEntregaFormateada = fechaEntrega ? new Date(fechaEntrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

        // Información del envío (con fallbacks)
        let direccionEntrega = document.getElementById('direccion-entrega').value;
        let tipoEnvio = document.getElementById('tipo-envio').value;
        if (!direccionEntrega) {
          try {
            const wf = JSON.parse(sessionStorage.getItem('workflowClienteData') || '{}');
            const de = wf?.direccionEntrega || {};
            const linea = [de.calle, de.colonia, de.cp, de.ciudad].filter(Boolean).join(', ');
            if (linea) direccionEntrega = linea + (de.referencias ? ` (Ref: ${de.referencias})` : '');
          } catch {}
        }
        if (!tipoEnvio) {
          try {
            if (window.workflowData && window.workflowData.metodoEntrega) tipoEnvio = window.workflowData.metodoEntrega;
          } catch {}
        }
        const distanciaKm = document.getElementById('distancia-km').value;
        const detalleCalculo = document.getElementById('detalle-calculo').value;
        const origenEnvio = 'Oriente 174 No. 290, CP 15530, CDMX';

        console.log('Datos para PDF:', {
          numeroCotizacion,
          fecha,
          clienteNombre,
          equipos: equipos.length,
          totalFinal
        });

        const contenidoHTML = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: white;">
            <!-- Header -->
            <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="margin: 0; color: #2c3e50; font-size: 24px;">${empresa.nombre}</h1>
              <p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">${empresa.certificacion}</p>
              <p style="margin: 5px 0; font-size: 12px;">${empresa.direccion}</p>
              <p style="margin: 5px 0; font-size: 12px;">Tel: ${empresa.telefono} | Cel: ${empresa.celular}</p>
              <p style="margin: 5px 0; font-size: 12px;">Email: ${empresa.email}</p>
            </div>

            <!-- Información de Cotización -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
              <div>
                <h2 style="margin: 0; color: #2c3e50; font-size: 20px;">COTIZACIÓN</h2>
                <p style="margin: 5px 0; font-size: 14px;"><strong>No.:</strong> ${numeroCotizacion}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Fecha:</strong> ${fechaFormateada}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Moneda:</strong> MXN</p>
          </div>
          </div>

            <!-- Información del Cliente -->
            <div style="margin-bottom: 30px;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">RECEPTOR</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                <div><strong>Compañía:</strong> ${condiciones === 'Empresa' ? clienteNombre : ''}</div>
                <div><strong>Contacto:</strong> ${clienteNombre}</div>
                <div><strong>Domicilio:</strong> ${clienteDomicilio}</div>
                <div><strong>Ciudad:</strong> ${clienteCiudad}</div>
                <div><strong>Teléfono:</strong> ${clienteTelefono}</div>
                <div><strong>E-Mail:</strong> ${clienteEmail}</div>
          </div>
            </div>

            <!-- Descripción del Servicio -->
            <div style="margin-bottom: 30px;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">DESCRIPCIÓN DEL SERVICIO</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">${descripcion || 'Renta de equipos y materiales'}</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;"><strong>Periodo de renta:</strong> ${dias} días</p>
            </div>

            <!-- Información de Envío -->
            ${direccionEntrega ? `
            <div style="margin-bottom: 30px;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">INFORMACIÓN DE ENVÍO</h3>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 14px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div><strong>Origen:</strong> ${origenEnvio}</div>
                  <div><strong>Destino:</strong> ${direccionEntrega}</div>
                  <div><strong>Tipo de Envío:</strong> ${tipoEnvio === 'local' ? 'Local' : 'Foráneo'}</div>
                  <div><strong>Distancia:</strong> ${distanciaKm} km</div>
                  <div><strong>Cálculo:</strong> ${detalleCalculo}</div>
                  <div><strong>Costo de Envío:</strong> $${costoEnvio.toFixed(2)}</div>
                  ${fechaEntregaFormateada ? `<div><strong>Fecha de Entrega:</strong> ${fechaEntregaFormateada}</div>` : ''}
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Tabla de Equipos -->
            <div style="margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">PART.</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">CANT.</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">DESCRIPCIÓN</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">P.UNIT.</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">IMPORTE</th>
                  </tr>
                </thead>
            <tbody>
                  ${equipos.map((eq, index) => `
                    <tr>
                      <td style="border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">${eq.cantidad}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">${eq.descripcion}</td>
                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${eq.precio.toFixed(2)}</td>
                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${eq.subtotal.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  ${costoEnvio > 0 ? `
                    <tr>
                      <td style="border: 1px solid #ddd; padding: 8px;">${equipos.length + 1}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">1</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">LOGISTICA (ENTREGA Y RECOLECCION) - ${distanciaKm} km</td>
                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${costoEnvio.toFixed(2)}</td>
                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${costoEnvio.toFixed(2)}</td>
                    </tr>
                  ` : ''}
            </tbody>
          </table>
          </div>

            <!-- Resumen Financiero -->
            <div style="margin-bottom: 30px;">
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span><strong>RENTA POR DÍA:</strong></span>
                <span>$${rentaDia.toFixed(2)}</span>
          </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span><strong>X ${dias} DÍAS:</strong></span>
                <span>$${totalDias.toFixed(2)}</span>
          </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span><strong>SUB-TOTAL:</strong></span>
                <span>$${subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span><strong>I.V.A. (16%):</strong></span>
                <span>$${iva.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px;">
                <span>TOTAL:</span>
                <span>$${totalFinal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 10px;">
                <span><strong>GARANTÍA:</strong></span>
                <span>$${garantia.toFixed(2)}</span>
              </div>
            </div>

            <!-- Condiciones -->
            <div style="margin-bottom: 30px;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">CONDICIONES</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">${condicionesPago}</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;"><strong>Documentación requerida:</strong></p>
              <p style="margin: 5px 0; font-size: 14px;">${documentacion}</p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #7f8c8d;">
              <p style="margin: 5px 0;">Hora: ${new Date().toLocaleTimeString('es-MX')}</p>
              <p style="margin: 5px 0;">Página 1 de 1</p>
            </div>
        </div>
      `;

        console.log('Contenido HTML generado correctamente');
        return contenidoHTML;
        
      } catch (error) {
        console.error('Error en crearContenidoPDF:', error);
        return '<div style="padding: 20px; text-align: center;"><h2>Error al generar el PDF</h2><p>Por favor intente nuevamente.</p></div>';
      }
    }