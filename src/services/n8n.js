// Este archivo utiliza la API global `fetch` disponible en Node.js v18+.
// Si usas una versión anterior, instala 'node-fetch' con `npm install node-fetch`
// y descomenta la siguiente línea:
// const fetch = require('node-fetch');

/**
 * Envía una notificación a un webhook de n8n.
 * @param {string} eventType - Un identificador para el tipo de evento (ej: 'user_created', 'stock_low').
 * @param {object} payload - El objeto con los datos a enviar.
 */
async function sendToN8n(eventType, payload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes('PEGA_AQUI')) {
    console.warn('N8N_WEBHOOK_URL no está definida en el archivo .env. Omitiendo notificación.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log(`Notificación '${eventType}' enviada a n8n exitosamente.`);
    } else {
      console.error(`Error al enviar notificación a n8n: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Fallo al conectar con el webhook de n8n:', error);
  }
}

module.exports = { sendToN8n };