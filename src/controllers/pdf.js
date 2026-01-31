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
 * Generar PDF de orden de envío con Logo en Base64 y Header Nativo
 */
exports.generarOrdenEnvioPdf = async (req, res) => {
    let browser = null;
    try {
        const { htmlContent, fileName, folio = '', download = true, formData = {} } = req.body;

        if (!htmlContent) {
            return res.status(400).json({ error: 'Se requiere htmlContent' });
        }

        // PROCESAR LOS DATOS DEL FORMULARIO Y REEMPLAZARLOS EN EL HTML
        let processedHtml = htmlContent;
        
        if (formData && typeof formData === 'object') {
            // Reemplazar cada valor en el HTML
            if (formData.destinatario) {
                processedHtml = processedHtml.replace(
                    /id="destinatario"[^>]*>/g,
                    `id="destinatario" value="${formData.destinatario}">`
                );
            }
            if (formData.rfc) {
                processedHtml = processedHtml.replace(
                    /id="rfc"[^>]*>/g,
                    `id="rfc" value="${formData.rfc}">`
                );
            }
            if (formData.seFacturaA) {
                processedHtml = processedHtml.replace(
                    /id="se-factura-a"[^>]*>/g,
                    `id="se-factura-a" value="${formData.seFacturaA}">`
                );
            }
            if (formData.domicilioFacturacion) {
                processedHtml = processedHtml.replace(
                    /id="domicilio-facturacion"[^>]*>/g,
                    `id="domicilio-facturacion" value="${formData.domicilioFacturacion}">`
                );
            }
            if (formData.telefono) {
                processedHtml = processedHtml.replace(
                    /id="telefono"[^>]*>/g,
                    `id="telefono" value="${formData.telefono}">`
                );
            }
            if (formData.porte) {
                processedHtml = processedHtml.replace(
                    /id="porte"[^>]*>/g,
                    `id="porte" value="${formData.porte}">`
                );
            }
            if (formData.contacto) {
                processedHtml = processedHtml.replace(
                    /id="contacto"[^>]*>/g,
                    `id="contacto" value="${formData.contacto}">`
                );
            }
            if (formData.aDomicilio) {
                processedHtml = processedHtml.replace(
                    /id="a-domicilio"[^>]*>/g,
                    `id="a-domicilio" value="${formData.aDomicilio}">`
                );
            }
            if (formData.envioPor) {
                processedHtml = processedHtml.replace(
                    /id="envio-por"[^>]*>/g,
                    `id="envio-por" value="${formData.envioPor}">`
                );
            }
            if (formData.descripcionCarga) {
                processedHtml = processedHtml.replace(
                    /id="descripcion-carga"[^>]*>/g,
                    `id="descripcion-carga" value="${formData.descripcionCarga}">`
                );
            }
        }

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--font-render-hinting=none',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        const page = await browser.newPage();
        
        // Viewport optimizado para renderizado de Tailwind
        await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });
        await page.emulateMediaType('print');

        // Establecer contenido y esperar a que no haya peticiones de red activas
        await page.setContent(processedHtml, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Asegurarse de que las fuentes estén listas
        await page.evaluateHandle('document.fonts.ready');

        // Inyectar estilos optimizados ANTES de generar el PDF
        await page.addStyleTag({
            content: `
                /* RESETEAR MÁRGENES Y PADDING DEL CONTENEDOR PRINCIPAL */
                .contract-page {
                    margin: 0 !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    box-shadow: none !important;
                    background: white !important;
                }
                
                /* OPTIMIZAR ESPACIADO DE SECCIONES CON BORDER */
                .border {
                    margin-top: 6px !important;
                    margin-bottom: 6px !important;
                    padding: 8px 12px !important;
                }
                
                /* PRIMER BLOQUE - REMITENTE */
                .mb-1.mt-2 {
                    margin-top: 12px !important;
                    margin-bottom: 6px !important;
                    padding: 8px 12px !important;
                }
                
                /* SEGUNDO BLOQUE - DESTINATARIO */
                .mt-2.mb-2 {
                    margin-top: 8px !important;
                    margin-bottom: 6px !important;
                    padding: 8px 12px !important;
                }
                
                /* OPTIMIZAR INPUTS PARA QUE SE VEAN MEJOR */
                .form-field {
                    border-bottom: 1px solid #333 !important;
                    padding: 0 4px !important;
                    min-width: 60px !important;
                    font-size: 0.75rem !important;
                }
                
                /* MEJORAR ESPACIADO DE LÍNEAS EN FORMULARIOS */
                .space-y-1 > * + * {
                    margin-top: 0.35rem !important;
                }
                
                /* AJUSTAR TAMAÑO DE FUENTE PARA APROVECHAR ESPACIO */
                .text-xs {
                    font-size: 0.70rem !important;
                    line-height: 1.3 !important;
                }
                
                /* FOOTER DE EXPEDIENTE */
                .hp-footer {
                    display: none !important;
                    margin-top: 0 !important;
                    page-break-inside: avoid !important;
                }
                
                .hp-exp-row3,
                .hp-exp-row2 {
                    font-size: 0.65rem !important;
                    padding: 4px 6px !important;
                }
                
                /* ASEGURAR QUE NO HAY ESPACIOS INNECESARIOS */
                * {
                    box-sizing: border-box !important;
                }
                
                /* OCULTAR SOLO EL HEADER DUPLICADO */
                .contract-header {
                    display: none !important;
                }
                
                /* OPTIMIZAR FLEX ITEMS */
                .flex.items-center {
                    align-items: center !important;
                    margin-bottom: 0.25rem !important;
                }
                
                /* AJUSTAR LABELS PARA QUE NO OCUPEN TANTO ESPACIO */
                .clause-heading {
                    font-size: 0.70rem !important;
                    white-space: nowrap !important;
                    margin-right: 8px !important;
                }
                
                /* HACER QUE LOS INPUTS SEAN MÁS FLEXIBLES */
                .flex-1 {
                    flex: 1 1 auto !important;
                    max-width: 100% !important;
                }
                
                /* REMOVER MÁRGENES DEL BODY */
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                }
            `
        });

        // Ajustes adicionales por JavaScript
        await page.evaluate(() => {
            // Ajustar ancho de la página para usar todo el espacio
            const contractPage = document.querySelector('.contract-page');
            if (contractPage) {
                contractPage.style.padding = '0 8px';
            }
            
            // Asegurar que todos los borders tengan el mismo estilo
            const borders = document.querySelectorAll('.border');
            borders.forEach(el => {
                el.style.borderWidth = '1px';
                el.style.borderColor = '#9ca3af';
            });
        });

        /**
         * LOGO EN BASE64
         * Sustituye esta cadena por el Base64 real de tu logo de "Andamios Torres"
         */
        const logoBase64 = "data:image/jpeg;base64,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AeTX8kQElglglhASWCWDa1c5vCgAAAAAAAAAE884ya0pbKLKWyiylsorPGHJs+qw5PQAAAAAAASjx4zDBM2OPMsEsICSwSwy7Oj6Nx59UAAAAAAAAAABzNLZ1hLCAWUtlLZYvrz6LZatlje2Of0KAAAAAAAAAAYM+pEBASWCWCWEBJYJYLIdW6m3QAAAAAAAADHOWevEospbKLKWyizMY9jP7JQAAAAAAAAAAAA84s41pmxR5BJYJYJYXc0ab7x7oAAAAAAAAB59c80fNglhALKWylssX159FstWyx66HP2TbFAAAAAAAAAY8HvxEBASWCWCWEBJYJYJYOjzadZhzUAAAAAAAx3kjwFsospbKLKW3fMWyAAAAAAAAAAAAAAACUa/jbwxhlglglhJYXd0adB59UAAAAAAAMROR6xiWCWEAspbKWyxfXn0Wy1bLHr34p02PJQAAAAAAAA8GCEQEBJYJYJYQElglglhANrUh2LyNqt149gAAACXmmLCFBbKLKWyjK6A9AAAAAANJN1w1nccMdxwx3HD8L32PJKAAAAAABj19zHGtLBLCSwSw973OzG4KAAAAAMOkbXN8iSwSwSwgFlLZS2WL68+i2WrZY9WU2drQ36AAAAAAAAYc2tHkEBASWCWCWEBJYJYJYQElglgy4Vb2zxx3HH2jeePYMZg5lhQUFsospcvnpHqgAAAAAA+b73ymswbyAAxe/Gb9B1/lPq8aBQAAAAAAMervYY15YSWCWCWG3sczoV7AeMRsNLEdLFzPJu62ORAQEllJYJYQCylspbLF9efRbLVsserKet7Q2zOKAAAAAAA86+bDEBAQElglglhASWCWCWEBJYJYQVJYJYXY1odPU1wspQUFso9ed4zZgAAAAAAA5HE2dbpzCgBI8QzX13yPal7omgAAAAAAANbDvaceJYJYJYTJjGfD5glhASWCWEBASWUlglhALKWylssX159FstWyx6spc2H2b4oAAAAAADDj9eYgICAksEsEsICSwSwSwgJLBLCCpLBLBLABZSgoLZTN1MWUAAAAAAAau1w7OSOmAAHn1jiDNZ8A+2ujvZ0CgAAAAAAMeQc+Z8EJYJYQElglhASWCWEBASWUlglhALKWylssX159FstWyx6spfXn0bvvDmoAAAAABL5NcRAQEBJYJYJYQElglglhASWCWEFSWCWCWAC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ar5zzzyiJYKr4OutVVFDzzzzzzzzzzzzzzzzzzzzzzzy9cetden1VVjzzzzzywDwD4Lzzzzzzzzgr5ZbrzzzzzyxYqr4OutVVHljzzzzzzzzzzzzzzzzzzzzzjv9cetden1XTzzzzzzzyzwD4JzzzzzzzygL5ZbTzzzzzzzyir4OutVVGlFTzzzzzzzzzzzzzzzzzzzy6v8AXHrXXp9U888888888scA+C88888888sK+WW8888888888M+DrrVVRpBw0888888888888888888mBr/XHrXXp8888888888888A+CU88888884K+WW88888888888sPrrVVRpBVg8888888888888888883Br/XHrXTE8888888888880A+CK88888882K+WS8888888888884jrVVRpBVGw8888888888888888mVBr/XHrXk8888888888888cA+C+8888884WK+WW8888888888888ojVVRpBVWu088888888888888sVVBr/AFx6xPPPPPPPPPPPPPPPAPgvmgljnrllivlgvPPPPPPPPPPPPPLFVUaQVVqlPPPPPPPPPPPPPPI1VQa/1x8nPPPPPPPPPPPPPPFAPgvqglvvvllivlgvPPPPPPPPPPPPPPEVUaQVVqlNPPPPPPPPPPPPPiVVQa/1x1PPPPPPPPPPPPPNAPAPgvqglvvvllivlhqtPPPPPPPPPPPPPOHUaQVVqgMPPPPPPPPPPPPCqVVQa/11/PPPPPPPPPPPPOPAPAPgvqjnustnlivllqpsPPPPPPPPPPPPPHUaQVVqgOvPPPPPPPPPPOKaVVQa/wBdPzzzzzzzzzzzjwDwDwDqTzzzzzzzyxzZZardcLzzzzzzzzzzzz1GkFVaoD5TzzzzzzzzzyamlVUGv9cfzzzzzzzzzywDwDwDzxzzzzzzzzzzzzwxqrdcOrzzzzzzzzzyxVGkFVaoD5bzzzzzzzzzymmlVUGv9ce/zzzzzzzzxQDwDxizzzzzzzzzzzzzzzzy79cP/bzzzzzzzzy1VGkFVaoD4ZTzzzzzzzygmmlVUGv9cetfzTzzzzjVQDwDxzzzzzz3HHHTTzzzzzzw58P9fLzzzzzzilVVGkFVaoD5ZTzzzzzzzyqmmlVUGv8AXHrXXZo408IVUA8Ec888888s888CW88888888aD/AFw/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zzzzzzzzzzzzFRvhUMzDvewPyverchfYSejdyQ+Oh1/hIA+Q8mNbz0WnjzwgTXyd0EXzzzzzzzzzzzzzzzzzzzzzzyJDaVvBzwLa/wC0868p3uW/vWsqeC8I8d82nssCGdPM1/oc5R8zsO8s7be888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888/9oADAMBAAIAAwAAABDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzjzzDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzDSmu9euf/AP7bjvzw0888888888888888888888888888888888888888888888888888888888808BJpprr/AF+1/wD+usN9e8Nu9XzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzjCkmmmmmmuv9ftf/8ArrDfXvDreqWDU888888888888888888888888888888888888888888888884gB1ppppppprr/X7X/8A66w317w63qllqh8dPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOG/gFaaaaaaaa6/1+1/8A+usN9e8Ot6pZapavtjTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzA2yL4BWmmmmmmmuv8AX7X/AP66w317w63qllqlq61/+PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPRPLIvgFaaaaaaaa6/1+18+66w317w63qllqlq61614dPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOEXFPLIvgFaaaaaaaa6/00XPLKIw317w63qllqlq61611v+PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPLwvFPLIvgFaaaaaaaa6/x/PPPPIw317w63qllqlq61611vokPPPPPPPPPPPPPPPPPPPPPPPPPPPPPOKvgvFPLIvgFaaaaaaaa6/wDTzzzzzgt9e8Ot6pZapautetdb4KxXzzzzzzzzzzzzzzzzzzzzzzzzzzyyKr4LxTyyL4BmlWGmmmmuvvzzzzzzyN9e8Ot6ed+tautetdb4LyjnzzzzzzzzzzzzzzzzzzzzzzzzzxBKr4LxTyyLsRzzzymmmmusfzzzzzzwx9e8Osfzzzyyetetdb4LyhRXzzzzzzzzzzzzzzzzzzzzzzzzShKr4LxTyyXzzzzzzwmmmutzzzzzzzyx9e8Pvzzzzzyw9+tdb4LygTxjzzzzzzzzzzzzzzzzzzzzzhRShKr4LxTxzzzzzzzzzymmutzzzzzzzyxde8MzzzzzzzzwiNdb4LygTyzzzzzzzzzzzzzzzzzzzzzyPxShKr4LxBzzzzzzzzzywmmuvzzzzzzzyh9e8Pzzzzzzzzzwh9b4LygTzynzzzzzzzzzzzzzzzzzzztbxShKr4LwTzzzzzzzzzzymmuvTzzzzzzyx9e9PzzzzzzzzzzzxL4LygTzyjnzzzzzzzzzzzzzzzzzyBbxShKr4LTzzzzzzzzzzzy2mutvzzzzzzxN9e9fzzzzzzzzzzzwz4LygTzyivzzzzzzzzzzzzzzzzxWtbxShKr7zzzzzzzzzzzzzyimuu/zzzzzzgN9e8fzzzzzzzzzzzzwgLygTzyisfzzzzzzzzzzzzzzzj+tbxShKoXzzzzzzzzzzzzzzymuv9euc9/tsN9e8Pzzzzzzzzzzzzzx3ygTzyisPzzzzzzzzzzzzzzwD+tbxShLPzzzzzzzzzzzzzzymmuv9ftf/wDrrDfXvT888888888888888coE88orDV8888888888888qj/rW8UoSc8888888888884w5pprr/X7X/wD66w317w3+PPPPPPPPPPPPPOIBPPKKw1WPPPPPPPPPPPPDQ/61vFKAvPPPPPPPPPPPMGaaaaa6/wBvNvvOOMt9e8Ot/HTzzzzzzzzzzyyATzyisNVfTzzzzzzzzzyj8P8ArW8UoW88888888888oppppppnVMc888888c4fvDreqn888888888888AE88orDVXw88888888881/D/rW8UoCc888888888cppppppkc8888888888884LreqWH08888888888oE88orDVXT8888888888K/D/rW8UoSe88888888o1ppppx8888888888888888sHWqWW/088888888soE88orDVXT088888888oJ/D/rW8UoSqeR88888kAVpppl888888nLDDE08888888biWWq3088884oQ8oE88orDVXDw88888888lp/D/AK1vFKEqvgjMVfPNQFaadXPPPPPPAfPPHE/PPPPPPPH1lqloeNOHd/gvKBPPKKw1VwyvPPPPPPPP6fw/61vFKEqvgvFPDM/gFaefPPPPPPPNfPP/AI7zzzzzzzyxtapbvtetdb4LygTzyisNVcP7zzzzzzzxan8P+tbxShKr4LxTyyL4BWmTzzzzzzwnzzyj63vzzzzzzzzzapautetdb4LygTzyisNVcP5zzzzzzzjWn8P+tbxShKr4LxTyyL4BWHzzzzzzzyfzzz775Tzzzzzzzzy2pautetdb4LygTzyisNVcP5zzzzzzztWn8P8ArW8UoSq+C8U8si+AV08888888Yd886e+++888888888sqWrrXrXW+C8oE88orDVXD+S8888885Vp/D/rW8UoSm/I0c8si+AV88888888j8888W+++2888888888nWrrXrXX0I0oE88orDVXD+C8888881Vp/D/rW8Qzt8888s8si+Ad88888888c888LuyyyT888888888sWrrXps888sdJ48orDVXD+C888888fVp/D/rSX88888888csi+AU8888888Be885N+/wD/AN/33331rzzzh6utdHzzzzzzzy2CsNVcP5bzzzzzz5Wn8P8ArU8888888848si+A08888888Y888r/8APPPPPPPPP+/PPLPq61//ADzzzzzzzyGsNVcP5bzzzzzx5Wn8P+tHzzzzzzzyzyyL4DzzzzzzzxbzzxPzzzzzzzzzyzzzzzz+utfvzzzzzzzzyGsNVcP4Zzzzzzz5Wn8P+tHzzzzzzzynyyL4BTzzzzzyx3zyosMMv7zy8EOGLzzzzx+utf8A888888888NrDVXD+W888888eVp/D/rU8888888898si+A0888888K888/wDPPPPvPPKvPPPPPPPN661+/PPPPPPPPMaw1Vw/ktPPPPPH1afw/wCtTzzzzzzzz3yyL4DzzzzzzzzzzxHzzzyvzzzvzzzzzzyhautf/wA88888881IrDVXD+C8888889Vp/D/rW8z/APPPPPKfLIvgDfPPPPBPPPOXPPPPNfPPPk/PPPPPOFq61/8AzzzzziFxyisNVcP4LzzzzzzVWn8P+tbxShLq9F3TyyL4BHzzzzwfzzyzzzzzzzLzzyPzzzzzytauteufd3FygTzyisNVcP5bzzzzzylWn8P+tbxShKr4LxTyyL4AVzzzx1XzzhvzzzzzzLzzznTzzzzwpautetdb4LygTzyisNVcP4bzzzzzy9Wn8P8ArW8UoSq+C8U8si+AVN888p888/c888888F/88sg88881qWrrXrXW+C8oE88orDVXD+C888888o9p/D/rW8UoSq+C8U8si+AVp088f888C88888888V88898888fqWrrXrXW+C8oE88orDVXD+c88888882p/D/rW8UoSq+C8U8si+AVpd0/+885d88888888R8889A88HWqWrrXrXW+C8oE88orDVXD6c8888888uf8Azz7vDDPDPDLDPHPDPDPDLPBfPPLvPPPPPPPPCAQQQYPPDPHLHLHLPDPDPDPLHHLLLLPLPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPH8qfPPPDMq/PPOOMvOOMsstIdPPPPPPB8rfPPPDMsr/PPPF8siPDMq/PPPHUSwEfPPPPFwfnn/PPPPPHfPs/PPP8Ay5vzylTxWhbzzzzy+DzzzzzXy6vzzxfzzjTzwTXzwHz/AMr886s88889N888/d888uW8888U888G888/88a88pU8VoW8wz178u7888A888m888X888t88H888B8/8r88+85oB08+A8d89+nf8uw888N8A8o888/888G8pU8VoW8B88O18/8APPFfPvPvPPF/OfLfPJfNfAfP/K/JfPvvPLG/KPGfK/PLHP8AvzyXf0fb3Xzz/wAU9pWpU8VoW8B888y8+c8lf9329988X8o860816c8B8/8AK/NPPPPPPJfLTkvPjDJvPPPPKvKPM/NPPP8Axfvy6lTxWhbwHzzzvzx/zLzrxvxjzxfzv3zjjyj3wHz/AMr8e8q8888R88dAz088teh888W84wx8u88/8Xb1tHU8VoW8B888785h8c8Awk8+88X8rC8vP8K98B8/8r828a8888Tc8X8s1R2/8tP8498+++88g8/8X8C8uc8VoW8B8888868s98+++8888X8r21+W6N98B8/8r8/888888r8+tGNc88A+8/8AIvPvPPNPKPP/ABfyxDzzxWhbwHzyn3zXyrzrzzzjwzxfyvzbzzPz3wHz/wAr8k09l88nP8/8W8l888z8s4e8q888T8qz/wDF/POP/PFaFvPf3XPKZ/PvFvPPF/Ps1/K/FfPFPPfAfP8AyvyzPz3993zlTybS20l/7hOzOUXzzwBnOLPN3zzwLPNWhnPPPf7OfxDOE/zzwzHM53O3y7rWXzjMHzvOTzywbnzz2jzzyyLbzzz5Lywxzzzzzywwwwwzzzzwwxzwwwwxzzzzywxzzzzzywwwwwzzwxzzywxzwwxzzzzzh89vzzzzzyxQ2jzzzzzzzzzzwXHHHHHHGDzzwUMhSTzzzzHHHHGHTzzwXHHHHHDzzyzHHHHHHGDzwR7ylzzzyZyLTzzzzzzzzzzzzzzxz/8A/wD/AP8A/wDfPDXvPPPhfPAv/wD/AP8A/wA6zzxz/wD/AP8A/wCpI8F//wD/AP8A/wD9PALPPPPZfGK9iY/PPPPPPPPPPPPPPNcMPvOsMKfO/OOMePL4fAvPPfeefLyfPPPffd9PH/FPPsMMMMKhX+IYdvLioYCPyPPPPPPPPPPPPPPPPPPPvK/PPIv/AB/zwH/zuQLzxbzxLfw3zzxXzzxzz3xTyrzzzzzxny3zwhrDHx97Efzzzzzzzzzzzzzzzzzz7yvzzwLy0jzzwL/yILzxbzzhXzfzzxXzzwHyrxTyrzzzzzwfz7uXwHGjzyTzzzzzzzzzzzzzzzzzzzz7yvzzx3y3zzzzx3wwLzz4825yQPzzwc89D7jnxTy88889vxFzzzwyw7zzzzzzzzzzzzzzzzzzzzzzzz7yvzzxTz3zzzzxXyELzzzzzy77zzzzzzzzxWDxTz//AP8A/wCzzwFnfzzz+3zzzzzzzzzzzzzzzzzzzzzzz7yvzzyzzzzzzxh7wALzyYPCny67zzxANOLfwvxTyrzzzzzww8vwFFvy7zzzzzzzzzzzzzzzzzzzzzzz7yvzzwfyynzzzny4ELzxbzxhbzHzzxXzzxLyrxTyrzzzzzx7yHzzwryzzzzzzzzzzzzzzzzzzzzzzzz7yvzzzxny9vNZzijwLzxbzzxTyLzzxXzzx/zvxTz444444sXy6g9r3znzzzzzzzzzzzzzzzzzzzzzzz7yvzzzxHf/AM88+B88C88W888+83888V8883858U8888888r41+8887gj88888888888888888888888hyz888888ynCTK888CyyC888Tyh8AyB888SySsjyyyyyyyi88Cmy4w88888888888888888888888888888888888880888888888888888848888888888888888888888888888888888888888888888888AfCmSnEBUBKO982AbvVe/dISihFC2uj4x3bxl6lPj8X73U88Rm08ue7T88888888888888888888888jkDztwkVHT9Tw8D8iYHv9UX2vDrVOMDoT1gMLL/KE1E013b8hg/8AINvB/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP/EAC4RAAIBAwIGAQQDAQEAAwAAAAECEQADEBIxBBMgITJRQSJAUGEwYHEUcCOAkP/aAAgBAgEBPwD/AOjU/wD6ORUf+iH+nE/04mP6eT/Tif8Ax0n+nEx/T2P4GKj+9n+nnf8AtwBJgVyH9VyH9VyH9UbTDf8AFn8Bw69yehzJirgg/ijv+AtLpUDJMUTNXBIn8Ufv7S6mA6HMCMETREGP6Rw6wC3Q5k5uiDP4g7ffjvSrpUDJMCTUzlxK/iD9/ZWWn10cQ0LHukMr0EQY/Dt/FH2thYWffReaW/yrR7x0XR8/hzv/AAAfbKJIFAQIGWbSpNPd0tFc8eq5/wCq5/6rn/quf+q549Vzx6rnj1XPHquePVI+rvH4E79Y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"; 

// SOLUCIÓN CORREGIDA PARA PUPPETEER PDF
// ========================================

// 1. Definición del Header (optimizado)
const headerTemplate = `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0 !important; padding: 0 !important; }
        #header { 
            padding: 0 !important; 
            margin: 0 !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .header-container {
            width: 100%;
            padding: 12px 45px 8px 45px;
            display: flex;
            align-items: flex-start;
            border-bottom: 2.5px solid #003366;
            font-family: 'Arial', sans-serif;
            background: white;
        }
        .logo-col { 
            width: 85px;
            flex-shrink: 0;
        }
        .logo-img { 
            width: 80px; 
            height: auto; 
            display: block; 
        }
        .info-col { 
            flex-grow: 1; 
            padding-left: 20px; 
        }
        .co-name { 
            color: #003366; 
            font-size: 18px; 
            font-weight: bold; 
            margin: 0; 
            line-height: 1.2;
        }
        .co-address { 
            font-size: 8.5px; 
            color: #444; 
            margin-top: 4px; 
            line-height: 1.3; 
        }
        .folio-col { 
            width: 150px; 
            text-align: right;
            flex-shrink: 0;
        }
        .folio-label { 
            color: #cc0000; 
            font-size: 12px; 
            font-weight: bold; 
            margin-bottom: 2px; 
        }
        .folio-val { 
            color: #cc0000; 
            font-size: 24px; 
            font-weight: 900; 
            border-bottom: 3px solid #cc0000; 
            display: inline-block;
            line-height: 1;
        }
        .doc-type { 
            font-size: 11px; 
            font-weight: bold; 
            color: #333; 
            margin-top: 6px; 
        }
    </style>
    <div class="header-container">
        <div class="logo-col">
            <img src="${logoBase64}" class="logo-img" alt="Logo" />
        </div>
        <div class="info-col">
            <h1 class="co-name">ANDAMIOS Y PROYECTOS TORRES, S.A. DE C.V.</h1>
            <div class="co-address">
                ORIENTE 174 N° 290 COLONIA MOCTEZUMA 2 SECC. C.P. 15530 CDMX<br>
                TELS: 55-5571-7105 55-2643-0024 | RFC: APT100310EC2<br>
                ventas@andamiostorres.com | www.andamiostorres.com
            </div>
        </div>
        <div class="folio-col">
            <div class="folio-label">FOLIO</div>
            <div class="folio-val">${folio || 'N/A'}</div>
            <div class="doc-type">ORDEN DE ENVÍO</div>
        </div>
    </div>
`;

// 2. Definición del Footer nativo de Puppeteer (EXPEDIENTE)
const footerTemplate = `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0 !important; padding: 0 !important; }
        
        .footer-container {
            width: 100%;
            font-family: Arial, sans-serif;
            font-size: 8px;
            padding: 0 15px;
            background: white;
        }
        
        .hp-footer {
            border: 1px solid #333;
            width: 100%;
        }
        
        .hp-exp-row3 {
            display: flex;
            border-bottom: 1px solid #333;
        }
        
        .hp-exp-row2 {
            display: flex;
        }
        
        .hp-exp-cell {
            flex: 1;
            border-right: 1px solid #333;
            padding: 6px 8px;
            font-size: 8px;
            font-weight: 600;
            text-align: center;
            vertical-align: middle;
            min-height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.3;
        }
        
        .hp-exp-cell:last-child {
            border-right: none;
        }
    </style>
    
    <div class="footer-container">
        <div class="hp-footer">
            <div class="hp-exp-row3">
                <div class="hp-exp-cell">EMITE: COORD. VENTAS</div>
                <div class="hp-exp-cell">REVISA: RESP. GESTIÓN DE CALIDAD</div>
                <div class="hp-exp-cell">APRUEBA: SUBDIRECTOR GENERAL</div>
            </div>
            <div class="hp-exp-row2">
                <div class="hp-exp-cell">REVISIÓN: 02</div>
                <div class="hp-exp-cell">FECHA DE EMISIÓN: 02-01-2026</div>
            </div>
        </div>
    </div>`;

// 3. Antes de generar el PDF, preparar el contenido del body
await page.evaluate(() => {
    // Ocultar cualquier header/footer que esté en el HTML original
    const contractHeader = document.querySelector('.contract-header');
    if (contractHeader) {
        contractHeader.style.display = 'none';
    }
    
    // Asegurar que el body principal tenga el margen correcto
    const contractPage = document.querySelector('.contract-page');
    if (contractPage) {
        contractPage.style.paddingTop = '0';
        contractPage.style.marginTop = '0';
    }
    
    // Remover márgenes superiores de los primeros elementos
    const firstBorder = document.querySelector('.border');
    if (firstBorder) {
        firstBorder.style.marginTop = '0';
    }
});

// Esperar a que las imágenes se carguen
try {
    await page.evaluate(() => {
        return new Promise((resolve) => {
            const images = document.querySelectorAll('img');
            if (images.length === 0) return resolve();
            let loaded = 0;
            images.forEach(img => {
                if (img.complete) {
                    loaded++;
                } else {
                    img.addEventListener('load', () => {
                        loaded++;
                        if (loaded === images.length) resolve();
                    });
                }
            });
            setTimeout(resolve, 3000); // Timeout de seguridad
        });
    });
} catch (err) {
    console.log('Error cargando imágenes:', err);
}

// Scroll para asegurar que todo se renderiza
await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
    window.scrollBy(0, -window.innerHeight);
});

// Esperar un momento para que se complete el renderizado
await new Promise(resolve => setTimeout(resolve, 400));

// 7. GENERAR PDF CON MÁRGENES OPTIMIZADOS
const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: headerTemplate,
    footerTemplate: footerTemplate,
    margin: {
        top: '24mm',      // Espacio para header
        bottom: '55mm',   // Aumentado significativamente para footer al pie
        right: '8mm',
        left: '8mm'
    },
    scale: 1.1,  // 100% para aprovechar todo
    preferCSSPageSize: false
});

await browser.close();

const outputFileName = fileName || `Orden_Envio_${folio}.pdf`;
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${outputFileName}"`);
return res.send(pdfBuffer);

    } catch (err) {
        if (browser) await browser.close();
        console.error("Error crítico en PDF:", err);
        return res.status(500).json({ error: err.message });
    }
};

// ========================================
// NOTAS IMPORTANTES:
// ========================================
// 
// 1. Los márgenes top y bottom deben coincidir aproximadamente con 
//    la altura real de tu header y footer
//
// 2. Puppeteer renderiza el header/footer en el espacio de los márgenes
//
// 3. El contenido del body automáticamente fluye en el espacio disponible
//
// 4. Si el contenido se sigue amontonando, ajusta:
//    - Aumenta top si el header es más grande
//    - Aumenta bottom si el footer es más grande
//    - Reduce scale si necesitas más espacio
//
// 5. Para debugging, puedes generar el PDF sin header/footer primero:
//    displayHeaderFooter: false
//    Esto te ayudará a ver si el problema es del contenido o de los márgenes
//
// ========================================

/*termina orden de envio*/

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
