// models/ConfiguracionFacturacion.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ConfiguracionFacturacion', {
      rfc: { type: DataTypes.STRING(13), allowNull: false },
      razon_social: { type: DataTypes.STRING, allowNull: false },
      regimen_fiscal: { type: DataTypes.STRING(3), allowNull: false },
      codigo_postal: { type: DataTypes.STRING(5), allowNull: false },
      csd_cer_path: { type: DataTypes.TEXT, allowNull: false },
      csd_key_path: { type: DataTypes.TEXT, allowNull: false },
      csd_password_encrypted: { type: DataTypes.TEXT, allowNull: false }
    }, {
      tableName: 'configuracion_facturacion',
      timestamps: true,
      updatedAt: 'fecha_actualizacion',
      createdAt: false
    });
  };