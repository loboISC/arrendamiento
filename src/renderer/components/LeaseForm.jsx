import React, { useState } from 'react';

function LeaseForm({ onContratoCreado }) {
  const [cliente, setCliente] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enviar datos al backend vía IPC
    const contrato = { cliente, fechaInicio, fechaFin };
    const { success } = await window.electron.invoke('lease:crear', contrato);
    if (success && onContratoCreado) onContratoCreado();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Nuevo Contrato de Arrendamiento</h2>
      <input placeholder="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} required />
      <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required />
      <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required />
      <button type="submit">Crear Contrato</button>
    </form>
  );
}

export default LeaseForm;
