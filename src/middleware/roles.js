// Middleware más flexible: acepta roles simples o permisos de tipo 'nc.create',
// si el usuario trae atributo `permisos` como array se valida también.
module.exports = function(allowed) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    // Normalize into array
    const lista = Array.isArray(allowed) ? allowed : [allowed];
    for (const item of lista) {
      if (item.includes('.')) {
        // tratar como permiso granular
        if (user.permisos && user.permisos.includes(item)) {
          return next();
        }
      } else {
        if (user.rol === item) {
          return next();
        }
      }
    }
    return res.status(403).json({ error: 'Acceso denegado' });
  };
}; 