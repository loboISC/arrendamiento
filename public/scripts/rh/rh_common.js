/**
 * rh_common.js - Shared logic for all RH module pages
 */

function syncTheme() {
    if (window.parent && window.parent.document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-mode');
    }
}

/**
 * Muestra una notificación profesional tipo Toast
 * @param {string} msg - Mensaje a mostrar
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
function showToast(msg, type = 'success') {
    let toast = document.getElementById('rh-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rh-toast';
        document.body.appendChild(toast);
    }
    
    const colors = {
        success: '#16a34a',
        error: '#dc2626',
        info: '#2563eb',
        warning: '#f59e0b'
    };

    toast.textContent = msg;
    toast.style.background = colors[type] || colors.success;
    toast.className = 'rh-toast-active';
    
    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

// Auto-sync on load
document.addEventListener('DOMContentLoaded', syncTheme);
