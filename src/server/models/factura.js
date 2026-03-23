    // src/models/Factura.js
    module.exports = (sequelize, DataTypes) => {
        return sequelize.define('Factura', {
          uuid: { type: DataTypes.STRING, primaryKey: true },
          fecha_emision: DataTypes.DATE,
          total: DataTypes.DECIMAL,
          rfc_emisor: DataTypes.STRING,
          rfc_receptor: DataTypes.STRING,
          xml: DataTypes.TEXT,
          pdf: DataTypes.BLOB,
          estado: DataTypes.STRING
        });
      };


