# Swagger/OpenAPI Documentación

## Acceso a la Documentación

Una vez que el servidor está en funcionamiento, puedes acceder a la documentación interactiva de Swagger en:

```
http://localhost:3001/api-docs
```

También puedes obtenerse el JSON de especificación en:
```
http://localhost:3001/api-docs.json
```

## Configuración

La configuración de Swagger se encuentra en: `src/config/swagger.js`

## Cómo documentar tus endpoints

Para que tus endpoints aparezcan en la documentación de Swagger, necesitas añadir comentarios JSDoc en tus archivos de rutas.

### Ejemplo básico en `src/routes/clientes.js`:

```javascript
/**
 * @swagger
 * /api/clientes:
 *   get:
 *     summary: Obtener lista de clientes
 *     description: Retorna una lista de todos los clientes registrados
 *     tags:
 *       - Clientes
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida exitosamente
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
router.get('/', (req, res) => {
  // Tu código aquí
});
```

### Ejemplo con parámetros en `src/routes/clientes.js`:

```javascript
/**
 * @swagger
 * /api/clientes/{id}:
 *   get:
 *     summary: Obtener cliente por ID
 *     description: Retorna los detalles de un cliente específico
 *     tags:
 *       - Clientes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cliente
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
 */
router.get('/:id', (req, res) => {
  // Tu código aquí
});
```

### Ejemplo POST con body en `src/routes/clientes.js`:

```javascript
/**
 * @swagger
 * /api/clientes:
 *   post:
 *     summary: Crear nuevo cliente
 *     description: Crea un nuevo cliente en la base de datos
 *     tags:
 *       - Clientes
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
 *               telefono:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 */
router.post('/', (req, res) => {
  // Tu código aquí
});
```

### Ejemplo con autenticación:

```javascript
/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     summary: Listar usuarios
 *     description: Obtiene lista de todos los usuarios (requiere autenticación)
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autorizado (token requerido)
 */
router.get('/', (req, res) => {
  // Tu código aquí
});
```

## Agregar rutas a la configuración

Para que tus rutas se incluyan en la documentación, debe estar listadas en el archivo `src/config/swagger.js`:

```javascript
apis: [
  './src/routes/auth.js',
  './src/routes/clientes.js',
  './src/routes/equipos.js',
  './src/routes/productos.js',
  './src/routes/cotizaciones.js',
  './src/routes/facturas.js',
  './src/routes/usuarios.js'
  // Agrega más rutas según sea necesario
]
```

## Tags disponibles

Para organizar tus endpoints, utiliza estos tags en tus comentarios JSDoc:
- Clientes
- Equipos
- Productos
- Cotizaciones
- Facturas
- Usuarios
- Entregas
- Contratos
- Dashboard
- Análisis

## Esquemas de componentes

Los esquemas están definidos en `src/config/swagger.js`. Puedes referenciarlos con:
```javascript
$ref: '#/components/schemas/NombreDelEsquema'
```

Esquemas disponibles:
- Cliente
- Equipo
- Cotizacion
- Factura
- User
- Error

## Seguridad

La API está configurada para usar JWT Bearer tokens. En Swagger puedes hacer clic en el botón "Authorize" para añadir tu token JWT.

## Verificación

Para verificar que todo está funcionando correctamente:

1. Inicia el servidor: `npm run server`
2. Abre en tu navegador: `http://localhost:3001/api-docs`
3. Deberías ver la interfaz Swagger con todos los endpoints documentados

## Notas

- La documentación se actualiza automáticamente cuando modificas los comentarios JSDoc
- Asegúrate de que el formato de los comentarios JSDoc sea correcto
- Para endpoints no documentados, Swagger aún permitirá hacer requests pero no habrá documentación

## Herramientas útiles

- **Swagger Editor**: https://editor.swagger.io/ - Para editar y validar tu especificación OpenAPI
- **Prismá**: Herramienta para generar código mocking desde la especificación
