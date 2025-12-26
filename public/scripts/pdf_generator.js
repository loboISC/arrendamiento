/**
 * ========== GENERADOR DE PDF CON PUPPETEER ==========
 * 
 * Ventajas sobre html2canvas + jsPDF:
 * ✅ Texto real seleccionable y buscable
 * ✅ Fidelidad 100% al CSS (flexbox, grid, etc.)
 * ✅ Fuentes renderizadas correctamente
 * ✅ Archivos más pequeños (vectorial vs imagen)
 * ✅ Calidad perfecta a cualquier zoom
 * ✅ Soporte completo de @media print
 */

/**
 * Genera PDF usando Puppeteer en el servidor
 * Mantiene la estética exacta del template para hoja tamaño carta
 * @param {Object} options - Opciones de generación
 * @param {boolean} options.printMode - Si es true, abre vista previa de impresión en lugar de descargar
 */
async function generatePDF(options = {}) {
    const { printMode = false } = options;
    const btn = printMode 
      ? document.querySelector('[onclick*="printReport"]')
      : document.getElementById('download-pdf-btn');
    const originalText = btn ? btn.innerHTML : '';

    try {
        // Mostrar indicador de carga
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span style="font-size:1.2rem;">⏳</span> <span>Generando PDF...</span>';
        }
        console.log('[PDF] Iniciando generación con Puppeteer...');

        // Obtener el contenedor del documento
        const docContainer = document.getElementById('pdf-template');
        if (!docContainer) {
            throw new Error('No se encontró el contenedor del documento');
        }

        // Clonar el documento para prepararlo
        const clone = docContainer.cloneNode(true);

        const originalHeader = docContainer.querySelector('header.print-header');
        const originalFooter = docContainer.querySelector('footer.print-footer');
        const headerHeight = originalHeader ? originalHeader.offsetHeight : 0;
        const footerHeight = originalFooter ? originalFooter.offsetHeight : 0;

        // Remover elementos que no deben aparecer en el PDF
        const elementsToRemove = ['#filters-panel', '#preview-title', '.no-print'];
        elementsToRemove.forEach(selector => {
            const el = clone.querySelector(selector);
            if (el) el.remove();
        });

        // Ocultar toolbar de controles
        const toolbar = clone.querySelector('.cr-toolbar');
        if (toolbar) toolbar.style.display = 'none';

        // Recopilar solo estilos inline para evitar cargas de red al renderizar con Puppeteer
        const styles = Array.from(document.querySelectorAll('style'))
            .map(el => el.outerHTML)
            .join('\n');

        // Obtener folio/numero_cotizacion desde varias fuentes (fallbacks)
        const getText = (el) => (el ? (el.textContent || el.value || '').trim() : '');
        let folio = '';
        const folioEl = document.getElementById('quote-number');
        if (getText(folioEl)) folio = getText(folioEl);
        if (!folio) {
          const alt1 = document.getElementById('numero_cotizacion') || document.querySelector('#numero-cotizacion');
          folio = getText(alt1) || folio;
        }
        if (!folio) {
          const alt2 = document.querySelector('input[name="numero_cotizacion"], input[name="numero-cotizacion"]');
          folio = getText(alt2) || folio;
        }
        if (!folio) {
          const tpl = document.getElementById('pdf-template');
          folio = (tpl && tpl.dataset && (tpl.dataset.folio || tpl.dataset.numeroCotizacion || tpl.dataset.numero_cotizacion) || '').trim() || folio;
        }
        if (!folio) {
          try {
            const urlFolio = new URLSearchParams(window.location.search).get('folio') || new URLSearchParams(window.location.search).get('numero_cotizacion');
            folio = (urlFolio || '').trim() || folio;
          } catch(_) {}
        }
        if (!folio) {
          try { folio = (window.appQuote && (appQuote.numero_cotizacion || appQuote.folio) || '').trim() || folio; } catch(_){ }
        }
        // Fallback final: extraer del texto visible (ej. "Editando Cotización: REN-2025-000112")
        if (!folio) {
          try {
            const text = (document.body && document.body.innerText) ? document.body.innerText : '';
            const m = text.match(/\b(REN|VEN)-\d{4}-\d{6}\b/);
            if (m && m[0]) folio = m[0];
          } catch(_) {}
        }
        try { console.log('[PDF] Folio detectado:', folio || '(vacío)'); } catch(_) {}
        // Actualizar la VISTA PREVIA (DOM real) si existe el placeholder
        try {
          const qnLive = document.getElementById('quote-number');
          if (qnLive && folio && (qnLive.textContent.trim() === '' || qnLive.textContent.trim() === '—')) {
            qnLive.textContent = folio;
          }
        } catch(_) {}
        const currencyEl = document.getElementById('currency-code');
        const currency = currencyEl ? currencyEl.textContent.trim() : 'MXN';
        const dateEl = document.getElementById('current-date');
        const currentDateText = dateEl ? dateEl.textContent.trim() : '';
        // Timestamp de generación (dd/mm/yyyy HH:mm)
        const pad2 = (n) => String(n).padStart(2, '0');
        const now = new Date();
        const generatedAt = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

        // === Auto-calcar estilos del template para el header nativo ===
        const root = document.documentElement;
        const rs = getComputedStyle(root);
        const colorPrimary = (rs.getPropertyValue('--color-primary') || '#1D3768').trim();
        const colorSecondary = (rs.getPropertyValue('--color-secondary') || '#E3232C').trim();
        const qpRow = document.querySelector('.qp-row');
        const qpLabel = document.querySelector('.qp-label');
        const qpValue = document.querySelector('.qp-value');
        const softBorder = document.querySelector('.soft-border');
        const hdrContainer = document.querySelector('header.print-header');

        const get = (el, prop, fallback='') => {
          try { return el ? getComputedStyle(el).getPropertyValue(prop) || fallback : fallback; } catch(_){ return fallback; }
        };
        const qpBg = get(qpRow,'background-color','#f3f4f6');
        const qpRadius = get(qpRow,'border-radius','4px');
        const qpBorderColor = get(qpRow,'border-color','#e5e7eb');
        const qpPad = `${parseInt(get(qpRow,'padding-top','6px')) || 6}px ${parseInt(get(qpRow,'padding-right','10px')) || 10}px`;
        const labelColor = get(qpLabel,'color','#374151');
        const valueColor = get(qpValue,'color','#111827');
        const valueWeight = get(qpValue,'font-weight','800') || '800';
        const hdrBorderBottomColor = get(hdrContainer,'border-bottom-color', colorPrimary) || colorPrimary;
        const softBorderColor = get(softBorder,'border-color','#e5e7eb');
        const fileName = folio && folio !== '—'
            ? `cotizacion_${folio.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`
            : `cotizacion_${Date.now()}.pdf`;

        // Construir HTML completo para Puppeteer
        const origin = (window.location && window.location.origin) ? window.location.origin : '';
        const normalizedOrigin = origin ? (origin.endsWith('/') ? origin : `${origin}/`) : '';

        const dynamicTop = headerHeight ? (headerHeight + 16) : 120;
        const dynamicBottom = footerHeight ? (footerHeight + 20) : 120;

        // Utilidad para convertir imágenes a data URL (para header/footer nativos)
        async function toDataURL(url){
          try{
            const res = await fetch(url, { cache: 'no-store' });
            if(!res.ok) return '';
            const blob = await res.blob();
            return await new Promise((resolve)=>{
              const fr = new FileReader();
              fr.onloadend = () => resolve(fr.result || '');
              fr.readAsDataURL(blob);
            });
          }catch(_){ return ''; }
        }

        // Preparar imágenes del header en data URI para que Chromium las renderice en template nativo
        const logoDataUrl = await toDataURL((normalizedOrigin || '') + 'img/logo-demo.jpg');
        const isoDataUrl  = await toDataURL((normalizedOrigin || '') + 'img/iso 9001.png');

        // Rellenar el número de cotización en el clon si está vacío
        try {
          const qn = clone.querySelector('#quote-number');
          if (qn && (!qn.textContent || qn.textContent.trim() === '—') && folio) {
            qn.textContent = folio;
          }
        } catch(_) {}

        // Decidir si mostramos el indicador final según si forzaría una hoja nueva
        let showEndIndicator = true;
        try {
          const pageWidthMm = 215.9; // Letter width (mm)
          const marginLeftMm = 6;    // debe coincidir con @page
          const marginRightMm = 6;   // debe coincidir con @page
          const effectiveWidthMm = pageWidthMm - marginLeftMm - marginRightMm; // ~203.9mm
          const probeWrap = document.createElement('div');
          probeWrap.style.cssText = `position:fixed; left:-9999px; top:0; width:${effectiveWidthMm}mm; padding:0; margin:0; background:#fff;`;
          const probeClone = clone.cloneNode(true);
          // Simular márgenes de impresión similares a los del PDF
          const probeBody = probeClone.querySelector('.print-body');
          if (probeBody) {
            probeBody.style.marginTop = '54mm';
            probeBody.style.marginBottom = '14mm';
          }
          // Asegurar que el indicador esté visible para medir
          const ind = probeClone.querySelector('.report-end-indicator');
          if (ind) ind.style.display = 'inline-block';
          probeWrap.appendChild(probeClone);
          document.body.appendChild(probeWrap);
          // Medir alturas con unidades reales de mm convertidas por el navegador
          const mmBox = document.createElement('div');
          mmBox.style.height = '279.4mm'; // altura carta
          probeWrap.appendChild(mmBox);
          const pageHeightPx = mmBox.getBoundingClientRect().height || 0;
          mmBox.remove();
          const indEl = probeWrap.querySelector('.report-end-indicator');
          if (indEl && pageHeightPx > 0) {
            const pxPerMm = pageHeightPx / 279.4;
            // 1) Páginas con indicador
            const totalWithPx = probeWrap.scrollHeight;
            const pagesWith = Math.ceil(totalWithPx / pageHeightPx);
            // 2) Páginas sin indicador (ocultarlo temporalmente y medir)
            const prevDisp = indEl.style.display;
            indEl.style.display = 'none';
            const totalWithoutPx = probeWrap.scrollHeight;
            const pagesWithout = Math.ceil(totalWithoutPx / pageHeightPx);
            indEl.style.display = prevDisp;

            // Regla fuerte: si con el label aumenta el número de páginas, lo ocultamos.
            if (pagesWith > pagesWithout) {
              showEndIndicator = false;
            } else {
              // Regla adicional: si cae muy pegado al inicio de una nueva página, ocultarlo también.
              const rect = indEl.getBoundingClientRect();
              const wrapRect = probeWrap.getBoundingClientRect();
              const y = rect.top - wrapRect.top;
              const offsetInPage = y % pageHeightPx;
              if (offsetInPage < (24 * pxPerMm)) showEndIndicator = false;
            }
          }
          document.body.removeChild(probeWrap);
        } catch(_) { /* si falla la medición, no ocultamos */ }

        // Detectar modo: venta vs renta y ajustar el CLON (no la vista previa)
        try {
          let isVenta = false;
          const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
          const tplEl = document.getElementById('pdf-template');
          const modeAttr = tplEl && tplEl.dataset ? (tplEl.dataset.modo || tplEl.dataset.mode || '') : '';
          let qsModo = '';
          try { qsModo = (new URLSearchParams(window.location.search).get('modo') || '').toLowerCase(); } catch(_) {}
          // Prioridades: querystring > data-modo > ruta > folio
          if (qsModo === 'venta') isVenta = true;
          else if (qsModo === 'renta') isVenta = false;
          else if (modeAttr) isVenta = (modeAttr.toLowerCase() === 'venta');
          else if (path.includes('cotizacion_venta.html') || path.includes('/venta')) isVenta = true;
          else if (path.includes('cotizacion_renta.html') || path.includes('/renta')) isVenta = false;
          else if (/^ven-/i.test(folio || '')) isVenta = true;

          if (isVenta) {
            // 1) Quitar columna Garantía en la tabla de resumen
            const table = clone.querySelector('.cr-table--summary');
            if (table) {
              const garHeader = table.querySelector('thead th[data-col="gar"], thead th.col-garantia');
              let garIndex = -1;
              if (garHeader && garHeader.parentElement) {
                garIndex = Array.from(garHeader.parentElement.children).indexOf(garHeader) + 1;
                garHeader.remove();
              }
              if (garIndex > 0) {
                table.querySelectorAll('tbody tr').forEach(tr => {
                  const td = tr.querySelector(`td:nth-child(${garIndex})`);
                  if (td) td.remove();
                });
              }
            }
            // 1.1) Ocultar en el CLON todos los elementos marcados como solo-renta
            try {
              clone.querySelectorAll('.only-renta').forEach(el => { el.style.display = 'none'; });
            } catch(_) {}

            // 1.2) En VENTA: reusar (mover) las celdas de "PESO TOTAL" hacia la fila de "COSTO DE ENVÍO" y ocultar la fila original.
            // Esto mantiene el look-and-feel de renta pero sin huecos grandes cuando se omiten filas de renta.
            try {
              const totals = clone.querySelector('#cr-totals-paired-table');
              if (totals) {
                const pesoCell = totals.querySelector('#cr-total-weight');
                const shipCell = totals.querySelector('#cr-fin-shipping');
                const pesoTr = pesoCell ? pesoCell.closest('tr') : null;
                const shipTr = shipCell ? shipCell.closest('tr') : null;
                if (pesoTr && shipTr && pesoTr !== shipTr) {
                  const pesoTd1 = pesoTr.children[0] || null;
                  const pesoTd2 = pesoTr.children[1] || null;
                  if (pesoTd1 && pesoTd2) {
                    const shipTd1 = shipTr.children[0] || null;
                    const shipTd2 = shipTr.children[1] || null;
                    if (shipTd1) shipTd1.remove();
                    if (shipTd2) shipTd2.remove();
                    shipTr.insertBefore(pesoTd2, shipTr.firstChild);
                    shipTr.insertBefore(pesoTd1, shipTr.firstChild);
                    pesoTr.style.display = 'none';
                  }
                }
              }
            } catch(_) {}
          }
        } catch(_) {}

        const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cotización PDF</title>
    ${normalizedOrigin ? `<base href="${normalizedOrigin}">` : ''}
    ${styles}
    <style id="pdf-dynamic-spacing">
        :root {
            --pdf-margin-top: ${dynamicTop}px;
            --pdf-margin-bottom: ${dynamicBottom}px;
        }
        @media print {
            .print-body {
                padding-bottom: 0 !important; /* evitar empuje a una hoja extra */
            }
        }
    </style>
    <style>
        /* === ESTILOS PARA PDF (Puppeteer) === */
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body * { font-family: 'Arial', 'Helvetica', sans-serif !important; }

        /* Estructura de página: header/body/footer repetibles */
        .print-sheet {
            display: table; /* permite header repetido */
            width: 100%;
            border-collapse: collapse;
        }
        .print-header {
            display: table-header-group; /* se repite en cada página */
            position: static !important;
            top: auto !important;
            left: auto !important;
            transform: none !important;
            width: 100% !important;
        }
        .print-body {
            display: table-row-group; /* cuerpo paginable */
        }
        /* Anular márgenes/paddings del template (Tailwind pt-4 y @media print) que agregan aire extra */
        .print-body { margin-top: 0 !important; padding-top: 0 !important; }
        .content { padding-top: 0 !important; }
        .print-footer {
            display: table-footer-group; /* ubica el pie al final de cada página */
            position: static !important;
            top: auto !important;
            left: auto !important;
            transform: none !important;
            width: 100% !important;
            padding: 0; /* sin padding para pegarlo más al borde inferior */
            page-break-inside: avoid;
            break-inside: avoid;
        }

        /* Ocultar elementos de UI y los headers/footers HTML (usaremos nativos de Puppeteer) */
        #filters-panel, #preview-title, .cr-toolbar, .no-print, .print-footer, .print-header { display: none !important; }
        /* Mostrar el indicador de fin solo en el body (no en el footer nativo) y hacerlo compacto sin forzar hoja extra */
        .report-end-indicator {
            display: inline-block !important;
            margin: 2px 0 1px 0 !important;
            padding: 1px 6px !important;
            font-size: 9.5px !important;
            color: #4b5563 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
        }
        
        /* Contenedor principal */
        .document-viewer {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
        }
        .document-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 1mm 5mm 5mm 5mm !important; /* mínimo aire en primera hoja */
            box-shadow: none !important;
            border: none !important;
        }
        /* Asegurar separación bajo el header nativo para el primer título */
        h1:first-of-type, h2:first-of-type { margin-top: 0 !important; }
        /* Primer bloque: sin margen superior extra */
        #client-block { margin-top: 0 !important; }
        
        /* Evitar cortes de página en elementos importantes */
        .avoid-break,
        .cr-table--summary tbody tr,
        .cr-summary-totals,
        #seller-block,
        #client-block,
        #observaciones-block,
        .header-content {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        /* Evitar salto de página al final (no crear hoja extra vacía) */
        .print-body:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        .document-container:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        .cr-summary-totals:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        .document-viewer:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        .print-sheet:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        .content:last-child { page-break-after: avoid !important; break-after: avoid !important; }
        /* Evitar mínimos de altura que empujen a una página extra */
        html, body { height: auto !important; }
        .document-container { min-height: 0 !important; }
        /* Mostrar el indicador solo al final del body (una vez), compacto y sin forzar nueva página */
        .report-end-indicator {
            display: inline-block !important;
            margin: 4px 0 !important;
            padding: 2px 6px !important;
            font-size: 10px !important;
            color: #4b5563 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        ${!showEndIndicator ? '.report-end-indicator{ display:none !important; }' : ''}
        
        /* Imágenes */
        img { max-width: 100% !important; }
        .cr-table--summary td img {
            width: 40px !important;
            height: 40px !important;
            object-fit: cover !important;
        }
        
        /* Tabla de productos */
        .cr-table--summary {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
        }
        .cr-table--summary th {
            background: linear-gradient(180deg, #fbfcff 0%, #eef2fb 100%) !important;
            -webkit-print-color-adjust: exact !important;
        }
        .cr-table--summary td, .cr-table--summary th {
            padding: 5px 6px !important;
            font-size: 11px !important;
            border: 1px solid #dee2e6 !important;
        }
        
        /* Evitar que las filas de productos se corten entre páginas */
        .cr-table--summary tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
            break-after: auto !important;
            display: table-row !important;
        }
        
        /* Asegurar que el thead se repita en cada página */
        .cr-table--summary thead {
            display: table-header-group !important;
        }
        
        /* Control de huérfanas y viudas para evitar filas solitarias */
        .cr-table--summary tbody {
            orphans: 3;
            widows: 3;
        }
        
        /* Totales: respetar layout actual (ancho completo bajo condiciones) */
        .cr-totals-paired {
            width: 100% !important;
            table-layout: fixed !important;
            margin-left: 0 !important;
        }
        .cr-totals-paired td {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            font-variant-numeric: tabular-nums;
        }
        /* Celdas vacías sin borde (las primeras columnas vacías en algunas filas) */
        .cr-totals-paired td.empty-cell {
            border: none !important;
        }
        /* Cifras alineadas a la derecha, en una sola línea y negritas */
        .cr-totals-paired td.text-right {
            text-align: right;
            white-space: nowrap;
            font-weight: 700;
        }
        
        /* Garantía destacada */
        #cr-fin-deposit {
            background: #fff8b3 !important;
            -webkit-print-color-adjust: exact !important;
        }
        
        /* Header */
        .soft-border {
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
        }
        .qp-row {
            background: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
        }
        
        @page {
            size: letter;
            /* top right bottom left */
            margin: 54mm 6mm 14mm 6mm; /* margen inferior aún menor para evitar hoja extra */
        }
        @page:first {
            /* Reducir aire exclusivamente en la primera página */
            margin: 48mm 6mm 18mm 6mm;
        }
    </style>
</head>
<body>
    <div class="document-viewer">
        ${clone.outerHTML}
    </div>
</body>
</html>`;

        // Enviar al servidor
        console.log('[PDF] Enviando HTML al servidor...');
        const response = await fetch('/api/pdf/generar/cotizacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                htmlContent: fullHtml,
                fileName: fileName,
                download: true,
                folio: folio,
                // Campos que SÍ consume el backend actual
                headerTemplate: `
                  <div style="box-sizing:border-box; width:100%; font-family:Arial, Helvetica, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; color:${valueColor};">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:3px 6mm 3px 8mm; border-bottom:3px solid ${hdrBorderBottomColor || colorPrimary};">
                      <!-- Columna izquierda: logos + razón social y datos -->
                      <div style="display:flex; align-items:flex-start; gap:8px; flex:1; min-width:0;">
                        <div style="display:flex; align-items:flex-start; gap:10px;">
                          <!-- Logo circular -->
                          <div style="width:20mm; height:21mm; display:flex; align-items:center; justify-content:center; background:${qpBg}; border-radius:20%; overflow:hidden;">
                            <img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">
                          </div>
                          <!-- ISO -->
                          <img src="${isoDataUrl}" style="height:21mm; object-fit:contain; opacity:0.95;" onerror="this.style.display='none'">
                        </div>
                        <div style="line-height:1.2; font-size:10px; min-width:0; margin-left:2mm;">
                          <div style="font-weight:800; color:${colorPrimary}; font-size:12px; letter-spacing:.2px; white-space:nowrap;">ANDAMIOS Y PROYECTOS TORRES SA DE C.V</div>
                          <div style="color:${labelColor};">APT100310EC2</div>
                          <div style="color:${labelColor};">Oriente 174 No. 290 | Col. Moctezuma 2a Sección C.P.:15330</div>
                          <div style="color:${labelColor};">Venustiano Carranza, CDMX, MÉXICO.</div>
                          <div style="color:${labelColor};">Tels. (01) 55-55-71-71-05 55-26-46-00-24 Cel. 55-62-55-78-19</div>
                          <div style="color:${labelColor};">eMail: ventas@andamiostorres.com</div>
                          <div style="color:${labelColor};">Cuenta(s): Visite nuestro aviso de privacidad en</div>
                          <div style="color:${labelColor};">www.andamiostorres.com</div>
                        </div>
                      </div>
                      <!-- Columna derecha: tarjeta de cotización -->
                      <div style="min-width:70mm; max-width:86mm; display:flex; gap:6px; align-items:stretch;">
                        <!-- Barra vertical suave -->
                        <div style="width:3mm; background:linear-gradient(180deg,#eef2fb 0%, #f6f8ff 100%); border:1px solid #e5e7eb; border-radius:6px;"></div>
                        <!-- Tarjeta simplificada y robusta para Puppeteer -->
                        <div style="flex:1;">
                          <div style="background:linear-gradient(180deg,#fbfcff 0%, #eef2fb 100%); border:1px solid #dbe3f5; border-radius:8px; padding:6px 10px; box-shadow: inset 0 0 0 1px rgba(15,23,42,0.03);">
                            <!-- Cotización -->
                            <div style="padding:4px 8px; border:1px solid #e6ecfb; border-radius:6px; background:#f7f9fd; margin:0;">
                              <div style="font-size:10px; color:#475569; font-weight:700; text-align:right; line-height:1;">Cotización:</div>
                              <div style="font-size:11px; color:#E3232C; font-weight:800; text-align:right; line-height:1.25; position:relative;">
                                ${folio || '—'}
                                <span style="position:absolute; right:8px; bottom:-2px; width:12px; height:2px; background:#E3232C;"></span>
                              </div>
                            </div>
                            <!-- Fecha -->
                            <div style="padding:4px 8px; border:1px solid #e6ecfb; border-radius:6px; background:#f7f9fd; margin-top:4px;">
                              <div style="font-size:10px; color:#475569; font-weight:700; text-align:right; line-height:1;">Fecha:</div>
                              <div style="font-size:11px; color:#111827; font-weight:800; text-align:right; line-height:1.25;">${currentDateText || '<span class=\"date\"></span>'}</div>
                            </div>
                            <!-- Moneda -->
                            <div style="padding:4px 8px; border:1px solid #e6ecfb; border-radius:6px; background:#f7f9fd; margin-top:4px;">
                              <div style="font-size:10px; color:#475569; font-weight:700; text-align:right; line-height:1;">Moneda:</div>
                              <div style="font-size:11px; color:#0f172a; font-weight:800; text-align:right; line-height:1.25;">${currency}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                `,
                footerTemplate: `
                  <div style="box-sizing:border-box; width:100%; min-height:8mm; padding:0.8mm 0 0.8mm 0; font-family:Arial, Helvetica, sans-serif; font-size:9px; color:#1D3768; text-align:center; border-top:1px solid #e5e7eb; -webkit-print-color-adjust:exact; print-color-adjust:exact; position:relative;">
                    <div style="line-height:1.1; color:#6b7280;">Generado automáticamente por el sistema de Andamios y Proyectos Torres S.A. de C.V.</div>
                    <div style="line-height:1.1; color:#6b7280;">Documento Confidencial</div>
                    <div style="line-height:1.1; color:#6b7280;">Generado el: ${generatedAt}</div>
                    <div style="margin-top:1px; opacity:0.85; color:#1f2937;">Página <span class=\"pageNumber\"></span> de <span class=\"totalPages\"></span></div>
                  </div>
                `,
                // Se mantiene por compatibilidad futura, pero el backend actual lo ignora
                puppeteer: {
                    displayHeaderFooter: true,
                    preferCSSPageSize: true,
                    margin: { top: '26mm', bottom: '22mm' },
                    format: 'A4'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }

        // Descargar o imprimir el PDF según el flag
        console.log('[PDF] Procesando archivo...');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        if (printMode) {
          // Modo impresión: abrir PDF en navegador externo (Chrome/Edge) para imprimir
          console.log('[PDF] Preparando PDF para imprimir en navegador externo...');
          
          // Convertir blob a base64 y enviarlo al servidor como PDF temporal
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64 = reader.result.split(',')[1];
              
              // Guardar PDF temporal en el servidor
              const tempResponse = await fetch('/api/pdf/temp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Data: base64, fileName: fileName })
              });
              
              if (!tempResponse.ok) {
                throw new Error('No se pudo crear PDF temporal');
              }
              
              const { url: pdfUrl } = await tempResponse.json();
              console.log('[PDF] PDF temporal creado:', pdfUrl);
              
              // Abrir en navegador externo usando Electron API
              console.log('[PDF] electronAPI disponible:', !!window.electronAPI);
              console.log('[PDF] openExternal disponible:', !!(window.electronAPI && window.electronAPI.openExternal));
              console.log('[PDF] URL a abrir:', pdfUrl);
              
              // Detectar si estamos en Electron
              const isElectron = navigator.userAgent.toLowerCase().includes('electron');
              console.log('[PDF] Es Electron:', isElectron);
              
              if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                // Usar API de Electron directamente
                try {
                  await window.electronAPI.openExternal(pdfUrl);
                  console.log('[PDF] ✅ Abierto en navegador externo via electronAPI');
                } catch(openErr) {
                  console.error('[PDF] Error en openExternal:', openErr);
                  window.open(pdfUrl, '_blank');
                }
              } else if (isElectron) {
                // Estamos en Electron pero sin electronAPI (ventana secundaria)
                // El setWindowOpenHandler en main.js debería interceptar URLs con /pdfs/
                // y abrirlas en el navegador del sistema automáticamente
                console.log('[PDF] Abriendo via window.open (será interceptado por Electron)...');
                window.open(pdfUrl, '_blank');
                console.log('[PDF] ✅ Solicitud enviada a Electron');
              } else {
                // Navegador web normal - abrir en nueva pestaña
                console.log('[PDF] Navegador web, abriendo en nueva pestaña...');
                window.open(pdfUrl, '_blank');
                console.log('[PDF] ✅ Abierto en nueva pestaña');
              }
              
            } catch(e) {
              console.error('[PDF] Error al abrir para imprimir:', e);
              // Fallback: descargar el archivo
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              alert('El PDF se ha descargado. Ábrelo e imprímelo con Ctrl+P.');
            } finally {
              // Restaurar botón
              if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
              }
            }
          };
          reader.readAsDataURL(blob);
          return; // Salir aquí, el finally del reader manejará el botón
          
        } else {
          // Modo descarga: descargar el PDF
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
          console.log('[PDF] ✅ Generado exitosamente:', fileName);
        }

    } catch (error) {
        console.error('[PDF] ❌ Error:', error);
        alert('Error al generar el PDF: ' + error.message);
    } finally {
        // Restaurar botón
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Conectar el botón al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('download-pdf-btn');
    if (btn) {
        btn.addEventListener('click', generatePDF);
    }

    // Forzar modo desde querystring (?modo=venta|renta)
    try {
      const params = new URLSearchParams(window.location.search);
      const modo = (params.get('modo') || '').toLowerCase();
      const tplEl = document.getElementById('pdf-template');
      if (tplEl && (modo === 'venta' || modo === 'renta')) {
        tplEl.dataset.modo = modo;
      }
    } catch(_) {}

    // Adaptar VISTA PREVIA según modo (venta vs renta) sin romper diseño (con reintentos y observador)
    try {
      const detectVenta = () => {
        const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
        const tplEl = document.getElementById('pdf-template');
        const modeAttr = tplEl && tplEl.dataset ? (tplEl.dataset.modo || tplEl.dataset.mode || '') : '';
        const folioLive = ((document.getElementById('quote-number') || {}).textContent || '').trim();
        let qsModo = '';
        try { qsModo = (new URLSearchParams(window.location.search).get('modo') || '').toLowerCase(); } catch(_) {}
        const ref = (document.referrer || '').toLowerCase();
        let openerPath = '';
        try { openerPath = (window.opener && window.opener.location && window.opener.location.pathname || '').toLowerCase(); } catch(_) {}
        const storageModo = (localStorage.getItem('modo_cotizacion') || sessionStorage.getItem('modo_cotizacion') || localStorage.getItem('tipo_cotizacion') || sessionStorage.getItem('tipo_cotizacion') || '').toLowerCase();
        // Prioridades: querystring > data-modo > ruta > folio
        if (qsModo === 'venta') return true;
        if (qsModo === 'renta') return false;
        if (modeAttr) return modeAttr.toLowerCase() === 'venta';
        if (path.includes('cotizacion_venta.html') || path.includes('/venta')) return true;
        if (path.includes('cotizacion_renta.html') || path.includes('/renta')) return false;
        if (ref.includes('cotizacion_venta.html') || ref.includes('/venta')) return true;
        if (openerPath.includes('cotizacion_venta.html') || openerPath.includes('/venta')) return true;
        if (storageModo === 'venta') return true;
        if (storageModo === 'renta') return false;
        if (/^ven-/i.test(folioLive)) return true;
        return false;
      };

      const applyVentaPreview = () => {
        if (!detectVenta()) return;
        // 1) Ocultar columna Garantía
        const table = document.querySelector('.cr-table--summary');
        if (table) {
          const headerRow = table.querySelector('thead tr');
          const garHeader = table.querySelector('thead th[data-col="gar"], thead th.col-garantia');
          if (garHeader && headerRow) {
            const garIndex = Array.from(headerRow.children).indexOf(garHeader) + 1;
            garHeader.style.display = 'none';
            if (garIndex > 0) {
              table.querySelectorAll('tbody tr').forEach(tr => {
                const td = tr.querySelector(`td:nth-child(${garIndex})`);
                if (td) td.style.display = 'none';
              });
            }
          }
        }
        // 2) Ocultar explícitamente cualquier elemento marcado como only-renta
        // Nota: NO ocultamos filas completas por texto/ID porque "PESO TOTAL" comparte fila con "GARANTÍA".
        try {
          document.querySelectorAll('.only-renta').forEach(el => { el.style.display = 'none'; });
        } catch(_) {}
        // 3) Deshabilitar checkbox de Garantía en filtros
        const chkGar = document.getElementById('filter-garantia');
        if (chkGar) {
          chkGar.checked = false;
          chkGar.disabled = true;
          const label = document.querySelector('label[for="filter-garantia"]');
          if (label) label.style.opacity = '0.6';
        }
      };

      // Ejecutar al cargar, y reintentar por si se rellena después
      applyVentaPreview();
      setTimeout(applyVentaPreview, 200);
      setTimeout(applyVentaPreview, 600);
      setTimeout(applyVentaPreview, 1200);

      // Observar cambios en la tabla y totales para re-aplicar
      const target = document.getElementById('cr-quote-summary-card') || document;
      if (target && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(() => applyVentaPreview());
        mo.observe(target, { childList: true, subtree: true });
      }
    } catch(_) {}
});

// Exponer globalmente
window.generatePDF = generatePDF;
