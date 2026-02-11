// API URL para transacciones
const TRANSACCIONES_URL = '/api/transacciones';

// Función para formatear moneda
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

// Función para formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Función para obtener el estilo del tipo de transacción
function getTypeClass(type) {
    return type.toLowerCase() === 'renta' ? 'renta' : 'pago';
}

// Función para renderizar una transacción
function renderTransaccion(transaccion) {
    return `
        <tr>
            <td>
                <div>${transaccion.cliente}</div>
                <div class="transaction-company">${transaccion.empresa}</div>
            </td>
            <td>
                <span class="transaction-type ${getTypeClass(transaccion.tipo)}">
                    ${transaccion.tipo}
                </span>
            </td>
            <td>${transaccion.referencia}</td>
            <td>${transaccion.descripcion}</td>
            <td class="transaction-amount">${formatMoney(transaccion.monto)}</td>
            <td>
                <span class="transaction-status">
                    ${transaccion.estado}
                </span>
            </td>
            <td>${formatDate(transaccion.fecha)}</td>
        </tr>
    `;
}

// Función para cargar transacciones
async function cargarTransacciones() {
    try {
        const headers = getAuthHeaders();
        const response = await fetch(TRANSACCIONES_URL, { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            // Si el endpoint no existe, mostrar datos vacíos en lugar de error
            if (response.status === 404) {
                console.warn('Endpoint de transacciones no encontrado, mostrando datos vacíos');
                mostrarTransacciones([]);
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const transacciones = await response.json();
        mostrarTransacciones(transacciones);
    } catch (error) {
        console.warn('Error al cargar transacciones, mostrando datos vacíos:', error.message);
        // En lugar de mostrar error, mostrar tabla vacía
        mostrarTransacciones([]);
    }
}

// Función para mostrar transacciones en la tabla
function mostrarTransacciones(transacciones) {
    const tablaTransacciones = document.getElementById('transacciones-table');
    if (!tablaTransacciones) return;
    
    if (transacciones.length === 0) {
        tablaTransacciones.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #888;">
                    <i class="fas fa-receipt" style="font-size: 3rem; margin-bottom: 16px; color: #e5e7eb;"></i>
                    <p>No hay transacciones registradas</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tablaTransacciones.innerHTML = transacciones.map(renderTransaccion).join('');
}

// Función para buscar transacciones
async function buscarTransacciones(termino) {
    if (!termino.trim()) {
        await cargarTransacciones();
        return;
    }
    
    try {
        const headers = getAuthHeaders();
        const response = await fetch(`${TRANSACCIONES_URL}/buscar?q=${encodeURIComponent(termino)}`, { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Error al buscar transacciones');
        }
        
        const transacciones = await response.json();
        mostrarTransacciones(transacciones);
    } catch (error) {
        console.error('Error al buscar transacciones:', error);
        showMessage('Error al buscar transacciones', 'error');
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar transacciones al iniciar
    cargarTransacciones();
    
    // Event listener para búsqueda
    const inputBusqueda = document.getElementById('search-input');
    if (inputBusqueda) {
        let timeoutId;
        inputBusqueda.addEventListener('input', function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                buscarTransacciones(this.value);
            }, 300);
        });
    }
});

// Hacer funciones disponibles globalmente
window.cargarTransacciones = cargarTransacciones;
window.buscarTransacciones = buscarTransacciones;
