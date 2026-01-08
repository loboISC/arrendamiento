# 🚀 Variables de Entorno - Referencia Rápida

## Acceso Rápido
**Configuración → Variables de Entorno**

## Variables Esenciales

### 🗄️ Base de Datos (Opción 1 - Recomendada)
```env
DATABASE_URL=postgres://usuario:password@host:puerto/nombre_bd
DB_SSL=false
```

### 🗄️ Base de Datos (Opción 2 - Alternativa)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=torresdb
DB_USER=postgres
DB_PASSWORD=tu_password
DB_SSL=false
```

### 🖥️ Servidor
```env
PORT=3001
JWT_SECRET=tu_clave_secreta_jwt
```

### 📧 SMTP (Correo)
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=correo@dominio.com
SMTP_PASS=password_smtp
```

### 💰 Facturación (Opcional)
```env
FACTURAMA_USER=usuario@facturama.com
FACTURAMA_PASSWORD=password
FACTURAMA_BASE_URL=https://api.facturama.mx
CSD_ENCRYPT_KEY=clave_cifrado
```

## 3 Pasos para Desplegar

1. **Configurar** → Completa los campos en la interfaz
2. **Descargar** → Haz clic en "Descargar .env"
3. **Subir** → Sube el archivo a la raíz del proyecto en el servidor

## Comandos Útiles

```bash
# Reiniciar con npm
npm restart

# Reiniciar con PM2
pm2 restart app

# Ver logs
pm2 logs app

# Verificar variables cargadas
node -e "require('dotenv').config(); console.log(process.env)"
```

## ⚠️ Recordatorios de Seguridad

- ✅ Agrega `.env` al `.gitignore`
- ✅ Nunca compartas el archivo `.env`
- ✅ Usa contraseñas diferentes para desarrollo y producción
- ✅ Cambia `JWT_SECRET` en producción

## 🔧 Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| Servidor no inicia | Verifica que `.env` esté en la raíz |
| Error de BD | Revisa `DATABASE_URL` o variables DB_* |
| Correos no se envían | Verifica credenciales SMTP y puerto |
| Token inválido | Cambia `JWT_SECRET` y reinicia |

## 📞 Ayuda

Consulta `GUIA_VARIABLES_ENTORNO.md` para documentación completa.
