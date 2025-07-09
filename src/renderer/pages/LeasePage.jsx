import React, { useEffect, useState } from 'react';
import LeaseForm from '../components/LeaseForm';

function LeasePage() {
  const [contratos, setContratos] = useState([]);

  const cargarContratos = async () => {
    const lista = await window.electron.invoke('lease:obtenerTodos');
    setContratos(lista);
  };

  useEffect(() => {
    cargarContratos();
  }, []);

  return (
    <div>
      <LeaseForm onContratoCreado={cargarContratos} />
      <h2>Contratos Existentes</h2>
      <ul>
        {contratos.map(c => (
          <li key={c.id}>{c.cliente} | {c.fechaInicio} - {c.fechaFin} | {c.estado}</li>
        ))}
      </ul>
    </div>
  );
}

export default LeasePage;
