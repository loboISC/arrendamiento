/**
 * Servicio de calculo fiscal para notas de credito.
 * Centraliza redondeos y evita diferencias entre vista previa, guardado y timbrado.
 */
class ServicioCalculadoraImpuestos {
  redondear(valor) {
    return Number(Number(valor || 0).toFixed(2));
  }

  /**
   * Base gravable, IVA y total alineados con Facturama: Total impuesto = round(Base * Rate, 2).
   */
  calcularLineaFacturama(concepto) {
    const cantidad = Number(concepto.cantidad || concepto.quantity || 0);
    const precioUnitario = Number(concepto.precio_unitario || concepto.unit_price || 0);
    const descuentoFijo = Number(concepto.descuento || concepto.discount || 0);
    const descuentoPct = Number(concepto.descuento_porcentaje || 0);
    const tasaIva = Number(concepto.tasa_iva ?? concepto.tax_rate ?? 0.16);

    const subtotalBruto = this.redondear(cantidad * precioUnitario);
    const descuento = this.redondear(descuentoFijo + subtotalBruto * (descuentoPct / 100));
    const base = this.redondear(Math.max(subtotalBruto - descuento, 0));
    const iva = this.redondear(base * tasaIva);
    const total = this.redondear(base + iva);

    return {
      cantidad,
      precioUnitario,
      descuento,
      subtotalBruto,
      base,
      tasaIva,
      iva,
      total
    };
  }

  calcularTrasladoIva(base, tasaIva = 0.16) {
    const baseRedondeada = this.redondear(base);
    const rate = Number(tasaIva);
    return {
      Base: baseRedondeada,
      Rate: rate,
      Total: this.redondear(baseRedondeada * rate),
      Name: 'IVA',
      IsRetention: false
    };
  }

  calcularConcepto(concepto) {
    const cantidad = Number(concepto.cantidad || concepto.quantity || 0);
    const precioUnitario = Number(concepto.precio_unitario || concepto.unit_price || 0);
    const descuentoFijo = Number(concepto.descuento || concepto.discount || 0);
    const descuentoPct = Number(concepto.descuento_porcentaje || 0);
    const tasaIva = Number(concepto.tasa_iva ?? 0.16);
    const retencion = Number(concepto.retencion || 0);
    const subtotalBruto = this.redondear(cantidad * precioUnitario);
    const descuento = this.redondear(descuentoFijo + subtotalBruto * (descuentoPct / 100));
    const base = this.redondear(Math.max(subtotalBruto - descuento, 0));

    const lineaFacturama = this.calcularLineaFacturama({
      ...concepto,
      cantidad,
      precio_unitario: precioUnitario,
      descuento: descuentoFijo,
      descuento_porcentaje: descuentoPct,
      tasa_iva: tasaIva
    });

    let iva;
    if (concepto.iva_manual != null && concepto.iva_manual !== '' && Number.isFinite(Number(concepto.iva_manual))) {
      iva = this.redondear(Number(concepto.iva_manual));
    } else {
      iva = lineaFacturama.iva;
    }

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
