@echo off
REM Script para copiar archivos de la encuesta a la carpeta surveys-hostinger

echo ========================================
echo Copiando archivos de encuesta a Hostinger...
echo ========================================

REM Crear carpetas si no existen
if not exist styles mkdir styles
if not exist img mkdir img

REM Copiar archivos HTML y JS
echo [1/5] Copiando HTML...
copy ..\public\sastifaccion_clienteSG.html . >nul
if errorlevel 1 (
    echo ERROR: No se pudo copiar HTML
    exit /b 1
)
echo ✓ HTML copiado

echo [2/5] Copiando JavaScript...
copy ..\public\scripts\sastifacion_clienteSG.js . >nul
if errorlevel 1 (
    echo ERROR: No se pudo copiar JS
    exit /b 1
)
echo ✓ JavaScript copiado

REM Copiar estilos
echo [3/5] Copiando estilos CSS...
copy ..\public\styles\style.css .\styles\ >nul
if errorlevel 1 (
    echo WARNING: No se pudo copiar CSS (puede no existir)
)
echo ✓ CSS copiado (o no existe)

REM Copiar imágenes
echo [4/5] Copiando imágenes...
copy ..\public\img\image.png .\img\ >nul
if errorlevel 1 (
    echo WARNING: image.png no encontrado
)
copy ..\public\img\*.png .\img\ >nul 2>&1
copy ..\public\img\*.jpg .\img\ >nul 2>&1
copy ..\public\img\*.jpeg .\img\ >nul 2>&1
echo ✓ Imágenes copiadas

REM Crear archivo de configuración
echo [5/5] Creando archivo de configuración...
(
echo # Configuración de Encuesta - Hostinger
echo.
echo ## URL API Backend
echo SURVEY_API_BASE_URL=http://localhost:3001
echo.
echo ## Instrucciones
echo 1. Edita SURVEY_API_BASE_URL si usas ngrok o backend público
echo 2. Para ngrok: reemplaza con la URL generada (ej: https://abc123.ngrok.io^)
echo 3. Para Hostinger: usa https://api.andamiositorres.com
) > .env.surveys

echo ✓ Configuración creada (.env.surveys)

echo.
echo ========================================
echo ✅ Archivos listos para subir a Hostinger
echo ========================================
echo.
echo Próximos pasos:
echo 1. Revisa INSTRUCCIONES_DEPLOYMENT.md
echo 2. Sube los archivos a https://encuesta.andamiositorres.com/
echo 3. Prueba en: https://encuesta.andamiositorres.com/sastifaccion_clienteSG.html
echo.
pause
