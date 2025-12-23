#!/bin/bash
# Script de deployment para Hostinger (alternativa a .bat para Linux/Mac)

echo "🚀 Preparando archivos para Hostinger..."
echo ""

# Crear directorio si no existe
mkdir -p surveys-hostinger/{styles,img}

# Cambiar a directorio
cd surveys-hostinger || exit

echo "[1/4] Copiando HTML..."
cp ../public/sastifaccion_clienteSG.html . 2>/dev/null && echo "✓ HTML copiado" || echo "⚠ HTML no encontrado"

echo "[2/4] Copiando JavaScript..."
cp ../public/scripts/sastifacion_clienteSG.js . 2>/dev/null && echo "✓ JS copiado" || echo "⚠ JS no encontrado"

echo "[3/4] Copiando estilos..."
cp ../public/styles/style.css styles/ 2>/dev/null && echo "✓ CSS copiado" || echo "⚠ CSS no encontrado"

echo "[4/4] Copiando imágenes..."
cp ../public/img/* img/ 2>/dev/null && echo "✓ Imágenes copiadas" || echo "⚠ Imágenes no encontradas"

echo ""
echo "✅ Archivos listos en: surveys-hostinger/"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Lee: INICIO_RAPIDO.md"
echo "   2. Configura backend (ngrok u Hostinger)"
echo "   3. Sube archivos a encuesta.andamiositorres.com"
echo ""
