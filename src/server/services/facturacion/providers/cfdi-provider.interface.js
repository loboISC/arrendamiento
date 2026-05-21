/**
 * Contrato base para proveedores CFDI.
 * Cada proveedor debe implementar estos metodos para que el modulo fiscal no dependa de una marca.
 */
class ProveedorCFDI {
  async crearFactura() {
    throw new Error('crearFactura debe implementarse en el proveedor CFDI.');
  }

  async crearNotaCredito() {
    throw new Error('crearNotaCredito debe implementarse en el proveedor CFDI.');
  }

  async cancelarFactura() {
    throw new Error('cancelarFactura debe implementarse en el proveedor CFDI.');
  }

  async obtenerPDF() {
    throw new Error('obtenerPDF debe implementarse en el proveedor CFDI.');
  }

  async obtenerXML() {
    throw new Error('obtenerXML debe implementarse en el proveedor CFDI.');
  }
}

module.exports = ProveedorCFDI;
