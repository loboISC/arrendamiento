// ─────────────────────────────────────────────
//  DASHBOARD DE ASISTENCIA - LÓGICA DE DATOS
// ─────────────────────────────────────────────

let lastData = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarDashboard();

    document.getElementById('btnRefresh').addEventListener('click', cargarDashboard);
    document.getElementById('periodFilter').addEventListener('change', cargarDashboard);
    document.getElementById('locationFilter').addEventListener('change', () => {
        if (lastData) aplicarFiltrosLocal();
    });
});

async function cargarDashboard() {
    const period = document.getElementById('periodFilter').value;
    const btn = document.getElementById('btnRefresh');
    
    btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Cargando...';
    
    try {
        const url = `/api/rh/asistencia/dashboard-stats?quincena=${period}`;
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok) {
            console.log('Dashboard Data:', data);
            lastData = data;
            aplicarFiltrosLocal();
        } else {
            showToast(data.error || 'Error al cargar dashboard', 'error');
        }
    } catch (err) {
        console.error('Dashboard Error:', err);
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-sync"></i> Actualizar';
    }
}

function aplicarFiltrosLocal() {
    if (!lastData) return;

    const location = document.getElementById('locationFilter').value;
    
    let filteredCritical = lastData.criticalAbsences;
    let filteredPerfect = lastData.perfectAttendance;
    let currentKPIs = { ...lastData.kpis };

    if (location !== 'all') {
        const locId = parseInt(location);
        filteredCritical = lastData.criticalAbsences.filter(f => f.depto_padre === locId);
        filteredPerfect = lastData.perfectAttendance.filter(f => f.depto_padre === locId);
        
        // Recalcular KPIs básicos para la planta
        currentKPIs.criticalAbsences = filteredCritical.filter(f => f.faltas >= 3 || f.retardos >= 3).length;
    }

    renderKPIs(currentKPIs);
    renderCriticalAbsences(filteredCritical);
    renderPerfectAttendance(filteredPerfect);
}

function renderKPIs(kpis) {
    document.getElementById('statAttendanceRate').innerText = `${kpis.attendanceRate}%`;
    document.getElementById('statCriticalAbsences').innerText = kpis.criticalAbsences;
    document.getElementById('statAvgLate').innerText = `${kpis.avgLate} min`;
    document.getElementById('statUnlinked').innerText = kpis.unlinked;

    const alertCard = document.querySelector('.absences-alert');
    if (kpis.criticalAbsences > 0) {
        alertCard.style.borderLeft = '5px solid var(--danger)';
    } else {
        alertCard.style.borderLeft = '1px solid var(--line)';
    }
}

function renderCriticalAbsences(absences) {
    const body = document.getElementById('criticalAbsencesBody');
    body.innerHTML = '';

    if (absences.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--muted);">No hay incidencias en esta planta 🎉</td></tr>';
        return;
    }

    absences.forEach(emp => {
        const row = document.createElement('tr');
        
        let badgeHtml = '';
        if (emp.faltas >= 3) {
            badgeHtml = '<span class="badge-danger">FALTAS CRÍTICAS</span>';
        } else if (emp.retardos >= 3) {
            badgeHtml = '<span style="background:#fff3e0; color:#e65100; padding:4px 8px; border-radius:12px; font-size:10px; font-weight:bold; border: 1px solid #ffcc80;">EXCESO RETARDOS</span>';
        } else {
            badgeHtml = '<span class="badge-warning">OBSERVACIÓN</span>';
        }

        row.innerHTML = `
            <td>
                <div style="font-weight:700;">${emp.nombre} ${emp.apellidos}</div>
                <div style="font-size:11px; color:var(--muted);">ID: ${emp.empleado_id}</div>
            </td>
            <td>
                <span class="location-label ${emp.depto_padre === 101 ? 'text-cdmx' : 'text-tex'}">
                    ${emp.depto_padre === 101 ? 'CDMX' : 'TEXCOCO'}
                </span>
            </td>
            <td><div class="present-count" style="font-weight:700; color:#2e7d32; text-align:center;">${emp.asistencias}</div></td>
            <td><div class="abs-count" style="font-weight:700; text-align:center;">${emp.faltas}</div></td>
            <td><div class="late-count" style="font-weight:700; color:#e65100; text-align:center;">${emp.retardos}</div></td>
            <td>${badgeHtml}</td>
            <td>
                <button class="btn-refresh" style="padding:5px 10px; font-size:11px;" onclick="parent.window.MapsTo('rh-empleados');">
                    Ver Detalle
                </button>
            </td>
        `;
        body.appendChild(row);
    });
}

function renderPerfectAttendance(perfect) {
    const list = document.getElementById('perfectAttendanceList');
    list.innerHTML = '';

    if (perfect.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:var(--muted); padding:20px;">Sin datos</li>';
        return;
    }

    perfect.forEach((emp, index) => {
        const item = document.createElement('li');
        item.className = 'ranking-item';
        item.innerHTML = `
            <div class="rank-pos">${index + 1}</div>
            <div class="rank-info">
                <span class="rank-name">${emp.nombre} ${emp.apellidos}</span>
                <span class="rank-meta">${emp.depto_padre === 101 ? 'Corporativo' : 'Planta Texcoco'}</span>
            </div>
            <div class="rank-badge">
                <i class="fa-solid fa-award text-warning" style="font-size:20px;"></i>
            </div>
        `;
        list.appendChild(item);
    });
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('rh-toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = `rh-toast rh-toast-active ${type}`;
    setTimeout(() => { toast.className = 'rh-toast'; }, 3500);
}
