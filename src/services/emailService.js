const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
    async sendMail(mailOptions) {
        try {
            const info = await this.transporter.sendMail({
                from: process.env.EMAIL_USER || 'sistemas@andamiostorres.com',
                ...mailOptions
            });
            console.log('Email sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    constructor() {
        // Configuración del transportador de email
        // En producción, usar variables de entorno
        this.transporter = nodemailer.createTransport({
            host: 'smtp-mail.outlook.com', // Servidor SMTP de Outlook
            port: 587,
            secure: false, // true para 465, false para otros puertos
            auth: {
                user: process.env.EMAIL_USER || 'sistemas@andamiostorres.com',
                pass: process.env.EMAIL_PASS || 'Sistemas_2025!'
            }
        });
    }

    async enviarFactura(destinatario, asunto, mensaje, rutaPDF, rutaXML = null) {
        try {
            // Verificar que el archivo PDF existe
            if (!fs.existsSync(rutaPDF)) {
                throw new Error('El archivo PDF no existe');
            }

            const bannerPath = path.join(__dirname, '../../public/img/FACTURAS CUERPO DE PRESENTACIO.png.jpeg');
            const attachments = [
                {
                    filename: path.basename(rutaPDF),
                    path: rutaPDF,
                    contentType: 'application/pdf'
                }
            ];

            if (rutaXML && fs.existsSync(rutaXML)) {
                attachments.push({
                    filename: path.basename(rutaXML),
                    path: rutaXML,
                    contentType: 'application/xml'
                });
            }

            // Agregar el banner como CID para incrustación
            if (fs.existsSync(bannerPath)) {
                attachments.push({
                    filename: 'banner.jpeg',
                    path: bannerPath,
                    cid: 'banner_andamios' // ID para referenciar en el HTML
                });
            }

            const mailOptions = {
                from: process.env.EMAIL_USER || 'sistemas@andamiostorres.com',
                to: destinatario,
                subject: asunto,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e3e8ef; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <!-- Banner con CID -->
                        <div style="text-align: center; background-color: #000000;">
                            <img src="cid:banner_andamios" alt="Andamios Torres" style="width: 100%; max-width: 600px; display: block;">
                        </div>
                        
                        <div style="padding: 30px; background: #ffffff;">
                            <h2 style="color: #232323; margin-top: 0; font-size: 22px; border-bottom: 2px solid #2979ff; padding-bottom: 10px;">Facturación Electrónica</h2>
                            
                            <div style="color: #4b5563; line-height: 1.6; font-size: 16px; margin-top: 20px;">
                                ${mensaje ? mensaje.replace(/\n/g, '<br>') : 'Le informamos que su factura se encuentra lista y adjunta a este correo electrónico.'}
                            </div>
                            
                            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2979ff;">
                                <p style="margin: 0; color: #1e293b; font-size: 14px;">
                                    <strong>Documentos adjuntos:</strong><br>
                                    • Comprobante Fiscal Digital (PDF)<br>
                                    • Archivo estructurado (XML)
                                </p>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                Si tiene alguna duda con respecto a su facturación, por favor póngase en contacto con nuestro departamento administrativo.
                            </p>
                        </div>
                        
                        <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e3e8ef;">
                            <p style="margin: 0; font-weight: 600;">© 2025 Andamios Torres S.A. de C.V.</p>
                            <p style="margin: 5px 0 0 0;">Este es un correo automático, por favor no responda a este mensaje.</p>
                        </div>
                    </div>
                `,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Factura enviada OK:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando email de factura:', error);
            throw error;
        }
    }

    // Método para probar la conexión
    async verificarConexion() {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error('Error verificando conexión de email:', error);
            return false;
        }
    }
}

module.exports = new EmailService(); 