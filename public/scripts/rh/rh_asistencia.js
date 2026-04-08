// ─────────────────────────────────────────────
//  CONTROL DE ASISTENCIA - LÓGICA DE FRONTEND
// ─────────────────────────────────────────────

const tableBody = document.getElementById('attendanceTableBody');
let _idEditando = null;
let asistencias = [];

const API_BASE = '/api/rh/asistencia';

async function cargarAsistencias() {
    try {
        const fecha = document.getElementById('dateFilter').value;
        const res = await fetch(`${API_BASE}?inicio=${fecha}&fin=${fecha}`);
        asistencias = await res.json();
        renderizarAsistencia(asistencias);
    } catch (err) {
        console.error('Error al cargar asistencias:', err);
    }
}

function renderizarAsistencia(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--muted);">No hay registros para este día</td></tr>';
        return;
    }

    data.forEach(rec => {
        const row = document.createElement('tr');
        const statusClass = rec.status === 'OK' ? 'badge-ok' :
                            rec.status === 'Retardo' ? 'badge-retardo' : 
                            rec.status === 'Justificado' ? 'badge-active' : 
                            rec.status === 'VINCULACIÓN PENDIENTE' ? 'badge-retardo' : 'badge-inactive';
        
        // Manejar fecha para preview
        const fechaDisplay = rec.fecha ? new Date(rec.fecha).toLocaleDateString() : 'Hoy (Reloj)';
        const tipoDisplay = rec.tipo || 'Entrada/Salida';

        row.innerHTML = `
            <td>
                <div style="font-weight:700;">${rec.nombre} ${rec.apellidos || ''}</div>
                <div style="font-size:11px; color:var(--muted);">${rec.departamento || 'No link'}</div>
            </td>
            <td><span class="badge-count">${rec.empleado_id || rec.bio_id_registro}</span></td>
            <td>${fechaDisplay}</td>
            <td><div style="font-weight:600;"><i class="fa-regular fa-clock"></i> ${rec.hora}</div></td>
            <td><span class="status-badge ${tipoDisplay.includes('Entrada') ? 'badge-entry' : 'badge-exit'}">${tipoDisplay}</span></td>
            <td><span class="status-badge ${statusClass}">${rec.status || 'OK'}</span></td>
            <td>
                <i class="fa-solid ${rec.metodo.includes('Biométrico') || rec.metodo.includes('Reloj') ? 'fa-fingerprint' : 'fa-keyboard'}" 
                   style="margin-right:6px; color: var(--primary);"></i>
                ${rec.metodo}
            </td>
            <td class="actions-cell">
                ${rec.id ? `<i class="fa-solid fa-pen-to-square action-icon" onclick="editarRegistro(${rec.id})" title="Editar Manual"></i>` : '<i class="fa-solid fa-lock" title="Solo lectura"></i>'}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function vistaPreviaReloj() {
    const btn = document.getElementById('btnPreview');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Leyendo Reloj...';

    try {
        const res = await fetch(`${API_BASE}/preview`);
        const data = await res.json();
        
        if (res.ok) {
            showToast(`Vista previa cargada: ${data.length} registros en el reloj hoy.`, 'success');
            renderizarAsistencia(data);
        } else {
            showToast(data.error || 'Error al obtener vista previa', 'error');
        }
    } catch (err) {
        showToast('Error de conexión con el biométrico', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function sincronizarReloj() {
    const btn = document.getElementById('btnSync');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Conectando al Reloj...';

    try {
        const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
        const data = await res.json();
        
        if (res.ok) {
            showToast(data.message, 'success');
            cargarAsistencias();
        } else {
            showToast(data.error || 'Error al sincronizar', 'error');
        }
    } catch (err) {
        showToast('Error de conexión con el biométrico', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function editarRegistro(id) {
    const rec = asistencias.find(r => r.id === id);
    if (!rec) return;
    _idEditando = id;

    const modal = document.getElementById('editModal');
    document.getElementById('editModalTitle').textContent = `Justificar Asistencia`;
    document.getElementById('editModalSub').textContent = `${rec.nombre} — ${rec.hora}`;
    document.getElementById('editStatusSelect').value = rec.status || 'OK';
    modal.style.display = 'flex';
}

function cerrarModalEdicion() {
    document.getElementById('editModal').style.display = 'none';
    _idEditando = null;
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('dateFilter');
    if (dateInput) {
        dateInput.value = today;
        dateInput.onchange = cargarAsistencias;
    }
    cargarAsistencias();
});

// Cerrar modal al hacer clic en el overlay
const modal = document.getElementById('editModal');
if (modal) {
    modal.addEventListener('click', function(e) {
        if (e.target === this) cerrarModalEdicion();
    });
}
