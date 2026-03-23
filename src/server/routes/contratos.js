const express = require('express');
const router = express.Router();
const contratosController = require('../controllers/contratos');

/**
 * @swagger
 * /api/contratos/siguiente-numero:
 *   get:
 *     summary: Obtener siguiente número de contrato
 *     description: Retorna el siguiente número secuencial disponible para un nuevo contrato
 *     tags:
 *       - Contratos
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
 *       500:
 *         description: Error interno del servidor
 */
router.get('/siguiente-numero', contratosController.getSiguienteNumero);

/**
 * @swagger
 * /api/contratos/siguiente-numero-nota:
 *   get:
 *     summary: Obtener siguiente número de nota
 *     description: Retorna el siguiente número secuencial para notas de crédito
 *     tags:
 *       - Contratos
 *     responses:
 *       200:
 *         description: Siguiente número obtenido exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.get('/siguiente-numero-nota', contratosController.getSiguienteNumeronota);

/**
 * @swagger
 * /api/contratos/dashboard-kpis:
 *   get:
 *     summary: Obtener KPIs del dashboard de contratos
 *     description: Retorna métricas clave de desempeño relacionadas a contratos
 *     tags:
 *       - Contratos
 *     responses:
 *       200:
 *         description: KPIs obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalContratos:
 *                   type: integer
 *                 contratosActivos:
 *                   type: integer
 *                 contratosVencidos:
 *                   type: integer
 *                 montoTotal:
 *                   type: number
 *       500:
 *         description: Error interno del servidor
 */
router.get('/dashboard-kpis', contratosController.getDashboardKpis);

/**
 * @swagger
 * /api/contratos:
 *   get:
 *     summary: Obtener todos los contratos
 *     description: Retorna un listado completo de todos los contratos con opciones de filtrado
 *     tags:
 *       - Contratos
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Filtrar por estado (activo, vencido, cancelado, concluido)
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de cliente
 *     responses:
 *       200:
 *         description: Lista de contratos obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Contrato'
 *       500:
 *         description: Error interno del servidor
 *   post:
 *     summary: Crear nuevo contrato
 *     description: Crea un nuevo contrato en el sistema
 *     tags:
 *       - Contratos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cliente_id
 *               - numero
 *             properties:
 *               numero:
 *                 type: string
 *               cliente_id:
 *                 type: integer
 *               descripcion:
 *                 type: string
 *               monto:
 *                 type: number
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *               estado:
 *                 type: string
 *                 enum: [activo, vencido, cancelado, concluido]
 *     responses:
 *       201:
 *         description: Contrato creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contrato'
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', contratosController.getAll);
router.post('/', contratosController.create);

/**
 * @swagger
 * /api/contratos/{id}:
 *   get:
 *     summary: Obtener contrato por ID
 *     description: Retorna los detalles completos de un contrato específico
 *     tags:
 *       - Contratos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del contrato
 *     responses:
 *       200:
 *         description: Contrato encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contrato'
 *       404:
 *         description: Contrato no encontrado
 *       500:
 *         description: Error interno del servidor
 *   put:
 *     summary: Actualizar contrato
 *     description: Actualiza los datos de un contrato existente
 *     tags:
 *       - Contratos
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
 *               descripcion:
 *                 type: string
 *               monto:
 *                 type: number
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Contrato actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Contrato no encontrado
 *       500:
 *         description: Error interno del servidor
 *   delete:
 *     summary: Eliminar contrato
 *     description: Elimina un contrato de la base de datos
 *     tags:
 *       - Contratos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contrato eliminado exitosamente
 *       404:
 *         description: Contrato no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:id', contratosController.getById);
router.put('/:id', contratosController.update);
router.delete('/:id', contratosController.delete);

/**
 * @swagger
 * /api/contratos/{id}/estado:
 *   patch:
 *     summary: Actualizar estado del contrato
 *     description: Actualiza únicamente el estado de un contrato
 *     tags:
 *       - Contratos
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
 *             required:
 *               - estado
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [activo, vencido, cancelado, concluido]
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 *       400:
 *         description: Estado inválido
 *       404:
 *         description: Contrato no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.patch('/:id/estado', contratosController.updateEstado);

module.exports = router;
