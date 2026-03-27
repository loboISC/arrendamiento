// Mock Data Extendido para Empleados
let empleados = [
    { 
        id: 1, nombre: "Juan", apellidos: "Pérez García", curp: "PERJ850101HDFRRN01", rfc: "PERJ850101ABC", nss: "12345678901",
        puesto: "Chofer", depto: "Operaciones", tipo: "Planta", bio_id: 101, estado: "Activo",
        tel: "555-0123", sangre: "O+", ingreso: "2023-01-15", dir: "Av. Industrial 123, Col. Centro", emergencia: "Esposa - 555-9999",
        fecha_nac: "1985-01-01", reg_patronal: "Y56-49369-10-4", prestaciones: "DE LEY", salario_diario: 450.00, sdi: 472.50, nomina: "NOMINA QUINCENAL", contrato: "INDETERMINADO"
    },
    { 
        id: 2, nombre: "María", apellidos: "Rodríguez Sosa", curp: "ROSM900505MDFRRN02", rfc: "ROSM900505XYZ", nss: "98765432101",
        puesto: "Administrativo", depto: "Administración", tipo: "Planta", bio_id: 102, estado: "Activo",
        tel: "555-4567", sangre: "A+", ingreso: "2024-02-10", dir: "Calle Roble 45, Juárez", emergencia: "Padre - 555-8888",
        fecha_nac: "1990-05-05", reg_patronal: "Y56-49369-10-4", prestaciones: "DE LEY", salario_diario: 600.00, sdi: 630.00, nomina: "NOMINA QUINCENAL", contrato: "INDETERMINADO"
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
    const fields = [
        'nombre', 'apellidos', 'fecha_nac', 'curp', 'rfc', 'nss', 'tel', 'sangre', 'dir', 'emergencia', 
        'puesto', 'depto', 'tipo', 'bio_id', 'ingreso', 'reg_patronal', 'prestaciones', 'salario_diario', 'sdi', 'nomina', 'contrato'
    ];
    fields.forEach(f => {
        const el = document.getElementById(`m_${f}`);
        if(el) el.value = '';
    });
    document.getElementById('m_estado').value = 'Activo';
}

function guardarEmpleado() {
    const nombre = document.getElementById('m_nombre').value;
    if (!nombre) return showToast('El nombre es requerido', 'error');

    const data = {
        nombre,
        apellidos: document.getElementById('m_apellidos').value,
        fecha_nac: document.getElementById('m_fecha_nac').value,
        curp: document.getElementById('m_curp').value,
        rfc: document.getElementById('m_rfc').value,
        nss: document.getElementById('m_nss').value,
        tel: document.getElementById('m_tel').value,
        sangre: document.getElementById('m_sangre').value,
        dir: document.getElementById('m_dir').value,
        emergencia: document.getElementById('m_emergencia').value,
        puesto: document.getElementById('m_puesto').value,
        depto: document.getElementById('m_depto').value,
        tipo: document.getElementById('m_tipo').value,
        bio_id: document.getElementById('m_bio_id').value,
        ingreso: document.getElementById('m_ingreso').value,
        estado: document.getElementById('m_estado').value,
        reg_patronal: document.getElementById('m_reg_patronal').value,
        prestaciones: document.getElementById('m_prestaciones').value,
        salario_diario: document.getElementById('m_salario_diario').value,
        sdi: document.getElementById('m_sdi').value,
        nomina: document.getElementById('m_nomina').value,
        contrato: document.getElementById('m_contrato').value
    };

    if (_idEditando) {
        const index = empleados.findIndex(e => e.id === _idEditando);
        if (index !== -1) {
            empleados[index] = { ...empleados[index], ...data };
            showToast('Expediente actualizado correctamente');
        }
    } else {
        const nuevo = { id: Date.now(), ...data };
        empleados.push(nuevo);
        showToast('Expediente creado exitosamente');
    }

    renderizarEmpleados();
    cerrarModal();
    _idEditando = null;
}

function editarEmpleado(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    _idEditando = id;
    
    document.getElementById('modalTitle').textContent = "Expediente de " + emp.nombre;
    
    // Poblar campos
    const fields = [
        'nombre', 'apellidos', 'fecha_nac', 'curp', 'rfc', 'nss', 'tel', 'sangre', 'dir', 'emergencia', 
        'puesto', 'depto', 'tipo', 'bio_id', 'ingreso', 'estado', 'reg_patronal', 'prestaciones', 'salario_diario', 'sdi', 'nomina', 'contrato'
    ];
    
    fields.forEach(f => {
        const el = document.getElementById(`m_${f}`);
        if(el) el.value = emp[f] || '';
    });
    
    cambiarTabModal('general');
    modal.style.display = 'flex';
}

function eliminarEmpleado(id) {
    if (confirm('¿Estás seguro de eliminar este expediente?')) {
        empleados = empleados.filter(e => e.id !== id);
        renderizarEmpleados();
        showToast('Expediente eliminado', 'warning');
    }
}

// Initial render
renderizarEmpleados();
