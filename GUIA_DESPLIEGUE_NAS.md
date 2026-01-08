# 🗄️ Despliegue de ScaffoldPro en Servidor NAS

## 🎯 ¿Qué es un NAS?

Un **NAS (Network Attached Storage)** es un dispositivo de almacenamiento conectado a la red que también puede funcionar como servidor de aplicaciones. Marcas populares: Synology, QNAP, Asustor, TrueNAS.

## ✅ Ventajas de Usar un NAS

- ✅ **Ya lo tienes** - No necesitas comprar hardware adicional
- ✅ **Bajo consumo** - 15-30W, mucho menos que una PC
- ✅ **Siempre encendido** - Diseñado para funcionar 24/7
- ✅ **Almacenamiento incluido** - Perfecto para backups
- ✅ **Interfaz web** - Fácil de administrar
- ✅ **Docker incluido** - En la mayoría de modelos modernos
- ✅ **Sin costos mensuales** - Solo electricidad (~$3/mes)

## 🔍 Compatibilidad por Marca

### ✅ Synology (Más Popular)

**Modelos Compatibles:**
- DS220+, DS420+, DS720+, DS920+ (y superiores)
- DS218+, DS418+, DS918+ (modelos anteriores)
- Serie Plus (+) o superior recomendada

**Requisitos:**
- DSM 7.0 o superior
- 2GB RAM mínimo (4GB recomendado)
- CPU Intel Celeron o superior

**Facilidad:** ⭐⭐⭐⭐⭐ (Muy fácil con Docker)

### ✅ QNAP

**Modelos Compatibles:**
- TS-x53D, TS-x64, TS-x73A (y superiores)
- Serie TS-x51+ o superior

**Requisitos:**
- QTS 5.0 o superior
- 2GB RAM mínimo (4GB recomendado)
- CPU Intel o AMD

**Facilidad:** ⭐⭐⭐⭐ (Fácil con Container Station)

### ✅ Asustor

**Modelos Compatibles:**
- AS5304T, AS6604T (y superiores)
- Serie AS-6xx o superior

**Requisitos:**
- ADM 4.0 o superior
- 2GB RAM mínimo

**Facilidad:** ⭐⭐⭐⭐ (Fácil con Docker)

### ✅ TrueNAS / FreeNAS

**Requisitos:**
- TrueNAS CORE o SCALE
- 8GB RAM mínimo
- CPU x86-64

**Facilidad:** ⭐⭐⭐ (Requiere más conocimientos)

---

## 🚀 Métodos de Despliegue en NAS

### Método 1: Docker (Recomendado) ⭐

**Ventajas:**
- ✅ Más fácil de configurar
- ✅ Aislado del sistema
- ✅ Fácil de actualizar
- ✅ Portable

**Desventajas:**
- ⚠️ Requiere NAS con soporte Docker

### Método 2: Instalación Nativa

**Ventajas:**
- ✅ Mejor rendimiento
- ✅ Funciona en cualquier NAS con SSH

**Desventajas:**
- ⚠️ Más complejo de configurar
- ⚠️ Puede afectar el sistema del NAS

---

## 📦 Método 1: Despliegue con Docker (Synology)

### Paso 1: Habilitar SSH y Docker

1. **Habilitar SSH:**
   - Panel de Control → Terminal & SNMP
   - Activar "Habilitar servicio SSH"
   - Puerto: 22

2. **Instalar Docker:**
   - Centro de Paquetes → Buscar "Docker"
   - Instalar "Container Manager" (DSM 7.2+) o "Docker" (DSM 7.0-7.1)

### Paso 2: Crear Estructura de Carpetas

```bash
# Conectar por SSH
ssh admin@ip-de-tu-nas

# Crear directorios
sudo mkdir -p /volume1/docker/scaffoldpro
sudo mkdir -p /volume1/docker/postgres-data

# Dar permisos
sudo chmod -R 755 /volume1/docker/scaffoldpro
```

### Paso 3: Crear docker-compose.yml

```bash
# Crear archivo
sudo nano /volume1/docker/scaffoldpro/docker-compose.yml
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
      POSTGRES_PASSWORD: tu_password_segura_aqui
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /volume1/docker/postgres-data:/var/lib/postgresql/data
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
    command: sh -c "npm install && npm start"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://scaffoldpro:tu_password_segura_aqui@postgres:5432/torresdb
      DB_SSL: "false"
      PORT: 3001
      JWT_SECRET: tu_clave_jwt_super_segura
      SMTP_HOST: smtp.hostinger.com
      SMTP_PORT: 465
      SMTP_USER: correo@tudominio.com
      SMTP_PASS: tu_password_smtp
    volumes:
      - /volume1/docker/scaffoldpro/app:/app
    ports:
      - "3001:3001"
    networks:
      - scaffoldpro-network
    depends_on:
      postgres:
        condition: service_healthy

  # Nginx (Proxy Inverso)
  nginx:
    image: nginx:alpine
    container_name: scaffoldpro-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /volume1/docker/scaffoldpro/nginx.conf:/etc/nginx/nginx.conf:ro
      - /volume1/docker/scaffoldpro/ssl:/etc/nginx/ssl:ro
    networks:
      - scaffoldpro-network
    depends_on:
      - app

networks:
  scaffoldpro-network:
    driver: bridge
```

### Paso 4: Subir el Código de la Aplicación

**Opción A: Usando File Station (Interfaz Web)**

1. Abre File Station en DSM
2. Navega a `docker/scaffoldpro/`
3. Crea carpeta `app`
4. Sube todos los archivos de tu proyecto

**Opción B: Usando SCP/SFTP**

```bash
# Desde tu PC local
scp -r c:\Users\siste\arrendamiento/* admin@ip-nas:/volume1/docker/scaffoldpro/app/
```

**Opción C: Usando Git**

```bash
# Conectar por SSH al NAS
ssh admin@ip-de-tu-nas

# Clonar repositorio
cd /volume1/docker/scaffoldpro
sudo git clone https://github.com/tu-usuario/arrendamiento.git app
```

### Paso 5: Crear Configuración de Nginx

```bash
sudo nano /volume1/docker/scaffoldpro/nginx.conf
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
        }
    }
}
```

### Paso 6: Iniciar los Contenedores

**Desde la Interfaz Web (Container Manager):**

1. Abre Container Manager
2. Ve a "Proyecto"
3. Clic en "Crear"
4. Selecciona la ruta: `/volume1/docker/scaffoldpro`
5. Clic en "Crear"

**Desde SSH:**

```bash
cd /volume1/docker/scaffoldpro
sudo docker-compose up -d

# Ver logs
sudo docker-compose logs -f

# Ver estado
sudo docker-compose ps
```

### Paso 7: Importar Base de Datos

```bash
# Copiar dump SQL al NAS
scp torres9.sql admin@ip-nas:/volume1/docker/scaffoldpro/

# Conectar al contenedor de PostgreSQL
sudo docker exec -it scaffoldpro-db psql -U scaffoldpro -d torresdb

# Importar desde el contenedor
sudo docker exec -i scaffoldpro-db psql -U scaffoldpro -d torresdb < /volume1/docker/scaffoldpro/torres9.sql
```

### Paso 8: Acceder a la Aplicación

```
http://ip-de-tu-nas
o
http://nombre-nas.local
```

---

## 🔧 Método 2: Instalación Nativa (Sin Docker)

### Para Synology DSM 7.x

```bash
# 1. Conectar por SSH
ssh admin@ip-de-tu-nas

# 2. Instalar Node.js desde Centro de Paquetes
# O descargar manualmente:
wget https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz
sudo tar -xf node-v18.19.0-linux-x64.tar.xz -C /usr/local/
sudo ln -s /usr/local/node-v18.19.0-linux-x64/bin/node /usr/bin/node
sudo ln -s /usr/local/node-v18.19.0-linux-x64/bin/npm /usr/bin/npm

# 3. Instalar PostgreSQL desde Centro de Paquetes
# O configurar contenedor Docker solo para PostgreSQL

# 4. Clonar/subir aplicación
cd /volume1/web
sudo git clone https://github.com/tu-usuario/arrendamiento.git scaffoldpro
cd scaffoldpro

# 5. Instalar dependencias
npm install

# 6. Crear .env
nano .env
# (Pega el contenido de tu archivo .env)

# 7. Iniciar con PM2
sudo npm install -g pm2
pm2 start src/index.js --name scaffoldpro
pm2 save
pm2 startup

# 8. Configurar inicio automático
# Editar script de inicio del NAS
sudo nano /usr/local/etc/rc.d/scaffoldpro.sh
```

**Contenido del script:**

```bash
#!/bin/sh
case $1 in
    start)
        su - admin -c "cd /volume1/web/scaffoldpro && pm2 start src/index.js --name scaffoldpro"
        ;;
    stop)
        su - admin -c "pm2 stop scaffoldpro"
        ;;
    restart)
        su - admin -c "pm2 restart scaffoldpro"
        ;;
esac
```

```bash
# Dar permisos
sudo chmod +x /usr/local/etc/rc.d/scaffoldpro.sh
```

---

## 🌐 Acceso desde Internet

### Opción 1: Port Forwarding en Router

```
1. Accede a tu router (192.168.1.1 o 192.168.0.1)
2. Busca "Port Forwarding" o "Reenvío de puertos"
3. Configura:
   - Puerto externo: 80, 443
   - Puerto interno: 80, 443
   - IP interna: IP de tu NAS (ej: 192.168.1.100)
4. Guarda cambios
```

### Opción 2: QuickConnect (Synology)

```
1. Panel de Control → QuickConnect
2. Activar QuickConnect
3. Registrar ID: tuempresa
4. Acceder desde: https://tuempresa.quickconnect.to
```

### Opción 3: DDNS + Reverse Proxy

```
1. Panel de Control → Conectividad Externa → DDNS
2. Agregar servicio DDNS (Synology, No-IP, etc.)
3. Configurar dominio: tuempresa.synology.me
4. Panel de Control → Portal de Aplicaciones → Proxy Inverso
5. Crear regla para ScaffoldPro
```

### Opción 4: Cloudflare Tunnel (Más Seguro)

```bash
# Instalar en el NAS
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Configurar túnel
cloudflared tunnel login
cloudflared tunnel create scaffoldpro
cloudflared tunnel route dns scaffoldpro app.tudominio.com

# Crear configuración
sudo nano /volume1/docker/scaffoldpro/cloudflared-config.yml
```

**Contenido:**

```yaml
tunnel: tu-tunnel-id
credentials-file: /volume1/docker/scaffoldpro/credentials.json

ingress:
  - hostname: app.tudominio.com
    service: http://localhost:80
  - service: http_status:404
```

```bash
# Ejecutar
cloudflared tunnel run scaffoldpro
```

---

## 📊 Rendimiento Esperado

### NAS de Gama Media (DS220+, TS-253D)
```
CPU: Intel Celeron J4025 (2 cores)
RAM: 2-6 GB
Usuarios simultáneos: 10-20
Tiempo de respuesta: <500ms
Carga CPU: 20-40%
```

### NAS de Gama Alta (DS920+, TS-464)
```
CPU: Intel Celeron J4125 (4 cores)
RAM: 4-8 GB
Usuarios simultáneos: 30-50
Tiempo de respuesta: <300ms
Carga CPU: 10-30%
```

---

## 🔒 Seguridad en NAS

### Configuración Recomendada

```bash
# 1. Cambiar puerto SSH
Panel de Control → Terminal & SNMP → Puerto: 2222

# 2. Habilitar firewall
Panel de Control → Seguridad → Firewall
- Permitir solo puertos necesarios: 80, 443, 2222

# 3. Habilitar protección contra fuerza bruta
Panel de Control → Seguridad → Protección
- Activar bloqueo automático

# 4. Configurar SSL
Panel de Control → Seguridad → Certificado
- Usar Let's Encrypt o importar certificado

# 5. Actualizar DSM regularmente
Panel de Control → Actualización y Restauración
```

---

## 💾 Backups Automáticos

### Usando Hyper Backup (Synology)

```
1. Instalar Hyper Backup desde Centro de Paquetes
2. Crear tarea de respaldo:
   - Origen: /volume1/docker/scaffoldpro
   - Destino: Carpeta local, USB, o nube
   - Frecuencia: Diaria a las 2 AM
3. Configurar retención: 7 días
```

### Script de Respaldo Manual

```bash
#!/bin/bash
# /volume1/scripts/backup-scaffoldpro.sh

BACKUP_DIR="/volume1/backups/scaffoldpro"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio
mkdir -p $BACKUP_DIR

# Respaldar base de datos
docker exec scaffoldpro-db pg_dump -U scaffoldpro torresdb > $BACKUP_DIR/db_$DATE.sql

# Respaldar archivos
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /volume1/docker/scaffoldpro/app

# Limpiar respaldos antiguos (>7 días)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completado: $DATE"
```

**Programar con Programador de Tareas:**

```
Panel de Control → Programador de Tareas
- Crear → Tarea programada → Script definido por el usuario
- Nombre: Backup ScaffoldPro
- Usuario: root
- Programación: Diaria 2:00 AM
- Script: /volume1/scripts/backup-scaffoldpro.sh
```

---

## 🔧 Mantenimiento

### Comandos Útiles

```bash
# Ver logs de Docker
sudo docker-compose logs -f app

# Reiniciar contenedores
sudo docker-compose restart

# Actualizar aplicación
cd /volume1/docker/scaffoldpro/app
git pull
sudo docker-compose restart app

# Ver uso de recursos
docker stats

# Limpiar imágenes antiguas
docker system prune -a
```

### Monitoreo

```
Panel de Control → Centro de Recursos
- CPU: <50% en promedio
- RAM: <80% en uso
- Red: Monitorear tráfico
- Disco: >20% libre
```

---

## ❓ Preguntas Frecuentes

### ¿Mi NAS es suficiente?
Si tiene 2GB+ RAM y CPU Intel/AMD, sí. Verifica en las especificaciones.

### ¿Puedo usar mi NAS para otras cosas?
Sí, Docker aísla la aplicación. Puedes seguir usando el NAS normalmente.

### ¿Afectará el rendimiento del NAS?
Mínimamente. ScaffoldPro usa ~500MB RAM y 10-20% CPU en uso normal.

### ¿Necesito un NAS de gama alta?
No. Un DS220+ o equivalente es suficiente para 10-20 usuarios.

### ¿Puedo acceder desde internet?
Sí, con port forwarding, QuickConnect, o Cloudflare Tunnel.

### ¿Es seguro?
Sí, si configuras firewall, SSL, y actualizas regularmente el DSM.

---

## 💰 Costos

```
Hardware NAS: Ya lo tienes ($0)
Electricidad: ~$3/mes (20W promedio)
Dominio (opcional): $10-15/año
SSL: Gratis (Let's Encrypt)

Total: ~$50/año
```

**Comparado con VPS:** Ahorras ~$115/año

---

## ✅ Ventajas de Usar tu NAS

1. ✅ **Costo cero** - Ya tienes el hardware
2. ✅ **Datos locales** - Control total de tu información
3. ✅ **Backups integrados** - Aprovecha el almacenamiento del NAS
4. ✅ **Bajo consumo** - 15-30W vs 100W+ de una PC
5. ✅ **Interfaz familiar** - Ya conoces DSM/QTS
6. ✅ **Múltiples servicios** - Puedes correr otras apps en Docker

---

## 🎉 Conclusión

**Tu NAS es una EXCELENTE opción para ScaffoldPro:**

- ✅ Gratis (ya lo tienes)
- ✅ Fácil de configurar con Docker
- ✅ Bajo consumo eléctrico
- ✅ Perfecto para uso en oficina
- ✅ Backups automáticos incluidos

**Recomendación:** Usa el **Método 1 (Docker)** para una configuración limpia y fácil de mantener.

---

**¿Listo para desplegar en tu NAS? Sigue esta guía paso a paso!** 🚀
