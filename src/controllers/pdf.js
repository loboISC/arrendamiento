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
    // Logging detallado desde el contexto de la p├ígina
    try {
      page.on('console', msg => {
        try { console.log('[PDF][page]', msg.type?.(), msg.text?.()); } catch (_) { }
      });
      page.on('pageerror', err => {
        try { console.error('[PDF][pageerror]', err && (err.stack || err.message || String(err))); } catch (_) { }
      });
      page.on('requestfailed', req => {
        try { console.warn('[PDF][requestfailed]', req.url(), req.failure()?.errorText); } catch (_) { }
      });
    } catch (_) { }

    // Configurar viewport para mejor renderizado
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2
    });

    // Emular medios de impresi├│n para activar @media print
    await page.emulateMediaType('print');

    // Cargar el contenido HTML
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 120000
    });

    // Esperar a que las fuentes se carguen
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // Respetar tama├▒o y m├írgenes definidos por CSS @page
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
      return res.status(400).json({ error: 'Faltan par├ímetros requeridos' });
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
    const { htmlContent, fileName, download, logoBase64, scaffoldBase64, headerTemplate, footerTemplate } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML de la hoja de pedido' });
    }

    // 1. Ya no necesitamos leer im├ígenes aqu├¡, el frontend las env├¡a inyectadas o Puppeteer las resuelve v├¡a <base>
    // 2. Ya no usamos headerTemplate nativo

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

    // Interceptor: Bloquear fuentes externas para evitar retardos
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (req.resourceType() === 'font') return req.abort();
        return req.continue();
      });
    } catch (_) { }

    // Logging y diagnóstico
    page.on('console', msg => console.log('[PDF][Browser]', msg.text()));

    try { page.setDefaultNavigationTimeout(60000); } catch (_) { }

    const publicPath = path.join(__dirname, '../../public');
    const fileBaseUrl = `file://${publicPath.replace(/\\/g, '/')}/`;

    // Inyectar etiqueta <base>
    const htmlWithBase = htmlContent.replace('<head>', `<head><base href="${fileBaseUrl}">`);

    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    // Usamos 'domcontentloaded' y un timeout más agresivo
    console.log('[PDF] Iniciando setContent...');
    await page.setContent(htmlWithBase, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('[PDF] setContent completado.');

    // Esperamos fuentes internas y luego imágenes con timeout de 10s
    try { await page.evaluateHandle('document.fonts.ready'); } catch (_) { }

    await page.evaluate(() => {
      return new Promise((resolve) => {
        const images = Array.from(document.querySelectorAll('img'));
        if (images.length === 0) return resolve();
        let loaded = 0;
        const done = () => { if (++loaded >= images.length) resolve(); };
        images.forEach(img => {
          if (img.complete) done();
          else { img.addEventListener('load', done); img.addEventListener('error', done); }
        });
        setTimeout(resolve, 10000);
      });
    });

    try {
      await page.emulateMediaType('print');
    } catch (_) { }

    // 3. Inyectar CSS técnico para máxima fidelidad (colores y saltos)
    try {
      await page.addStyleTag({
        content: `
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Forzar colores en todos los elementos (especialmente badges rojos) */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Asegurar que cada bloque .page empiece en una hoja nueva */
          .page {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        `
      });
    } catch (_) { }

    // 4. Generar PDF (Escala 1:1 para distribución idéntica)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '<div></div>',
      footerTemplate: footerTemplate || '<div></div>',
      margin: {
        top: headerTemplate ? '35mm' : '0mm',
        right: '0mm',
        bottom: footerTemplate ? '6mm' : '0mm',
        left: '0mm'
      },
      scale: 1.0 // Escala 100% para coincidir con la vista previa
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
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    console.error('[PDF][CRITICAL_ERROR] generarHojaPedidoPdf:', err);
    return res.status(500).json({
      error: 'No se pudo generar el PDF de hoja de pedido',
      details: err && err.message,
      stack: err && err.stack ? err.stack.slice(0, 500) : 'No stack trace available',
      phase: 'generating-pdf'
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
      return res.status(400).json({ error: 'Faltan par├ímetros requeridos' });
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
      return res.status(400).json({ error: 'Faltan par├ímetros requeridos' });
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
      return res.status(400).json({ error: 'Nombre de archivo inv├ílido' });
    }

    const filePath = path.resolve(PDF_DIR, fileName);

    // Verificar que el archivo existe
    await fs.access(filePath);

    // Enviar el archivo con Content-Type para visualizaci├│n
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
      return res.status(400).json({ error: 'Nombre de archivo inv├ílido' });
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
 * Endpoint de prueba: genera PDF desde el archivo p├║blico de reporte y lo devuelve inline
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
 * Generar PDF de cotizaci├│n desde HTML renderizado (tama├▒o carta)
 * Recibe el HTML completo del documento ya poblado con datos
 */
exports.generarCotizacionPdf = async (req, res) => {
  let browser = null;
  try {
    const { htmlContent, fileName, download, headerTemplate = '', footerTemplate = '', folio: clientFolio = '' } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML del reporte' });
    }

    // Configuraci├│n de Puppeteer optimizada para PDF de alta fidelidad
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

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) { } try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) { }

    // Viewport amplio para renderizar correctamente el contenido A4/Carta
    await page.setViewport({
      width: 816, // 8.5 pulgadas * 96 DPI
      height: 1056, // 11 pulgadas * 96 DPI (tama├▒o carta)
      deviceScaleFactor: 2
    });

    // Emular medios de impresi├│n para activar @media print
    await page.emulateMediaType('print');

    // Cargar el contenido HTML
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Esperar a que las fuentes se carguen
    await page.evaluateHandle('document.fonts.ready');

    // Esperar un momento adicional para que las im├ígenes carguen
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

      // Inyectar CSS adicional para mejorar la paginaci├│n y posici├│n del encabezado
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

    // Generar PDF tama├▒o carta con configuraci├│n optimizada
    try { console.log('[PDF] headerTemplate bytes:', (headerTemplate || '').length, 'footerTemplate bytes:', (footerTemplate || '').length); } catch (_) { }
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
    } catch (_) { }
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    return res.status(500).json({
      error: 'No se pudo generar el PDF de cotizaci├│n',
      details: err && err.message,
      stack: err && (err.stack || '').slice(0, 1500)
    });
  }
};

/**
 * Guardar PDF de cotizaci├│n en el servidor y devolver URL
 */
exports.guardarCotizacionPdf = async (req, res) => {
  let browser = null;
  try {
    await ensurePdfDir();

    const { htmlContent, folio, headerTemplate = '', footerTemplate = '' } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Se requiere htmlContent con el HTML del reporte' });
    }

    // Configuraci├│n de Puppeteer
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

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) { } try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) { }
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 2
    });
    await page.emulateMediaType('print');

    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded'], timeout: 120000 });

    await page.evaluateHandle('document.fonts.ready');

    // Esperar im├ígenes
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

    try { console.log('[PDF][guardar] headerTemplate bytes:', (headerTemplate || '').length, 'footerTemplate bytes:', (footerTemplate || '').length); } catch (_) { }
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
      message: 'PDF de cotizaci├│n guardado exitosamente',
      fileName: fileName,
      url: `/pdfs/${fileName}`
    });

  } catch (err) {
    console.error('Error guardando PDF de cotizaci├│n:', err);
    if (browser) {
      try { await browser.close(); } catch (_) { }
    }
    return res.status(500).json({
      error: 'No se pudo guardar el PDF de cotizaci├│n',
      details: err.message
    });
  }
};

// Directorio para PDFs temporales
const TEMP_PDF_DIR = path.join(__dirname, '../../public/pdfs/temp');

// Asegurar que el directorio existe
async function ensureTempPdfDir() {
  try {
    await fs.mkdir(TEMP_PDF_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creando directorio de PDFs temporales:', err);
  }
}

/**
 * Guardar PDF temporal para abrir en navegador
 * Guarda en disco en lugar de memoria para que persista
 */
exports.guardarPdfTemporal = async (req, res) => {
  try {
    const { base64Data, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Falta base64Data' });
    }

    await ensureTempPdfDir();

    // Generar nombre ├║nico
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const safeFileName = (fileName || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullFileName = `${id}_${safeFileName}`;
    const filePath = path.join(TEMP_PDF_DIR, fullFileName);

    // Guardar en disco
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);

    console.log('[PDF] Archivo temporal guardado:', filePath);

    // Limpiar despu├®s de 10 minutos
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
        console.log('[PDF] Archivo temporal eliminado:', filePath);
      } catch (e) { /* ignorar si ya no existe */ }
    }, 10 * 60 * 1000);

    // Devolver URL para acceder al PDF (archivo est├ítico)
    // Usar la URL base del request para que funcione en cualquier servidor
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3001';
    const url = `${protocol}://${host}/pdfs/temp/${fullFileName}`;
    res.json({ url, id: fullFileName });

  } catch (err) {
    console.error('Error guardando PDF temporal:', err);
    res.status(500).json({ error: 'Error guardando PDF temporal' });
  }
};

/**
 * Servir PDF temporal (fallback si no se sirve como est├ítico)
 */
exports.servirPdfTemporal = async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(TEMP_PDF_DIR, id);

    try {
      const data = await fs.readFile(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${id}"`);
      res.send(data);
    } catch (e) {
      return res.status(404).json({ error: 'PDF no encontrado o expirado' });
    }

  } catch (err) {
    console.error('Error sirviendo PDF temporal:', err);
    res.status(500).json({ error: 'Error sirviendo PDF temporal' });
  }
};
