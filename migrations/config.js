require('dotenv').config();

module.exports = {
    // URL de conexión a la base de datos
    databaseUrl: process.env.DATABASE_URL ||
        `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'irving'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'torresdb'}`,

    // Tabla donde se guardan las migraciones ejecutadas
    migrationsTable: 'pgmigrations',

    // Directorio donde están las migraciones
    dir: 'migrations',

    // Dirección por defecto (up = aplicar, down = revertir)
    direction: 'up',

    // Número de migraciones a ejecutar (Infinity = todas)
    count: Infinity,

    // Patrón de archivos a ignorar
    ignorePattern: '.*\\.map',

    // Schema de PostgreSQL
    schema: 'public',

    // Crear schema si no existe
    createSchema: false,

    // Crear tabla de migraciones si no existe
    createMigrationsSchema: false,

    // Modo verbose para ver detalles
    verbose: true
};
