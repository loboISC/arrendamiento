// Mock Data Extendido para Empleados
let empleados = [
    { 
        id: 1, nombre: "Juan", apellidos: "Pérez García", curp: "PERJ850101HDFRRN01", rfc: "PERJ850101ABC", nss: "12345678901",
        puesto: "Chofer", depto: "Operaciones", tipo: "Planta", bio_id: 101, estado: "Activo",
        tel: "555-0123", sangre: "O+", ingreso: "2023-01-15", dir: "Av. Industrial 123, Col. Centro", emergencia: "Esposa - 555-9999"
    },
    { 
        id: 2, nombre: "María", apellidos: "Rodríguez Sosa", curp: "ROSM900505MDFRRN02", rfc: "ROSM900505XYZ", nss: "98765432101",
        puesto: "Administrativo", depto: "Administración", tipo: "Planta", bio_id: 102, estado: "Activo",
        tel: "555-4567", sangre: "A+", ingreso: "2024-02-10", dir: "Calle Roble 45, Juárez", emergencia: "Padre - 555-8888"
    }
];

const tableBody = document.getElementById('employeeTableBody');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('employeeModal');
let _idEditando = null;

function renderizarEmpleados(data = empleados) {
    tableBody.innerHTML = '';
    data.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img src="/assets/images/LOGO_ANDAMIOS_02.png" class="emp-avatar"></td>
            <td>
                <strong>${emp.nombre} ${emp.apellidos}</strong><br>
                <small style="color:var(--muted);">${emp.curp}</small>
            </td>
            <td>${emp.puesto}</td>
            <td>${emp.tipo}</td>
            <td>${emp.bio_id}</td>
            <td><span class="badge ${emp.estado === 'Activo' ? 'badge-active' : 'badge-inactive'}">${emp.estado}</span></td>
            <td class="actions-cell">
                <i class="fa-solid fa-address-card action-icon" onclick="editarEmpleado(${emp.id})" title="Ver Expediente"></i>
                <i class="fa-solid fa-trash action-icon" onclick="eliminarEmpleado(${emp.id})" title="Eliminar"></i>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = empleados.filter(emp => 
        emp.nombre.toLowerCase().includes(term) || 
        emp.apellidos.toLowerCase().includes(term) || 
        emp.curp.toLowerCase().includes(term)
    );
    renderizarEmpleados(filtered);
});

function abrirModal() {
    document.getElementById('modalTitle').textContent = "Nuevo Empleado";
    limpiarFormulario();
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
    const fields = ['nombre', 'apellidos', 'curp', 'rfc', 'nss', 'tel', 'sangre', 'dir', 'emergencia', 'bio_id', 'ingreso'];
    fields.forEach(f => {
        const el = document.getElementById(`m_${f}`);
        if(el) el.value = '';
    });
    document.getElementById('m_estado').value = 'Activo';
}

function guardarEmpleado() {
    const nombre = document.getElementById('m_nombre').value;
    if (!nombre) return alert('El nombre es requerido');

    if (_idEditando) {
        const emp = empleados.find(e => e.id === _idEditando);
        if (emp) {
            emp.nombre = nombre;
            emp.apellidos = document.getElementById('m_apellidos').value;
            emp.curp = document.getElementById('m_curp').value;
            emp.puesto = document.getElementById('m_puesto').value;
            emp.estado = document.getElementById('m_estado').value;
            emp.tipo = document.getElementById('m_tipo').value;
            // ... otros campos podrían mapearse igual
        }
    }

    renderizarEmpleados();
    alert('Expediente guardado exitosamente (Simulación)');
    cerrarModal();
    _idEditando = null;
}

function editarEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    _idEditando = id;
    
    document.getElementById('modalTitle').textContent = "Expediente de " + emp.nombre;
    
    // Poblar campos
    document.getElementById('m_nombre').value = emp.nombre;
    document.getElementById('m_apellidos').value = emp.apellidos;
    document.getElementById('m_curp').value = emp.curp;
    document.getElementById('m_rfc').value = emp.rfc;
    document.getElementById('m_nss').value = emp.nss;
    document.getElementById('m_tel').value = emp.tel;
    document.getElementById('m_sangre').value = emp.sangre;
    document.getElementById('m_dir').value = emp.dir;
    document.getElementById('m_emergencia').value = emp.emergencia;
    
    document.getElementById('m_puesto').value = emp.puesto;
    document.getElementById('m_depto').value = emp.depto || 'Operaciones';
    document.getElementById('m_tipo').value = emp.tipo;
    document.getElementById('m_bio_id').value = emp.bio_id;
    document.getElementById('m_ingreso').value = emp.ingreso;
    document.getElementById('m_estado').value = emp.estado;
    
    cambiarTabModal('general');
    modal.style.display = 'flex';
}

function eliminarEmpleado(id) {
    if (confirm('¿Estás seguro de eliminar este expediente?')) {
        empleados = empleados.filter(e => e.id !== id);
        renderizarEmpleados();
    }
}

// Initial render
renderizarEmpleados();
