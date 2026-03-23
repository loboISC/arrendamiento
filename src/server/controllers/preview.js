const { randomUUID } = require('crypto');

const previews = new Map();
const PREVIEW_TTL_MS = 10 * 60 * 1000; // 10 minutos

function cleanupPreviews() {
  const now = Date.now();
  for (const [id, entry] of previews.entries()) {
    if (now - entry.createdAt > PREVIEW_TTL_MS) {
      previews.delete(id);
    }
  }
}

exports.createPreview = (req, res) => {
  const { html } = req.body || {};

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Contenido HTML inválido' });
  }

  cleanupPreviews();

  const id = randomUUID();
  previews.set(id, {
    html,
    createdAt: Date.now(),
  });

  res.json({ id, url: `/api/preview/${id}` });
};

exports.getPreview = (req, res) => {
  cleanupPreviews();
  const { id } = req.params;
  const entry = previews.get(id);

  if (!entry) {
    return res.status(404).send('Vista previa expirada o no encontrada');
  }

  previews.delete(id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(entry.html);
};
