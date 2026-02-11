// Función mejorada para ver detalles de cotizaciones (sobrescribe la original)
// Muestra modal con detalles y botón para abrir PDF
async function verDetalles(id) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/cotizaciones/' + id, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (!response.ok) {
      throw new Error('Error al cargar la cotización');
    }

    const cotizacion = await response.json();

    // 🔍 LOGS DE DEPURACIÓN
    console.log('═══════════════════════════════════════');
    console.log('📦 DATOS COMPLETOS DE COTIZACIÓN:', cotizacion);
    console.log('🔧 cotizacion.equipos:', cotizacion.equipos);
    console.log('📝 cotizacion.descripcion:', cotizacion.descripcion);
    console.log('🚚 cotizacion.tipo_entrega:', cotizacion.tipo_entrega);
    console.log('═══════════════════════════════════════');

    // Funciones de formato
    const formatMoney = (val) => new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(val || 0);

    const formatDate = (date) => new Date(date).toLocaleDateString('es-MX');

    // Procesar equipos/productos
    let equiposHTML = '';

    // PASO 1: Verificar productos_seleccionados y accesorios_seleccionados (campos reales del backend)
    // Parsear JSON si vienen como string
    let productosArray = cotizacion.productos_seleccionados || [];
    let accesoriosArray = cotizacion.accesorios_seleccionados || [];

    // Si son strings, parsearlos
    if (typeof productosArray === 'string') {
      try { productosArray = JSON.parse(productosArray); } catch (e) { productosArray = []; }
    }
    if (typeof accesoriosArray === 'string') {
      try { accesoriosArray = JSON.parse(accesoriosArray); } catch (e) { accesoriosArray = []; }
    }

    // Asegurar que sean arrays
    if (!Array.isArray(productosArray)) productosArray = [];
    if (!Array.isArray(accesoriosArray)) accesoriosArray = [];

    const todosLosItems = [...productosArray, ...accesoriosArray];

    console.log('🔍 Productos encontrados:', productosArray.length);
    console.log('🔍 Accesorios encontrados:', accesoriosArray.length);
    console.log('🔍 Total items:', todosLosItems.length);

    if (todosLosItems.length > 0) {
      equiposHTML = todosLosItems.map((item, i) => {
        const cantidad = item.cantidad || 1;
        // Calcular precio unitario desde subtotal si no existe precio_unitario
        const unitario = item.precio_unitario || item.precio || item.price || (item.subtotal ? item.subtotal / cantidad : 0);
        const total = item.subtotal || (cantidad * unitario);

        return '<tr><td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (i + 1) + '</td>' +
          '<td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (item.nombre || item.descripcion || 'Producto') + '</td>' +
          '<td style="padding: 8px; text-align: center; border-bottom: 1px solid #f0f0f0;">' + cantidad + '</td>' +
          '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">' + formatMoney(unitario) + '</td>' +
          '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;"><strong>' + formatMoney(total) + '</strong></td></tr>';
      }).join('');
    }

    // PASO 2 (FALLBACK): Verificar si existe cotizacion.equipos (array directo)
    else if (cotizacion.equipos && Array.isArray(cotizacion.equipos) && cotizacion.equipos.length > 0) {
      equiposHTML = cotizacion.equipos.map((e, i) => {
        const cantidad = e.cantidad || 1;
        const unitario = e.precio_unitario || e.precio || e.price || 0;
        const total = e.subtotal || (cantidad * unitario);
        return '<tr><td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (i + 1) + '</td>' +
          '<td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (e.descripcion || e.nombre || 'Equipo') + '</td>' +
          '<td style="padding: 8px; text-align: center; border-bottom: 1px solid #f0f0f0;">' + cantidad + '</td>' +
          '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">' + formatMoney(unitario) + '</td>' +
          '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;"><strong>' + formatMoney(total) + '</strong></td></tr>';
      }).join('');
    }

    // PASO 3 (FALLBACK): Buscar en cotizacion.descripcion (JSON string)
    else if (cotizacion.descripcion && cotizacion.descripcion !== '[]') {
      try {
        const desc = typeof cotizacion.descripcion === 'string' ? JSON.parse(cotizacion.descripcion) : cotizacion.descripcion;

        if (Array.isArray(desc) && desc.length > 0) {
          equiposHTML = desc.map((it, i) => {
            const cantidad = it.cantidad || 1;
            const unitario = it.precio_unitario || 0;
            const total = cantidad * unitario;
            return '<tr><td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (i + 1) + '</td>' +
              '<td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">' + (it.descripcion || it.nombre || '-') + '</td>' +
              '<td style="padding: 8px; text-align: center; border-bottom: 1px solid #f0f0f0;">' + cantidad + '</td>' +
              '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;">' + formatMoney(unitario) + '</td>' +
              '<td style="padding: 8px; text-align: right; border-bottom: 1px solid #f0f0f0;"><strong>' + formatMoney(total) + '</strong></td></tr>';
          }).join('');
        }
      } catch (e) {
        console.error('Error parseando descripción:', e);
      }
    }

    // 🔍 LOG: Resultado del procesamiento
    console.log('📊 equiposHTML generado:', equiposHTML ? 'SÍ (' + equiposHTML.length + ' chars)' : 'NO (vacío)');

    // Datos de resumen
    // Construir información de entrega más descriptiva
    let tipoEntrega = 'No especificado';
    if (cotizacion.tipo_envio) {
      const tipoEnvioMap = {
        'local': 'Envío Local',
        'foraneo': 'Envío Foráneo',
        'recoleccion': 'Recolección en Almacén',
        'express': 'Envío Express'
      };
      tipoEntrega = tipoEnvioMap[cotizacion.tipo_envio] || cotizacion.tipo_envio;

      // Agregar kilómetros si están disponibles
      if (cotizacion.entrega_kilometros && parseFloat(cotizacion.entrega_kilometros) > 0) {
        tipoEntrega += ' (' + cotizacion.entrega_kilometros + ' km)';
      }

      // Agregar municipio si está disponible
      if (cotizacion.entrega_municipio) {
        tipoEntrega += ' - ' + cotizacion.entrega_municipio;
      }
    }

    const subtotal = parseFloat(cotizacion.subtotal || cotizacion.total || 0);
    const iva = parseFloat(cotizacion.iva || 0);
    const total = parseFloat(cotizacion.total || cotizacion.monto_total || 0);

    // Construir HTML del modal
    let modalHTML = '<div style="font-size: 0.95rem; max-height: 80vh; overflow-y: auto;">';

    // Información general
    modalHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">';
    modalHTML += '<div>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Número:</strong> ' + cotizacion.numero_cotizacion + '</p>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Cliente:</strong> ' + (cotizacion.cliente_nombre || cotizacion.nombre_cliente || 'N/A') + '</p>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Fecha:</strong> ' + formatDate(cotizacion.fecha_cotizacion) + '</p>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Tipo:</strong> ' + (cotizacion.tipo || 'N/A') + '</p>';
    modalHTML += '</div>';
    modalHTML += '<div>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Estado:</strong> <span class="tag tag-' + (cotizacion.estado || 'borrador').toLowerCase().replace(/\s+/g, '-') + '">' + (cotizacion.estado || 'Borrador') + '</span></p>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Prioridad:</strong> <span class="tag tag-' + (cotizacion.prioridad || 'media').toLowerCase() + '">' + (cotizacion.prioridad || 'Media') + '</span></p>';
    modalHTML += '<p style="margin: 8px 0;"><strong>Entrega:</strong> <strong style="color: #2979ff;">' + tipoEntrega + '</strong></p>';
    modalHTML += '</div>';
    modalHTML += '</div>';

    // Tabla de equipos
    modalHTML += '<h4 style="margin: 20px 0 10px 0; border-bottom: 2px solid #2979ff; padding-bottom: 8px;"><i class="fa fa-list"></i> Detalle de Equipos</h4>';
    modalHTML += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 20px;">';
    modalHTML += '<thead>';
    modalHTML += '<tr style="background: #f5f7fa; border-bottom: 2px solid #e0e0e0;">';
    modalHTML += '<th style="padding: 10px; text-align: left; font-weight: 600;">#</th>';
    modalHTML += '<th style="padding: 10px; text-align: left; font-weight: 600;">Descripción</th>';
    modalHTML += '<th style="padding: 10px; text-align: center; font-weight: 600;">Cantidad</th>';
    modalHTML += '<th style="padding: 10px; text-align: right; font-weight: 600;">Precio Unit.</th>';
    modalHTML += '<th style="padding: 10px; text-align: right; font-weight: 600;">Total</th>';
    modalHTML += '</tr>';
    modalHTML += '</thead>';
    modalHTML += '<tbody>';
    modalHTML += equiposHTML || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;"><i class="fa fa-inbox"></i> Sin equipos especificados</td></tr>';
    modalHTML += '</tbody>';
    modalHTML += '</table>';

    // Resumen de totales
    modalHTML += '<div style="text-align: right; padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">';
    modalHTML += '<p style="margin: 8px 0;"><strong>Subtotal:</strong> ' + formatMoney(subtotal) + '</p>';
    if (iva > 0) {
      modalHTML += '<p style="margin: 8px 0;"><strong>IVA (16%):</strong> ' + formatMoney(iva) + '</p>';
    }
    modalHTML += '<p style="margin: 12px 0; font-size: 1.2rem; color: #2979ff; border-top: 2px solid #e0e0e0; padding-top: 10px;"><strong>Total: ' + formatMoney(total) + '</strong></p>';
    modalHTML += '</div>';

    // Notas
    if (cotizacion.notas) {
      modalHTML += '<div style="margin-bottom: 20px; padding: 12px; background: #fffbe6; border-left: 4px solid #ffc107; border-radius: 4px;">';
      modalHTML += '<h4 style="margin: 0 0 8px 0; color: #f57f17;"><i class="fa fa-sticky-note"></i> Notas</h4>';
      modalHTML += '<p style="margin: 0; color: #333;">' + cotizacion.notas + '</p>';
      modalHTML += '</div>';
    }

    // Botones de acción
    modalHTML += '<div style="display: flex; gap: 10px; margin-top: 20px;">';
    modalHTML += '<button class="btn-primary" onclick="vistaPreviaPDF(' + cotizacion.id_cotizacion + ')" style="flex: 1;"><i class="fa fa-file-pdf"></i> Vista previa PDF</button>';
    modalHTML += '<button class="btn-primary" onclick="cerrarModal()" style="flex: 1; background: #6b7280;"><i class="fa fa-times"></i> Cerrar</button>';
    modalHTML += '</div>';
    modalHTML += '</div>';

    // Actualizar modal
    document.getElementById('modal-title').textContent = 'Cotización ' + cotizacion.numero_cotizacion;
    document.getElementById('modal-body').innerHTML = modalHTML;
    document.getElementById('modal-detalles').style.display = 'flex';

  } catch (error) {
    console.error('Error cargando detalles:', error);
    alert('Error al cargar los detalles de la cotización: ' + error.message);
  }
}

// Función para cerrar modal
function cerrarModal() {
  const modal = document.getElementById('modal-detalles');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Limpiar columna vacía de la tabla al cargar
document.addEventListener('DOMContentLoaded', function () {
  // Esperar a que la tabla se renderice
  setTimeout(function () {
    const table = document.querySelector('.cotizaciones-table tbody');
    if (table) {
      // Remover celdas vacías (8ª columna que está vacía)
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 8) {
          // Si hay más de 8 celdas, remover la 8ª (índice 7)
          if (cells[7] && cells[7].textContent.trim() === '') {
            cells[7].remove();
          }
        }
      });
    }
  }, 100);
});
