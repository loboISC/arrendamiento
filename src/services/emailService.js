const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const { descifrarContrasena } = require('../utils/smtpEncryption');

class EmailService {
    constructor() {
        // Transportador por defecto (fallback)
        this.defaultTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.hostinger.com',
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER || 'sistemas@andamiostorres.com',
                pass: process.env.SMTP_PASSWORD || 'Sistemas_2025!'
            }
        });

        // Caché de transportadores dinámicos
        this.transporters = new Map();
    }

    /**
     * Obtiene un transportador basado en la configuración SMTP
     * @param {Object} config - Objeto con host, puerto, usa_ssl, usuario, contrasena, correo_from
     */
    getTransporter(config) {
        if (!config || !config.host || !config.usuario || !config.contrasena) {
            return this.defaultTransporter;
        }

        const cacheKey = `${config.host}:${config.puerto}:${config.usuario}:${config.contrasena}`;
        if (this.transporters.has(cacheKey)) {
            return this.transporters.get(cacheKey);
        }

        const contrasena_plana = descifrarContrasena(config.contrasena);

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.puerto || 465,
            secure: config.usa_ssl !== false,
            auth: {
                user: config.usuario,
                pass: contrasena_plana
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        this.transporters.set(cacheKey, transporter);
        return transporter;
    }

    async sendMail(mailOptions, smtpConfig = null) {
        try {
            const transporter = this.getTransporter(smtpConfig);
            const from = smtpConfig?.correo_from || smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';

            const info = await transporter.sendMail({
                from: from,
                ...mailOptions
            });
            console.log('Email sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    async enviarFactura(destinatario, asunto, mensaje, rutaPDF, rutaXML = null, smtpConfig = null) {
        try {
            // Verificar que el archivo PDF existe
            if (!fs.existsSync(rutaPDF)) {
                throw new Error('El archivo PDF no existe');
            }

            const transporter = this.getTransporter(smtpConfig);
            const from = smtpConfig?.correo_from || smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';

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
                from: from,
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

            const info = await transporter.sendMail(mailOptions);
            console.log('Factura enviada OK:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando email de factura:', error);
            throw error;
        }
    }

    async enviarComprobanteAbono(destinatario, asunto, contenido, rutaPDF, nombrePDF = 'comprobante-abono.pdf', smtpConfig = null) {
        try {
            // Verificar que el archivo PDF existe
            if (!fs.existsSync(rutaPDF)) {
                throw new Error('El archivo PDF del comprobante no existe');
            }

            const transporter = this.getTransporter(smtpConfig);
            const from = smtpConfig?.correo_from || smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';

            const attachments = [
                {
                    filename: nombrePDF,
                    path: rutaPDF,
                    contentType: 'application/pdf'
                }
            ];

            const mailOptions = {
                from: from,
                to: destinatario,
                subject: asunto,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e3e8ef; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <div style="padding: 30px; background: #ffffff;">
                            <h2 style="color: #232323; margin-top: 0; font-size: 22px; border-bottom: 3px solid #10b981; padding-bottom: 10px;">
                                <i style="color: #10b981;">✓</i> Comprobante de Abono
                            </h2>
                            
                            <div style="color: #4b5563; line-height: 1.8; font-size: 15px; margin-top: 20px;">
                                ${contenido}
                            </div>
                            
                            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
                                <p style="margin: 0; color: #047857; font-size: 14px; font-weight: 600;">
                                    ✓ Comprobante de pago adjunto
                                </p>
                                <p style="margin: 8px 0 0 0; color: #059669; font-size: 13px;">
                                    El comprobante en PDF se encuentra adjunto a este correo.
                                </p>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 13px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                Cualquier pregunta o aclaración sobre este comprobante, favor de contactar al departamento de cobranza.
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

            const info = await transporter.sendMail(mailOptions);
            console.log('Comprobante de abono enviado OK:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando comprobante de abono por email:', error);
            throw error;
        }
    }

    // Método para probar la conexión por defecto
    async verificarConexion() {
        try {
            await this.defaultTransporter.verify();
            return true;
        } catch (error) {
            console.error('Error verificando conexión de email:', error);
            return false;
        }
    }
}

module.exports = new EmailService(); 