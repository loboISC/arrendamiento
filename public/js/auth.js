// public/js/auth.js
// Sistema de autenticación común para todas las páginas

// Función para verificar si el usuario está autenticado
async function verificarAutenticacion() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No hay token, redirigiendo al login');
            window.location.href = 'login.html';
            return false;
        }

        // Solo verificar con el servidor si estamos en modo desarrollo o si es necesario
        // En producción, confiar en el token local
        const isElectron = window.electron || window.require || window.location.protocol === 'file:';
        const baseURL = isElectron ? 'http://localhost:3001' : '';

        try {
            const response = await fetch(`${baseURL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                return true;
            } else {
                console.log('Token inválido, redirigiendo al login');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return false;
            }
        } catch (error) {
            // Si hay error de conexión, permitir continuar con el token local
            console.log('Error de conexión, usando token local');
            return true;
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        // En caso de error, permitir continuar
        return true;
    }
}

// Función para cargar datos del usuario
async function cargarUsuario() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Determinar la URL base del servidor
        const isElectron = window.electron || window.require || window.location.protocol === 'file:';
        const baseURL = isElectron ? 'http://localhost:3001' : '';

        try {
            const response = await fetch(`${baseURL}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const usuario = await response.json();
                
                // Actualizar elementos del usuario en la interfaz
                const userNameElement = document.getElementById('user-name');
                const userRoleElement = document.getElementById('user-role');
                const userEmailElement = document.getElementById('user-email');
                const avatarImg = document.getElementById('avatar-img');
                const avatarImgDropdown = document.getElementById('avatar-img-dropdown');

                if (userNameElement) userNameElement.textContent = usuario.nombre || 'Usuario';
                if (userRoleElement) userRoleElement.textContent = usuario.rol || 'Usuario';
                if (userEmailElement) userEmailElement.textContent = usuario.correo || '';
                
                console.log('Usuario cargado:', usuario);
                console.log('Foto del usuario:', usuario.foto ? usuario.foto.substring(0, 100) + '...' : 'No hay foto');
                
                // Actualizar elementos tradicionales si existen
                if (usuario.foto && avatarImg) {
                    avatarImg.src = usuario.foto;
                    avatarImg.onerror = () => { 
                        avatarImg.src = 'img/default-user.png'; 
                    };
                }
                if (usuario.foto && avatarImgDropdown) {
                    avatarImgDropdown.src = usuario.foto;
                    avatarImgDropdown.onerror = () => { 
                        avatarImgDropdown.src = 'img/default-user.png'; 
                    };
                }
                
                // Guardar usuario en localStorage para otras páginas
                localStorage.setItem('currentUser', JSON.stringify(usuario));
                
                // Disparar evento personalizado para que otras páginas puedan escuchar
                const userEvent = new CustomEvent('userLoaded', {
                    detail: usuario
                });
                document.dispatchEvent(userEvent);

                return usuario;
            } else {
                console.log('Error cargando usuario, pero permitiendo continuar');
                // No redirigir automáticamente, solo mostrar error
                return null;
            }
        } catch (error) {
            console.error('Error cargando usuario:', error);
            // En caso de error de conexión, permitir continuar
            return null;
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
        return null;
    }
}

// Función para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser'); // Asegurar que se limpie todo
    window.location.href = 'login.html';
}

// Función para obtener el token de autenticación
function getAuthToken() {
    return localStorage.getItem('token');
}

// Función para generar headers de autorización
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Inicialización automática cuando se carga el script
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación básica (solo token local)
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No hay token, redirigiendo al login');
        window.location.href = 'login.html';
        return;
    }

    // Cargar datos del usuario (sin bloquear si falla)
    const usuario = await cargarUsuario();
    
    // Si no se pudo cargar del servidor, intentar desde localStorage
    if (!usuario) {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const userEvent = new CustomEvent('userLoaded', {
                    detail: user
                });
                document.dispatchEvent(userEvent);
            } catch (e) {
                console.log('Error parsing saved user:', e);
            }
        }
    }
    
    // Configurar eventos comunes
    configurarEventosComunes();
});

// Configurar eventos comunes de la interfaz
function configurarEventosComunes() {
    // Toggle del menú lateral
    const menuBtn = document.getElementById('openSidebar');
    if (menuBtn) {
        menuBtn.onclick = function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('open');
            }
        };
    }

    // Toggle del dropdown de usuario
    const avatarImg = document.getElementById('avatar-img');
    if (avatarImg) {
        avatarImg.onclick = function() {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            }
        };
    }

    // Botón de cerrar sesión
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = cerrarSesion;
    }

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('user-dropdown');
        const avatarImg = document.getElementById('avatar-img');
        
        if (dropdown && avatarImg && !avatarImg.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Exportar funciones para uso global
window.auth = {
    verificarAutenticacion,
    cargarUsuario,
    cerrarSesion,
    getAuthToken,
    getAuthHeaders
}; 