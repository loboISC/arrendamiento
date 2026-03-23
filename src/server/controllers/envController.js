const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../../.env');

// Leer el archivo .env
exports.getEnv = (req, res) => {
    try {
        if (!fs.existsSync(envPath)) {
            return res.status(404).json({ error: 'Archivo .env no encontrado' });
        }
        const content = fs.readFileSync(envPath, 'utf8');
        // Convertir a objeto para el frontend si se prefiere, o enviar texto plano
        res.json({ content });
    } catch (error) {
        console.error('Error al leer .env:', error);
        res.status(500).json({ error: 'Error al leer el archivo de configuración' });
    }
};

// Guardar el archivo .env
exports.saveEnv = (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Contenido del .env requerido' });

    try {
        fs.writeFileSync(envPath, content, 'utf8');
        res.json({ success: true, message: 'Archivo .env actualizado. Reinicie el servidor para aplicar cambios.' });
    } catch (error) {
        console.error('Error al escribir .env:', error);
        res.status(500).json({ error: 'Error al guardar el archivo de configuración' });
    }
};
