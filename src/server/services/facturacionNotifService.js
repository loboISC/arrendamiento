/**
 * facturacionNotifService.js
 * Helper fire-and-forget para crear notificaciones de eventos de facturación.
 * NO interrumpe el flujo principal: todos los errores se capturan y logean.
 *
 * También envía Web Push al navegador/celular si VAPID_PUBLIC_KEY está configurado.
 */
'use strict';

const db = require('../config/database');

/* ─── Web-push (opcional) ─── */
let webpush = null;
let vapidReady = false;
(function initVapid() {
    try {
        const pubKey  = process.env.VAPID_PUBLIC_KEY?.trim();
        const privKey = process.env.VAPID_PRIVATE_KEY?.trim();
        const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:info@andamiostorres.com';
        if (!pubKey || !privKey) return;
        webpush = require('web-push');
        webpush.setVapidDetails(
            subject.startsWith('mailto:') || subject.startsWith('https://') ? subject : `mailto:${subject}`,
            pubKey,
            privKey
        );
        vapidReady = true;
        console.log('[FacNotif] VAPID listo para push de facturación');
    } catch (e) {
        console.warn('[FacNotif] VAPID no disponible:', e.message);
    }
})();

/**
 * Enviar Web Push a suscripciones de usuarios internos del sistema
 * que tengan suscripción activa en user_push_subscriptions.
 */
async function enviarPushInterno({ titulo, cuerpo, icono = '/assets/images/LOGO_ANDAMIOS_02.png', tag }) {
    if (!vapidReady || !webpush) return;
    try {
        const { rows } = await db.query(
            `SELECT endpoint, p256dh, auth
             FROM user_push_subscriptions
             WHERE activa = true`,
            []
        );
        if (!rows.length) return;
        const payload = JSON.stringify({ title: titulo, body: cuerpo, icon: icono, tag });
        await Promise.allSettled(
            rows.map((sub) =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                )
            )
        );
        console.log(`[FacNotif] Push enviado a ${rows.length} suscripción(es)`);
    } catch (e) {
        console.warn('[FacNotif] Error enviando push:', e.message);
    }
}

/**
 * Crear notificación de evento de facturación.
 *
 * @param {object} opts
 * @param {string}  opts.tipo               Ej. 'FACTURA_TIMBRADA'
 * @param {string}  opts.mensaje            Texto legible del evento
 * @param {string}  [opts.modulo]           'facturacion' | 'notas_credito' | 'reportes'
 * @param {string}  [opts.referencia_tipo]  'factura' | 'nota_credito' | 'reporte'
 * @param {string}  [opts.referencia_id]    UUID o ID del registro
 * @param {number}  [opts.id_usuario_accion] ID del usuario que ejecutó la acción
 * @param {object}  [opts.metadata]         Datos extra {folio, total, cliente, rfc}
 * @param {string}  [opts.prioridad]        'Alta' | 'Normal' | 'Baja'
 */
async function crearNotificacion(opts = {}) {
    const {
        tipo              = 'INFO',
        mensaje           = '',
        modulo            = 'facturacion',
        referencia_tipo   = null,
        referencia_id     = null,
        id_usuario_accion = null,
        metadata          = null,
        prioridad         = 'Normal',
    } = opts;

    if (!mensaje) return;

    try {
        await db.query(
            `INSERT INTO notificaciones
               (tipo, mensaje, modulo, referencia_tipo, referencia_id,
                id_usuario_accion, metadata, prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                tipo,
                mensaje,
                modulo,
                referencia_tipo,
                referencia_id     ? String(referencia_id)      : null,
                id_usuario_accion ? Number(id_usuario_accion)  : null,
                metadata          ? JSON.stringify(metadata)   : null,
                prioridad,
            ]
        );
    } catch (err) {
        console.warn('[FacNotif] Error insertando notificación:', err.message);
        return; // fire-and-forget: no lanzar
    }

    // Intentar enviar push al navegador/celular (best-effort)
    const tagMap = {
        FACTURA_TIMBRADA:     'factura-timbrada',
        FACTURA_CANCELADA:    'factura-cancelada',
        COMPLEMENTO_TIMBRADO: 'complemento-pago',
        NC_TIMBRADA:          'nota-credito',
        NC_CANCELADA:         'nc-cancelada',
        REPORTE_GENERADO:     'reporte',
        ERROR_TIMBRADO:       'error-timbrado',
    };
    const iconMap = {
        FACTURA_TIMBRADA:     '/assets/images/LOGO_ANDAMIOS_02.png',
        ERROR_TIMBRADO:       '/assets/images/LOGO_ANDAMIOS_02.png',
    };
    enviarPushInterno({
        titulo: tipo.replace(/_/g, ' '),
        cuerpo: mensaje,
        icono:  iconMap[tipo] || '/assets/images/LOGO_ANDAMIOS_02.png',
        tag:    tagMap[tipo]  || 'facturacion',
    }).catch(() => {});
}

module.exports = { crearNotificacion };
