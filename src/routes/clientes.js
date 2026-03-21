const express = require('express');
const router = express.Router();
const { 
  getAllClientes, 
  createCliente, 
  getClienteById, 
  updateCliente, 
  deleteCliente, 
  searchClientes,
  getClienteByRFC,
  validateRFC,
  getClientesStats,
  getClienteHistorial,
  getClienteLedger,
  getClientesConCredito,
  getDetalleCreditoCliente,
  registrarAbonoCredito,
  vincularFacturaAbono,
  enviarComprobanteAbonoPorEmail,
  checkNombreExiste
} = require('../controllers/clientes');
const { authenticateToken } = require('../middleware/auth');
const roles = require('../middleware/roles');

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * @swagger
 * /api/clientes:
 *   get:
 *     summary: Obtener todos los clientes
 *     description: Retorna un listado completo de todos los clientes registrados
 *     tags:
 *       - Clientes
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
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Campo para ordenar resultados
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Cliente'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 *   post:
 *     summary: Crear nuevo cliente
 *     description: Crea un nuevo cliente en el sistema
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *               - rfc
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               rfc:
 *                 type: string
 *               razon_social:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               estado:
 *                 type: string
 *               codigo_postal:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         description: Datos inválidos o cliente ya existe
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener todos los clientes
router.get('/', getAllClientes);

// Crear nuevo cliente
router.post('/', createCliente);

/**
 * @swagger
 * /api/clientes/search:
 *   get:
 *     summary: Buscar clientes
 *     description: Busca clientes por nombre, email o RFC
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cliente'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Buscar clientes (debe ir antes de /:id)
router.get('/search', searchClientes);

/**
 * @swagger
 * /api/clientes/check-nombre:
 *   get:
 *     summary: Verificar si existe un cliente con nombre
 *     description: Verifica si ya existe un cliente con el mismo nombre
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: nombre
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado de verificación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 existe:
 *                   type: boolean
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Verificar si ya existe un cliente con el mismo nombre (debe ir antes de /:id)
router.get('/check-nombre', checkNombreExiste);

/**
 * @swagger
 * /api/clientes/stats:
 *   get:
 *     summary: Obtener estadísticas de clientes
 *     description: Retorna estadísticas generales de clientes
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClientes:
 *                   type: integer
 *                 clientesActivos:
 *                   type: integer
 *                 clientesConCredito:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Obtener estadísticas de clientes (debe ir antes de /:id)
router.get('/stats', getClientesStats);

/**
 * @swagger
 * /api/clientes/validate-rfc/{rfc}:
 *   get:
 *     summary: Validar formato de RFC
 *     description: Valida que el RFC tenga un formato correcto
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rfc
 *         required: true
 *         schema:
 *           type: string
 *         description: RFC a validar
 *     responses:
 *       200:
 *         description: Resultado de validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valido:
 *                   type: boolean
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Validar RFC (debe ir antes de /:id)
router.get('/validate-rfc/:rfc', validateRFC);

/**
 * @swagger
 * /api/clientes/rfc/{rfc}:
 *   get:
 *     summary: Obtener cliente por RFC
 *     description: Busca y retorna un cliente específico por su RFC
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rfc
 *         required: true
 *         schema:
 *           type: string
 *         description: RFC del cliente
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente no encontrado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
// Buscar cliente por RFC (debe ir antes de /:id)
router.get('/rfc/:rfc', getClienteByRFC);

/**
 * @swagger
 * /api/clientes/credito/listado:
 *   get:
 *     summary: Obtener clientes con crédito
 *     description: Retorna lista de clientes que tienen saldo de crédito disponible
 *     tags:
 *       - Clientes
 *       - Crédito
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes con crédito
 *       401:
 *         description: No autorizado
 */
// Obtener clientes con crédito (debe ir antes de /:id)
router.get('/credito/listado', getClientesConCredito);

router.get('/credito/:id/detalle', getDetalleCreditoCliente);
router.post('/credito/abonos', registrarAbonoCredito);
router.patch('/credito/abonos/:ledgerId/factura', vincularFacturaAbono);
router.post('/enviar-comprobante-abono', enviarComprobanteAbonoPorEmail);

// Obtener historial del cliente (debe ir antes de /:id)
router.get('/:id/historial', getClienteHistorial);

// Ledger financiero del cliente (paginado/filtros)
router.get('/:id/ledger', roles(['nc.audit.view','Admin']), getClienteLedger);

/**
 * @swagger
 * /api/clientes/{id}:
 *   get:
 *     summary: Obtener cliente por ID
 *     description: Retorna los detalles completos de un cliente específico
 *     tags:
 *       - Clientes
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
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente no encontrado
 *       401:
 *         description: No autorizado
 *   put:
 *     summary: Actualizar cliente
 *     description: Actualiza los datos de un cliente
 *     tags:
 *       - Clientes
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
 *         description: Cliente actualizado
 *       404:
 *         description: Cliente no encontrado
 *   delete:
 *     summary: Eliminar cliente
 *     description: Elimina un cliente de la base de datos
 *     tags:
 *       - Clientes
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
 *         description: Cliente eliminado
 *       404:
 *         description: Cliente no encontrado
 */

// Actualizar cliente
router.put('/:id', updateCliente);

// Eliminar cliente
router.delete('/:id', deleteCliente);

module.exports = router; 
