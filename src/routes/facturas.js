const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacion');
const { authenticateToken } = require('../middleware/auth');
const roles = require('../middleware/roles');

/**
 * @swagger
 * tags:
 *   - name: Facturas
 *     description: Gestión de facturas y timbrado
 *   - name: Notas de Crédito
 *     description: Gestión de notas de crédito
 */

/**
 * @swagger
 * /api/facturas:
 *   get:
 *     summary: Obtener todas las facturas
 *     description: Retorna un listado completo de todas las facturas timbradas
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [vigente, cancelada]
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de facturas obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Factura'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener todas las facturas
router.get('/', authenticateToken, facturacionController.getFacturas);

/**
 * @swagger
 * /api/facturas/timbrar:
 *   post:
 *     summary: Timbrar nueva factura
 *     description: Crea y timbra una nueva factura en el RFC del contribuyente (Facturama)
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cliente_id
 *               - items
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               notas:
 *                 type: string
 *               descuento:
 *                 type: number
 *     responses:
 *       201:
 *         description: Factura timbrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Factura'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Timbrar nueva factura
router.post('/timbrar', authenticateToken, facturacionController.timbrarFactura);

// Cancelar factura
router.post('/:uuid/cancelar', facturacionController.cancelarFactura);

// Descargar PDF de factura
router.get('/:uuid/pdf', authenticateToken, facturacionController.descargarPDF);

/**
 * @swagger
 * /api/facturas/{uuid}:
 *   get:
 *     summary: Obtener factura por UUID
 *     description: Retorna los detalles de una factura específica
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Factura encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Factura'
 *       404:
 *         description: Factura no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener factura por UUID
router.get('/:uuid', facturacionController.getFacturaByUuid);

/**
 * @swagger
 * /api/facturas/{uuid}/enviar-email:
 *   post:
 *     summary: Enviar factura por email
 *     description: Envía la factura al correo electrónico del cliente
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Factura enviada exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Factura no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Enviar factura por email
router.post('/:uuid/enviar-email', authenticateToken, facturacionController.enviarFacturaPorEmail);

/**
 * @swagger
 * /api/facturas/{uuid}/cancelar:
 *   post:
 *     summary: Cancelar factura
 *     description: Cancela una factura vigente
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Factura cancelada exitosamente
 *       400:
 *         description: No se puede cancelar esta factura
 *       404:
 *         description: Factura no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Cancelar factura
router.post('/:uuid/cancelar', facturacionController.cancelarFactura);

/**
 * @swagger
 * /api/facturas/search-document/{query}:
 *   get:
 *     summary: Buscar documento para timbrado
 *     description: Busca documentos (cotizaciones, contratos, etc.) por folio para timbrar
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Folio o número a buscar
 *     responses:
 *       200:
 *         description: Documentos encontrados
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Buscar documento o equipo para timbrado
router.get('/search-document/:query', facturacionController.searchDocumentByFolio);

/**
 * @swagger
 * /api/facturas/search-concepts/{query}:
 *   get:
 *     summary: Buscar conceptos para factura
 *     description: Busca productos, servicios y cotizaciones para agregar a la factura
 *     tags:
 *       - Facturas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conceptos encontrados
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Buscar conceptos (productos, servicios, cotizaciones) para modal
router.get('/search-concepts/:query', facturacionController.searchConcepts);

/**
 * @swagger
 * /api/facturas/eligible-credit-balance/{facturaId}:
 *   get:
 *     summary: Obtener saldo elegible para nota de crédito
 *     description: Retorna el monto disponible para crear una nota de crédito de una factura
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: facturaId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Saldo elegible obtenido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saldoElegible:
 *                   type: number
 *       404:
 *         description: Factura no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// recuperar saldo elegible para nota de crédito
router.get('/eligible-credit-balance/:facturaId', authenticateToken, facturacionController.getEligibleCreditBalance);

/**
 * @swagger
 * /api/facturas/credit-notes/timbrar:
 *   post:
 *     summary: Timbrar nota de crédito
 *     description: Crea y timbra una nota de crédito asociada a una factura
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - factura_id
 *               - monto
 *             properties:
 *               factura_id:
 *                 type: integer
 *               monto:
 *                 type: number
 *               razon:
 *                 type: string
 *               items:
 *                 type: array
 *     responses:
 *       201:
 *         description: Nota de crédito timbrada exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Permiso denegado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// timbrado de nota de crédito (flujo separado)
router.post('/credit-notes/timbrar', authenticateToken, roles(['nc.create', 'Admin', 'Director General']), facturacionController.timbrarNotaCredito);

/**
 * @swagger
 * /api/facturas/credit-notes:
 *   get:
 *     summary: Obtener notas de crédito
 *     description: Retorna listado de todas las notas de crédito timbradas
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de notas de crédito
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// listado y detalles de notas de crédito
router.get('/credit-notes', authenticateToken, facturacionController.getCreditNotes);

/**
 * @swagger
 * /api/facturas/credit-notes/{id}:
 *   get:
 *     summary: Obtener nota de crédito por ID
 *     description: Retorna los detalles de una nota de crédito específica
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nota de crédito encontrada
 *       404:
 *         description: Nota de crédito no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/credit-notes/:id', authenticateToken, facturacionController.getCreditNoteById);

/**
 * @swagger
 * /api/facturas/credit-notes/{id}/cancelar:
 *   post:
 *     summary: Cancelar nota de crédito
 *     description: Cancela una nota de crédito vigente
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nota de crédito cancelada
 *       403:
 *         description: Permiso denegado
 *       404:
 *         description: Nota de crédito no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// acciones sobre nota de crédito
router.post('/credit-notes/:id/cancelar', authenticateToken, roles(['nc.cancel', 'Admin']), facturacionController.cancelarNotaCredito);

/**
 * @swagger
 * /api/facturas/credit-notes/{id}/aprobar:
 *   post:
 *     summary: Aprobar nota de crédito
 *     description: Aprueba una nota de crédito pendiente
 *     tags:
 *       - Notas de Crédito
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nota de crédito aprobada
 *       403:
 *         description: Permiso denegado
 *       404:
 *         description: Nota de crédito no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/credit-notes/:id/aprobar', authenticateToken, roles(['nc.approve', 'Admin']), facturacionController.aprobarNotaCredito);

module.exports = router;

