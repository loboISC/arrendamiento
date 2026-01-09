# 📁 Directorio de Migraciones

Este directorio contiene todas las migraciones de base de datos para ScaffoldPro.

## 🎯 ¿Qué son las Migraciones?

Las migraciones son como **Git para tu base de datos**. Cada archivo representa un cambio en el esquema de la base de datos, versionado y rastreable.

## 📋 Comandos Disponibles

```bash
# Crear nueva migración
npm run migrate:create nombre-descriptivo

# Ver estado de migraciones
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate:up

# Deshacer última migración
npm run migrate:down
```

## 📝 Ejemplo de Uso

### 1. Crear Migración

```bash
npm run migrate:create add-mantenimiento-table
```

Esto crea un archivo: `migrations/1704729600000_add-mantenimiento-table.js`

### 2. Editar Migración

```javascript
exports.up = pgm => {
  pgm.createTable('mantenimiento', {
    id_mantenimiento: 'id',
    id_equipo: { type: 'integer', notNull: true },
    tipo: { type: 'varchar(50)', notNull: true },
    fecha_programada: { type: 'date', notNull: true },
    estado: { type: 'varchar(20)', default: 'Pendiente' }
  });
};

exports.down = pgm => {
  pgm.dropTable('mantenimiento');
};
```

### 3. Ejecutar Migración

```bash
npm run migrate:up
```

## 🔄 Flujo de Trabajo

```
1. Desarrollo → npm run migrate:create nombre
2. Editar → Escribir cambios en el archivo
3. Probar → npm run migrate:up (local)
4. Commit → git add migrations/ && git commit
5. Deploy → npm run migrate:up (producción)
```

## 📚 Documentación Completa

Ver `GUIA_MIGRACIONES_BD.md` en la raíz del proyecto para guía completa.

## ⚠️ Reglas Importantes

1. **NUNCA** modifiques una migración ya ejecutada
2. **SIEMPRE** implementa el método `down` para rollback
3. **PRUEBA** localmente antes de desplegar
4. **NOMBRA** descriptivamente tus migraciones
5. **UNA** migración = UN cambio lógico

## 📊 Estructura de Archivos

```
migrations/
├── config.js                           # Configuración
├── README.md                           # Este archivo
├── 1704729600000_initial-schema.js     # Migración inicial
├── 1704729700000_add-mantenimiento.js  # Agregar tabla
└── 1704729800000_add-indexes.js        # Agregar índices
```

## 🎯 Ejemplos Comunes

### Crear Tabla

```javascript
exports.up = pgm => {
  pgm.createTable('nombre_tabla', {
    id: 'id',
    nombre: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });
};
```

### Agregar Columna

```javascript
exports.up = pgm => {
  pgm.addColumn('nombre_tabla', {
    nueva_columna: { type: 'varchar(50)' }
  });
};
```

### Crear Índice

```javascript
exports.up = pgm => {
  pgm.createIndex('nombre_tabla', 'columna');
};
```

---

**Para más información, consulta `GUIA_MIGRACIONES_BD.md`**
