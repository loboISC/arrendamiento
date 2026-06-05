// Mock de xmlService para tests (evita errores ESM de @nodecfdi/cfdi-core)
module.exports = {
    construirCfdi40: jest.fn(),
    sellarXml: jest.fn(),
    generarXmlFactura: jest.fn(),
    validarXml: jest.fn(),
};
