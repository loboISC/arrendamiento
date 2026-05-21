const ProveedorCFDI = require('./cfdi-provider.interface');

/**
 * Adaptador inicial para APIFiscal.
 * Queda listo para conectar credenciales y endpoints sin tocar la logica fiscal del modulo.
 */
class ProveedorAPIFiscal extends ProveedorCFDI {
  async crearFactura() {
    throw new Error('APIFiscal aun no esta configurado para facturas.');
  }

  async crearNotaCredito(payload) {
    return {
      modo: 'mock',
      proveedor: 'apifiscal',
      payload,
      mensaje: 'Estructura preparada. Falta conectar credenciales y endpoint real.'
    };
  }

  async cancelarFactura() {
    throw new Error('APIFiscal aun no esta configurado para cancelaciones.');
  }

  async obtenerPDF() {
    throw new Error('APIFiscal aun no esta configurado para descarga PDF.');
  }

  async obtenerXML() {
    throw new Error('APIFiscal aun no esta configurado para descarga XML.');
  }
}

module.exports = ProveedorAPIFiscal;
