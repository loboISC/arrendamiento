const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  let token = null;

  if (auth) {
    token = auth.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = {
  authenticateToken
};
