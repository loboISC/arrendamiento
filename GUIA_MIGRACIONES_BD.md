# 🗄️ Sistema de Migraciones de Base de Datos para ScaffoldPro

## 🎯 Tu Situación Actual

- ❌ **NO usas Prisma** - Usas PostgreSQL directo con el driver `pg`
- ✅ **Usas Git** - Para control de versiones del código
- 🎯 **Necesitas** - Sistema de migraciones para la base de datos

## 📊 Opciones Disponibles

### Opción 1: node-pg-migrate (Recomendada) ⭐

**Ventajas:**
- ✅ Diseñado específicamente para PostgreSQL
- ✅ Compatible con tu stack actual (Node.js + pg)
- ✅ Migraciones en JavaScript
- ✅ Rollback automático
- ✅ Fácil de integrar

### Opción 2: Knex.js

**Ventajas:**
- ✅ Query builder incluido
- ✅ Soporte para múltiples bases de datos
- ✅ Migraciones robustas

**Desventajas:**
- ⚠️ Más pesado (incluye query builder que no necesitas)

### Opción 3: db-migrate

**Ventajas:**
- ✅ Agnóstico de base de datos
- ✅ CLI simple

**Desventajas:**
- ⚠️ Menos mantenido que las otras opciones

---

## 🚀 Implementación con node-pg-migrate (Recomendado)

### Paso 1: Instalar node-pg-migrate

```bash
# En tu proyecto
cd c:\Users\siste\arrendamiento

# Instalar como dependencia de desarrollo
npm install --save-dev node-pg-migrate

# Verificar instalación
npx node-pg-migrate --version
```

### Paso 2: Configurar package.json

Agrega scripts para migraciones:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm:electron-dev\"",
    "server": "node src/server.js",
    
    "migrate:create": "node-pg-migrate create",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:status": "node-pg-migrate list"
  }
}
```

### Paso 3: Crear Archivo de Configuración

Crea `database.json` en la raíz del proyecto:

```json
{
  "dev": {
    "driver": "pg",
    "host": "localhost",
    "port": 5432,
    "database": "torresdb",
    "user": "postgres",
    "password": "irving"
  },
  "production": {
    "driver": "pg",
    "host": {"ENV": "DB_HOST"},
    "port": {"ENV": "DB_PORT"},
    "database": {"ENV": "DB_NAME"},
    "user": {"ENV": "DB_USER"},
    "password": {"ENV": "DB_PASSWORD"}
  }
}
```

**O mejor aún, crear `migrations/config.js`:**

```javascript
require('dotenv').config();

module.exports = {
  databaseUrl: process.env.DATABASE_URL || 
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
  direction: 'up',
  count: Infinity,
  ignorePattern: '.*\\.map',
  schema: 'public'
};
```

### Paso 4: Crear Primera Migración

```bash
# Crear migración para tabla de mantenimiento
npm run migrate:create add-mantenimiento-table

# Esto crea un archivo como:
# migrations/1704729600000_add-mantenimiento-table.js
```

### Paso 5: Escribir la Migración

Edita el archivo creado en `migrations/`:

```javascript
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Crear tabla de mantenimiento
  pgm.createTable('mantenimiento', {
    id_mantenimiento: {
      type: 'serial',
      primaryKey: true
    },
    id_equipo: {
      type: 'integer',
      notNull: true,
      references: 'equipos(id_equipo)',
      onDelete: 'CASCADE'
    },
    tipo_mantenimiento: {
      type: 'varchar(50)',
      notNull: true
    },
    fecha_programada: {
      type: 'date',
      notNull: true
    },
    fecha_realizada: {
      type: 'date'
    },
    descripcion: {
      type: 'text'
    },
    costo: {
      type: 'decimal(10,2)'
    },
    estado: {
      type: 'varchar(20)',
      notNull: true,
      default: 'Pendiente'
    },
    realizado_por: {
      type: 'varchar(100)'
    },
    notas: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Crear índices
  pgm.createIndex('mantenimiento', 'id_equipo');
  pgm.createIndex('mantenimiento', 'fecha_programada');
  pgm.createIndex('mantenimiento', 'estado');

  // Agregar comentario a la tabla
  pgm.sql(`
    COMMENT ON TABLE mantenimiento IS 'Tabla para gestionar mantenimientos de equipos';
  `);
};

exports.down = pgm => {
  // Rollback: eliminar tabla
  pgm.dropTable('mantenimiento');
};
```

### Paso 6: Ejecutar Migración

```bash
# Ver estado de migraciones
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate:up

# Si algo sale mal, hacer rollback
npm run migrate:down
```

---

## 📝 Estructura de Proyecto con Migraciones

```
arrendamiento/
├── migrations/
│   ├── config.js
│   ├── 1704729600000_initial-schema.js
│   ├── 1704729700000_add-mantenimiento-table.js
│   ├── 1704729800000_add-facturacion-table.js
│   └── 1704729900000_add-indexes.js
├── src/
│   ├── server.js
│   └── db.js
├── database.json (opcional)
├── package.json
└── .env
```

---

## 🔄 Flujo de Trabajo con Migraciones

### Desarrollo Local (v1.0 → v1.1)

```bash
# 1. Crear nueva migración
npm run migrate:create add-facturacion-module

# 2. Editar archivo de migración
# migrations/xxxxx_add-facturacion-module.js

# 3. Ejecutar migración localmente
npm run migrate:up

# 4. Probar cambios

# 5. Commit a Git
git add migrations/
git commit -m "Add facturacion module migration"

# 6. Crear tag de versión
git tag -a v1.1 -m "v1.1 - Módulo de facturación"
git push origin v1.1
```

### Despliegue en QNAP

```bash
# 1. Conectar al QNAP
ssh admin@IP-QNAP

# 2. Ir al directorio de la app
cd /share/Container/scaffoldpro/app

# 3. Actualizar código
git fetch --all --tags
git checkout v1.1

# 4. Ejecutar migraciones
npm run migrate:up

# 5. Reiniciar aplicación
cd /share/Container/scaffoldpro
docker-compose restart app
```

---

## 📋 Ejemplos de Migraciones Comunes

### Crear Tabla

```javascript
// migrations/xxxxx_create-clientes.js
exports.up = pgm => {
  pgm.createTable('clientes', {
    id_cliente: 'id',
    nombre: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(100)', unique: true },
    telefono: 'varchar(20)',
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
};

exports.down = pgm => {
  pgm.dropTable('clientes');
};
```

### Agregar Columna

```javascript
// migrations/xxxxx_add-rfc-to-clientes.js
exports.up = pgm => {
  pgm.addColumn('clientes', {
    rfc: {
      type: 'varchar(13)',
      notNull: false
    }
  });
};

exports.down = pgm => {
  pgm.dropColumn('clientes', 'rfc');
};
```

### Modificar Columna

```javascript
// migrations/xxxxx_modify-email-length.js
exports.up = pgm => {
  pgm.alterColumn('clientes', 'email', {
    type: 'varchar(200)'
  });
};

exports.down = pgm => {
  pgm.alterColumn('clientes', 'email', {
    type: 'varchar(100)'
  });
};
```

### Crear Índice

```javascript
// migrations/xxxxx_add-indexes.js
exports.up = pgm => {
  pgm.createIndex('clientes', 'email');
  pgm.createIndex('clientes', 'rfc');
  pgm.createIndex('contratos', ['id_cliente', 'fecha_inicio']);
};

exports.down = pgm => {
  pgm.dropIndex('clientes', 'email');
  pgm.dropIndex('clientes', 'rfc');
  pgm.dropIndex('contratos', ['id_cliente', 'fecha_inicio']);
};
```

### Agregar Constraint

```javascript
// migrations/xxxxx_add-constraints.js
exports.up = pgm => {
  pgm.addConstraint('contratos', 'check_fechas', {
    check: 'fecha_fin > fecha_inicio'
  });
};

exports.down = pgm => {
  pgm.dropConstraint('contratos', 'check_fechas');
};
```

### Insertar Datos Iniciales (Seeds)

```javascript
// migrations/xxxxx_seed-initial-data.js
exports.up = pgm => {
  pgm.sql(`
    INSERT INTO configuracion (clave, valor) VALUES
    ('version', '1.0'),
    ('empresa_nombre', 'ScaffoldPro'),
    ('moneda_default', 'MXN');
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DELETE FROM configuracion WHERE clave IN ('version', 'empresa_nombre', 'moneda_default');
  `);
};
```

---

## 🔧 Integración con tu Aplicación

### Actualizar src/server.js

```javascript
require('dotenv').config();
const express = require('express');
const { migrate } = require('node-pg-migrate');
const path = require('path');

const app = express();

// Función para ejecutar migraciones al iniciar
async function runMigrations() {
  try {
    console.log('🔄 Verificando migraciones...');
    
    await migrate({
      databaseUrl: process.env.DATABASE_URL,
      dir: path.join(__dirname, '../migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      count: Infinity,
      verbose: true
    });
    
    console.log('✅ Migraciones completadas');
  } catch (error) {
    console.error('❌ Error en migraciones:', error);
    throw error;
  }
}

// Iniciar servidor
async function startServer() {
  try {
    // Ejecutar migraciones primero
    await runMigrations();
    
    // Luego iniciar servidor
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
```

---

## 📊 Script de Actualización Mejorado

Actualiza `update.sh` para incluir migraciones:

```bash
#!/bin/bash

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "❌ Error: Debes especificar una versión"
    echo "Uso: ./update.sh v1.1"
    exit 1
fi

echo "🔄 Actualizando ScaffoldPro a $VERSION..."

# Backup
echo "💾 Creando backup..."
./backup.sh

# Actualizar código
cd /share/Container/scaffoldpro/app
echo "📥 Descargando actualizaciones..."
git fetch --all --tags
git checkout "$VERSION"

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones de base de datos..."
npm run migrate:up

# Reiniciar aplicación
cd /share/Container/scaffoldpro
echo "🔄 Reiniciando aplicación..."
docker-compose restart app

# Esperar
sleep 10

# Verificar
echo "✅ Actualización completada!"
docker-compose ps
docker-compose logs --tail=20 app
```

---

## 📝 Mejores Prácticas

### 1. Nombrar Migraciones Descriptivamente

```bash
# ✅ Bueno
npm run migrate:create add-mantenimiento-table
npm run migrate:create add-rfc-to-clientes
npm run migrate:create create-facturacion-indexes

# ❌ Malo
npm run migrate:create migration1
npm run migrate:create update
```

### 2. Siempre Incluir Rollback

```javascript
exports.up = pgm => {
  // Cambios hacia adelante
};

exports.down = pgm => {
  // SIEMPRE implementar rollback
  // Debe deshacer exactamente lo que hace up
};
```

### 3. Probar Migraciones Localmente

```bash
# Ejecutar migración
npm run migrate:up

# Probar rollback
npm run migrate:down

# Volver a ejecutar
npm run migrate:up
```

### 4. Una Migración = Un Cambio Lógico

```bash
# ✅ Bueno - Migraciones separadas
1. add-mantenimiento-table.js
2. add-mantenimiento-indexes.js
3. add-mantenimiento-constraints.js

# ❌ Malo - Todo en una migración
1. update-everything.js
```

### 5. Nunca Modificar Migraciones Ejecutadas

```bash
# ❌ NUNCA hagas esto
# Editar migrations/xxxxx_old-migration.js después de ejecutarla

# ✅ Crea una nueva migración
npm run migrate:create fix-previous-migration
```

---

## 🔍 Comandos Útiles

```bash
# Ver estado de migraciones
npm run migrate:status

# Ejecutar todas las migraciones pendientes
npm run migrate:up

# Ejecutar solo la siguiente migración
npm run migrate:up 1

# Hacer rollback de la última migración
npm run migrate:down

# Hacer rollback de las últimas 2 migraciones
npm run migrate:down 2

# Ver SQL que se ejecutará (dry run)
npm run migrate:up -- --dry-run
```

---

## 🎯 Ejemplo Completo: Agregar Módulo de Mantenimiento

### Paso 1: Crear Migración

```bash
npm run migrate:create add-mantenimiento-module
```

### Paso 2: Editar Migración

```javascript
// migrations/xxxxx_add-mantenimiento-module.js
exports.up = pgm => {
  // Tabla principal
  pgm.createTable('mantenimiento', {
    id_mantenimiento: 'id',
    id_equipo: {
      type: 'integer',
      notNull: true,
      references: 'equipos'
    },
    tipo: { type: 'varchar(50)', notNull: true },
    fecha_programada: { type: 'date', notNull: true },
    fecha_realizada: 'date',
    costo: 'decimal(10,2)',
    estado: {
      type: 'varchar(20)',
      notNull: true,
      default: 'Pendiente'
    },
    notas: 'text',
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp')
    }
  });

  // Índices
  pgm.createIndex('mantenimiento', 'id_equipo');
  pgm.createIndex('mantenimiento', 'estado');
  
  // Datos iniciales
  pgm.sql(`
    INSERT INTO configuracion (clave, valor)
    VALUES ('mantenimiento_enabled', 'true');
  `);
};

exports.down = pgm => {
  pgm.dropTable('mantenimiento');
  pgm.sql(`
    DELETE FROM configuracion WHERE clave = 'mantenimiento_enabled';
  `);
};
```

### Paso 3: Ejecutar

```bash
# Ejecutar migración
npm run migrate:up

# Verificar
npm run migrate:status
```

### Paso 4: Commit

```bash
git add migrations/
git commit -m "Add mantenimiento module migration"
git tag -a v1.1 -m "v1.1 - Módulo de mantenimiento"
git push origin v1.1
```

---

## 🎉 Resumen

**Ahora tienes:**

1. ✅ **Sistema de migraciones** - Como Git para tu base de datos
2. ✅ **Versionado de BD** - Sincronizado con versiones de código
3. ✅ **Rollback automático** - Si algo falla
4. ✅ **Historial completo** - De todos los cambios en la BD
5. ✅ **Despliegue fácil** - Un comando ejecuta todo

**Flujo completo:**

```
Desarrollo → Migración → Commit → Tag → Push → Deploy → Migrate → Restart
```

**¿Listo para implementar?** Sigue los pasos en orden y tendrás un sistema profesional de migraciones! 🚀
