# Sistema de Gestión de Arrendamiento (SAPT)

Este proyecto es una aplicación integral diseñada para la gestión de arrendamiento de equipos de construcción (andamios, torres, etc.), control de inventario, logística, facturación electrónica y análisis de datos. Construido sobre una arquitectura moderna y robusta, permite optimizar todos los procesos operativos de la empresa.

---

## 🚀 Tecnologías Usadas

El sistema utiliza un stack tecnológico de vanguardia para garantizar rendimiento, seguridad y escalabilidad:

### Backend
- **Node.js**: Entorno de ejecución para el servidor.
- **Express.js**: Framework para la creación de la API REST.
- **PostgreSQL**: Base de datos relacional para el almacenamiento persistente.
- **JWT (JSON Web Tokens)**: Para la autenticación y autorización segura.
- **Bcrypt**: Encriptación de contraseñas y datos sensibles.
- **Nodemailer**: Gestión de envío de correos electrónicos (notificaciones, facturas, encuestas).
- **Multer**: Middleware para el manejo de carga de archivos (imágenes, documentos).
- **Swagger**: Documentación interactiva de la API.

### Frontend
- **HTML5 / CSS3 / JavaScript (ES6+)**: Base de la interfaz de usuario.
- **React**: Biblioteca para la construcción de interfaces dinámicas.
- **Vite**: Herramienta de construcción rápida para el frontend.
- **Electron**: Framework para empaquetar la aplicación como una aplicación de escritorio.
- **Bootstrap Icons**: Librería de iconos vectoriales.
- **AmCharts 5**: Motor de visualización de datos para dashboards y reportes.

### Servicios y Herramientas
- **Puppeteer & PDFKit**: Generación dinámica de reportes y contratos en formato PDF.
- **Facturama SDK**: Integración para el timbrado de facturas CFDI y notas de crédito.
- **Luxon**: Manejo avanzado de fechas y zonas horarias.
- **QRCode**: Generación de códigos QR para seguimiento de contratos.

---

## 📸 Interfaces del Sistema

A continuación, se presentan algunas de las interfaces principales del sistema:

| Módulo | Previsualización |
| :--- | :--- |
| **Dashboard Principal** | ![Dashboard](.assets/imges/capturas/principal.png) *(Espacio para imagen)* |
| **Gestión de Contratos** | ![Contratos](.assets/imges/capturas/contratos.png) *(Espacio para imagen)* |
| **Logística y Entregas** | ![Logistica](.assets/imges/capturas/logistica.png) *(Espacio para imagen)* |
| **Facturación** | ![Facturacion](.assets/imges/capturas/facturacion.png) *(Espacio para imagen)* |





## 🛠️ Módulos Detallados

### 1. Autenticación y Seguridad
Gestiona el acceso al sistema mediante perfiles de usuario. Incluye:
- Inicio de sesión seguro con JWT.
- Recuperación de contraseñas vía correo electrónico.
- Control de acceso basado en roles (RBAC).

### 2. Gestión de Clientes
Módulo central para administrar la base de datos de clientes, incluyendo información de contacto, direcciones de entrega y historial de transacciones.

### 3. Inventario y Equipos
Permite el control total del stock:
- Registro de equipos y componentes (andamios, escaleras, etc.).
- Gestión de múltiples almacenes.
- Seguimiento de movimientos de inventario (entradas/salidas).

### 4. Cotizaciones y Contratos
Automatiza el proceso comercial:
- Creación de cotizaciones rápidas con cálculo automático de precios.
- Conversión de cotizaciones a contratos legales.
- Seguimiento de vigencia de contratos y alertas de vencimiento.

### 5. Logística
Optimiza la entrega y recolección de equipos:
- Asignación de vehículos y choferes a pedidos.
- Seguimiento en tiempo real del estado de entrega (Pendiente, En Camino, Entregado).
- Registro de evidencias de entrega.

### 6. Facturación Electrónica (CFDI)
Integración completa con el SAT de México a través de Facturama:
- Generación de facturas (Ingreso).
- Timbrado de notas de crédito y complementos de pago.
- Descarga masiva de XML y PDF.

### 7. Análisis y Reportes
Visualización de métricas clave para la toma de decisiones:
- Dashboard con gráficas de ingresos, contratos activos y rotación de inventario.
- Reportes exportables a Excel y PDF.

### 8. Satisfacción del Cliente (Surveys)
Envío automatizado de encuestas de satisfacción tras concluir un contrato para medir el NPS y recibir feedback directo.

---

## ⚙️ Configuración e Instalación

### Requisitos Previos
- **Node.js** (v18 o superior)
- **PostgreSQL** instalado y configurado
- Acceso a un servidor **SMTP** (para correos)

### Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/loboISC/arrendamiento.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno en un archivo `.env`:
   ```env
   # Configuración de Base de Datos
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contraseña  # ¡No compartas este archivo!
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=arrendamiento

   # Configuración de JWT
   JWT_SECRET=tu_clave_secreta

   # Configuración Facturama (Pruebas/Producción)
   FACTURAMA_USER=tu_usuario
   FACTURAMA_PASS=tu_password
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

## 🔒 Seguridad de Datos
**IMPORTANTE**: Nunca subas el archivo `.env` o la carpeta `node_modules` al control de versiones. Asegúrate de que el archivo `.gitignore` incluya estas rutas para evitar fugas de información sensible.

---
© 2026 SAPT - Sistema de Arrendamiento Profesional. Desarrollado por **irving**.
