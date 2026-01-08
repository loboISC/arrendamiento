# 🚀 Despliegue de ScaffoldPro v1.0 en QNAP TS-x73A con Git

## 🎯 Tu Situación

- ✅ **NAS:** QNAP TS-x73A (Excelente modelo)
- ✅ **Código:** En repositorio Git
- ✅ **Objetivo:** Desplegar v1.0 y poder actualizar a v1.1, v1.2, etc.

## 📋 Estrategia de Versionado

Usaremos **Git tags** para manejar versiones:

```
v1.0 → Primera versión en producción
v1.1 → Primera actualización
v1.2 → Segunda actualización
etc.
```

Esto te permite:
- ✅ Desplegar versiones específicas
- ✅ Hacer rollback si algo falla
- ✅ Mantener historial de cambios
- ✅ Actualizar con un solo comando

---

## 🔧 Preparación Inicial (Una sola vez)

### Paso 1: Preparar tu Repositorio Git

**En tu PC local (donde tienes el código):**

```bash
# 1. Ir a tu proyecto
cd c:\Users\siste\arrendamiento

# 2. Verificar que todo esté commiteado
git status

# 3. Crear tag para versión 1.0
git tag -a v1.0 -m "ScaffoldPro versión 1.0 - Primera versión en producción"

# 4. Subir tag al repositorio remoto
git push origin v1.0

# 5. Ver todos los tags
git tag
```

### Paso 2: Habilitar Container Station en QNAP

1. **Abrir QTS** (interfaz web del QNAP)
2. **App Center** → Buscar "Container Station"
3. **Instalar** Container Station
4. **Abrir** Container Station

### Paso 3: Habilitar SSH en QNAP

1. **Panel de Control** → **Telnet / SSH**
2. Activar **"Permitir conexión SSH"**
3. Puerto: **22** (o cambiarlo por seguridad, ej: 2222)
4. **Aplicar**

---

## 📦 Despliegue Inicial (v1.0)

### Paso 1: Conectar al QNAP por SSH

```bash
# Desde tu PC (PowerShell o CMD)
ssh admin@IP-DE-TU-QNAP

# Si cambiaste el puerto SSH:
ssh -p 2222 admin@IP-DE-TU-QNAP

# Ejemplo:
ssh admin@192.168.1.100
```

### Paso 2: Crear Estructura de Directorios

```bash
# Crear directorios principales
mkdir -p /share/Container/scaffoldpro
mkdir -p /share/Container/postgres-data

# Entrar al directorio
cd /share/Container/scaffoldpro
```

### Paso 3: Clonar Repositorio

```bash
# Clonar tu repositorio
git clone https://github.com/TU-USUARIO/arrendamiento.git app

# Si es repositorio privado, necesitarás autenticarte:
# Opción A: HTTPS con token
git clone https://TU-TOKEN@github.com/TU-USUARIO/arrendamiento.git app

# Opción B: SSH (recomendado)
git clone git@github.com:TU-USUARIO/arrendamiento.git app

# Entrar al directorio
cd app

# Cambiar a la versión 1.0
git checkout v1.0

# Verificar versión actual
git describe --tags
# Debería mostrar: v1.0
```

### Paso 4: Configurar Variables de Entorno

```bash
# Crear archivo .env
nano .env
```

**Pega el contenido generado desde la interfaz web:**

```env
# Variables de entorno para ScaffoldPro v1.0
# Generado el: [fecha]

# ===== BASE DE DATOS =====
DATABASE_URL=postgres://scaffoldpro:TU_PASSWORD_SEGURA@postgres:5432/torresdb
DB_SSL=false

# ===== SERVIDOR =====
PORT=3001
JWT_SECRET=tu_clave_jwt_super_segura_2024

# ===== SMTP (Correo Electrónico) =====
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=correo@tudominio.com
SMTP_PASS=tu_password_smtp

# ===== FACTURACIÓN =====
FACTURAMA_USER=usuario@facturama.com
FACTURAMA_PASSWORD=password
FACTURAMA_BASE_URL=https://api.facturama.mx
CSD_ENCRYPT_KEY=clave_cifrado
```

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

### Paso 5: Crear docker-compose.yml

```bash
# Volver al directorio principal
cd /share/Container/scaffoldpro

# Crear docker-compose.yml
nano docker-compose.yml
```

**Contenido:**

```yaml
version: '3.8'

services:
  # Base de datos PostgreSQL
  postgres:
    image: postgres:14-alpine
    container_name: scaffoldpro-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: torresdb
      POSTGRES_USER: scaffoldpro
      POSTGRES_PASSWORD: TU_PASSWORD_SEGURA_AQUI
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /share/Container/postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - scaffoldpro-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scaffoldpro"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Aplicación ScaffoldPro
  app:
    image: node:18-alpine
    container_name: scaffoldpro-app
    restart: unless-stopped
    working_dir: /app
    command: sh -c "npm install --production && npm start"
    env_file:
      - ./app/.env
    volumes:
      - /share/Container/scaffoldpro/app:/app
      - /share/Container/scaffoldpro/app/node_modules:/app/node_modules
    ports:
      - "3001:3001"
    networks:
      - scaffoldpro-network
    depends_on:
      postgres:
        condition: service_healthy
    labels:
      - "com.scaffoldpro.version=1.0"

  # Nginx (Proxy Inverso)
  nginx:
    image: nginx:alpine
    container_name: scaffoldpro-nginx
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - /share/Container/scaffoldpro/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - scaffoldpro-network
    depends_on:
      - app

networks:
  scaffoldpro-network:
    driver: bridge
```

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

### Paso 6: Crear Configuración de Nginx

```bash
nano nginx.conf
```

**Contenido:**

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3001;
    }

    server {
        listen 80;
        server_name _;

        # Mostrar versión en headers (útil para debugging)
        add_header X-ScaffoldPro-Version "1.0" always;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://app/api/health;
            access_log off;
        }
    }
}
```

**Guardar:** `Ctrl+O`, Enter, `Ctrl+X`

### Paso 7: Importar Base de Datos

```bash
# Si tienes un dump SQL, súbelo al NAS primero
# Desde tu PC:
scp torres9.sql admin@IP-QNAP:/share/Container/scaffoldpro/

# Luego en el QNAP, después de iniciar los contenedores:
# (Ver Paso 8 primero, luego volver aquí)
```

### Paso 8: Iniciar Contenedores

```bash
# Desde /share/Container/scaffoldpro
cd /share/Container/scaffoldpro

# Iniciar contenedores
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Esperar a que todo inicie (30-60 segundos)
# Presiona Ctrl+C para salir de los logs

# Verificar estado
docker-compose ps
```

**Deberías ver:**

```
NAME                  STATUS              PORTS
scaffoldpro-db        Up (healthy)        5432/tcp
scaffoldpro-app       Up                  3001/tcp
scaffoldpro-nginx     Up                  0.0.0.0:8080->80/tcp
```

### Paso 9: Importar Base de Datos (Continuación)

```bash
# Importar dump SQL
docker exec -i scaffoldpro-db psql -U scaffoldpro -d torresdb < torres9.sql

# O si prefieres hacerlo interactivamente:
docker exec -it scaffoldpro-db psql -U scaffoldpro -d torresdb

# Dentro de psql:
\i /path/to/dump.sql
\q
```

### Paso 10: Verificar Despliegue

```bash
# Verificar que la app esté corriendo
docker logs scaffoldpro-app

# Probar endpoint
curl http://localhost:8080

# Desde tu navegador:
http://IP-DE-TU-QNAP:8080
```

---

## 🔄 Actualización a Versiones Nuevas (v1.1, v1.2, etc.)

### Flujo de Actualización

```
Desarrollo → Commit → Tag → Push → Pull en QNAP → Restart
```

### Paso 1: Preparar Nueva Versión en tu PC

```bash
# En tu PC, después de hacer cambios
cd c:\Users\siste\arrendamiento

# 1. Commit de cambios
git add .
git commit -m "Actualización v1.1: [descripción de cambios]"

# 2. Crear tag para nueva versión
git tag -a v1.1 -m "ScaffoldPro v1.1 - [descripción]"

# 3. Subir al repositorio
git push origin main
git push origin v1.1

# Ver tags
git tag
```

### Paso 2: Actualizar en QNAP

```bash
# Conectar al QNAP
ssh admin@IP-QNAP

# Ir al directorio de la app
cd /share/Container/scaffoldpro/app

# Ver versión actual
git describe --tags
# Muestra: v1.0

# Descargar actualizaciones
git fetch --all --tags

# Ver versiones disponibles
git tag

# Cambiar a la nueva versión
git checkout v1.1

# Verificar versión
git describe --tags
# Muestra: v1.1

# Volver al directorio principal
cd /share/Container/scaffoldpro

# Reiniciar contenedores
docker-compose restart app

# Ver logs para verificar
docker-compose logs -f app
```

### Paso 3: Verificar Actualización

```bash
# Verificar versión en logs
docker logs scaffoldpro-app | grep -i version

# Probar aplicación
curl http://localhost:8080

# Verificar en navegador
http://IP-QNAP:8080
```

---

## 🔙 Rollback (Volver a Versión Anterior)

Si algo sale mal con v1.1, puedes volver a v1.0:

```bash
# Conectar al QNAP
ssh admin@IP-QNAP

# Ir al directorio
cd /share/Container/scaffoldpro/app

# Volver a versión anterior
git checkout v1.0

# Reiniciar
cd /share/Container/scaffoldpro
docker-compose restart app

# Verificar
docker logs scaffoldpro-app
```

---

## 📝 Script de Actualización Automática

Crea un script para facilitar actualizaciones:

```bash
# Crear script
nano /share/Container/scaffoldpro/update.sh
```

**Contenido:**

```bash
#!/bin/bash

# Script de actualización de ScaffoldPro
# Uso: ./update.sh v1.1

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "❌ Error: Debes especificar una versión"
    echo "Uso: ./update.sh v1.1"
    exit 1
fi

echo "🔄 Actualizando ScaffoldPro a $VERSION..."

# Ir al directorio de la app
cd /share/Container/scaffoldpro/app

# Guardar versión actual
CURRENT_VERSION=$(git describe --tags)
echo "📌 Versión actual: $CURRENT_VERSION"

# Descargar actualizaciones
echo "📥 Descargando actualizaciones..."
git fetch --all --tags

# Verificar que la versión existe
if ! git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo "❌ Error: La versión $VERSION no existe"
    echo "Versiones disponibles:"
    git tag
    exit 1
fi

# Cambiar a nueva versión
echo "🔀 Cambiando a $VERSION..."
git checkout "$VERSION"

# Volver al directorio principal
cd /share/Container/scaffoldpro

# Reiniciar contenedores
echo "🔄 Reiniciando contenedores..."
docker-compose restart app

# Esperar a que inicie
echo "⏳ Esperando a que la aplicación inicie..."
sleep 10

# Verificar estado
echo "✅ Verificando estado..."
docker-compose ps

# Mostrar logs recientes
echo "📋 Logs recientes:"
docker-compose logs --tail=20 app

echo ""
echo "✅ Actualización completada!"
echo "📌 Versión anterior: $CURRENT_VERSION"
echo "📌 Versión actual: $VERSION"
echo ""
echo "🌐 Accede a: http://$(hostname -I | awk '{print $1}'):8080"
```

**Dar permisos:**

```bash
chmod +x /share/Container/scaffoldpro/update.sh
```

**Usar el script:**

```bash
# Actualizar a v1.1
/share/Container/scaffoldpro/update.sh v1.1

# Actualizar a v1.2
/share/Container/scaffoldpro/update.sh v1.2

# Volver a v1.0
/share/Container/scaffoldpro/update.sh v1.0
```

---

## 📊 Gestión de Versiones

### Ver Versión Actual

```bash
# Método 1: Git
cd /share/Container/scaffoldpro/app
git describe --tags

# Método 2: Docker labels
docker inspect scaffoldpro-app | grep version

# Método 3: Logs de la aplicación
docker logs scaffoldpro-app | head -20
```

### Listar Todas las Versiones

```bash
cd /share/Container/scaffoldpro/app
git tag

# Con fechas
git tag -n

# Más detallado
git log --tags --simplify-by-decoration --pretty="format:%ai %d"
```

### Ver Cambios Entre Versiones

```bash
# Ver diferencias entre v1.0 y v1.1
git diff v1.0 v1.1

# Ver commits entre versiones
git log v1.0..v1.1 --oneline

# Ver archivos modificados
git diff --name-only v1.0 v1.1
```

---

## 🔒 Mejores Prácticas de Versionado

### 1. Nomenclatura de Versiones (Semantic Versioning)

```
v1.0.0 → MAJOR.MINOR.PATCH

MAJOR (1.x.x): Cambios incompatibles
MINOR (x.1.x): Nuevas funcionalidades compatibles
PATCH (x.x.1): Correcciones de bugs
```

**Ejemplos:**

```bash
v1.0.0 → Primera versión en producción
v1.1.0 → Agregaste módulo de facturación
v1.1.1 → Corregiste un bug en facturación
v1.2.0 → Agregaste módulo de reportes
v2.0.0 → Cambio mayor en la base de datos
```

### 2. Crear Tags con Mensajes Descriptivos

```bash
# ✅ Bueno
git tag -a v1.1.0 -m "v1.1.0 - Agregado módulo de facturación y correcciones de bugs"

# ❌ Malo
git tag v1.1.0
```

### 3. Mantener CHANGELOG.md

Crea un archivo `CHANGELOG.md` en tu proyecto:

```markdown
# Changelog

## [1.1.0] - 2026-01-15

### Agregado
- Módulo de facturación electrónica
- Integración con Facturama
- Exportación de reportes a PDF

### Corregido
- Bug en cálculo de IVA
- Error al guardar clientes

### Cambiado
- Mejorado rendimiento de consultas

## [1.0.0] - 2026-01-08

### Agregado
- Versión inicial en producción
- Módulo de cotizaciones
- Módulo de contratos
- Módulo de clientes
```

### 4. Probar Antes de Crear Tag

```bash
# En desarrollo
git add .
git commit -m "Nuevas funcionalidades para v1.1"
git push origin main

# Probar en ambiente de desarrollo/staging

# Si todo funciona, crear tag
git tag -a v1.1.0 -m "v1.1.0 - Listo para producción"
git push origin v1.1.0
```

---

## 💾 Backups Antes de Actualizar

### Script de Backup Automático

```bash
nano /share/Container/scaffoldpro/backup.sh
```

**Contenido:**

```bash
#!/bin/bash

BACKUP_DIR="/share/Container/scaffoldpro/backups"
DATE=$(date +%Y%m%d_%H%M%S)
VERSION=$(cd /share/Container/scaffoldpro/app && git describe --tags)

# Crear directorio de backups
mkdir -p $BACKUP_DIR

echo "📦 Creando backup de ScaffoldPro $VERSION..."

# Backup de base de datos
echo "💾 Respaldando base de datos..."
docker exec scaffoldpro-db pg_dump -U scaffoldpro torresdb > $BACKUP_DIR/db_${VERSION}_${DATE}.sql

# Backup de archivos subidos (si los hay)
echo "📁 Respaldando archivos..."
tar -czf $BACKUP_DIR/files_${VERSION}_${DATE}.tar.gz /share/Container/scaffoldpro/app/uploads 2>/dev/null || true

# Limpiar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup completado: $BACKUP_DIR"
echo "📌 Versión: $VERSION"
echo "📅 Fecha: $DATE"
```

**Dar permisos:**

```bash
chmod +x /share/Container/scaffoldpro/backup.sh
```

**Usar antes de actualizar:**

```bash
# Hacer backup
/share/Container/scaffoldpro/backup.sh

# Luego actualizar
/share/Container/scaffoldpro/update.sh v1.1
```

---

## 🔍 Monitoreo y Logs

### Ver Logs por Versión

```bash
# Logs de la versión actual
docker logs scaffoldpro-app

# Logs en tiempo real
docker logs -f scaffoldpro-app

# Últimas 100 líneas
docker logs --tail=100 scaffoldpro-app

# Logs con timestamps
docker logs -t scaffoldpro-app
```

### Verificar Salud de la Aplicación

```bash
# Estado de contenedores
docker-compose ps

# Uso de recursos
docker stats scaffoldpro-app

# Health check
curl http://localhost:8080/health
```

---

## 📋 Checklist de Actualización

Antes de cada actualización, verifica:

- [ ] ✅ Backup de base de datos creado
- [ ] ✅ Tag creado y pusheado a Git
- [ ] ✅ CHANGELOG.md actualizado
- [ ] ✅ Variables de entorno revisadas
- [ ] ✅ Cambios en base de datos documentados
- [ ] ✅ Usuarios notificados de la actualización
- [ ] ✅ Ventana de mantenimiento programada (si es necesario)

---

## 🎉 Resumen del Flujo Completo

### Primera Vez (v1.0)

```bash
# En tu PC
git tag -a v1.0 -m "Primera versión"
git push origin v1.0

# En QNAP
ssh admin@IP-QNAP
cd /share/Container/scaffoldpro
git clone [repo] app
cd app && git checkout v1.0
cd .. && docker-compose up -d
```

### Actualizaciones (v1.1, v1.2, etc.)

```bash
# En tu PC
git add . && git commit -m "Cambios v1.1"
git tag -a v1.1 -m "Versión 1.1"
git push origin main && git push origin v1.1

# En QNAP
ssh admin@IP-QNAP
/share/Container/scaffoldpro/backup.sh
/share/Container/scaffoldpro/update.sh v1.1
```

---

**¡Listo! Ahora tienes un sistema de despliegue profesional con versionado!** 🚀
