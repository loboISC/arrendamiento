// Variables globales para el estado local
let empleados = [];
let catalogos = { departamentos: [], puestos: [], turnos: [] };

const tableBody = document.getElementById('employeeTableBody');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('employeeModal');
let _idEditando = null;

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
});

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            obtenerEmpleados(),
            cargarCatalogos()
        ]);
    } catch (err) {
        showToast('Error al conectar con el servidor', 'error');
    }
}

async function obtenerEmpleados() {
    try {
        const res = await fetch('/api/rh/empleados');
        empleados = await res.json();
        renderizarEmpleados(empleados);
    } catch (err) {
        console.error(err);
    }
}

async function cargarCatalogos() {
    try {
        const [resPuestos, resDeptos] = await Promise.all([
            fetch('/api/rh/config/puestos').then(r => r.json()),
            fetch('/api/rh/config/deptos').then(r => r.json())
        ]);

        catalogos.puestos = resPuestos;
        catalogos.departamentos = resDeptos;

        // Poblar selects
        const sPuesto = document.getElementById('m_puesto');
        const sDepto = document.getElementById('m_depto');

        sPuesto.innerHTML = '<option value="">Seleccionar Puesto...</option>';
        catalogos.puestos.forEach(p => {
            sPuesto.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });

        sDepto.innerHTML = '<option value="">Seleccionar Departamento...</option>';
        catalogos.departamentos.forEach(d => {
            sDepto.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
        });
    } catch (err) {
        console.error('Error al cargar catálogos:', err);
    }
}

// --- RENDERIZADO ---

function renderizarEmpleados(data = empleados) {
    tableBody.innerHTML = '';
    data.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img src="/assets/images/LOGO_ANDAMIOS_02.png" class="emp-avatar"></td>
            <td>
                <strong>${emp.nombre} ${emp.apellidos || ''}</strong><br>
                <small style="color:var(--muted);">${emp.id} | ${emp.curp || 'S/C'}</small>
            </td>
            <td>${emp.puesto || 'Sin asignar'}</td>
            <td>${emp.reg_patronal || 'N/A'}</td>
            <td>${emp.bio_id || '-'}</td>
            <td><span class="badge ${emp.estado === 'Activo' ? 'badge-active' : 'badge-inactive'}">${emp.estado}</span></td>
            <td class="actions-cell">
                <i class="fa-solid fa-address-card action-icon" onclick="editarEmpleado('${emp.id}')" title="Ver Expediente"></i>
                <i class="fa-solid fa-trash action-icon" onclick="eliminarEmpleado('${emp.id}')" title="Baja de Empleado"></i>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- BÚSQUEDA ---

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = empleados.filter(emp =>
        (emp.nombre + ' ' + emp.apellidos).toLowerCase().includes(term) ||
        emp.id.toString().includes(term) ||
        (emp.curp && emp.curp.toLowerCase().includes(term))
    );
    renderizarEmpleados(filtered);
});

// --- GESTIÓN DE MODAL ---

function abrirModal() {
    _idEditando = null;
    document.getElementById('modalTitle').textContent = "Nuevo Empleado";
    limpiarFormulario();
    document.getElementById('m_id').disabled = false; // Permitir asignar ID
    cambiarTabModal('general');
    modal.style.display = 'flex';
}

function cerrarModal() {
    modal.style.display = 'none';
}

function cambiarTabModal(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.modal-tab[onclick="cambiarTabModal('${tab}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function limpiarFormulario() {
    const fields = [
        'id', 'nombre', 'apellidos', 'fecha_nac', 'curp', 'rfc', 'nss', 'tel', 'sangre', 'dir', 'emergencia',
        'puesto', 'depto', 'tipo', 'bio_id', 'ingreso', 'reg_patronal', 'prestaciones', 'salario_diario', 'sdi', 'nomina', 'contrato'
    ];
    fields.forEach(f => {
        const el = document.getElementById(`m_${f}`);
        if (el) el.value = '';
    });
    document.getElementById('m_estado').value = 'Activo';
}

// --- ACCIONES API ---

async function guardarEmpleado() {
    const id = document.getElementById('m_id').value;
    const nombre = document.getElementById('m_nombre').value;

    if (!id || !nombre) return showToast('ID y Nombre son obligatorios', 'error');

    const data = {
        id, nombre,
        apellidos: document.getElementById('m_apellidos').value,
        fecha_nac: document.getElementById('m_fecha_nac').value,
        curp: document.getElementById('m_curp').value,
        rfc: document.getElementById('m_rfc').value,
        nss: document.getElementById('m_nss').value,
        telefono: document.getElementById('m_tel').value,
        tipo_sangre: document.getElementById('m_sangre').value,
        direccion: document.getElementById('m_dir').value,
        contacto_emergencia: document.getElementById('m_emergencia').value,
        puesto_id: document.getElementById('m_puesto').value,
        bio_id: document.getElementById('m_bio_id').value,
        fecha_ingreso: document.getElementById('m_ingreso').value,
        estado: document.getElementById('m_estado').value,
        reg_patronal: document.getElementById('m_reg_patronal').value,
        tipo_prestaciones: document.getElementById('m_prestaciones').value,
        salario_diario: document.getElementById('m_salario_diario').value,
        sdi: document.getElementById('m_sdi').value,
        nomina_asignada: document.getElementById('m_nomina').value,
        tipo_contrato: document.getElementById('m_contrato').value,
        correo_empresa: document.getElementById('m_correo_empresa').value,
        celular_empresa: document.getElementById('m_celular_empresa').value
    };

    try {
        const res = await fetch('/api/rh/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast('Expediente guardado correctamente');
            cerrarModal();
            obtenerEmpleados();
        } else {
            const err = await res.json();
            showToast('Error: ' + err.error, 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

async function editarEmpleado(id) {
    try {
        const res = await fetch(`/api/rh/empleados/${id}`);
        const emp = await res.json();

        _idEditando = id;
        document.getElementById('modalTitle').textContent = "Expediente: " + emp.nombre;
        document.getElementById('m_id').value = emp.id;
        document.getElementById('m_id').disabled = true; // No permitir cambiar ID en edición

        // Mapeo manual para asegurar que los campos coincidan con la DB
        document.getElementById('m_nombre').value = emp.nombre || '';
        document.getElementById('m_apellidos').value = emp.apellidos || '';
        document.getElementById('m_fecha_nac').value = emp.fecha_nac ? emp.fecha_nac.substring(0, 10) : '';
        document.getElementById('m_curp').value = emp.curp || '';
        document.getElementById('m_rfc').value = emp.rfc || '';
        document.getElementById('m_nss').value = emp.nss || '';
        document.getElementById('m_tel').value = emp.telefono || '';
        document.getElementById('m_sangre').value = emp.tipo_sangre || '';
        document.getElementById('m_dir').value = emp.direccion || '';
        document.getElementById('m_emergencia').value = emp.contacto_emergencia || '';
        document.getElementById('m_puesto').value = emp.puesto_id || '';
        document.getElementById('m_bio_id').value = emp.bio_id || '';
        document.getElementById('m_ingreso').value = emp.fecha_ingreso ? emp.fecha_ingreso.substring(0, 10) : '';
        document.getElementById('m_estado').value = emp.estado || 'Activo';
        document.getElementById('m_reg_patronal').value = emp.reg_patronal || '';
        document.getElementById('m_prestaciones').value = emp.tipo_prestaciones || 'DE LEY';
        document.getElementById('m_salario_diario').value = emp.salario_diario || 0;
        document.getElementById('m_sdi').value = emp.sdi || 0;
        document.getElementById('m_nomina').value = emp.nomina_asignada || '';
        document.getElementById('m_contrato').value = emp.tipo_contrato || '';
        document.getElementById('m_correo_empresa').value = emp.correo_empresa || '';
        document.getElementById('m_celular_empresa').value = emp.celular_empresa || '';

        cambiarTabModal('general');
        modal.style.display = 'flex';
    } catch (err) {
        showToast('Error al obtener datos del empleado', 'error');
    }
}

function eliminarEmpleado(id) {
    // Para RH, preferimos "Baja" que eliminar físicamente
    if (confirm('¿Estás seguro de dar de BAJA este expediente?')) {
        // En una fase posterior implementaremos un endpoint de DELETE o status update
        showToast('Funcionalidad de baja en desarrollo. Cambie el estado a "Baja" manualmente.', 'info');
    }
}

// --- IMPORTACIÓN MASIVA ---

function triggerImport() {
    document.getElementById('csvImportInput').click();
}

async function procesarArchivoCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        showToast('Por favor selecciona un archivo .csv', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('csv', file);

    showToast('Procesando archivo...', 'info');

    try {
        const res = await fetch('/api/rh/importar', {
            method: 'POST',
            body: formData
        });

        const result = await res.json();
        if (res.ok) {
            showToast(`¡Éxito! Se procesaron ${result.procesados} registros.`);
            obtenerEmpleados(); // Recargar tabla
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('Error de conexión al importar', 'error');
        console.error(err);
    } finally {
        event.target.value = ''; // Limpiar input
    }
}

function exportarDatosCSV() {
    showToast('Generando archivo de exportación...', 'info');
    window.location.href = '/api/rh/exportar';
}
