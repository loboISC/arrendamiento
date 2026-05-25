/**
 * Validador fiscal de reglas SAT aplicables a notas de crédito / débito.
 */
class ServicioValidadorSAT {
  etiquetaMotivo(motivo) {
    const mapa = {
      DEVOLUCION: 'Devolución de mercancía',
      DESCUENTO: 'Descuento comercial',
      BONIFICACION: 'Bonificación',
      CORRECCION_PARCIAL: 'Corrección parcial',
      AJUSTE_ADMINISTRATIVO: 'Ajuste administrativo'
    };
    return mapa[motivo] || motivo || 'Corrección fiscal';
  }

  validarBorrador({
    facturaOrigen,
    motivo,
    relationType,
    tipoComprobante,
    conceptos,
    totales,
    saldoDisponible
  }) {
    const errores = [];
    const advertencias = [];

    if (!facturaOrigen) errores.push('La factura relacionada es obligatoria.');
    if (!facturaOrigen?.uuid) errores.push('La factura origen debe tener UUID timbrado.');
    if (!motivo) errores.push('El motivo de la corrección es obligatorio.');
    if (!Array.isArray(conceptos) || conceptos.length === 0) {
      errores.push('Debe existir al menos un concepto acreditable.');
    }

    const subtotal = Number(totales?.subtotal || 0);
    const iva = Number(totales?.iva || 0);
    const retenciones = Number(totales?.retenciones || 0);
    const total = Number(totales?.total || 0);
    const saldo = Number(saldoDisponible || 0);
    const sumaFiscal = Number((subtotal + iva - retenciones).toFixed(2));

    if (total <= 0) errores.push('El total de la nota debe ser mayor a cero.');
    if (Math.abs(sumaFiscal - total) > 0.02) {
      errores.push(
        `El total (${total.toFixed(2)}) no coincide con subtotal + IVA - retenciones (${sumaFiscal.toFixed(2)}).`
      );
    }
    if (total > saldo + 0.01) {
      errores.push(
        `El total calculado (${total.toFixed(2)}) excede el saldo acreditable (${saldo.toFixed(2)}). ` +
        `Subtotal ${subtotal.toFixed(2)} + IVA ${iva.toFixed(2)}. Verifica que el IVA coincida con la factura origen (no uses 16% si el CFDI tiene otra tasa).`
      );
    }

    const subtotalOrigen = Number(facturaOrigen?.subtotal || 0);
    const ivaOrigen = Number(facturaOrigen?.tax ?? facturaOrigen?.total_iva ?? 0);
    const totalOrigen = Number(facturaOrigen?.total || 0);
    if (subtotalOrigen > 0 && ivaOrigen >= 0 && total > saldo + 0.01) {
      advertencias.push(
        `Factura origen: subtotal ${subtotalOrigen.toFixed(2)} + IVA ${ivaOrigen.toFixed(2)} = ${totalOrigen.toFixed(2)}. Copia esos importes para acreditar el total sin exceder el saldo.`
      );
    }

    const tasaEfectiva = subtotal > 0 ? iva / subtotal : 0;
    if (subtotal > 0 && Math.abs(tasaEfectiva - 0.16) > 0.02) {
      advertencias.push(
        `La tasa de IVA efectiva es ${(tasaEfectiva * 100).toFixed(2)}% (no 16% uniforme). Usa el IVA timbrado de la factura origen.`
      );
    }

    const rel = String(relationType || '01');
    const tipo = String(tipoComprobante || 'E').toUpperCase();
    if (rel === '02' && tipo !== 'I') {
      advertencias.push('Nota de débito (relación 02) normalmente se emite como comprobante de Ingreso (I).');
    }
    if (['01', '03', '07'].includes(rel) && tipo !== 'E') {
      advertencias.push(`Relación ${rel} (${this.etiquetaMotivo(motivo)}) suele emitirse como Egreso (E).`);
    }

    advertencias.push(`Motivo registrado: ${this.etiquetaMotivo(motivo)}.`);
    advertencias.push('La nota de crédito no cancela el CFDI origen; solo reduce o ajusta el saldo acreditable.');
    if (rel !== '01') {
      advertencias.push(`Tipo de relación SAT seleccionado: ${rel}.`);
    }

    return {
      valido: errores.length === 0,
      errores,
      advertencias
    };
  }
}

module.exports = ServicioValidadorSAT;
