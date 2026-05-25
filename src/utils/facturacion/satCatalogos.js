const FORMA_PAGO = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Pago por subrogación',
  '14': 'Pago por consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de deuda',
  '26': 'Prescripción o caducidad',
  '27': 'A satisfacción del acreedor',
  '28': 'Tarjeta de débito',
  '29': 'Tarjeta de servicios',
  '30': 'Aplicación de anticipos',
  '31': 'Intermediario de pagos',
  '99': 'Por definir'
};

const METODO_PAGO = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido'
};

const TIPO_RELACION = {
  '01': 'Nota de crédito de los documentos relacionados',
  '02': 'Nota de débito de los documentos relacionados',
  '03': 'Devolución de mercancía sobre facturas o traslados previos',
  '04': 'Sustitución de los CFDI previos',
  '05': 'Traslados de mercancías facturados previamente',
  '06': 'Factura generada por los traslados previos',
  '07': 'CFDI por aplicación de anticipo'
};

function extraerClave(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  if (texto.includes(' - ')) return texto.split(' - ')[0].trim();
  return texto;
}

function yaTieneDescripcion(valor) {
  return String(valor || '').includes(' - ');
}

function formaPagoTexto(clave) {
  if (yaTieneDescripcion(clave)) return String(clave).trim();
  let key = extraerClave(clave) || '99';
  if (/^\d+$/.test(key)) key = key.padStart(2, '0');
  const desc = FORMA_PAGO[key] || FORMA_PAGO['99'];
  return `${key} - ${desc}`;
}

function metodoPagoTexto(clave) {
  if (yaTieneDescripcion(clave)) return String(clave).trim();
  const key = extraerClave(clave).toUpperCase() || 'PUE';
  const desc = METODO_PAGO[key] || METODO_PAGO.PUE;
  return `${key} - ${desc}`;
}

function descripcionTipoRelacion(clave) {
  const key = extraerClave(clave) || '01';
  return TIPO_RELACION[key] || TIPO_RELACION['01'];
}

function tipoRelacionTexto(clave) {
  if (yaTieneDescripcion(clave)) return String(clave).trim();
  const key = extraerClave(clave) || '01';
  return `${key} - ${descripcionTipoRelacion(key)}`;
}

module.exports = {
  FORMA_PAGO,
  METODO_PAGO,
  TIPO_RELACION,
  formaPagoTexto,
  metodoPagoTexto,
  descripcionTipoRelacion,
  tipoRelacionTexto
};
