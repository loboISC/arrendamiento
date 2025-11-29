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
    const { htmlContent, fileName, download, headerTemplate = '', footerTemplate = '' } = req.body;

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

    const page = await browser.newPage();

    // Viewport amplio para renderizar correctamente el contenido A4/Carta
    await page.setViewport({
      width: 816, // 8.5 pulgadas * 96 DPI
      height: 1056, // 11 pulgadas * 96 DPI (tamaño carta)
      deviceScaleFactor: 2
    });

    // Emular medios de impresión para activar @media print
    await page.emulateMediaType('print');

    // Cargar el contenido HTML
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 60000
    });

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

    // Ocultar elementos que no deben aparecer en el PDF
    await page.evaluate(() => {
      // Ocultar panel de filtros
      const filtersPanel = document.getElementById('filters-panel');
      if (filtersPanel) filtersPanel.style.display = 'none';
      
      // Ocultar título de vista previa
      const previewTitle = document.getElementById('preview-title');
      if (previewTitle) previewTitle.style.display = 'none';
      
      // Ocultar controles de descuento/IVA (toolbar)
      const toolbar = document.querySelector('.cr-toolbar');
      if (toolbar) toolbar.style.display = 'none';
      
      // Ajustar el contenedor del documento para ocupar todo el ancho
      const docViewer = document.querySelector('.document-viewer');
      if (docViewer) {
        docViewer.style.marginLeft = '0';
        docViewer.style.maxWidth = '100%';
      }
      
      // Asegurar que el contenedor del documento tenga el tamaño correcto
      const docContainer = document.querySelector('.document-container');
      if (docContainer) {
        docContainer.style.width = '100%';
        docContainer.style.maxWidth = '210mm';
        docContainer.style.margin = '0 auto';
        docContainer.style.boxShadow = 'none';
        docContainer.style.border = 'none';
      }
    });

    // Generar PDF tamaño carta con márgenes mínimos para maximizar contenido
    const pdfBuffer = await page.pdf({
      format: 'Letter', // Tamaño carta (8.5 x 11 pulgadas)
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
      margin: {
        top: (headerTemplate ? '28mm' : '12mm'),
        right: '8mm',
        bottom: (footerTemplate ? '22mm' : '12mm'),
        left: '8mm'
      },
      scale: 0.92
    });

    await browser.close();
    browser = null;

    // Nombre del archivo
    const outputFileName = fileName || `cotizacion_${Date.now()}.pdf`;

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
    console.error('Error generando PDF de cotización:', err);
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    return res.status(500).json({ 
      error: 'No se pudo generar el PDF de cotización', 
      details: err.message 
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

    const page = await browser.newPage();
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 2
    });
    await page.emulateMediaType('print');

    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 60000
    });

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

    // Ocultar elementos no deseados
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
    });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || '',
      footerTemplate: footerTemplate || '',
      margin: {
        top: (headerTemplate ? '28mm' : '12mm'),
        right: '8mm',
        bottom: (footerTemplate ? '22mm' : '12mm'),
        left: '8mm'
      },
      scale: 0.92
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
      try { await browser.close(); } catch (_) {}
    }
    return res.status(500).json({ 
      error: 'No se pudo guardar el PDF de cotización', 
      details: err.message 
    });
  }
};
