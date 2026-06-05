/**
 * notificaciones-widget.js
 * Componente frontend modular para la campana de notificaciones.
 * Administra el badge de conteo, el dropdown interactivo y las notificaciones nativas de navegador.
 */
'use strict';

const NotificacionesWidget = (() => {
    let unreadCount = 0;
    let notifsList = [];
    let pollingInterval = null;
    let lastNotifiedId = null;

    // Inyectar estilos CSS específicos para el widget
    const injectStyles = () => {
        if (document.getElementById('notif-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'notif-widget-styles';
        style.textContent = `
            .notif-dropdown {
                position: absolute;
                right: 0;
                top: 45px;
                width: 340px;
                max-height: 480px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                z-index: 10000;
                display: none;
                flex-direction: column;
                overflow: hidden;
                font-family: inherit;
            }
            .notif-dropdown.show {
                display: flex;
            }
            .notif-header {
                padding: 12px 16px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .notif-header-title {
                font-weight: 700;
                font-size: 0.9rem;
                color: #1e293b;
                margin: 0;
            }
            .notif-mark-all {
                font-size: 0.75rem;
                color: #2563eb;
                background: none;
                border: none;
                cursor: pointer;
                font-weight: 600;
                padding: 0;
            }
            .notif-mark-all:hover {
                text-decoration: underline;
            }
            .notif-body {
                overflow-y: auto;
                flex: 1;
                max-height: 380px;
            }
            .notif-item {
                padding: 12px 16px;
                border-bottom: 1px solid #f1f5f9;
                display: flex;
                gap: 12px;
                cursor: pointer;
                transition: background 0.15s ease;
                align-items: flex-start;
                text-decoration: none;
            }
            .notif-item:hover {
                background: #f8fafc;
            }
            .notif-item.unread {
                background: #f0f7ff;
            }
            .notif-item.unread:hover {
                background: #e6f2ff;
            }
            .notif-icon-wrapper {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 1rem;
            }
            .notif-icon-wrapper.facturacion { background: #e0f2fe; color: #0284c7; }
            .notif-icon-wrapper.notas_credito { background: #fef3c7; color: #d97706; }
            .notif-icon-wrapper.reportes { background: #dcfce7; color: #16a34a; }
            .notif-icon-wrapper.error { background: #fee2e2; color: #dc2626; }
            .notif-content {
                flex: 1;
                min-width: 0;
            }
            .notif-text {
                font-size: 0.8rem;
                color: #334155;
                margin: 0 0 4px 0;
                line-height: 1.4;
                word-wrap: break-word;
            }
            .notif-meta {
                font-size: 0.7rem;
                color: #94a3b8;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .notif-author {
                font-weight: 600;
                color: #64748b;
            }
            .notif-empty {
                padding: 30px 16px;
                text-align: center;
                color: #94a3b8;
                font-size: 0.85rem;
            }
            .notif-footer {
                padding: 10px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
            }
            .notif-footer-btn {
                font-size: 0.8rem;
                color: #2563eb;
                font-weight: 600;
                text-decoration: none;
                background: none;
                border: none;
                cursor: pointer;
            }
            .notif-footer-btn:hover {
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    };

    // Helper para realizar fetch autenticado
    const apiCall = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('[NotifWidget] Token expirado o inválido');
                }
                return null;
            }
            return await response.json();
        } catch (e) {
            console.error('[NotifWidget] Error en API Call:', e);
            return null;
        }
    };

    // Solicitar permiso de notificaciones de navegador
    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('[NotifWidget] Permiso de notificaciones de navegador:', permission);
            });
        }
    };

    // Mostrar notificación nativa en el OS/Navegador
    const showNativeNotification = (title, body) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: '/assets/images/LOGO_ANDAMIOS_02.png',
                    tag: 'andamios-torres-notif'
                });
            } catch (e) {
                console.warn('[NotifWidget] Fallo al mostrar notificación nativa:', e);
            }
        }
    };

    // Cargar cantidad de no leídas
    const checkUnreadCount = async () => {
        const data = await apiCall('/api/notificaciones/sin-leer/count');
        if (data && typeof data.count === 'number') {
            unreadCount = data.count;
            updateBadge();
        }
    };

    // Actualizar elemento visual del badge
    const updateBadge = () => {
        const dot = document.getElementById('notif-dot');
        if (!dot) return;

        if (unreadCount > 0) {
            dot.style.display = 'block';
            dot.textContent = unreadCount > 99 ? '99+' : unreadCount;
            // Ajustar estilo si tiene texto
            dot.style.padding = '1px 5px';
            dot.style.fontSize = '0.65rem';
            dot.style.fontWeight = 'bold';
            dot.style.color = '#fff';
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            dot.style.minWidth = '16px';
            dot.style.height = '16px';
            dot.style.borderRadius = '10px';
        } else {
            dot.style.display = 'none';
        }
    };

    // Cargar notificaciones para el dropdown
    const loadNotifications = async () => {
        const list = await apiCall('/api/notificaciones');
        if (Array.isArray(list)) {
            notifsList = list;
            
            // Verificar si hay notificaciones nuevas para mandar alerta de navegador
            if (notifsList.length > 0) {
                const newest = notifsList[0];
                if (lastNotifiedId === null) {
                    // Primera carga, registrar el ID más reciente
                    lastNotifiedId = newest.id_notificacion;
                } else if (newest.id_notificacion > lastNotifiedId) {
                    // Hay una nueva notificación unread
                    lastNotifiedId = newest.id_notificacion;
                    if (!newest.leida) {
                        showNativeNotification(
                            newest.tipo.replace(/_/g, ' '),
                            newest.mensaje
                        );
                    }
                }
            }
            
            renderDropdown();
        }
    };

    // Formatear fecha de forma legible
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    };

    // Mapear iconos según el módulo de la notificación
    const getNotifIcon = (modulo, tipo) => {
        if (tipo.includes('ERROR')) return 'fa-circle-xmark';
        if (modulo === 'notas_credito') return 'fa-file-invoice-dollar';
        if (modulo === 'reportes') return 'fa-file-excel';
        return 'fa-file-invoice';
    };

    // Mapear clases CSS de color
    const getNotifClass = (modulo, tipo) => {
        if (tipo.includes('ERROR')) return 'error';
        if (modulo === 'notas_credito') return 'notas_credito';
        if (modulo === 'reportes') return 'reportes';
        return 'facturacion';
    };

    // Renderizar HTML del dropdown
    const renderDropdown = () => {
        const body = document.getElementById('notif-dropdown-body');
        if (!body) return;

        body.innerHTML = '';
        if (notifsList.length === 0) {
            body.innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell" style="font-size: 1.8rem; margin-bottom: 8px; display: block; opacity: 0.5;"></i>No tienes notificaciones</div>';
            return;
        }

        notifsList.forEach(item => {
            const div = document.createElement('div');
            div.className = `notif-item ${item.leida ? '' : 'unread'}`;
            div.dataset.id = item.id_notificacion;
            
            const iconClass = getNotifIcon(item.modulo, item.tipo);
            const colorClass = getNotifClass(item.modulo, item.tipo);
            const timeStr = formatTime(item.fecha);
            const userStr = item.usuario_nombre || 'Sistema';

            div.innerHTML = `
                <div class="notif-icon-wrapper ${colorClass}">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="notif-content">
                    <p class="notif-text">${escapeHtml(item.mensaje)}</p>
                    <div class="notif-meta">
                        <span class="notif-author">${escapeHtml(userStr)}</span>
                        <span>${timeStr}</span>
                    </div>
                </div>
            `;

            // Marcar como leída al hacer click
            div.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!item.leida) {
                    await markAsRead(item.id_notificacion);
                }
                // Si estamos en principal.html, redirigir a la vista de notificaciones
                if (window.location.pathname.includes('principal.html')) {
                    if (window.FormManagerInstance && typeof window.FormManagerInstance.MapsTo === 'function') {
                        window.FormManagerInstance.MapsTo('notificaciones');
                    }
                }
                toggleDropdown(false);
            });

            body.appendChild(div);
        });
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Marcar una como leída
    const markAsRead = async (id) => {
        const res = await apiCall(`/api/notificaciones/${id}/leida`, { method: 'PATCH' });
        if (res) {
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge();
            const idx = notifsList.findIndex(n => n.id_notificacion === id);
            if (idx !== -1) {
                notifsList[idx].leida = true;
                renderDropdown();
            }
        }
    };

    // Marcar todas como leídas
    const markAllAsRead = async () => {
        const res = await apiCall('/api/notificaciones/leer-todas', { method: 'PATCH' });
        if (res && res.success) {
            unreadCount = 0;
            updateBadge();
            notifsList.forEach(n => n.leida = true);
            renderDropdown();
        }
    };

    // Mostrar/ocultar dropdown
    const toggleDropdown = (forceState) => {
        const dropdown = document.getElementById('notif-dropdown');
        if (!dropdown) return;

        const isVisible = dropdown.classList.contains('show');
        const show = typeof forceState === 'boolean' ? forceState : !isVisible;

        if (show) {
            dropdown.classList.add('show');
            loadNotifications();
        } else {
            dropdown.classList.remove('show');
        }
    };

    // Inicializar el widget
    const init = () => {
        injectStyles();
        requestNotificationPermission();

        const bell = document.getElementById('notif-bell');
        if (!bell) {
            console.warn('[NotifWidget] No se encontró el elemento #notif-bell');
            return;
        }

        // Crear contenedor para dropdown si no existe
        let dropdown = document.getElementById('notif-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'notif-dropdown';
            dropdown.className = 'notif-dropdown';
            dropdown.innerHTML = `
                <div class="notif-header">
                    <h3 class="notif-header-title">Notificaciones</h3>
                    <button class="notif-mark-all" id="notif-mark-all-btn">Marcar todas como leídas</button>
                </div>
                <div class="notif-body" id="notif-dropdown-body">
                    <div class="notif-empty">Cargando...</div>
                </div>
                <div class="notif-footer">
                    <button class="notif-footer-btn" id="notif-view-all-btn">Ver todas las notificaciones</button>
                </div>
            `;
            bell.parentElement.appendChild(dropdown);
        }

        // Event Listeners
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        // Cerrar dropdown si se hace click fuera
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
                toggleDropdown(false);
            }
        });

        // Marcar todas como leídas
        document.getElementById('notif-mark-all-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            markAllAsRead();
        });

        // Ver todas
        document.getElementById('notif-view-all-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(false);
            if (window.location.pathname.includes('principal.html')) {
                if (window.FormManagerInstance && typeof window.FormManagerInstance.MapsTo === 'function') {
                    window.FormManagerInstance.MapsTo('notificaciones');
                }
            } else {
                // Si estamos en facturacion.html, redirigir a principal.html#notificaciones
                window.location.href = 'principal.html#notificaciones';
            }
        });

        // Polling de no leídas
        checkUnreadCount();
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            checkUnreadCount();
            // Si el dropdown está abierto, recargar la lista
            if (dropdown.classList.contains('show')) {
                loadNotifications();
            }
        }, 30000); // Cada 30 segundos
    };

    return {
        init,
        cargar: () => {
            checkUnreadCount();
            loadNotifications();
        },
        apiCall
    };
})();

// Auto-inicializar si se importa directamente
document.addEventListener('DOMContentLoaded', () => {
    // Retrasar levemente para asegurar que los elementos del DOM estén montados
    setTimeout(() => {
        NotificacionesWidget.init();
    }, 500);
});
