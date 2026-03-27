const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const { descifrarContrasena } = require('../../utils/smtpEncryption');

class EmailService {
    constructor() {
        // Transportador por defecto (fallback)
        const defaultPort = parseInt(process.env.SMTP_PORT) || 465;
        this.defaultTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.hostinger.com',
            port: defaultPort,
            secure: defaultPort === 465,
            auth: {
                user: process.env.SMTP_USER || 'sistemas@andamiostorres.com',
                pass: process.env.SMTP_PASSWORD || 'Sistemas_2025!'
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });

        // Caché de transportadores dinámicos
        this.transporters = new Map();
    }

    /**
     * Obtiene un transportador basado en la configuración SMTP
     * @param {Object} config - Objeto con host, puerto, usa_ssl, usuario, contrasena, correo_from
     */
    getTransporter(config = null) {
        console.log(`[EmailService:getTransporter] Evaluando config SMTP...`);
        if (!config || !config.host) {
            console.log(`[EmailService:getTransporter] No hay config, usando defaultTransporter.`);
            return this.defaultTransporter;
        }

        const cacheKey = `${config.host}:${config.puerto}:${config.usuario}:${config.contrasena}`;
        if (this.transporters.has(cacheKey)) {
            console.log(`[EmailService:getTransporter] Retornando transporter desde CACHE para ${config.usuario}.`);
            return this.transporters.get(cacheKey);
        }

        console.log(`[EmailService:getTransporter] Creando NUEVO transporter para ${config.usuario}...`);
        try {
            const host = String(config.host).trim();
            const usuario = String(config.usuario).trim();
            // Diagnóstico profundo del objeto config
            const keys = Object.keys(config || {});
            console.log(`[EmailService:getTransporter] Objeto config tiene llaves: [${keys.join(', ')}]`);

            if (!config.contrasena) {
                console.error(`[EmailService:getTransporter] ❌ ERROR: El campo 'contrasena' no existe en el objeto config.`);
                throw new Error('Configuración SMTP incompleta: falta la contraseña en el objeto recibido.');
            }

            // NO USAR .trim() en la contraseña cifrada, puede corromper el payload
            const contrasena_plana = descifrarContrasena(String(config.contrasena));

            if (contrasena_plana.includes(':')) {
                console.error(`[EmailService:getTransporter] ❌ ERROR: Descifrado fallido. La cadena sigue teniendo formato 'iv:data'.`);
                console.error(`[EmailService:getTransporter] Esto indica que la llave CSD_ENCRYPT_KEY no coincide con la usada al guardar.`);
            } else {
                console.log(`[EmailService:getTransporter] Descifrado aparententemente OK.`);
                // Loguear solo el inicio para seguridad
                console.log(`[EmailService:getTransporter] Inicio pass: ${contrasena_plana.substring(0, 2)}... (Longitud: ${contrasena_plana.length})`);
            }

            const transporter = nodemailer.createTransport({
                host: host,
                port: config.puerto || 465,
                secure: config.usa_ssl !== false,
                auth: {
                    user: usuario,
                    pass: contrasena_plana
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 15000,
                greetingTimeout: 10000,
                socketTimeout: 20000
            });

            this.transporters.set(cacheKey, transporter);
            console.log(`[EmailService:getTransporter] Nuevo transporter creado y guardado en caché.`);
            return transporter;
        } catch (err) {
            console.error(`❌ [EmailService:getTransporter] ERROR:`, err);
            throw err;
        }
    }

    async sendMail(mailOptions, smtpConfig = null) {
        try {
            const transporter = this.getTransporter(smtpConfig);
            const senderEmail = smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';
            const fromName = (smtpConfig?.correo_from && smtpConfig.correo_from !== senderEmail) ? smtpConfig.correo_from : 'Andamios Torres';
            const from = `"${fromName}" <${senderEmail}>`;

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
            const senderEmail = smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';
            const fromName = (smtpConfig?.correo_from && smtpConfig.correo_from !== senderEmail) ? smtpConfig.correo_from : 'Andamios Torres';
            const from = `"${fromName}" <${senderEmail}>`;

            const bannerPath = path.join(process.cwd(), 'public/assets/images/FACTURAS CUERPO DE PRESENTACIO.png.jpeg');
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
                bcc: senderEmail,
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
            const senderEmail = smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';
            const fromName = (smtpConfig?.correo_from && smtpConfig.correo_from !== senderEmail) ? smtpConfig.correo_from : 'Andamios Torres';
            const from = `"${fromName}" <${senderEmail}>`;

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
                bcc: senderEmail,
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
            console.log(`[SMTP_DEBUG] Abono enviado. BCC usado: ${mailOptions.bcc}`);
            console.log('Comprobante de abono enviado OK:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando comprobante de abono por email:', error);
            throw error;
        }
    }

    async enviarEncuesta(destinatario, asunto, clienteNombre, url, smtpConfig = null) {
        try {
            console.log(`\n⏳ [EmailService:enviarEncuesta] INICIO para ${destinatario}...`);
            const transporter = this.getTransporter(smtpConfig);

            console.log(`[EmailService:enviarEncuesta] Configurando opciones del correo...`);
            const senderEmail = smtpConfig?.usuario || process.env.SMTP_USER || 'sistemas@andamiostorres.com';
            const fromDisplayName = 'Andamios Torres';
            const from = `"${fromDisplayName}" <${senderEmail}>`;
            const bannerPath = path.join(process.cwd(), 'public/assets/images/Banne-ESC.jpeg');

            console.log(`[EmailService:enviarEncuesta] Verificando banner en: ${bannerPath}`);
            const attachments = [];
            if (fs.existsSync(bannerPath)) {
                console.log(`[EmailService:enviarEncuesta] Banner encontrado.`);
                attachments.push({
                    filename: 'banner.jpeg',
                    path: bannerPath,
                    cid: 'banner_andamios'
                });
            } else {
                console.log(`[EmailService:enviarEncuesta] ⚠️ Banner NO encontrado.`);
            }

            console.log(`[EmailService:enviarEncuesta] Opciones configuradas. Armando HTML...`);

            const mailOptions = {
                from: from,
                to: destinatario,
                bcc: senderEmail,
                subject: asunto || 'Encuesta de Satisfacción - Andamios Torres',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e3e8ef; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <div style="text-align: center; background-color: #000000;">
                            <img src="cid:banner_andamios" alt="Andamios Torres" style="width: 100%; max-width: 600px; display: block;">
                        </div>
                        
                        <div style="padding: 30px; background: #ffffff;">
                            <h2 style="color: #232323; margin-top: 0; font-size: 22px; border-bottom: 2px solid #2979ff; padding-bottom: 10px;">Encuesta de Satisfacción</h2>
                            
                            <p style="color: #4b5563; line-height: 1.6; font-size: 16px; margin-top: 20px;">
                                Hola <strong>${clienteNombre}</strong>,
                            </p>
                            
                            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
                                En <strong>Andamios Torres</strong> nos importa mucho tu opinión. Te invitamos a completar nuestra encuesta de satisfacción para ayudarnos a mejorar nuestro servicio. Te tomará menos de 2 minutos.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${url}" style="background-color: #2979ff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Responder Encuesta</a>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:<br>
                                <a href="${url}" style="color: #2979ff; word-break: break-all;">${url}</a>
                            </p>
                        </div>
                        
                        <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e3e8ef;">
                            <p style="margin: 0; font-weight: 600;">© 2025 Andamios Torres S.A. de C.V.</p>
                            <p style="margin: 5px 0 0 0;">Este es un correo automático para fines de mejora continua.</p>
                        </div>
                    </div>
                `,
                attachments: attachments
            };

            console.log(`📤 [EmailService:enviarEncuesta] Invocando transporter.sendMail()... ESTE ES EL PASO CRÍTICO`);
            try {
                const info = await transporter.sendMail(mailOptions);
                console.log(`✅ [EmailService:enviarEncuesta] sendMail() finalizado. ID: ${info.messageId}`);
                return { success: true, messageId: info.messageId };
            } catch (smtpErr) {
                const failedUser = transporter.transporter?.auth?.user || transporter.options?.auth?.user || 'Desconocido';
                const passStart = transporter.options?.auth?.pass ? String(transporter.options.auth.pass).substring(0, 2) : '??';
                const isHex = transporter.options?.auth?.pass?.includes(':');

                console.error(`❌ [EmailService:enviarEncuesta] Falló autenticación SMTP para el usuario: ${failedUser}`);
                throw new Error(`Fallo SMTP (Usuario: ${failedUser} | InicioPass: ${passStart} | Cifrado: ${isHex}). Detalle: ${smtpErr.message}`);
            }
        } catch (error) {
            console.error(`❌ [EmailService:enviarEncuesta] Excepción atrapada:`, error);
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