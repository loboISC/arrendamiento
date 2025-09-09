const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class PDFService {
    constructor() {
        this.doc = null;
    }

    async generarPDFFactura(facturaData) {
        return new Promise(async (resolve, reject) => {
            try {
                // Crear documento PDF
                this.doc = new PDFDocument({
                    size: 'A4',
                    margins: {
                        top: 30,
                        bottom: 30,
                        left: 30,
                        right: 30
                    }
                });

                const buffers = [];
                this.doc.on('data', buffers.push.bind(buffers));
                this.doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Generar contenido del PDF
                await this.generarContenidoPDF(facturaData);

                this.doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    async generarContenidoPDF(facturaData) {
        const { emisor, receptor, conceptos, totales, cfdiInfo } = facturaData;

        // Header con logo y datos del emisor
        await this.generarHeader(emisor);
        
        // Información del CFDI (lado derecho)
        this.generarInfoCFDI(cfdiInfo);
        
        // Datos del receptor
        this.generarDatosReceptor(receptor);
        
        // Tabla de conceptos
        this.generarTablaConceptos(conceptos);
        
        // Totales e impuestos
        this.generarTotales(totales);
        
        // Información de pago
        this.generarInfoPago(totales);
        
        // Pie de página con sellos digitales
        await this.generarPiePagina(cfdiInfo);
    }

    async generarHeader(emisor) {
        // Logo (si existe)
        try {
            const logoPath = path.join(__dirname, '../../public/img/logo-demo.jpg');
            if (fs.existsSync(logoPath)) {
                this.doc.image(logoPath, 30, 30, { width: 80 });
            }
        } catch (error) {
            console.log('Logo no encontrado, continuando sin logo');
        }

        // Título principal
        this.doc.fontSize(18).font('Helvetica-Bold').text('FACTURA ELECTRÓNICA', 120, 35);
        this.doc.fontSize(12).font('Helvetica').text('CFDI 4.0', 120, 55);

        // Información del emisor (lado izquierdo)
        this.doc.fontSize(11).font('Helvetica-Bold').text('EMISOR:', 30, 100);
        this.doc.fontSize(9).font('Helvetica');
        this.doc.text(`RFC: ${emisor.rfc}`, 30, 120);
        this.doc.text(`Razón Social: ${emisor.razonSocial}`, 30, 135);
        this.doc.text(`Régimen Fiscal: ${emisor.regimenFiscal}`, 30, 150);
        this.doc.text(`Código Postal: ${emisor.codigoPostal}`, 30, 165);
    }

    generarInfoCFDI(cfdiInfo) {
        // Información del CFDI (lado derecho)
        this.doc.fontSize(11).font('Helvetica-Bold').text('INFORMACIÓN CFDI:', 350, 100);
        this.doc.fontSize(8).font('Helvetica');
        this.doc.text(`UUID: ${cfdiInfo.uuid}`, 350, 120);
        this.doc.text(`Fecha de Emisión: ${cfdiInfo.fechaEmision}`, 350, 135);
        this.doc.text(`Folio Fiscal: ${cfdiInfo.uuid}`, 350, 150);
        this.doc.text(`Certificado SAT: ${cfdiInfo.certificadoSAT}`, 350, 165);
        this.doc.text(`Emisor Certificado: ${cfdiInfo.noCertificadoEmisor}`, 350, 180);
    }

    generarDatosReceptor(receptor) {
        this.doc.fontSize(11).font('Helvetica-Bold').text('RECEPTOR:', 30, 200);
        this.doc.fontSize(9).font('Helvetica');
        this.doc.text(`RFC: ${receptor.rfc}`, 30, 220);
        this.doc.text(`Nombre/Razón Social: ${receptor.nombre}`, 30, 235);
        this.doc.text(`Régimen Fiscal: ${receptor.regimenFiscal}`, 30, 250);
        this.doc.text(`Código Postal: ${receptor.codigoPostal}`, 30, 265);
        this.doc.text(`Uso CFDI: ${receptor.usoCfdi}`, 30, 280);
    }

    generarTablaConceptos(conceptos) {
        // Encabezados de la tabla
        const startY = 320;
        const headers = ['Cantidad', 'Clave ProdServ', 'Descripción', 'Valor Unit.', 'Importe'];
        const widths = [50, 80, 200, 70, 70];

        // Dibujar encabezados
        this.doc.fontSize(9).font('Helvetica-Bold');
        let x = 30;
        headers.forEach((header, index) => {
            this.doc.text(header, x, startY);
            x += widths[index];
        });

        // Línea separadora
        this.doc.moveTo(30, startY + 15).lineTo(470, startY + 15).stroke();

        // Contenido de la tabla
        this.doc.fontSize(8).font('Helvetica');
        let currentY = startY + 25;

        conceptos.forEach((concepto, index) => {
            if (currentY > 600) {
                // Nueva página si no hay espacio
                this.doc.addPage();
                currentY = 50;
            }

            x = 30;
            this.doc.text(concepto.cantidad.toString(), x, currentY);
            x += widths[0];
            
            this.doc.text(concepto.claveProductoServicio, x, currentY);
            x += widths[1];
            
            // Descripción con wrap de texto
            const descLines = this.wrapText(concepto.descripcion, widths[2] - 10);
            this.doc.text(descLines[0], x, currentY);
            if (descLines.length > 1) {
                this.doc.text(descLines[1], x, currentY + 12);
            }
            x += widths[2];
            
            this.doc.text(`$${concepto.valorUnitario.toFixed(2)}`, x, currentY);
            x += widths[3];
            
            this.doc.text(`$${concepto.importe.toFixed(2)}`, x, currentY);

            currentY += 25;
        });
    }

    generarTotales(totales) {
        const startY = 650;
        
        this.doc.fontSize(11).font('Helvetica-Bold');
        this.doc.text('TOTALES:', 350, startY);
        
        this.doc.fontSize(9).font('Helvetica');
        this.doc.text(`Subtotal: $${totales.subtotal.toFixed(2)}`, 350, startY + 20);
        this.doc.text(`IVA (16%): $${totales.iva.toFixed(2)}`, 350, startY + 35);
        this.doc.text(`Total: $${totales.total.toFixed(2)}`, 350, startY + 50);
    }

    generarInfoPago(totales) {
        const startY = 720;
        
        this.doc.fontSize(9).font('Helvetica');
        this.doc.text(`Forma de Pago: ${totales.formaPago}`, 30, startY);
        this.doc.text(`Método de Pago: ${totales.metodoPago}`, 30, startY + 15);
    }

    async generarPiePagina(cfdiInfo) {
        // Generar código QR
        const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${cfdiInfo.uuid}&re=${cfdiInfo.rfcEmisor}&rr=${cfdiInfo.rfcReceptor}&tt=${cfdiInfo.total}&fe=${cfdiInfo.selloDigital.substring(0, 8)}`;
        
        try {
            const qrCodeDataURL = await QRCode.toDataURL(qrData, {
                width: 80,
                margin: 1
            });
            
            // Convertir data URL a buffer
            const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
            const qrBuffer = Buffer.from(base64Data, 'base64');
            
            // Agregar código QR al PDF (lado izquierdo)
            this.doc.image(qrBuffer, 30, 750, { width: 80 });
            
        } catch (error) {
            console.error('Error generando código QR:', error);
        }

        // Sellos digitales (lado derecho)
        this.doc.fontSize(8).font('Helvetica-Bold');
        this.doc.text('Sello Digital del CFDI:', 200, 750);
        this.doc.fontSize(6).font('Helvetica');
        this.doc.text(cfdiInfo.selloDigital, 200, 765, { width: 250 });
        
        this.doc.fontSize(8).font('Helvetica-Bold');
        this.doc.text('Sello SAT:', 200, 800);
        this.doc.fontSize(6).font('Helvetica');
        this.doc.text(cfdiInfo.selloSAT, 200, 815, { width: 250 });
        
        this.doc.fontSize(8).font('Helvetica-Bold');
        this.doc.text('Cadena Original del Complemento de Certificación Digital del SAT:', 200, 850);
        this.doc.fontSize(6).font('Helvetica');
        this.doc.text(`||1.1|${cfdiInfo.uuid} ${cfdiInfo.fechaTimbrado} ${cfdiInfo.rfcEmisor}|${cfdiInfo.selloDigital}|${cfdiInfo.certificadoSAT}||`, 200, 865, { width: 250 });

        // Información adicional
        this.doc.fontSize(8).font('Helvetica');
        this.doc.text('Este documento es una representación impresa de un CFDI', 200, 900);
        this.doc.text('Para verificar la autenticidad, visita: https://verificacfdi.facturaelectronica.sat.gob.mx', 200, 910);
        this.doc.text('Documento generado automáticamente por ScaffoldPro', 200, 920);
    }

    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.doc.widthOfString(currentLine + ' ' + word);
            
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        lines.push(currentLine);
        return lines;
    }

    // Método para guardar PDF en archivo
    async guardarPDF(facturaData, nombreArchivo) {
        try {
            const pdfBuffer = await this.generarPDFFactura(facturaData);
            const rutaArchivo = path.join(__dirname, '../../pdfs', nombreArchivo);
            
            // Crear directorio si no existe
            const dir = path.dirname(rutaArchivo);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(rutaArchivo, pdfBuffer);
            return rutaArchivo;
        } catch (error) {
            throw new Error(`Error guardando PDF: ${error.message}`);
        }
    }
}

module.exports = PDFService; 