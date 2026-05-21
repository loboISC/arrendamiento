/**
 * Servicio para aplicación automática de notas de crédito a cobranza.
 * Gestiona: APLICAR, SALDO_FAVOR, DEVOLUCION
 */
class ServicioAplicacionCobranzaNC {
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  /**
   * Aplicar automáticamente: reduce saldo pendiente de factura relacionada
   */
  async aplicarAutomaticamente(creditNoteId, usuarioId) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    // Registrar en customer_ledger como ABONO
    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'ABONO',
      descripcion: `Aplicación automática de NC ${nota.folio || nota.uuid || nota.id} sobre factura ${nota.id_factura_origen}`,
      referencia_tipo: 'credit_note',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null
    };

    await this.repositorio.registrarMovimientoCobranza(movimiento);
    
    // Actualizar estado de la NC a APLICADA
    await this.repositorio.actualizarEstado(creditNoteId, 'APLICADA', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'AUTOMATICA'
    });

    return {
      tipo_aplicacion: 'AUTOMATICA',
      mensaje: `Nota de crédito aplicada automáticamente como abono. Saldo del cliente reducido en ${nota.total}`,
      movimiento_id: nota.id
    };
  }

  /**
   * Dejar como saldo a favor: sin aplicar a factura específica
   */
  async dejarComoSaldoFavor(creditNoteId, usuarioId) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    // Registrar en customer_ledger como SALDO_FAVOR
    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'SALDO_FAVOR',
      descripcion: `Saldo a favor por NC ${nota.folio || nota.uuid || nota.id}. Disponible para aplicar manualmente.`,
      referencia_tipo: 'credit_note',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null,
      notas: 'Este saldo está disponible para aplicarse a futuras facturas del cliente.'
    };

    await this.repositorio.registrarMovimientoCobranza(movimiento);

    // Actualizar estado de la NC a PARCIAL (sin aplicar)
    await this.repositorio.actualizarEstado(creditNoteId, 'PARCIAL', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'SALDO_FAVOR'
    });

    return {
      tipo_aplicacion: 'SALDO_FAVOR',
      mensaje: `NC registrada como saldo a favor del cliente. El cliente puede solicitar esta cantidad en futuras transacciones.`,
      movimiento_id: nota.id,
      saldo_disponible: nota.total
    };
  }

  /**
   * Generar devolución: crea documento de devolución de efectivo
   */
  async generarDevolucion(creditNoteId, usuarioId) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    // Registrar en customer_ledger como DEVOLUCION
    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'DEVOLUCION',
      descripcion: `Devolución de efectivo por NC ${nota.folio || nota.uuid || nota.id}. Monto: ${nota.total}`,
      referencia_tipo: 'credit_note_devolucion',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null,
      estado_devolucion: 'PENDIENTE'
    };

    const movimiento_id = await this.repositorio.registrarMovimientoCobranza(movimiento);

    // Actualizar estado de la NC a APLICADA pero con marca de devolución
    await this.repositorio.actualizarEstado(creditNoteId, 'APLICADA', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'DEVOLUCION',
      notas: `Devolución generada. Movimiento ID: ${movimiento_id}`
    });

    return {
      tipo_aplicacion: 'DEVOLUCION',
      mensaje: `Devolución de efectivo generada. El cliente recibirá ${nota.total} según su forma de pago registrada.`,
      movimiento_id: movimiento_id,
      estado: 'PENDIENTE',
      monto_devolucion: nota.total
    };
  }

  /**
   * Procesar aplicación según tipo seleccionado
   */
  async procesarAplicacion(creditNoteId, tipoAplicacion, usuarioId) {
    switch (String(tipoAplicacion).toUpperCase()) {
      case 'APLICAR':
      case 'AUTOMATICA':
        return await this.aplicarAutomaticamente(creditNoteId, usuarioId);
      
      case 'SALDO_FAVOR':
        return await this.dejarComoSaldoFavor(creditNoteId, usuarioId);
      
      case 'DEVOLUCION':
        return await this.generarDevolucion(creditNoteId, usuarioId);
      
      default:
        const error = new Error(`Tipo de aplicación inválido: ${tipoAplicacion}`);
        error.statusCode = 400;
        throw error;
    }
  }
}

module.exports = ServicioAplicacionCobranzaNC;
