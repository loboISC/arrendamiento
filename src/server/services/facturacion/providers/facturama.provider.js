const axios = require('axios');
const ProveedorCFDI = require('./cfdi-provider.interface');
const {
  obtenerTokenFacturama,
  FACTURAMA_BASE_URL
} = require('../facturamaservice');

/**
 * Adaptador de Facturama.
 * Aqui se encapsulan nombres de endpoints, autenticacion y formato de errores del proveedor.
 */
class ProveedorFacturama extends ProveedorCFDI {
  constructor() {
    super();
    this.baseUrl = FACTURAMA_BASE_URL;
  }

  obtenerCabeceras() {
    return {
      Authorization: `Basic ${obtenerTokenFacturama()}`,
      'Content-Type': 'application/json'
    };
  }

  normalizarError(error) {
    const detalle = error.response?.data || error.message || error;
    return {
      proveedor: 'facturama',
      mensaje: typeof detalle === 'string' ? detalle : JSON.stringify(detalle),
      detalle
    };
  }

  async crearFactura(payload) {
    try {
      const respuesta = await axios.post(`${this.baseUrl}/api-lite/3/cfdis`, payload, {
        headers: this.obtenerCabeceras()
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async crearNotaCredito(payload) {
    try {
      const respuesta = await axios.post(`${this.baseUrl}/api-lite/3/cfdis`, payload, {
        headers: this.obtenerCabeceras()
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async cancelarFactura(idProveedor, motivo = '02') {
    try {
      const respuesta = await axios.delete(
        `${this.baseUrl}/api-lite/cfdi/${idProveedor}?type=issuedLite&motive=${motivo}`,
        { headers: this.obtenerCabeceras() }
      );
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async obtenerPDF(idProveedor) {
    try {
      const respuesta = await axios.get(`${this.baseUrl}/cfdi/pdf/issuedLite/${idProveedor}`, {
        headers: this.obtenerCabeceras(),
        responseType: 'arraybuffer'
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }

  async obtenerXML(idProveedor) {
    try {
      const respuesta = await axios.get(`${this.baseUrl}/cfdi/xml/issuedLite/${idProveedor}`, {
        headers: this.obtenerCabeceras(),
        responseType: 'text'
      });
      return respuesta.data;
    } catch (error) {
      throw this.normalizarError(error);
    }
  }
}

module.exports = ProveedorFacturama;
