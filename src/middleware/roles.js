module.exports = function(rolesPermitidos) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !rolesPermitidos.includes(user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}; 