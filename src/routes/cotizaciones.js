const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizaciones');
const { authenticateToken } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

/**
 * @swagger
 * /api/cotizaciones/siguiente-numero:
 *   get:
 *     summary: Obtener siguiente número de cotización
 *     description: Retorna el siguiente número secuencial disponible para una nueva cotización
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Siguiente número obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 numero:
 *                   type: string
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener siguiente número de cotización (debe ir ANTES de '/:id' para evitar conflictos)
router.get('/siguiente-numero', cotizacionesController.getSiguienteNumero);

/**
 * @swagger
 * /api/cotizaciones:
 *   get:
 *     summary: Obtener todas las cotizaciones
 *     description: Retorna un listado completo de todas las cotizaciones con filtros opcionales
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página para paginación
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Filtrar por estado (pendiente, aprobado, rechazado)
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de cliente
 *     responses:
 *       200:
 *         description: Lista de cotizaciones obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Cotizacion'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener todas las cotizaciones
router.get('/', cotizacionesController.getCotizaciones);

/**
 * @swagger
 * /api/cotizaciones/ventas-kpis:
 *   get:
 *     summary: Obtener KPIs de ventas
 *     description: Retorna métricas clave de desempeño de ventas calculadas desde cotizaciones
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPIs obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCotizaciones:
 *                   type: integer
 *                 montoTotal:
 *                   type: number
 *                 cotizacionesPendientes:
 *                   type: integer
 *                 tasaConversion:
 *                   type: number
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// KPIs de ventas (calculados en backend)
router.get('/ventas-kpis', cotizacionesController.getVentasKPIs);

/**
 * @swagger
 * /api/cotizaciones/{id}:
 *   get:
 *     summary: Obtener cotización por ID
 *     description: Retorna los detalles completos de una cotización específica
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cotización
 *     responses:
 *       200:
 *         description: Cotización encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cotizacion'
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 *   post:
 *     summary: Crear nueva cotización
 *     description: Crea una nueva cotización para un cliente
 *     tags:
 *       - Cotizaciones
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
 *             properties:
 *               numero:
 *                 type: string
 *               cliente_id:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               fecha_vigencia:
 *                 type: string
 *                 format: date
 *               notas:
 *                 type: string
 *               estado:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cotización creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cotizacion'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 *   put:
 *     summary: Actualizar cotización
 *     description: Actualiza los datos de una cotización existente
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               numero:
 *                 type: string
 *               estado:
 *                 type: string
 *               notas:
 *                 type: string
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Cotización actualizada exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 *   delete:
 *     summary: Eliminar cotización
 *     description: Elimina una cotización de la base de datos
 *     tags:
 *       - Cotizaciones
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
 *         description: Cotización eliminada exitosamente
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener una cotización específica
router.get('/:id', cotizacionesController.getCotizacion);

// Crear nueva cotización
router.post('/', cotizacionesController.createCotizacion);

// Actualizar cotización
router.put('/:id', cotizacionesController.updateCotizacion);

// Eliminar cotización
router.delete('/:id', cotizacionesController.deleteCotizacion);

/**
 * @swagger
 * /api/cotizaciones/{id}/convertir-contrato:
 *   post:
 *     summary: Convertir cotización a contrato
 *     description: Convierte una cotización aprobada en un contrato
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Cotización convertida a contrato exitosamente
 *       400:
 *         description: No se puede convertir esta cotización
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Convertir cotización a contrato
router.post('/:id/convertir-contrato', cotizacionesController.convertirAContrato);

/**
 * @swagger
 * /api/cotizaciones/{id}/historial:
 *   get:
 *     summary: Obtener historial de cotización
 *     description: Retorna el historial de cambios de una cotización
 *     tags:
 *       - Cotizaciones
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
 *         description: Historial obtenido exitosamente
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener historial de una cotización
router.get('/:id/historial', cotizacionesController.getHistorialCotizacion);

/**
 * @swagger
 * /api/cotizaciones/{id}/clonar:
 *   post:
 *     summary: Clonar cotización existente
 *     description: Crea una copia de una cotización existente como una nueva cotización
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cliente_id:
 *                 type: integer
 *                 description: ID del nuevo cliente (si es diferente)
 *     responses:
 *       201:
 *         description: Cotización clonada exitosamente
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Clonar una cotización existente
router.post('/:id/clonar', cotizacionesController.clonarCotizacion);

/**
 * @swagger
 * /api/cotizaciones/{id}/with-history:
 *   put:
 *     summary: Actualizar cotización con historial
 *     description: Actualiza una cotización y registra los cambios en el historial
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cotización actualizada con historial
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Actualizar cotización con tracking de cambios
router.put('/:id/with-history', cotizacionesController.updateCotizacionWithHistory);

/**
 * @swagger
 * /api/cotizaciones/{id}/generar-folio-nota:
 *   post:
 *     summary: Generar folio de nota de crédito
 *     description: Genera un folio para nota de crédito asociada a la cotización
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Folio generado exitosamente
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Ruta para generar folio de nota
router.post('/:id/generar-folio-nota', cotizacionesController.generarFolioNota);

/**
 * @swagger
 * /api/cotizaciones/{id}/aplicar-credito:
 *   post:
 *     summary: Aplicar crédito del cliente a cotización
 *     description: Aplica crédito disponible del cliente a una cotización
 *     tags:
 *       - Cotizaciones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monto:
 *                 type: number
 *                 description: Monto de crédito a aplicar
 *     responses:
 *       200:
 *         description: Crédito aplicado exitosamente
 *       400:
 *         description: Datos inválidos o crédito insuficiente
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Aplicar crédito del cliente a una cotización
router.post('/:id/aplicar-credito', cotizacionesController.aplicarCreditoCotizacion);

module.exports = router;
