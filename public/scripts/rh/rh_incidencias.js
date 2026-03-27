// Mock Data para Incidencias
let incidencias = [
    { id: 1, name: "Juan Pérez García", date: "2026-03-24", type: "Retardo", desc: "Entrada: 08:02:15 (Tolerancia 3 min)", status: "Pendiente" },
    { id: 2, name: "Roberto Sánchez Díaz", date: "2026-03-24", type: "Retardo", desc: "Entrada: 08:12:44", status: "Justificado" },
    { id: 3, name: "Pedro Gómez Luna", date: "2026-03-23", type: "Falta", desc: "Sin registros de entrada/salida", status: "Pendiente" },
    { id: 4, name: "María Rodríguez Sosa", date: "2026-03-20", type: "Permiso", desc: "Cita Médica IMSS", status: "Aprobado" }
];

const tableBody = document.getElementById('incidentsTableBody');
const editModal = document.getElementById('editIncidentModal');
let _idEditando = null;

function renderizarIncidencias() {
    tableBody.innerHTML = '';
    incidencias.forEach(inc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${inc.name}</strong></td>
            <td>${inc.date}</td>
            <td><span class="badge ${inc.type === 'Falta' ? 'badge-danger' : 'badge-warning'}">${inc.type}</span></td>
            <td>${inc.desc}</td>
            <td><span class="badge ${obtenerBadgeEstado(inc.status)}">${inc.status}</span></td>
            <td>
                <button class="btn-action" onclick="abrirModalEdicion(${inc.id})">
                    <i class="fa-solid fa-pen-to-square"></i> Editar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    actualizarContadores();
}

function obtenerBadgeEstado(status) {
    if (status === 'Pendiente') return 'badge-warning';
    if (status === 'Justificado' || status === 'Aprobado') return 'badge-success';
    if (status === 'Rechazado') return 'badge-danger';
    return '';
}

function abrirModalEdicion(id) {
    const inc = incidencias.find(i => i.id === id);
    if (!inc) return;

    _idEditando = id;
    document.getElementById('ei_name').value = inc.name;
    document.getElementById('ei_type').value = inc.type;
    document.getElementById('ei_status').value = inc.status;
    document.getElementById('ei_desc').value = inc.desc;
    
    editModal.style.display = 'flex';
}

function cerrarModalEdicion() {
    editModal.style.display = 'none';
}

function actualizarIncidencia() {
    const inc = incidencias.find(i => i.id === _idEditando);
    if (inc) {
        inc.type = document.getElementById('ei_type').value;
        inc.status = document.getElementById('ei_status').value;
        inc.desc = document.getElementById('ei_desc').value;
        
        renderizarIncidencias();
        cerrarModalEdicion();
        showToast('Incidencia actualizada correctamente.');
    }
}

function actualizarContadores() {
    const retardos = incidencias.filter(i => i.type === 'Retardo' && i.status === 'Pendiente').length;
    const faltas = incidencias.filter(i => i.type === 'Falta' && i.status === 'Pendiente').length;
    
    document.getElementById('countRetardos').textContent = retardos;
    document.getElementById('countFaltas').textContent = faltas;
}

// Initial render
renderizarIncidencias();
