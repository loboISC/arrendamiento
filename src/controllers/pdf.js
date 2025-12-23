const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');

// Crear directorio de PDFs si no existe
const PDF_DIR = path.join(__dirname, '../../public/pdfs');

async function ensurePdfDir() {
  try {
    await fs.mkdir(PDF_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creando directorio de PDFs:', err);
  }
}

/**
 * Generar PDF desde HTML
 */
async function generarPdfDesdeHtml(htmlContent) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();
    // Logging detallado desde el contexto de la página
    try {
      page.on('console', msg => {
        try { console.log('[PDF][page]', msg.type?.(), msg.text?.()); } catch(_) { }
      });
      page.on('pageerror', err => {
        try { console.error('[PDF][pageerror]', err && (err.stack || err.message || String(err))); } catch(_) { }
      });
      page.on('requestfailed', req => {
        try { console.warn('[PDF][requestfailed]', req.url(), req.failure()?.errorText); } catch(_) { }
      });
    } catch(_) { }

    // Configurar viewport para mejor renderizado
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2
    });

    // Emular medios de impresión para activar @media print
    await page.emulateMediaType('print');

    // Cargar el contenido HTML
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 60000
    });

    // Esperar a que las fuentes se carguen
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // Respetar tamaño y márgenes definidos por CSS @page
      displayHeaderFooter: false,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      scale: 0.94
    });

    await browser.close();
    return pdfBuffer;
  } catch (err) {
    console.error('Error generando PDF:', err);
    throw new Error('No se pudo generar el PDF');
  }
}

/**
 * Guardar PDF de contrato
 */
exports.guardarPdfContrato = async (req, res) => {
  try {
    await ensurePdfDir();

    const { id_contrato, htmlContent, nombreArchivo } = req.body;

    if (!id_contrato || !htmlContent) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // Generar PDF
    const pdfBuffer = await generarPdfDesdeHtml(htmlContent);

    // Crear nombre de archivo
    const fileName = nombreArchivo || `contrato_${id_contrato}_${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    // Guardar archivo
    await fs.writeFile(filePath, pdfBuffer);

    // Guardar referencia en la base de datos
    await db.query(
      `UPDATE contratos SET pdf_contrato = $1 WHERE id_contrato = $2`,
      [fileName, id_contrato]
    );

    res.json({
      message: 'PDF de contrato guardado exitosamente',
      fileName: fileName,
      url: `/pdfs/${fileName}`
    });
  } catch (err) {
    console.error('Error guardando PDF de contrato:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Generar PDF de Hoja de Pedido desde HTML (A4)
 * Recibe el HTML completo del documento ya poblado con datos
 */
exports.generarHojaPedidoPdf = async (req, res) => {
  let browser = null;
  try {
    const { htmlContent, fileName, download } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML de la hoja de pedido' });
    }

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    try { page.setDefaultNavigationTimeout(120000); } catch (_) {}

    // Viewport amplio para un render estable
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    // Cargar el contenido HTML
    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 120000 });

    // Importante: aplicar media type "print" para que funcionen @media print (footer/header al ras, etc.)
    try {
      await page.emulateMediaType('print');
    } catch (_) {
      // noop
    }

    // Reset mínimo para evitar márgenes/padding por defecto que provoquen 2 páginas
    try {
      await page.addStyleTag({
        content: `
          html, body { margin: 0 !important; padding: 0 !important; }
          @page { margin: 0; }
        `
      });
    } catch (_) {
      // noop
    }

    // Esperar fuentes
    await page.evaluateHandle('document.fonts.ready');

    // Esperar imágenes
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const images = document.querySelectorAll('img');
        if (images.length === 0) return resolve();
        let loaded = 0;
        const done = () => { loaded++; if (loaded >= images.length) resolve(); };
        images.forEach(img => {
          if (img.complete) done();
          else { img.addEventListener('load', done); img.addEventListener('error', done); }
        });
        setTimeout(resolve, 7000);
      });
    });

    // Auto-compact + auto-fit (1 hoja A4) dentro de Puppeteer
    // IMPORTANTE: NO usar CSS transform scale para evitar PDF borroso.
    // En su lugar calculamos el scale para page.pdf({scale}) y dejamos el DOM en escala 1.
    const pdfScale = await page.evaluate(() => {
      try {
        const pageEl = document.querySelector('#hp-document') || document.querySelector('.page');
        const innerEl = document.querySelector('#hp-inner') || pageEl;
        const tableEl = document.querySelector('#print-productos')?.closest('table') || document.querySelector('table.hp-table');
        const signEl = document.querySelector('.hp-sign');
        const footerEl = document.querySelector('.hp-footer');
        if (tableEl) {
          // Header/Footer estáticos. Solo compactamos tipografía del contenido.
          const modes = ['', 'hp-table--compact', 'hp-table--dense', 'hp-table--ultra', 'hp-table--micro', 'hp-table--nano', 'hp-table--pico', 'hp-table--femto'];
          tableEl.classList.remove('hp-table--compact', 'hp-table--dense', 'hp-table--ultra', 'hp-table--micro', 'hp-table--nano', 'hp-table--pico', 'hp-table--femto');

          const signModes = ['', 'hp-sign--compact', 'hp-sign--dense', 'hp-sign--micro'];
          const footerModes = ['', 'hp-footer--compact', 'hp-footer--dense', 'hp-footer--micro'];
          if (signEl) signEl.classList.remove('hp-sign--compact', 'hp-sign--dense', 'hp-sign--micro');
          if (footerEl) footerEl.classList.remove('hp-footer--compact', 'hp-footer--dense', 'hp-footer--micro');

          try {
            tableEl.classList.add('hp-table--no-spacer');
            const spacerRow = tableEl.querySelector('.hp-table__spacer');
            if (spacerRow) {
              spacerRow.style.height = '0mm';
              spacerRow.querySelectorAll('td').forEach(td => {
                td.style.height = '0mm';
                td.style.paddingTop = '0';
                td.style.paddingBottom = '0';
              });
            }
          } catch (_) {}

          const fits = () => {
            if (!pageEl || !innerEl) return true;
            const pageH = pageEl.clientHeight;
            if (!pageH) return true;

            const pageRect = pageEl.getBoundingClientRect();
            const limitBottom = footerEl
              ? (footerEl.getBoundingClientRect().top - 2)
              : (pageRect.bottom - 2);

            if (signEl) {
              const signRect = signEl.getBoundingClientRect();
              if (signRect.bottom > limitBottom) return false;
            }

            const innerRect = innerEl.getBoundingClientRect();
            return innerRect.bottom <= (pageRect.bottom - 2);
          };

          let lastMode = '';
          for (const mode of modes) {
            tableEl.classList.remove('hp-table--compact', 'hp-table--dense', 'hp-table--ultra', 'hp-table--micro', 'hp-table--nano', 'hp-table--pico', 'hp-table--femto');
            if (mode) tableEl.classList.add(mode);
            lastMode = mode;
            if (fits()) {
              // Si cabe con holgura mínima, aplicar un leve scale para evitar 2ª hoja por redondeos
              try {
                const pageRect = pageEl.getBoundingClientRect();
                const footerTop = footerEl ? footerEl.getBoundingClientRect().top : pageRect.bottom;
                const innerRect = innerEl.getBoundingClientRect();
                const slack = Math.max(0, footerTop - innerRect.bottom);
                if (slack < 16) return 0.97;
              } catch (_) { }
              return 1;
            }
          }

          // Si ni con la tabla en modo femto cabe (por el bloque de firmas), compactamos solo tipografía de firmas/expediente.
          // NO se tocan márgenes/posiciones/bordes.
          for (let i = 0; i < Math.max(signModes.length, footerModes.length); i++) {
            if (signEl) {
              signEl.classList.remove('hp-sign--compact', 'hp-sign--dense', 'hp-sign--micro');
              const sm = signModes[Math.min(i, signModes.length - 1)];
              if (sm) signEl.classList.add(sm);
            }
            if (footerEl) {
              footerEl.classList.remove('hp-footer--compact', 'hp-footer--dense', 'hp-footer--micro');
              const fm = footerModes[Math.min(i, footerModes.length - 1)];
              if (fm) footerEl.classList.add(fm);
            }
            tableEl.classList.remove('hp-table--compact', 'hp-table--dense', 'hp-table--ultra', 'hp-table--micro', 'hp-table--nano', 'hp-table--pico', 'hp-table--femto');
            if (lastMode) tableEl.classList.add(lastMode);
            if (fits()) break;
          }
        }

        if (!pageEl || !innerEl) return 1;

        // Asegurar que no haya transform scaling en el HTML
        try { pageEl.style.setProperty('--fit-scale', '1'); } catch (_) {}

        const pageH = pageEl.clientHeight;
        const innerH = innerEl.scrollHeight;
        if (!pageH || !innerH) return 1;

        // Si aún no cabe tras compactar tipografía, aplicamos scale como último recurso.
        // Aumentamos margen por redondeos (footer/firmas) para evitar 2da hoja por 1 línea.
        const safetyPx = 28;
        const effectivePageH = Math.max(0, pageH - safetyPx);
        if (innerH <= effectivePageH) return 1;

        const ratio = effectivePageH / innerH;
        const scale = Number((ratio * 0.995).toFixed(3));
        // Fallback mínimo: preferimos compactar tipografía antes que encoger todo.
        // Si ni con femto cabe, permitimos bajar un poco más para evitar 2ª página.
        return Math.max(0.78, Math.min(1, scale));
      } catch (_) {
        return 1;
      }
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      scale: pdfScale || 1
    });

    await browser.close();
    browser = null;

    const safeName = (fileName ? String(fileName) : `HojaPedido_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputFileName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    if (download === true || download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${outputFileName}"`);
    }

    return res.send(pdfBuffer);
  } catch (err) {
    try {
      console.error('[PDF][ERROR] generarHojaPedidoPdf:', err && (err.stack || err.message || err));
    } catch (_) {}
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    return res.status(500).json({
      error: 'No se pudo generar el PDF de hoja de pedido',
      details: err && err.message,
      stack: err && (err.stack || '').slice(0, 1500)
    });
  }
};

/**
 * Guardar PDF de nota/hoja de pedido
 */
exports.guardarPdfNota = async (req, res) => {
  try {
    await ensurePdfDir();

    const { id_contrato, htmlContent, nombreArchivo } = req.body;

    if (!id_contrato || !htmlContent) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // Generar PDF
    const pdfBuffer = await generarPdfDesdeHtml(htmlContent);

    // Crear nombre de archivo
    const fileName = nombreArchivo || `nota_${id_contrato}_${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    // Guardar archivo
    await fs.writeFile(filePath, pdfBuffer);

    // Guardar referencia en la base de datos
    await db.query(
      `UPDATE contratos SET pdf_nota = $1 WHERE id_contrato = $2`,
      [fileName, id_contrato]
    );

    res.json({
      message: 'PDF de nota guardado exitosamente',
      fileName: fileName,
      url: `/pdfs/${fileName}`
    });
  } catch (err) {
    console.error('Error guardando PDF de nota:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Guardar ambos PDFs (contrato y nota)
 */
exports.guardarAmbospdfs = async (req, res) => {
  try {
    await ensurePdfDir();

    const { id_contrato, htmlContrato, htmlNota } = req.body;

    if (!id_contrato || !htmlContrato || !htmlNota) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // Generar ambos PDFs en paralelo
    const [pdfContrato, pdfNota] = await Promise.all([
      generarPdfDesdeHtml(htmlContrato),
      generarPdfDesdeHtml(htmlNota)
    ]);

    // Crear nombres de archivo
    const fileNameContrato = `contrato_${id_contrato}_${Date.now()}.pdf`;
    const fileNameNota = `nota_${id_contrato}_${Date.now()}.pdf`;

    const filePathContrato = path.join(PDF_DIR, fileNameContrato);
    const filePathNota = path.join(PDF_DIR, fileNameNota);

    // Guardar archivos
    await Promise.all([
      fs.writeFile(filePathContrato, pdfContrato),
      fs.writeFile(filePathNota, pdfNota)
    ]);

    // Actualizar referencias en la base de datos
    await db.query(
      `UPDATE contratos SET pdf_contrato = $1, pdf_nota = $2 WHERE id_contrato = $3`,
      [fileNameContrato, fileNameNota, id_contrato]
    );

    res.json({
      message: 'PDFs guardados exitosamente',
      contrato: {
        fileName: fileNameContrato,
        url: `/pdfs/${fileNameContrato}`
      },
      nota: {
        fileName: fileNameNota,
        url: `/pdfs/${fileNameNota}`
      }
    });
  } catch (err) {
    console.error('Error guardando PDFs:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Ver PDF en el navegador (sin forzar descarga)
 */
exports.verPdf = async (req, res) => {
  try {
    let { fileName } = req.params;

    // Extraer solo el nombre del archivo si es una ruta completa
    if (fileName.includes('\\') || fileName.includes('/')) {
      fileName = path.basename(fileName);
    }

    // Validar que el nombre de archivo no contenga caracteres peligrosos
    if (fileName.includes('..')) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const filePath = path.resolve(PDF_DIR, fileName);

    // Verificar que el archivo existe
    await fs.access(filePath);

    // Enviar el archivo con Content-Type para visualización
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Error visualizando PDF:', err);
    res.status(404).json({ error: 'PDF no encontrado' });
  }
};

/**
 * Descargar PDF
 */
exports.descargarPdf = async (req, res) => {
  try {
    let { fileName } = req.params;

    // Extraer solo el nombre del archivo si es una ruta completa
    if (fileName.includes('\\') || fileName.includes('/')) {
      fileName = path.basename(fileName);
    }

    // Validar que el nombre de archivo no contenga caracteres peligrosos
    if (fileName.includes('..')) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const filePath = path.join(PDF_DIR, fileName);

    // Verificar que el archivo existe
    await fs.access(filePath);

    res.download(filePath);
  } catch (err) {
    console.error('Error descargando PDF:', err);
    res.status(404).json({ error: 'PDF no encontrado' });
  }
};

/**
 * Endpoint de prueba: genera PDF desde el archivo público de reporte y lo devuelve inline
 */
exports.generarReporteTest = async (req, res) => {
  try {
    await ensurePdfDir();

    const reportePath = path.join(__dirname, '../../public/reporte_venta_renta.html');
    const absPath = path.resolve(reportePath);
    const fileUrl = 'file://' + absPath.replace(/\\/g, '/');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.emulateMediaType('print');

    // Navegar al archivo local para que recursos relativos (img/, css/, scripts) se resuelvan
    await page.goto(fileUrl, { waitUntil: ['networkidle2', 'domcontentloaded'], timeout: 60000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      scale: 0.94
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="reporte_test.pdf"');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error en generarReporteTest:', err);
    return res.status(500).json({ error: 'No se pudo generar el PDF de prueba', details: err.message });
  }
};

/**
 * Generar PDF de cotización desde HTML renderizado (tamaño carta)
 * Recibe el HTML completo del documento ya poblado con datos
 */
exports.generarCotizacionPdf = async (req, res) => {
  let browser = null;
  try {
    const { htmlContent, fileName, download, headerTemplate = '', footerTemplate = '', folio: clientFolio = '' } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML del reporte' });
    }

    // Configuración de Puppeteer optimizada para PDF de alta fidelidad
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) {} try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) {}

    // Viewport amplio para renderizar correctamente el contenido A4/Carta
    await page.setViewport({
      width: 816, // 8.5 pulgadas * 96 DPI
      height: 1056, // 11 pulgadas * 96 DPI (tamaño carta)
      deviceScaleFactor: 2
    });

    // Emular medios de impresión para activar @media print
    await page.emulateMediaType('print');

    // Cargar el contenido HTML
    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded'], timeout: 120000 });

    // Esperar a que las fuentes se carguen
    await page.evaluateHandle('document.fonts.ready');

    // Esperar un momento adicional para que las imágenes carguen
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const images = document.querySelectorAll('img');
        if (images.length === 0) return resolve();

        let loaded = 0;
        const checkDone = () => {
          loaded++;
          if (loaded >= images.length) resolve();
        };

        images.forEach(img => {
          if (img.complete) {
            checkDone();
          } else {
            img.addEventListener('load', checkDone);
            img.addEventListener('error', checkDone);
          }
        });

        // Timeout de seguridad
        setTimeout(resolve, 5000);
      });
    });

    // Ocultar elementos que no deben aparecer en el PDF e inyectar CSS
    await page.evaluate(() => {
      // Ocultar elementos de UI
      const filtersPanel = document.getElementById('filters-panel');
      if (filtersPanel) filtersPanel.style.display = 'none';
      const previewTitle = document.getElementById('preview-title');
      if (previewTitle) previewTitle.style.display = 'none';
      const toolbar = document.querySelector('.cr-toolbar');
      if (toolbar) toolbar.style.display = 'none';

      // Ajustar contenedores
      const docViewer = document.querySelector('.document-viewer');
      if (docViewer) {
        docViewer.style.marginLeft = '0';
        docViewer.style.maxWidth = '100%';
      }
      const docContainer = document.querySelector('.document-container');
      if (docContainer) {
        docContainer.style.width = '100%';
        docContainer.style.maxWidth = '210mm';
        docContainer.style.margin = '0 auto';
        docContainer.style.boxShadow = 'none';
        docContainer.style.border = 'none';
      }

      // Inyectar CSS adicional para mejorar la paginación y posición del encabezado
      const style = document.createElement('style');
      style.textContent = `
        .cr-table--summary tbody tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .cr-table--summary { page-break-inside: auto !important; }
        .cr-table--summary thead { display: table-header-group !important; }
        .cr-table--summary tbody { orphans: 1; widows: 1; }
        .cr-card, .cr-summary-wrap { page-break-inside: auto !important; }
        
        
      `;
      document.head.appendChild(style);
    });

    // Generar PDF tamaño carta con configuración optimizada
    try { console.log('[PDF] headerTemplate bytes:', (headerTemplate||'').length, 'footerTemplate bytes:', (footerTemplate||'').length); } catch (_) {}
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
      margin: {
        top: '56mm',  // RESERVAR ESPACIO para el encabezado
        right: '8mm',
        bottom: '14mm',
        left: '8mm'
      },
      scale: 0.90
    });

    await browser.close();
    browser = null;

    // Nombre del archivo (prioriza folio recibido)
    const folioSafe = (clientFolio ? String(clientFolio) : '').replace(/[^a-zA-Z0-9_-]/g, '');
    const outputFileName = fileName || (folioSafe ? `cotizacion_${folioSafe}.pdf` : `cotizacion_${Date.now()}.pdf`);

    // Headers para la respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);

    if (download === true || download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${outputFileName}"`);
    }

    return res.send(pdfBuffer);

  } catch (err) {
    try {
      console.error('[PDF][ERROR] generarCotizacionPdf:', err && (err.stack || err.message || err));
    } catch(_) { }
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    return res.status(500).json({
      error: 'No se pudo generar el PDF de cotización',
      details: err && err.message,
      stack: err && (err.stack || '').slice(0, 1500)
    });
  }
};

/**
 * Guardar PDF de cotización en el servidor y devolver URL
 */
exports.guardarCotizacionPdf = async (req, res) => {
  let browser = null;
  try {
    await ensurePdfDir();

    const { htmlContent, folio, headerTemplate = '', footerTemplate = '' } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML del reporte' });
    }

    // Configuración de Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) {} try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) {}
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 2
    });
    await page.emulateMediaType('print');

    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded'], timeout: 120000 });

    await page.evaluateHandle('document.fonts.ready');

    // Esperar imágenes
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const images = document.querySelectorAll('img');
        if (images.length === 0) return resolve();
        let loaded = 0;
        const checkDone = () => { loaded++; if (loaded >= images.length) resolve(); };
        images.forEach(img => {
          if (img.complete) checkDone();
          else { img.addEventListener('load', checkDone); img.addEventListener('error', checkDone); }
        });
        setTimeout(resolve, 5000);
      });
    });

    // Ocultar elementos no deseados e inyectar CSS
    await page.evaluate(() => {
      const filtersPanel = document.getElementById('filters-panel');
      if (filtersPanel) filtersPanel.style.display = 'none';
      const previewTitle = document.getElementById('preview-title');
      if (previewTitle) previewTitle.style.display = 'none';
      const toolbar = document.querySelector('.cr-toolbar');
      if (toolbar) toolbar.style.display = 'none';

      const docViewer = document.querySelector('.document-viewer');
      if (docViewer) { docViewer.style.marginLeft = '0'; docViewer.style.maxWidth = '100%'; }
      const docContainer = document.querySelector('.document-container');
      if (docContainer) {
        docContainer.style.width = '100%';
        docContainer.style.maxWidth = '210mm';
        docContainer.style.margin = '0 auto';
        docContainer.style.boxShadow = 'none';
        docContainer.style.border = 'none';
      }

      // Inyectar CSS adicional
      const style = document.createElement('style');
      style.textContent = `
        .cr-table--summary tbody tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .cr-table--summary { page-break-inside: auto !important; }
        .cr-table--summary thead { display: table-header-group !important; }
        .cr-table--summary tbody { orphans: 1; widows: 1; }
        .cr-card, .cr-summary-wrap { page-break-inside: auto !important; }
        
      `;
      document.head.appendChild(style);
    });

    try { console.log('[PDF][guardar] headerTemplate bytes:', (headerTemplate||'').length, 'footerTemplate bytes:', (footerTemplate||'').length); } catch (_) {}
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
      margin: {
        top: '56mm',  // RESERVAR ESPACIO para el encabezado
        right: '8mm',
        bottom: '14mm',
        left: '8mm'
      },
      scale: 0.90
    });

    await browser.close();
    browser = null;

    // Guardar archivo
    const folioStr = folio ? String(folio).replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const fileName = folioStr
      ? `cotizacion_${folioStr}_${Date.now()}.pdf`
      : `cotizacion_${Date.now()}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    await fs.writeFile(filePath, pdfBuffer);

    res.json({
      message: 'PDF de cotización guardado exitosamente',
      fileName: fileName,
      url: `/pdfs/${fileName}`
    });

  } catch (err) {
    console.error('Error guardando PDF de cotización:', err);
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    return res.status(500).json({
      error: 'No se pudo guardar el PDF de cotización',
      details: err.message
    });
  }
};
