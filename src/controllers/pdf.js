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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
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
