/**
 * SERVICIO DE NOTIFICACIONES - LOGISTICA
 * Maneja email y push notifications al cliente cuando cambia el estado del pedido.
 * SMS/Twilio queda deshabilitado por decision de implementacion.
 */

class NotificacionesService {
    /**
     * SMS deshabilitado intencionalmente.
     * @param {string} numeroTelefono
     * @param {object} evento
     */
    async enviarSMS(numeroTelefono, evento) {
        console.log(
            `[SMS] Omitido para ${numeroTelefono || 'sin numero'} en estado ${evento?.estado || 'desconocido'}: Twilio deshabilitado`
        );
        return null;
    }

    /**
     * Enviar email con seguimiento.
     * @param {string} email
     * @param {object} evento
     * @param {string} urlSeguimiento
     */
    async enviarEmail(email, evento, urlSeguimiento) {
        try {
            const emailService = require('./emailService');

            const asunto = {
                en_preparacion: 'Tu pedido esta siendo preparado',
                en_camino: 'Tu pedido esta en camino',
                completado: 'Pedido entregado',
                fallido: 'Inconveniente con tu pedido'
            };

            const tituloHTML = asunto[evento.estado] || 'Actualizacion de tu pedido';
            const trackingUrl = urlSeguimiento || process.env.PUBLIC_DOMAIN || '#';

            const htmlBody = `
                <h2>${tituloHTML}</h2>
                <p>Pedido: <strong>${evento.numero_contrato || 'Sin folio'}</strong></p>
                <p>${evento.descripcion || 'Hay una actualizacion en el estado de tu pedido.'}</p>
                <p style="margin-top: 20px;">
                    <a href="${trackingUrl}" style="background-color: #1B3C5E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Ver Seguimiento
                    </a>
                </p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                    Andamios Torres - Logistica en Tiempo Real
                </p>
            `;

            await emailService.sendMail({
                to: email,
                subject: asunto[evento.estado] || 'Actualizacion de tu pedido',
                html: htmlBody
            });

            console.log(`[Email] Enviado a ${email}`);
            return true;
        } catch (error) {
            console.error('[Email Error]', error.message);
            return false;
        }
    }

    /**
     * Guardar suscripcion Web Push para navegador.
     * @param {object} clienteInfo
     */
    async guardarSuscripcionPush(clienteInfo) {
        try {
            const db = require('../config/database');

            const { rows } = await db.query(
                `INSERT INTO cliente_push_subscriptions (cliente_id, endpoint, p256dh, auth, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (endpoint) DO UPDATE SET
                    cliente_id = EXCLUDED.cliente_id,
                    p256dh = EXCLUDED.p256dh,
                    auth = EXCLUDED.auth,
                    user_agent = EXCLUDED.user_agent,
                    activa = true,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [
                    clienteInfo.cliente_id,
                    clienteInfo.push_subscription.endpoint,
                    clienteInfo.push_subscription.keys.p256dh,
                    clienteInfo.push_subscription.keys.auth,
                    clienteInfo.user_agent
                ]
            );

            console.log('[Push] Suscripcion guardada:', rows[0].id);
            return rows[0].id;
        } catch (error) {
            console.error('[Push Error]', error.message);
            return null;
        }
    }

    /**
     * Enviar Web Push Notification.
     * @param {number|string} clienteId
     * @param {object} evento
     * @param {string} urlSeguimiento
     */
    async enviarPush(clienteId, evento, urlSeguimiento = null) {
        try {
            const db = require('../config/database');
            let webpush;

            try {
                webpush = require('web-push');
            } catch (dependencyError) {
                console.warn('[Push] Dependencia web-push no instalada:', dependencyError.message);
                return null;
            }

            if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                let vapidSubject = process.env.VAPID_SUBJECT || 'mailto:info@andamiostorres.com';
                let vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim();
                let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
                
                // Validar y ajustar formato del VAPID_SUBJECT
                if (!vapidSubject.startsWith('mailto:') && !vapidSubject.startsWith('https://')) {
                    vapidSubject = `mailto:${vapidSubject}`;
                    console.log('[Push] VAPID_SUBJECT ajustado a:', vapidSubject);
                }
                
                // Validar que las claves no estén vacías
                if (!vapidPublicKey) {
                    console.warn('[Push] VAPID_PUBLIC_KEY no configurada');
                    return null;
                }
                
                if (!vapidPrivateKey) {
                    console.warn('[Push] VAPID_PRIVATE_KEY no configurada');
                    return null;
                }
                
                try {
                    webpush.setVapidDetails(
                        vapidSubject,
                        vapidPublicKey,
                        vapidPrivateKey
                    );
                    console.log('[Push] VAPID configurado correctamente');
                } catch (vapidError) {
                    console.warn('[Push] Error configurando VAPID:', vapidError.message);
                    console.warn('[Push] Verifica que VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY sean válidas.');
                    return null;
                }
            } else {
                console.warn('[Push] VAPID keys no configuradas. Configura VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env');
                return null;
            }

            const { rows: suscripciones } = await db.query(
                `SELECT endpoint, p256dh, auth
                 FROM cliente_push_subscriptions
                 WHERE cliente_id = $1 AND activa = true`,
                [clienteId]
            );

            if (suscripciones.length === 0) {
                console.log('[Push] Sin suscripciones activas para cliente:', clienteId);
                return null;
            }

            const notificacion = {
                title: {
                    en_camino: 'Tu pedido esta en camino',
                    completado: 'Pedido entregado',
                    fallido: 'Problema con tu pedido'
                }[evento.estado] || 'Actualizacion de pedido',
                body: evento.descripcion,
                icon: '/assets/images/LOGO_ANDAMIOS_02.png',
                badge: '/assets/images/badge-36x36.png',
                tag: `pedido-${evento.numero_contrato || clienteId}`,
                requireInteraction: evento.estado === 'fallido',
                url: urlSeguimiento || process.env.PUBLIC_DOMAIN || '/seguimiento_cliente.html'
            };

            const resultados = await Promise.allSettled(
                suscripciones.map((sub) => {
                    const subscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    };
                    return webpush.sendNotification(subscription, JSON.stringify(notificacion));
                })
            );

            console.log(`[Push] Enviado a ${suscripciones.length} suscripciones`);
            return resultados;
        } catch (error) {
            console.error('[Push Error]', error.message);
            return null;
        }
    }

    /**
     * Orquestar notificaciones cuando cambia un evento de seguimiento.
     * @param {object} evento
     * @param {object} clienteInfo
     */
    async notificarCambioEstado(evento, clienteInfo) {
        console.log(`[Notificaciones] Procesando cambio de estado: ${evento.estado}`);

        try {
            if (clienteInfo.telefono) {
                await this.enviarSMS(clienteInfo.telefono, evento);
            }

            if (clienteInfo.email) {
                await this.enviarEmail(
                    clienteInfo.email,
                    evento,
                    clienteInfo.urlSeguimientoPublico
                );
            }

            if (clienteInfo.cliente_id) {
                await this.enviarPush(
                    clienteInfo.cliente_id,
                    evento,
                    clienteInfo.urlSeguimientoPublico
                );
            }
        } catch (error) {
            console.error('[Notificaciones Error]', error);
        }
    }
}

module.exports = new NotificacionesService();
