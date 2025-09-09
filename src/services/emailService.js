const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
    constructor() {
        // Configuración del transportador de email
        // En producción, usar variables de entorno
        this.transporter = nodemailer.createTransport({
            host: 'smtp-mail.outlook.com', // Servidor SMTP de Outlook
            port: 587,
            secure: false, // true para 465, false para otros puertos
            auth: {
                user: process.env.EMAIL_USER || 'sistemas@andamiostorres.com',
                pass: process.env.EMAIL_PASS || 'tu-password-app'
            }
        });
    }

    async enviarFactura(destinatario, asunto, mensaje, rutaPDF) {
        try {
            // Verificar que el archivo PDF existe
            if (!fs.existsSync(rutaPDF)) {
                throw new Error('El archivo PDF no existe');
            }

            const mailOptions = {
                from: process.env.EMAIL_USER || 'sistemas@andamiostorres.com',
                to: destinatario,
                subject: asunto,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #2979ff; color: white; padding: 20px; text-align: center;">
                            <h1 style="margin: 0;">ScaffoldPro</h1>
                            <p style="margin: 10px 0 0 0;">Facturación Electrónica</p>
                        </div>
                        
                        <div style="padding: 20px; background: #f9f9f9;">
                            <h2 style="color: #333; margin-bottom: 15px;">Factura Electrónica</h2>
                            <p style="color: #666; line-height: 1.6;">
                                ${mensaje || 'Adjunto encontrará su factura electrónica correspondiente.'}
                            </p>
                            
                            <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #333;">
                                    <strong>Importante:</strong> Esta factura es válida ante el SAT y contiene todos los elementos fiscales requeridos.
                                </p>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                Si tiene alguna pregunta, no dude en contactarnos.
                            </p>
                        </div>
                        
                        <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                            <p style="margin: 0;">© 2024 ScaffoldPro. Todos los derechos reservados.</p>
                        </div>
                    </div>
                `,
                attachments: [
                    {
                        filename: path.basename(rutaPDF),
                        path: rutaPDF,
                        contentType: 'application/pdf'
                    }
                ]
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email enviado:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando email:', error);
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