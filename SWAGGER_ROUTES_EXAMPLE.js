// Ejemplo de cómo documentar endpoints con Swagger/OpenAPI
// Este archivo es un referencia para que documentes tus rutas

/**
 * @swagger
 * tags:
 *   - name: Cotizaciones
 *     description: Endpoints para gestión de cotizaciones
 */

/**
 * @swagger
 * /api/cotizaciones:
 *   get:
 *     summary: Obtener lista de cotizaciones
 *     description: Retorna un listado de todas las cotizaciones con paginación opcional
 *     tags:
 *       - Cotizaciones
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
 *         description: Filtrar por estado (pendiente, aprobado, rechazado)
 *     security:
 *       - bearerAuth: []
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
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *       401:
 *         description: No autorizado - Token requerido
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /api/cotizaciones/{id}:
 *   get:
 *     summary: Obtener cotización por ID
 *     description: Retorna los detalles de una cotización específica
 *     tags:
 *       - Cotizaciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cotización
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cotización encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Cotizacion'
 *       404:
 *         description: Cotización no encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /api/cotizaciones:
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
 *               - items
 *             properties:
 *               cliente_id:
 *                 type: integer
 *                 description: ID del cliente
 *               numero:
 *                 type: string
 *                 description: Número de cotización
 *               items:
 *                 type: array
 *                 description: Items de la cotización
 *                 items:
 *                   type: object
 *                   properties:
 *                     producto_id:
 *                       type: integer
 *                     cantidad:
 *                       type: number
 *                     precio_unitario:
 *                       type: number
 *               fecha_vigencia:
 *                 type: string
 *                 format: date
 *                 description: Fecha hasta la cual es válida la cotización
 *               notas:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cotización creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Cotizacion'
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos o incompletos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /api/cotizaciones/{id}:
 *   put:
 *     summary: Actualizar cotización
 *     description: Actualiza los datos de una cotización existente
 *     tags:
 *       - Cotizaciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cotización
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 */

/**
 * @swagger
 * /api/cotizaciones/{id}:
 *   delete:
 *     summary: Eliminar cotización
 *     description: Elimina una cotización de la base de datos
 *     tags:
 *       - Cotizaciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cotización a eliminar
 *     security:
 *       - bearerAuth: []
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

module.exports = (router) => {
  // Aquí va tu código de rutas
  // Los comentarios JSDoc anteriores se utilizarán automáticamente
  // en la generación de la documentación Swagger
};
