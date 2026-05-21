/**
 * Servicio de calculo fiscal para notas de credito.
 * Centraliza redondeos y evita diferencias entre vista previa, guardado y timbrado.
 */
class ServicioCalculadoraImpuestos {
  redondear(valor) {
    return Number(Number(valor || 0).toFixed(2));
  }

  calcularConcepto(concepto) {
    const cantidad = Number(concepto.cantidad || concepto.quantity || 0);
    const precioUnitario = Number(concepto.precio_unitario || concepto.unit_price || 0);
    const descuento = Number(concepto.descuento || concepto.discount || 0);
    const tasaIva = Number(concepto.tasa_iva ?? 0.16);
    const retencion = Number(concepto.retencion || 0);
    const subtotalBruto = this.redondear(cantidad * precioUnitario);
    const base = this.redondear(Math.max(subtotalBruto - descuento, 0));
    const iva = this.redondear(base * tasaIva);
    const total = this.redondear(base + iva - retencion);

    return {
      ...concepto,
      cantidad,
      precio_unitario: precioUnitario,
      descuento: this.redondear(descuento),
      subtotal: base,
      iva,
      retencion: this.redondear(retencion),
      total
    };
  }

  calcularTotales(conceptos = []) {
    const conceptosCalculados = conceptos.map((concepto) => this.calcularConcepto(concepto));
    const subtotal = this.redondear(conceptosCalculados.reduce((suma, concepto) => suma + concepto.subtotal, 0));
    const iva = this.redondear(conceptosCalculados.reduce((suma, concepto) => suma + concepto.iva, 0));
    const retenciones = this.redondear(conceptosCalculados.reduce((suma, concepto) => suma + concepto.retencion, 0));
    const total = this.redondear(subtotal + iva - retenciones);

    return { conceptos: conceptosCalculados, subtotal, iva, retenciones, total };
  }
}

module.exports = ServicioCalculadoraImpuestos;
