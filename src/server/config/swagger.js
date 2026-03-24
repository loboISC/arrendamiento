let swaggerJsdoc;

try {
  swaggerJsdoc = require('swagger-jsdoc');
} catch (error) {
  console.warn('[swagger] swagger-jsdoc no esta instalado. Se desactiva la generacion de specs.');
  module.exports = null;
  return;
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My Electron App API',
      version: '1.0.0',
      description: 'API Documentation para la aplicación de gestión de equipos, rentas, contratos y facturas',
      contact: {
        name: 'Irving AG',
        email: 'humbertare0214@gmail.com'
      },
      license: {
        name: 'ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.andamiostorres-api.com/',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT para autenticación'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            error: {
              type: 'string'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            nombre: {
              type: 'string'
            },
            email: {
              type: 'string'
            },
            rol: {
              type: 'string',
              enum: ['admin', 'usuario', 'operador']
            }
          }
        },
        Cliente: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            nombre: {
              type: 'string'
            },
            rfc: {
              type: 'string'
            },
            email: {
              type: 'string'
            },
            telefono: {
              type: 'string'
            }
          }
        },
        Equipo: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            nombre: {
              type: 'string'
            },
            descripcion: {
              type: 'string'
            },
            estado: {
              type: 'string'
            }
          }
        },
        Cotizacion: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            numero: {
              type: 'string'
            },
            cliente_id: {
              type: 'integer'
            },
            monto: {
              type: 'number'
            },
            estado: {
              type: 'string'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Factura: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            folio: {
              type: 'string'
            },
            cliente_id: {
              type: 'integer'
            },
            monto: {
              type: 'number'
            },
            estado: {
              type: 'string'
            },
            fecha_emision: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Contrato: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            numero: {
              type: 'string'
            },
            cliente_id: {
              type: 'integer'
            },
            descripcion: {
              type: 'string'
            },
            monto: {
              type: 'number'
            },
            estado: {
              type: 'string',
              enum: ['activo', 'vencido', 'cancelado', 'concluido']
            },
            fecha_inicio: {
              type: 'string',
              format: 'date'
            },
            fecha_fin: {
              type: 'string',
              format: 'date'
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    // Rutas para documentación de endpoints
    './src/routes/auth.js',
    './src/routes/clientes.js',
    './src/routes/equipos.js',
    './src/routes/productos.js',
    './src/routes/cotizaciones.js',
    './src/routes/contratos.js',
    './src/routes/facturas.js',
    './src/routes/usuarios.js'
    // Agrega más rutas según sea necesario
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
