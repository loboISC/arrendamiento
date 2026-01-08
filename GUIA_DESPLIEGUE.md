# 🚀 Guía Completa de Despliegue - ScaffoldPro

## 📋 Índice
1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Opciones de Despliegue](#opciones-de-despliegue)
3. [Opción 1: Servidor Dedicado/VPS](#opción-1-servidor-dedicadovps)
4. [Opción 2: Servidor en Red Local](#opción-2-servidor-en-red-local)
5. [Opción 3: Servicios en la Nube](#opción-3-servicios-en-la-nube)
6. [Configuración Paso a Paso](#configuración-paso-a-paso)
7. [Mantenimiento y Monitoreo](#mantenimiento-y-monitoreo)

---

## 📊 Requisitos del Sistema

### Para el Servidor Backend (Node.js)

#### Mínimos
- **CPU**: 1 core / 1 vCPU
- **RAM**: 1 GB
- **Almacenamiento**: 10 GB SSD
- **Sistema Operativo**: 
  - Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
  - Windows Server 2019+
  - macOS 11+ (para desarrollo)

#### Recomendados para Producción
- **CPU**: 2-4 cores / vCPUs
- **RAM**: 4-8 GB
- **Almacenamiento**: 50-100 GB SSD
- **Ancho de banda**: 100 Mbps+
- **Sistema Operativo**: Ubuntu Server 22.04 LTS (recomendado)

### Para la Base de Datos (PostgreSQL)

#### Mínimos
- **RAM**: 512 MB adicionales
- **Almacenamiento**: 5 GB SSD

#### Recomendados
- **RAM**: 2-4 GB adicionales
- **Almacenamiento**: 20-50 GB SSD
- **Conexiones simultáneas**: 100+

### Software Requerido

```bash
# Node.js
Node.js 18.x o superior
npm 9.x o superior

# Base de Datos
PostgreSQL 14.x o superior

# Opcional pero Recomendado
PM2 (gestor de procesos)
Nginx (servidor web/proxy inverso)
Certbot (certificados SSL)
Git (control de versiones)
```

---

## 🎯 Opciones de Despliegue

### Comparativa Rápida

| Opción | Costo | Dificultad | Control | Escalabilidad | Recomendado para |
|--------|-------|------------|---------|---------------|------------------|
| **VPS/Servidor Dedicado** | $5-50/mes | Media | Alto | Media | Producción general |
| **Red Local** | Hardware propio | Baja | Total | Baja | Desarrollo/Oficina |
| **Cloud (AWS/Azure/GCP)** | $10-100+/mes | Alta | Medio | Alta | Empresas grandes |
| **PaaS (Heroku/Railway)** | $7-25/mes | Baja | Bajo | Alta | Startups/Rápido |

---

## 🖥️ Opción 1: Servidor Dedicado/VPS

### ✅ Ventajas
- Control total del servidor
- Mejor relación precio/rendimiento
- Configuración personalizada
- IP dedicada

### ❌ Desventajas
- Requiere conocimientos técnicos
- Mantenimiento manual
- Responsable de la seguridad

### 💰 Proveedores Recomendados

#### 1. **DigitalOcean** (Recomendado)
- **Precio**: Desde $6/mes (1GB RAM, 1 vCPU)
- **Ubicación**: Múltiples datacenters
- **Facilidad**: Muy fácil de usar
- **Soporte**: Excelente documentación
- 🔗 [digitalocean.com](https://www.digitalocean.com)

```bash
# Droplet recomendado para ScaffoldPro
Plan: Basic
RAM: 2 GB
vCPU: 1
SSD: 50 GB
Transferencia: 2 TB
Precio: ~$12/mes
```

#### 2. **Linode (Akamai)**
- **Precio**: Desde $5/mes
- **Ubicación**: Global
- **Facilidad**: Fácil
- 🔗 [linode.com](https://www.linode.com)

#### 3. **Vultr**
- **Precio**: Desde $6/mes
- **Ubicación**: Global
- **Facilidad**: Fácil
- 🔗 [vultr.com](https://www.vultr.com)

#### 4. **Hostinger VPS** (Opción Económica)
- **Precio**: Desde $4/mes
- **Ubicación**: Global
- **Facilidad**: Muy fácil
- 🔗 [hostinger.com](https://www.hostinger.com)

### 📝 Configuración en VPS (Ubuntu 22.04)

```bash
# 1. Conectar al servidor
ssh root@tu-servidor-ip

# 2. Actualizar sistema
sudo apt update && sudo apt upgrade -y

# 3. Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 5. Instalar PM2
sudo npm install -g pm2

# 6. Instalar Nginx
sudo apt install -y nginx

# 7. Instalar Git
sudo apt install -y git

# Verificar instalaciones
node --version
npm --version
psql --version
pm2 --version
nginx -v
```

---

## 🏢 Opción 2: Servidor en Red Local

### ✅ Ventajas
- Sin costos mensuales
- Control total
- Datos en tu infraestructura
- Acceso rápido en red local

### ❌ Desventajas
- No accesible desde internet (sin configuración adicional)
- Requiere hardware propio
- Consumo eléctrico
- Mantenimiento físico

### 💻 Hardware Recomendado

#### Opción A: PC de Escritorio Reutilizada
```
CPU: Intel i3/i5 o AMD Ryzen 3/5 (4+ cores)
RAM: 8 GB mínimo, 16 GB recomendado
Almacenamiento: 120 GB SSD + 500 GB HDD (opcional)
Red: Ethernet 1 Gbps
Costo: $0 (si ya tienes el equipo)
```

#### Opción B: Mini PC / NUC
```
Modelo: Intel NUC, Lenovo ThinkCentre Tiny, HP EliteDesk Mini
CPU: Intel i3/i5 (8va gen+)
RAM: 8-16 GB
Almacenamiento: 256 GB SSD
Red: Ethernet 1 Gbps
Costo: $200-400 USD (nuevo), $100-200 (usado)
Consumo: ~10-20W
```

#### Opción C: Raspberry Pi 4/5 (Económica)
```
Modelo: Raspberry Pi 4 (4GB/8GB) o Pi 5
CPU: ARM Cortex-A72/A76
RAM: 4-8 GB
Almacenamiento: MicroSD 64GB + SSD USB (recomendado)
Red: Ethernet 1 Gbps
Costo: $50-100 USD
Consumo: ~5-8W
Nota: Suficiente para 5-10 usuarios simultáneos
```

### 🔧 Sistemas Operativos Recomendados

#### 1. **Ubuntu Server 22.04 LTS** (Recomendado)
- ✅ Gratis y open source
- ✅ Excelente soporte
- ✅ Fácil de configurar
- ✅ Actualizaciones de seguridad hasta 2027
- 🔗 [ubuntu.com/download/server](https://ubuntu.com/download/server)

#### 2. **Debian 12**
- ✅ Muy estable
- ✅ Ligero
- ✅ Ideal para servidores
- 🔗 [debian.org](https://www.debian.org)

#### 3. **Windows Server 2022** (Si prefieres Windows)
- ✅ Interfaz familiar
- ✅ Integración con Active Directory
- ❌ Requiere licencia (~$500)
- 🔗 [microsoft.com](https://www.microsoft.com/windows-server)

#### 4. **Windows 10/11 Pro** (Alternativa económica)
- ✅ Más económico que Server
- ✅ Interfaz gráfica
- ⚠️ Límite de 20 conexiones simultáneas
- Costo: $100-200 USD

### 📡 Acceso desde Internet (Opcional)

Si quieres acceder desde fuera de tu red local:

#### Opción A: Port Forwarding (Gratis)
```bash
# Configurar en tu router
Puerto externo: 80, 443
Puerto interno: 3001 (o el que uses)
IP interna: 192.168.x.x (IP de tu servidor)

# Obtener IP pública
curl ifconfig.me

# Configurar DNS dinámico (si tu IP cambia)
# Servicios gratuitos: No-IP, DuckDNS, FreeDNS
```

#### Opción B: Cloudflare Tunnel (Gratis y Seguro)
```bash
# Instalar cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Autenticar
cloudflared tunnel login

# Crear túnel
cloudflared tunnel create scaffoldpro

# Configurar
cloudflared tunnel route dns scaffoldpro app.tudominio.com

# Ejecutar
cloudflared tunnel run scaffoldpro
```

#### Opción C: Ngrok (Desarrollo/Temporal)
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto
ngrok http 3001

# Obtendrás una URL como: https://abc123.ngrok.io
```

---

## ☁️ Opción 3: Servicios en la Nube

### A. Platform as a Service (PaaS) - Más Fácil

#### 1. **Railway** (Recomendado para Startups)
- **Precio**: $5/mes + uso
- **Facilidad**: ⭐⭐⭐⭐⭐
- **PostgreSQL incluido**: Sí
- **Deploy**: Git push
- 🔗 [railway.app](https://railway.app)

```bash
# Desplegar en Railway
1. Conecta tu repositorio GitHub
2. Railway detecta automáticamente Node.js
3. Agrega PostgreSQL desde el dashboard
4. Configura variables de entorno
5. Deploy automático
```

#### 2. **Render**
- **Precio**: Gratis (con limitaciones), $7/mes Pro
- **Facilidad**: ⭐⭐⭐⭐⭐
- **PostgreSQL**: $7/mes adicional
- 🔗 [render.com](https://render.com)

#### 3. **Heroku**
- **Precio**: $7/mes por dyno
- **Facilidad**: ⭐⭐⭐⭐⭐
- **PostgreSQL**: Desde $5/mes
- 🔗 [heroku.com](https://www.heroku.com)

### B. Infrastructure as a Service (IaaS) - Más Control

#### 1. **AWS (Amazon Web Services)**
- **Servicios**: EC2, RDS, S3
- **Precio**: Desde $10/mes
- **Facilidad**: ⭐⭐
- **Escalabilidad**: ⭐⭐⭐⭐⭐
- 🔗 [aws.amazon.com](https://aws.amazon.com)

#### 2. **Google Cloud Platform**
- **Servicios**: Compute Engine, Cloud SQL
- **Precio**: Desde $10/mes
- **Facilidad**: ⭐⭐
- **Créditos**: $300 gratis por 90 días
- 🔗 [cloud.google.com](https://cloud.google.com)

#### 3. **Microsoft Azure**
- **Servicios**: Virtual Machines, Azure Database
- **Precio**: Desde $10/mes
- **Facilidad**: ⭐⭐
- **Integración**: Excelente con Windows
- 🔗 [azure.microsoft.com](https://azure.microsoft.com)

---

## 🔧 Configuración Paso a Paso

### Paso 1: Preparar el Servidor

#### En Ubuntu Server 22.04:

```bash
# 1. Crear usuario para la aplicación
sudo adduser scaffoldpro
sudo usermod -aG sudo scaffoldpro

# 2. Cambiar a ese usuario
su - scaffoldpro

# 3. Instalar dependencias
sudo apt update
sudo apt install -y curl git build-essential

# 4. Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 5. Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 6. Instalar PM2
sudo npm install -g pm2

# 7. Configurar firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Paso 2: Configurar PostgreSQL

```bash
# 1. Cambiar a usuario postgres
sudo -u postgres psql

# 2. Crear base de datos y usuario
CREATE DATABASE torresdb;
CREATE USER scaffoldpro WITH PASSWORD 'tu_password_segura';
GRANT ALL PRIVILEGES ON DATABASE torresdb TO scaffoldpro;
\q

# 3. Configurar acceso remoto (opcional)
sudo nano /etc/postgresql/14/main/postgresql.conf
# Cambiar: listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Agregar: host all all 0.0.0.0/0 md5

# 4. Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Paso 3: Clonar y Configurar la Aplicación

```bash
# 1. Ir al directorio home
cd ~

# 2. Clonar repositorio (o subir archivos)
git clone https://github.com/tu-usuario/arrendamiento.git
# O usar SCP/SFTP para subir archivos

# 3. Entrar al directorio
cd arrendamiento

# 4. Instalar dependencias
npm install

# 5. Crear archivo .env usando la interfaz web
# O crear manualmente:
nano .env
```

**Contenido del .env:**
```env
# Base de Datos
DATABASE_URL=postgres://scaffoldpro:tu_password_segura@localhost:5432/torresdb
DB_SSL=false

# Servidor
PORT=3001
JWT_SECRET=tu_clave_jwt_super_segura_2024

# SMTP
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=correo@tudominio.com
SMTP_PASS=tu_password_smtp

# Facturación (opcional)
FACTURAMA_USER=usuario@facturama.com
FACTURAMA_PASSWORD=password
FACTURAMA_BASE_URL=https://api.facturama.mx
CSD_ENCRYPT_KEY=clave_cifrado
```

### Paso 4: Importar Base de Datos

```bash
# Si tienes un dump SQL
psql -U scaffoldpro -d torresdb -f torres9.sql

# O conectar y ejecutar scripts
psql -U scaffoldpro -d torresdb
\i database/schema.sql
\i database/seed.sql
\q
```

### Paso 5: Iniciar con PM2

```bash
# 1. Iniciar aplicación
pm2 start src/index.js --name scaffoldpro

# 2. Configurar inicio automático
pm2 startup
# Ejecutar el comando que PM2 te muestre

pm2 save

# 3. Ver logs
pm2 logs scaffoldpro

# 4. Ver estado
pm2 status

# 5. Reiniciar
pm2 restart scaffoldpro

# 6. Detener
pm2 stop scaffoldpro
```

### Paso 6: Configurar Nginx (Proxy Inverso)

```bash
# 1. Crear configuración
sudo nano /etc/nginx/sites-available/scaffoldpro
```

**Contenido:**
```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:3001;
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
```

```bash
# 2. Habilitar sitio
sudo ln -s /etc/nginx/sites-available/scaffoldpro /etc/nginx/sites-enabled/

# 3. Probar configuración
sudo nginx -t

# 4. Reiniciar Nginx
sudo systemctl restart nginx
```

### Paso 7: Configurar SSL con Let's Encrypt

```bash
# 1. Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtener certificado
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# 3. Renovación automática (ya está configurada)
sudo certbot renew --dry-run
```

---

## 🔍 Verificación del Despliegue

### Checklist de Verificación

```bash
# 1. Verificar que Node.js esté corriendo
pm2 status

# 2. Verificar logs
pm2 logs scaffoldpro --lines 50

# 3. Verificar PostgreSQL
sudo systemctl status postgresql

# 4. Verificar Nginx
sudo systemctl status nginx

# 5. Probar conexión a la base de datos
psql -U scaffoldpro -d torresdb -c "SELECT version();"

# 6. Probar endpoint
curl http://localhost:3001/api/health
# O desde navegador: http://tudominio.com

# 7. Verificar SSL
curl https://tudominio.com
```

---

## 📊 Mantenimiento y Monitoreo

### Comandos Útiles

```bash
# Ver logs en tiempo real
pm2 logs scaffoldpro

# Ver uso de recursos
pm2 monit

# Reiniciar aplicación
pm2 restart scaffoldpro

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Espacio en disco
df -h

# Uso de RAM
free -h

# Procesos
htop
```

### Respaldos Automáticos

```bash
# Crear script de respaldo
nano ~/backup.sh
```

**Contenido:**
```bash
#!/bin/bash
BACKUP_DIR="/home/scaffoldpro/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Respaldar base de datos
pg_dump -U scaffoldpro torresdb > $BACKUP_DIR/db_$DATE.sql

# Respaldar archivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /home/scaffoldpro/arrendamiento

# Eliminar respaldos antiguos (más de 7 días)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Respaldo completado: $DATE"
```

```bash
# Dar permisos
chmod +x ~/backup.sh

# Programar con cron (diario a las 2 AM)
crontab -e
# Agregar: 0 2 * * * /home/scaffoldpro/backup.sh
```

### Monitoreo con PM2 Plus (Opcional)

```bash
# Registrarse en PM2 Plus
pm2 plus

# Vincular servidor
pm2 link [secret_key] [public_key]

# Ver en: https://app.pm2.io
```

---

## 💰 Estimación de Costos

### Opción 1: VPS (DigitalOcean)
```
Droplet (2GB RAM): $12/mes
Dominio: $10-15/año
Total mensual: ~$13/mes
Total anual: ~$165/año
```

### Opción 2: Red Local
```
Hardware (Mini PC usado): $150 (una vez)
Electricidad (~20W, 24/7): $2-3/mes
Dominio (opcional): $10-15/año
Total primer año: ~$185
Total años siguientes: ~$35/año
```

### Opción 3: Railway
```
Plan Starter: $5/mes
PostgreSQL: Incluido
Total mensual: $5-10/mes
Total anual: ~$100/año
```

---

## 🆘 Solución de Problemas

### La aplicación no inicia

```bash
# Ver logs detallados
pm2 logs scaffoldpro --lines 100

# Verificar puerto
sudo lsof -i :3001

# Verificar variables de entorno
pm2 env 0

# Reiniciar
pm2 restart scaffoldpro
```

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Probar conexión
psql -U scaffoldpro -d torresdb

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Nginx no funciona

```bash
# Verificar configuración
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/error.log

# Reiniciar
sudo systemctl restart nginx
```

---

## 📞 Recursos y Soporte

### Documentación Oficial
- [Node.js Docs](https://nodejs.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [PM2 Docs](https://pm2.keymetrics.io/docs/)
- [Nginx Docs](https://nginx.org/en/docs/)

### Comunidades
- [Stack Overflow](https://stackoverflow.com)
- [Reddit r/node](https://reddit.com/r/node)
- [DigitalOcean Community](https://www.digitalocean.com/community)

---

**¿Necesitas ayuda con el despliegue? Consulta esta guía o contacta al administrador del sistema.**

**Versión:** 1.0  
**Última actualización:** Enero 2026
