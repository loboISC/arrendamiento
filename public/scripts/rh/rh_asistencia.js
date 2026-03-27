// Mock Data para Asistencia
let registrosAsistencia = [
    { id: 1, name: "Juan Pérez García",    bio_id: 101, date: "2026-03-24", time: "08:02:15", type: "Entrada", method: "Biométrico", status: "OK" },
    { id: 2, name: "Juan Pérez García",    bio_id: 101, date: "2026-03-24", time: "18:05:30", type: "Salida",  method: "Biométrico", status: "OK" },
    { id: 3, name: "María Rodríguez Sosa", bio_id: 102, date: "2026-03-24", time: "07:55:00", type: "Entrada", method: "Biométrico", status: "OK" },
    { id: 4, name: "Roberto Sánchez Díaz", bio_id: 105, date: "2026-03-24", time: "08:12:44", type: "Entrada", method: "Biométrico", status: "Retardo" }
];

const tableBody = document.getElementById('attendanceTableBody');
let _idEditando = null;

function renderizarAsistencia(data = registrosAsistencia) {
    tableBody.innerHTML = '';
    data.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    data.forEach(rec => {
        const row = document.createElement('tr');
        const statusClass = rec.status === 'OK' ? 'badge-ok' :
                            rec.status === 'Retardo' ? 'badge-retardo' : '';
        row.innerHTML = `
            <td><strong>${rec.name}</strong></td>
            <td>${rec.bio_id}</td>
            <td>${rec.date}</td>
            <td>${rec.time}</td>
            <td><span class="status-badge ${rec.type === 'Entrada' ? 'badge-entry' : 'badge-exit'}">${rec.type}</span></td>
            <td><span class="status-badge ${statusClass}">${rec.status || 'OK'}</span></td>
            <td><i class="fa-solid fa-fingerprint" style="margin-right:6px; color: var(--primary);"></i>${rec.method}</td>
            <td class="actions-cell">
                <i class="fa-solid fa-pen-to-square action-icon" onclick="editarRegistro(${rec.id})" title="Editar Manual"></i>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function editarRegistro(id) {
    const rec = registrosAsistencia.find(r => r.id === id);
    if (!rec) return;
    _idEditando = id;

    document.getElementById('editModalTitle').textContent = `Editar registro`;
    document.getElementById('editModalSub').textContent = `${rec.name} — ${rec.date} ${rec.time}`;
    document.getElementById('editStatusSelect').value = rec.status || 'OK';
    document.getElementById('editModal').style.display = 'flex';
}

function guardarEdicion() {
    const rec = registrosAsistencia.find(r => r.id === _idEditando);
    if (!rec) return cerrarModalEdicion();
    rec.status  = document.getElementById('editStatusSelect').value;
    rec.method  = 'Manual (RH)';
    showToast('Registro actualizado exitosamente');
    cerrarModalEdicion();
    renderizarAsistencia();
}

function cerrarModalEdicion() {
    document.getElementById('editModal').style.display = 'none';
    _idEditando = null;
}

// Cerrar modal al hacer clic en el overlay
document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalEdicion();
});

function simularImportacion() {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];

    const nuevosRegistros = [
        { id: 10, name: "Juan Pérez García",    bio_id: 101, date: today, time: "08:01:22", type: "Entrada", method: "Biométrico", status: "OK" },
        { id: 11, name: "María Rodríguez Sosa", bio_id: 102, date: today, time: "07:58:10", type: "Entrada", method: "Biométrico", status: "OK" },
        { id: 12, name: "Pedro Gómez Luna",     bio_id: 103, date: today, time: "08:15:00", type: "Entrada", method: "Biométrico", status: "Retardo" }
    ];

    registrosAsistencia = [...nuevosRegistros, ...registrosAsistencia];
    renderizarAsistencia();
    showToast('Importación del biométrico completada (3 nuevos registros)', 'info');
}

// Inicializar filtros de fecha con hoy
document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
renderizarAsistencia();
