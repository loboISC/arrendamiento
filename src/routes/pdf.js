const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdf');

// Guardar PDF de contrato
router.post('/contrato', pdfController.guardarPdfContrato);

// Guardar PDF de nota
router.post('/nota', pdfController.guardarPdfNota);

// Guardar ambos PDFs
router.post('/ambos', pdfController.guardarAmbospdfs);

// Endpoint de prueba: generar PDF desde plantilla pública y devolver inline
router.get('/generar/reporte-test', pdfController.generarReporteTest);

// Generar PDF de cotización desde HTML (devuelve el PDF directamente)
router.post('/generar/cotizacion', pdfController.generarCotizacionPdf);

// Guardar PDF de cotización en el servidor
router.post('/guardar/cotizacion', pdfController.guardarCotizacionPdf);

// Ver PDF en el navegador (sin forzar descarga)
router.get('/ver/:fileName', pdfController.verPdf);

// Descargar PDF
router.get('/descargar/:fileName', pdfController.descargarPdf);

module.exports = router;
