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

    // --- ESCUDO DE SEGURIDAD: MOCK DE STORAGE ---
    // Esto evita SecurityErrors si algún script intenta acceder a sessionStorage/localStorage en Puppeteer
    await page.evaluateOnNewDocument(() => {
      try {
        const mockStorage = {};
        const storageMock = {
          getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
          setItem: (key, value) => { mockStorage[key] = String(value); },
          removeItem: (key) => { delete mockStorage[key]; },
          clear: () => { for (let key in mockStorage) delete mockStorage[key]; },
          key: (i) => Object.keys(mockStorage)[i] || null,
          get length() { return Object.keys(mockStorage).length; }
        };
        Object.defineProperty(window, 'sessionStorage', { value: storageMock, writable: true });
        Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true });
      } catch (e) { }
    });

    // Logging detallado desde el contexto de la página
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

    // 1. Leer imágenes para el header (base64)
    const readImage = async (p) => {
      try {
        const data = await fs.readFile(p);
        const ext = path.extname(p).replace('.', '');
        return `data:image/${ext};base64,${data.toString('base64')}`;
      } catch (e) {
        console.warn('Error leyendo imagen para header:', p, e.message);
        return '';
      }
    };

    const imgPath1 = path.join(__dirname, '../../public/img/andamios multidireccional.png');
    const imgPath2 = path.join(__dirname, '../../public/img/image.png');
    const imgPath3 = path.join(__dirname, '../../public/img/andamios marcocruceta.png');

    const [img1, img2, img3] = await Promise.all([
      readImage(imgPath1),
      readImage(imgPath2),
      readImage(imgPath3)
    ]);

    // 2. Construir Header Template
    // Se replican los estilos críticos de .hp-header y sus hijos.
    // Ajustamos márgenes y tamaños específicamente para el template de Puppeteer.
    const headerTemplate = `
      <style>
        html { -webkit-print-color-adjust: exact; }
        .hp-header {
          display: grid;
          grid-template-columns: 42mm 1fr 42mm;
          align-items: start;
          border-bottom: 1.5px solid #000;
          padding-bottom: 1.0mm;
          gap: 1.5mm;
          font-family: 'Inter', 'Arial', sans-serif;
          width: 100%;
          margin: 0 10mm; 
          font-size: 10px;
          height: 100%; /* Ocupar el área asignada */
          box-sizing: border-box;
        }
        .hp-header__side {
          display: grid;
          align-items: start;
          justify-items: center;
          height: 21mm;
          overflow: visible;
        }
        .hp-header__side img {
          height: 48mm; /* Ajuste para evitar overflow excesivo en margen */
          width: auto;
          max-width: 100%;
          object-fit: contain;
        }
        .hp-header__side--left img { filter: grayscale(1) contrast(1.15); }
        .hp-header__side--right img { filter: saturate(0) contrast(1.05); }
        .hp-company {
          text-align: center;
          font-size: 7.2pt;
          line-height: 1.05;
          padding: 0 2mm;
          align-self: start;
        }
        .hp-company__logo {
          display: block;
          width: 32mm;
          max-width: 100%;
          margin: 0 auto 0.6mm;
        }
        .hp-company__title { margin: 0; font-size: 11.6pt; letter-spacing: 0.5px; color: #7a1f1f; font-weight: 700; }
        .hp-company__meta { margin: 0.1mm 0 0; color: #111827; font-weight: 700; }
      </style>
      <header class="hp-header">
        <div class="hp-header__side hp-header__side--left">
          <img src="${img1}" alt="Andamios Torres" />
        </div>
        <div class="hp-company">
          <img class="hp-company__logo" src="${img2}" alt="ANDAMIOS TORRES" />
          <h1 class="hp-company__title">ANDAMIOS Y PROYECTOS TORRES S.A. DE C.V.&reg;</h1>
          <p class="hp-company__meta">VENTA-RENTA DE ANDAMIOS PARA TRABAJOS EN ALTURAS</p>
          <p class="hp-company__meta">TIPO MARCO Y CRUCETA Y/O MULTIDIRECCIONAL</p>
          <p class="hp-company__meta">ORIENTE 174 #290 COL. MOCTEZUMA 2da SECC. CDMX C.P. 15530</p>
          <p class="hp-company__meta">TELS: 55 55 71 71 05 &middot; 55 26 43 00 24 &middot; WHATSAPP 55 62 55 78 19</p>
          <p class="hp-company__meta">ventas@andamiostorres.com &middot; www.andamiostorres.com</p>
        </div>
        <div class="hp-header__side hp-header__side--right">
          <img src="${img3}" alt="Andamios Torres" />
        </div>
      </header>
    `;

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
    try { page.setDefaultNavigationTimeout(120000); } catch (_) { }

    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 120000 });

    try {
      await page.emulateMediaType('print');
    } catch (_) { }

    // 3. Inyectar CSS para ocultar el header/footer originales y ajustar layout
    try {
      await page.addStyleTag({
        content: `
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
          }
          /* Ocultar el header/footer nativos del HTML (ahora son Templates) */
          .hp-header, .hp-footer, .copy-badge { display: none !important; }
          
          /* Ajustar la 'pagina' para permitir el flujo natural */
          .page {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }

          /* BODY 1: Datos del cliente - Solo en primera página */
          /* Usamos CSS counter para rastrear páginas */
          @page {
            counter-increment: page;
          }
          
          /* Estrategia: duplicar el contenido y ocultar selectivamente */
          /* En la primera renderización, Body 1 está visible */
          /* Después del primer salto de página, se oculta */
          .hp-body1 {
            page-break-after: avoid;
            break-after: avoid;
          }
          
          /* Forzar que después de Body 1 no haya salto inmediato */
          .hp-body1 + .hp-table {
            page-break-before: avoid;
          }

          /* BODY 2: Tabla de Productos */
          .hp-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 2mm;
            margin-top: 3mm;
          }
          .hp-table thead { 
            display: table-header-group; 
          }
          .hp-table tbody tr { 
            page-break-inside: avoid; 
            break-inside: avoid;
          }
          
          /* Permitir saltos de página naturales cada ~13 filas (límite P1) */
          .hp-table tbody tr:nth-child(13) {
            page-break-after: auto;
          }
          
          /* Totales y Firmas deben ir al final del flujo, sin partirse */
          .hp-total { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
            page-break-before: avoid;
            margin-top: 5mm;
          }
          .hp-sign { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
            page-break-before: avoid;
            margin-top: 10mm;
          }
          
          /* Mantener Totales y Firmas juntos */
          .hp-total + .hp-sign {
            page-break-before: avoid !important;
          }
        `
      });
    } catch (_) { }

    await page.evaluateHandle('document.fonts.ready');

    // Esperar imágenes del contenido
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
        setTimeout(resolve, 5000);
      });
    });

    // Auto-compact + auto-fit (1 hoja A4) dentro de Puppeteer
    // IMPORTANTE: NO usar CSS transform scale para evitar PDF borroso.
    // En su lugar calculamos el scale para page.pdf({scale}) y dejamos el DOM en escala 1.
    const pdfScaleFromPage = await page.evaluate(() => {
      try {
        const pageEl = document.querySelector('#hp-document') || document.querySelector('.page');
        const innerEl = document.querySelector('#hp-inner') || pageEl;
        const tableEl = document.querySelector('#print-productos')?.closest('table') || document.querySelector('table.hp-table');
        const signEl = document.querySelector('.hp-sign');
        const footerEl = document.querySelector('.hp-footer');
        if (tableEl && pageEl && innerEl) {
          // Header/Footer estáticos. Solo compactamos tipografía del contenido.
          const modes = ['', 'hp-table--compact', 'hp-table--dense', 'hp-table--ultra', 'hp-table--micro', 'hp-table--nano', 'hp-table--pico', 'hp-table--femto'];

          const signModes = ['', 'hp-sign--compact', 'hp-sign--dense', 'hp-sign--micro'];
          const footerModes = ['', 'hp-footer--compact', 'hp-footer--dense', 'hp-footer--micro'];

          const fits = () => {
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
            if (fits()) return 1;
          }

          // Si ni con femto cabe, compactamos firmas.
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
            if (fits()) return 1;
          }

          // Si aún no cabe, calculamos el ratio necesario para page.pdf({scale})
          const pageH = pageEl.clientHeight;
          const innerH = innerEl.scrollHeight;
          const effectivePageH = Math.max(0, pageH - 28);
          if (innerH > effectivePageH) {
            const ratio = effectivePageH / innerH;
            return Math.max(0.78, Math.min(1, Number((ratio * 0.995).toFixed(3))));
          }
        }
        return 1;
      } catch (_) {
        return 1;
      }
    });

    // Consturir Footer Template (Nativo)
    const footerTemplate = `
      <style>
        html { -webkit-print-color-adjust: exact; }
        .hp-footer {
          width: 100%;
          margin: 0 10mm;
          box-sizing: border-box;
          font-family: 'Inter', 'Arial', sans-serif;
          font-size: 8px;
          text-align: center;
        }
        .hp-exp-title {
          font-weight: 700;
          color: #7a1f1f;
          letter-spacing: 0.2px;
          margin: 0;
          text-align: center;
          font-size: 8pt;
        }
        .hp-exp-row3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0;
          border-left: 1px solid #000;
          border-right: 1px solid #000;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          margin-top: 1mm;
        }
        .hp-exp-row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          border-left: 1px solid #000;
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
        }
        .hp-exp-cell {
          padding: 1mm;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hp-exp-row3 .hp-exp-cell:nth-child(2) {
          border-left: 1px solid #000;
          border-right: 1px solid #000;
        }
        .hp-exp-row2 .hp-exp-cell:first-child {
          border-right: 1px solid #000;
          text-align: left;
        }
        .hp-exp-row2 .hp-exp-cell:last-child {
          text-align: right;
        }
      </style>
      <div class="hp-footer">
        <div class="hp-exp-title">EXPEDIENTE</div>
        <div class="hp-exp-row3">
          <div class="hp-exp-cell">EMITE: COORD. VENTAS</div>
          <div class="hp-exp-cell">REVISA: RESP. GESTIÓN DE CALIDAD</div>
          <div class="hp-exp-cell">APRUEBA: SUBDIRECTOR GENERAL</div>
        </div>
        <div class="hp-exp-row2">
          <div class="hp-exp-cell">REVISIÓN: 03</div>
          <div class="hp-exp-cell">FECHA DE EMISIÓN: 21-01-2026</div>
        </div>
        <div style="font-size: 9px; text-align: right; margin-top: 2mm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      </div>
    `;

    // 4. Generar PDF con Encabezado y Footer Nativos
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate,
      footerTemplate: footerTemplate,
      margin: {
        top: '56mm',
        right: '10mm',
        bottom: '30mm',
        left: '10mm'
      },
      scale: pdfScaleFromPage || 0.92
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
    } catch (_) { }
    if (browser) {
      try { await browser.close(); } catch (_) { }
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

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) { } try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) { }

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

    const page = await browser.newPage(); try { page.setDefaultNavigationTimeout(120000); } catch (_) { } try { await page.setRequestInterception(true); page.on('request', req => { const rtype = (typeof req.resourceType === 'function') ? req.resourceType() : ''; if (rtype === 'font') return req.abort(); return req.continue(); }); } catch (_) { }
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

    // Generar nombre único
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const safeFileName = (fileName || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullFileName = `${id}_${safeFileName}`;
    const filePath = path.join(TEMP_PDF_DIR, fullFileName);

    // Guardar en disco
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);

    console.log('[PDF] Archivo temporal guardado:', filePath);

    // Limpiar después de 10 minutos
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
        console.log('[PDF] Archivo temporal eliminado:', filePath);
      } catch (e) { /* ignorar si ya no existe */ }
    }, 10 * 60 * 1000);

    // Devolver URL para acceder al PDF (archivo estático)
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
 * Servir PDF temporal (fallback si no se sirve como estático)
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
