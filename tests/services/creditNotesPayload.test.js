const ServicioNotasCredito = require('../../src/server/modules/facturacion/credit-notes/services/credit-notes.service');

function crearNota(overrides = {}) {
  return {
    id: '9b2991c6-cb29-4f2a-a3ba-84cc136a6bb3',
    folio: 'NC-1',
    customer_rfc: 'XAXX010101000',
    customer_name: 'Cliente mostrador',
    razon_social: 'Cliente mostrador',
    tax_regime: '616',
    postal_code: '99999',
    metodo_pago: 'PUE',
    forma_pago: '03',
    tipo_comprobante: 'E',
    relation_type: '01',
    invoice_uuid_origen: '11111111-1111-1111-1111-111111111111',
    items: [{
      sat_product_key: '84111506',
      sat_unit_key: 'ACT',
      descripcion: 'Descuento conforme acuerdo con el cliente',
      cantidad: 1,
      precio_unitario: 100,
      descuento: 0,
      descuento_porcentaje: 0,
      tasa_iva: 0.16
    }],
    ...overrides
  };
}

describe('payload Facturama para notas de credito', () => {
  test('normaliza receptor publico general para cumplir CP receptor = LugarExpedicion', () => {
    const servicio = new ServicioNotasCredito();
    const payload = servicio.construirPayloadTimbrado(crearNota(), {
      rfc: 'APT100310EC2',
      razon_social: 'ANDAMIOS Y PROYECTOS TORRES',
      regimen_fiscal: '601',
      codigo_postal: '72000'
    });

    expect(payload.ExpeditionPlace).toBe('72000');
    expect(payload.Receiver).toEqual(expect.objectContaining({
      Rfc: 'XAXX010101000',
      Name: 'PUBLICO EN GENERAL',
      FiscalRegime: '616',
      TaxZipCode: '72000',
      CfdiUse: 'S01'
    }));
  });

  test('conserva datos fiscales de receptor real', () => {
    const servicio = new ServicioNotasCredito();
    const payload = servicio.construirPayloadTimbrado(crearNota({
      customer_rfc: 'COSC8001137NA',
      customer_name: 'CLIENTE REAL SA DE CV',
      tax_regime: '601',
      postal_code: '64000'
    }), {
      rfc: 'APT100310EC2',
      razon_social: 'ANDAMIOS Y PROYECTOS TORRES',
      regimen_fiscal: '601',
      codigo_postal: '72000'
    });

    expect(payload.Receiver).toEqual(expect.objectContaining({
      Rfc: 'COSC8001137NA',
      Name: 'CLIENTE REAL SA DE CV',
      FiscalRegime: '601',
      TaxZipCode: '64000',
      CfdiUse: 'G02'
    }));
  });
});
