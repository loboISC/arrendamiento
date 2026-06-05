'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Wire up the click event for the download button in the filters row
  const btnDescargarReporte = document.getElementById('btn-descargar-reporte');
  if (btnDescargarReporte) {
    btnDescargarReporte.addEventListener('click', abrirReporteMensualModal);
  }

  // Populate Year dropdown options
  const repAnioSelect = document.getElementById('rep-anio');
  if (repAnioSelect) {
    const currentYear = new Date().getFullYear();
    repAnioSelect.innerHTML = '';
    for (let year = currentYear + 1; year >= 2020; year--) {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      if (year === currentYear) opt.selected = true;
      repAnioSelect.appendChild(opt);
    }
  }

  // Set current month as default
  const repMesSelect = document.getElementById('rep-mes');
  if (repMesSelect) {
    const currentMonth = new Date().getMonth() + 1;
    repMesSelect.value = currentMonth;
  }

  // Initial UI state for range date fields
  handlePeriodoChange();

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const estatusDropdown = document.getElementById('rep-estatus-options');
    const estatusBtn = document.getElementById('btn-rep-estatus-dropdown');
    if (estatusDropdown && estatusBtn && !estatusBtn.contains(e.target) && !estatusDropdown.contains(e.target)) {
      estatusDropdown.style.display = 'none';
    }

    const tipoDropdown = document.getElementById('rep-tipo-options');
    const tipoBtn = document.getElementById('btn-rep-tipo-dropdown');
    if (tipoDropdown && tipoBtn && !tipoBtn.contains(e.target) && !tipoDropdown.contains(e.target)) {
      tipoDropdown.style.display = 'none';
    }
  });
});

/**
 * Open the modal
 */
function abrirReporteMensualModal() {
  const rfcInput = document.getElementById('emisor-rfc');
  const rfcVal = rfcInput ? rfcInput.value : '---';
  
  const rfcBadge = document.getElementById('reporte-rfc-badge');
  if (rfcBadge) {
    rfcBadge.textContent = rfcVal;
  }

  const modal = document.getElementById('reporte-mensual-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Small timeout for nice CSS transition
    setTimeout(() => {
      modal.style.opacity = '1';
      const card = modal.querySelector('.modal-premium-card');
      if (card) card.style.transform = 'translateY(0)';
    }, 10);
  }

  // Update selected texts for multi-selects
  updateRepEstatusText();
  updateRepTipoText();
}

/**
 * Close the modal
 */
function cerrarReporteMensualModal() {
  const modal = document.getElementById('reporte-mensual-modal');
  if (modal) {
    modal.style.opacity = '0';
    const card = modal.querySelector('.modal-premium-card');
    if (card) card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
}

/**
 * Toggle visibility of Estatus option panel
 */
function toggleRepEstatusDropdown() {
  const div = document.getElementById('rep-estatus-options');
  if (div) {
    const isShowing = div.style.display === 'block';
    // Close other dropdown
    const other = document.getElementById('rep-tipo-options');
    if (other) other.style.display = 'none';

    div.style.display = isShowing ? 'none' : 'block';
  }
}

/**
 * Update button text with selected Estatus checkboxes
 */
function updateRepEstatusText() {
  const checkboxes = document.querySelectorAll('#rep-estatus-options input[type="checkbox"]');
  const selected = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      // Find label text
      selected.push(cb.parentElement.textContent.trim());
    }
  });

  const span = document.getElementById('rep-estatus-selected-text');
  if (span) {
    if (selected.length === 0) {
      span.textContent = 'Ninguno';
    } else if (selected.length === checkboxes.length) {
      span.textContent = 'Todos';
    } else {
      span.textContent = selected.join(', ');
    }
  }
}

/**
 * Toggle visibility of Tipo Factura options panel
 */
function toggleRepTipoDropdown() {
  const div = document.getElementById('rep-tipo-options');
  if (div) {
    const isShowing = div.style.display === 'block';
    // Close other dropdown
    const other = document.getElementById('rep-estatus-options');
    if (other) other.style.display = 'none';

    div.style.display = isShowing ? 'none' : 'block';
  }
}

/**
 * Update button text with selected Tipo Factura checkboxes
 */
function updateRepTipoText() {
  const checkboxes = document.querySelectorAll('#rep-tipo-options input[type="checkbox"]');
  const selected = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selected.push(cb.parentElement.textContent.trim().split(' ')[0]); // Get abbreviation: e.g. "Ingreso"
    }
  });

  const span = document.getElementById('rep-tipo-selected-text');
  if (span) {
    if (selected.length === 0) {
      span.textContent = 'Ninguno';
    } else if (selected.length === checkboxes.length) {
      span.textContent = 'Todos';
    } else {
      span.textContent = selected.join(', ');
    }
  }
}

/**
 * Toggle date inputs when Mes is "todos"
 */
function handlePeriodoChange() {
  const mesSelect = document.getElementById('rep-mes');
  const showRange = mesSelect && mesSelect.value === 'todos';
  
  const startContainer = document.getElementById('rep-fecha-inicio-container');
  const endContainer = document.getElementById('rep-fecha-fin-container');

  if (startContainer && endContainer) {
    if (showRange) {
      startContainer.style.display = 'block';
      endContainer.style.display = 'block';
    } else {
      startContainer.style.display = 'none';
      endContainer.style.display = 'none';
    }
  }
}

/**
 * Disable fields and show warnings if Recibidas is selected
 */
function handleTipoComprobanteChange() {
  const tipoComp = document.getElementById('rep-tipo-comprobante').value;
  const isRecibidas = tipoComp === 'recibidas';

  if (isRecibidas) {
    Swal.fire({
      icon: 'info',
      title: 'Comprobantes Recibidos',
      text: 'La sección de recibidos (gastos/compras) no se encuentra habilitada en la base de datos actual. El reporte se generará vacío.',
      confirmButtonColor: '#2979ff'
    });
  }
}

/**
 * Trigger backend download
 */
async function descargarReporteMensual(event) {
  event.preventDefault();

  const rfcInput = document.getElementById('emisor-rfc');
  const rfcVal = rfcInput ? rfcInput.value : '';
  if (!rfcVal || rfcVal === '...' || rfcVal === '---') {
    Swal.fire({
      icon: 'warning',
      title: 'Datos Incompletos',
      text: 'No se ha detectado el RFC emisor. Por favor espere a que se cargue la configuración.',
      confirmButtonColor: '#2979ff'
    });
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    Swal.fire({
      icon: 'error',
      title: 'Sesión Expirada',
      text: 'Inicie sesión de nuevo para descargar el reporte.',
      confirmButtonColor: '#ef4444'
    });
    return;
  }

  // Get active status checks
  const estatusCbs = document.querySelectorAll('#rep-estatus-options input[type="checkbox"]');
  const estatusArr = [];
  estatusCbs.forEach(cb => {
    if (cb.checked) estatusArr.push(cb.value);
  });

  // Get active tipo checks
  const tipoCbs = document.querySelectorAll('#rep-tipo-options input[type="checkbox"]');
  const tipoArr = [];
  tipoCbs.forEach(cb => {
    if (cb.checked) tipoArr.push(cb.value);
  });

  const mesVal = document.getElementById('rep-mes').value;
  const anioVal = document.getElementById('rep-anio').value;
  const fInicio = document.getElementById('rep-fecha-inicio').value;
  const fFin = document.getElementById('rep-fecha-fin').value;
  const incConcepto = document.getElementById('rep-incluir-concepto').checked;
  const tipoComp = document.getElementById('rep-tipo-comprobante').value;
  const tipoRel = document.getElementById('rep-tipo-relacion').value;

  // Build URL parameters
  const params = new URLSearchParams();
  params.append('emisor_rfc', rfcVal);
  params.append('tipo_comprobante', tipoComp);
  params.append('tipo_relacion', tipoRel);
  params.append('mes', mesVal);
  params.append('anio', anioVal);
  params.append('incluir_concepto', incConcepto);

  if (mesVal === 'todos') {
    if (fInicio) params.append('fecha_inicio', fInicio);
    if (fFin) params.append('fecha_fin', fFin);
  }

  estatusArr.forEach(val => params.append('estatus[]', val));
  tipoArr.forEach(val => params.append('tipo_factura[]', val));

  // Visual feedback: loading state
  const btnSubmit = document.getElementById('btn-rep-submit');
  const originalHtml = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Generando...';

  try {
    const url = `/api/facturas/reporte-mensual?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || 'Error al generar el reporte');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    // Get filename from response header, or use default fallback
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `Reporte_${rfcVal}_${mesVal === 'todos' ? 'TODOS' : mesVal.padStart(2, '0')}_${anioVal}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    // Close modal on success
    cerrarReporteMensualModal();

    Swal.fire({
      icon: 'success',
      title: 'Reporte Generado',
      text: 'Tu reporte se ha descargado exitosamente.',
      timer: 2500,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('[ReporteMensual] Error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error de Generación',
      text: error.message || 'No se pudo generar el reporte. Inténtelo más tarde.',
      confirmButtonColor: '#ef4444'
    });
  } finally {
    // Reset button loading state
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalHtml;
  }
}
