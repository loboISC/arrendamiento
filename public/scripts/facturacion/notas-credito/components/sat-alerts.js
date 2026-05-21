/* Componente de alertas SAT visibles. */
window.ComponenteAlertasSATNC = {
  render(contenedor, estado) {
    const saldo = Number(estado.facturaSeleccionada?.saldo_disponible || 0);
    const errores = [];
    if (!estado.facturaSeleccionada) errores.push('CFDI relacionado obligatorio.');
    if (estado.totales.total > saldo && estado.facturaSeleccionada) errores.push('No exceder saldo acreditable.');
    if (!estado.motivo) errores.push('Motivo fiscal pendiente.');
    if (!estado.modoAvanzado && estado.tipoRelacion !== '01') errores.push('TipoRelacion solo puede cambiarse en modo avanzado.');

    contenedor.innerHTML = `
      <div class="nc-alertas">
        <div class="nc-alerta info"><i class="fa fa-circle-info"></i><span>La NC no cancela facturas; solo acredita saldo contra una factura existente.</span></div>
        <div class="nc-alerta info"><i class="fa fa-link"></i><span>CFDI relacionado obligatorio, UUID automatico y TipoRelacion ${estado.tipoRelacion || '01'}.</span></div>
        ${estado.modoAvanzado ? '<div class="nc-alerta info"><i class="fa fa-sliders"></i><span>Modo avanzado activo: revisa que la relacion y conceptos SAT coincidan con la correccion fiscal.</span></div>' : ''}
        ${errores.map((error) => `<div class="nc-alerta error"><i class="fa fa-triangle-exclamation"></i><span>${error}</span></div>`).join('')}
      </div>
    `;
  }
};
