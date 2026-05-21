/**
 * Validador fiscal de reglas SAT aplicables a CFDI de egreso.
 */
class ServicioValidadorSAT {
  validarBorrador({ facturaOrigen, motivo, conceptos, totales, saldoDisponible }) {
    const errores = [];
    const advertencias = [];

    if (!facturaOrigen) errores.push('La factura relacionada es obligatoria.');
    if (!facturaOrigen?.uuid) errores.push('La factura origen debe tener UUID timbrado.');
    if (!motivo) errores.push('El motivo fiscal de egreso es obligatorio.');
    if (!Array.isArray(conceptos) || conceptos.length === 0) errores.push('Debe existir al menos un concepto acreditable.');
    if (Number(totales?.total || 0) <= 0) errores.push('El total de la nota de credito debe ser mayor a cero.');
    if (Number(totales?.total || 0) > Number(saldoDisponible || 0) + 0.01) {
      errores.push('El total de la nota de credito excede el saldo acreditable.');
    }

    advertencias.push('La nota de credito no cancela facturas; solo acredita saldo.');
    advertencias.push('El CFDI relacionado se emite con TipoRelacion 01.');
    advertencias.push('No debe usarse una nota de credito para simular cancelaciones.');

    return {
      valido: errores.length === 0,
      errores,
      advertencias
    };
  }
}

module.exports = ServicioValidadorSAT;
