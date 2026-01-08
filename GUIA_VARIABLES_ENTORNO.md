# Guía de Variables de Entorno - ScaffoldPro

## 📋 Descripción

La nueva sección **Variables de Entorno** en la configuración del sistema te permite gestionar todas las variables necesarias para el despliegue de la aplicación de manera visual e intuitiva.

## 🎯 Ubicación

1. Abre la aplicación ScaffoldPro
2. Ve a **Configuración** (icono de engranaje en el menú lateral)
3. Haz clic en el botón **"Variables de Entorno"** en la navegación superior

## 🔧 Funcionalidades

### 1. **Gestión de Variables**

La interfaz te permite configurar las siguientes categorías de variables:

#### 📊 Base de Datos
- `DATABASE_URL` - URL completa de conexión a PostgreSQL
- `DB_HOST` - Host del servidor de base de datos
- `DB_PORT` - Puerto (por defecto: 5432)
- `DB_NAME` - Nombre de la base de datos
- `DB_USER` - Usuario de PostgreSQL
- `DB_PASSWORD` - Contraseña del usuario
- `DB_SSL` - Habilitar SSL (false para desarrollo local, true para producción)

**Característica especial:** Los campos se sincronizan automáticamente:
- Si completas los campos individuales, se genera automáticamente el `DATABASE_URL`
- Si pegas un `DATABASE_URL`, se extraen automáticamente los campos individuales

#### 🖥️ Servidor
- `PORT` - Puerto del servidor backend (por defecto: 3001)
- `JWT_SECRET` - Clave secreta para tokens de autenticación

#### 📧 SMTP (Correo Electrónico)
- `SMTP_HOST` - Servidor SMTP (ej: smtp.hostinger.com)
- `SMTP_PORT` - Puerto SMTP (465 para SSL, 587 para TLS)
- `SMTP_USER` - Usuario/correo SMTP
- `SMTP_PASS` - Contraseña SMTP

#### 💰 Facturación
- `FACTURAMA_USER` - Usuario de Facturama
- `FACTURAMA_PASSWORD` - Contraseña de Facturama
- `FACTURAMA_BASE_URL` - URL base de la API de Facturama
- `CSD_ENCRYPT_KEY` - Clave para cifrar sellos digitales

### 2. **Botones de Acción**

#### 📋 Copiar como .env
- Copia el contenido del archivo `.env` al portapapeles
- Incluye comentarios y formato adecuado
- Listo para pegar en tu editor de código

#### 💾 Descargar .env
- Descarga un archivo `.env` completo
- Incluye todas las variables configuradas
- Con comentarios explicativos y notas de seguridad

#### 💿 Guardar Variables
- Guarda la configuración localmente en el navegador
- Persiste entre sesiones
- Útil para tener una referencia rápida

### 3. **Características de Seguridad**

- **Contraseñas ocultas:** Todos los campos de contraseña están ocultos por defecto
- **Toggle de visibilidad:** Botón de ojo para mostrar/ocultar contraseñas
- **Advertencias:** Alertas sobre la importancia de no compartir el archivo `.env`
- **Almacenamiento local:** Los datos se guardan solo en tu navegador

## 📝 Ejemplo de Uso

### Configuración para Desarrollo Local

```env
# Base de datos local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=torresdb
DB_USER=postgres
DB_PASSWORD=tu_password
DB_SSL=false

# Servidor
PORT=3001
JWT_SECRET=clave_desarrollo_local

# SMTP (opcional para desarrollo)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=correo@dominio.com
SMTP_PASS=password_smtp
```

### Configuración para Producción

```env
# Base de datos en servidor remoto
DATABASE_URL=postgres://usuario:password@servidor.com:5432/torresdb
DB_SSL=true

# Servidor
PORT=3001
JWT_SECRET=clave_super_segura_produccion_2024

# SMTP
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=correo@dominio.com
SMTP_PASS=password_smtp

# Facturación
FACTURAMA_USER=usuario@facturama.com
FACTURAMA_PASSWORD=password_facturama
FACTURAMA_BASE_URL=https://api.facturama.mx
CSD_ENCRYPT_KEY=clave_cifrado_csd
```

## 🚀 Proceso de Despliegue

### Paso 1: Configurar Variables
1. Abre la sección "Variables de Entorno"
2. Completa todos los campos necesarios
3. Haz clic en "Guardar Variables"

### Paso 2: Generar Archivo .env
Elige una de estas opciones:
- **Copiar:** Haz clic en "Copiar como .env" y pega en tu editor
- **Descargar:** Haz clic en "Descargar .env" para obtener el archivo

### Paso 3: Subir al Servidor
1. Sube el archivo `.env` a la raíz de tu proyecto en el servidor
2. Asegúrate de que esté en el `.gitignore`
3. Verifica los permisos del archivo (solo lectura para el usuario del servidor)

### Paso 4: Reiniciar Servidor
```bash
# Con npm
npm restart

# Con PM2
pm2 restart app

# Con systemd
sudo systemctl restart scaffoldpro
```

### Paso 5: Verificar
1. Revisa los logs del servidor para confirmar que las variables se cargaron
2. Prueba la conexión a la base de datos
3. Verifica que el servidor responda correctamente

## ⚠️ Mejores Prácticas

### Seguridad
- ✅ **Nunca** compartas tu archivo `.env` públicamente
- ✅ **Siempre** incluye `.env` en tu `.gitignore`
- ✅ Usa contraseñas fuertes y únicas para producción
- ✅ Cambia las claves secretas regularmente
- ✅ Usa diferentes valores para desarrollo y producción

### Organización
- ✅ Documenta qué hace cada variable
- ✅ Mantén un archivo `.env.example` con valores de ejemplo
- ✅ Usa nombres descriptivos y consistentes
- ✅ Agrupa variables por categoría

### Respaldo
- ✅ Guarda una copia segura de las variables de producción
- ✅ Usa un gestor de secretos para producción (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Documenta dónde encontrar cada credencial

## 🔍 Solución de Problemas

### El servidor no inicia después de cambiar las variables
1. Verifica que el archivo `.env` esté en la raíz del proyecto
2. Revisa que no haya errores de sintaxis en el archivo
3. Confirma que todas las variables requeridas estén presentes
4. Revisa los logs del servidor para ver el error específico

### La base de datos no se conecta
1. Verifica que `DATABASE_URL` o las variables individuales sean correctas
2. Confirma que el servidor de PostgreSQL esté corriendo
3. Verifica que el usuario tenga permisos en la base de datos
4. Revisa la configuración de firewall/red

### Los correos no se envían
1. Verifica las credenciales SMTP
2. Confirma el puerto correcto (465 para SSL, 587 para TLS)
3. Revisa que el servidor SMTP permita conexiones desde tu IP
4. Verifica que no haya límites de envío

## 📚 Recursos Adicionales

- [Documentación de PostgreSQL](https://www.postgresql.org/docs/)
- [Guía de JWT](https://jwt.io/introduction)
- [Configuración SMTP Hostinger](https://support.hostinger.com/es/articles/1583229-como-configurar-una-cuenta-de-correo-electronico-en-un-cliente-de-correo)
- [API de Facturama](https://www.facturama.mx/api/)

## 💡 Consejos

1. **Desarrollo vs Producción:** Mantén archivos `.env.development` y `.env.production` separados
2. **Versionado:** Usa `.env.example` con valores ficticios para compartir la estructura
3. **Automatización:** Considera usar scripts de despliegue que configuren las variables automáticamente
4. **Monitoreo:** Implementa alertas si las variables críticas no están configuradas

## 🆘 Soporte

Si tienes problemas con la configuración de variables de entorno:

1. Revisa esta guía completa
2. Verifica los logs del sistema en la sección "Reportes"
3. Consulta la documentación del servidor
4. Contacta al administrador del sistema

---

**Última actualización:** Enero 2026  
**Versión:** 2.1.0
