// ===== NOTIFICACIONES DEMO DATA =====
const previewNotifs = [
  { icon: 'fa-cube', color: '#ffc107', text: 'Stock bajo: Andamios estándar (15 unidades restantes)', time: 'Hace 2h' },
  { icon: 'fa-calendar', color: '#f44336', text: 'Contrato #2024-156 vence mañana', time: 'Hace 4h' },
  { icon: 'fa-screwdriver-wrench', color: '#2979ff', text: 'Equipo #AND-4521 requiere mantenimiento urgente', time: 'Hace 6h' }
];

// ===== SECTION NAVIGATION =====
document.addEventListener('DOMContentLoaded', function () {
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.content-section');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetSection = this.dataset.section;

      // Update active tab
      tabButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Update active section
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(targetSection + '-section').classList.add('active');
    });
  });
});


function normalizarRol(rol) {
  if (!rol) return '';
  const map = {
    'ventas': 'Ventas',
    'rentas': 'Rentas',
    'recepcion': 'Recepción',
    'director general': 'Director General',
    'ingeniero en sistemas': 'Ingeniero en Sistemas',
    'ingeniera de proyectos': 'Ingeniero en Proyectos',
    'sistema de gestion de calidad': 'Ingeniero en Calidad',
    'auxiliar contable': 'Contabilidad'
  };
  return map[rol.trim().toLowerCase()] || rol;
}

function obtenerRolUsuario() {
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return normalizarRol(JSON.parse(user).rol);
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const role = obtenerRolUsuario();
  if (!role) return;
  const permisos = {
    'Director General': [
      'dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html',
      'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html',
      'notificaciones.html', 'configuracion.html', 'ventas.html'
    ],
    'Ingeniero en Systems': [
      'dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html',
      'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html',
      'notificaciones.html', 'configuracion.html', 'ventas.html'
    ],
    'Ingeniero en Sistemas': [
      'dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html',
      'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html',
      'notificaciones.html', 'configuracion.html', 'ventas.html'
    ],
    'Ingeniero en Calidad': [
      'calidad.html', 'analisis.html', 'dashboard.html'
    ],
    'Ingeniero en Proyectos': [
      'proyectos.html', 'analisis.html', 'notificaciones.html', 'logistica.html'
    ],
    'Ventas': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Rentas': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Recepción': [
      'dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ],
    'Contabilidad': [
      'dashboard.html', 'analisis.html', 'clientes.html', 'notificaciones.html', 'contratos.html',
      'facturacion.html', 'logistica.html', 'inventario.html'
    ]
  };
  if (!permisos[role]) return;
  document.querySelectorAll('.sidebar a').forEach(link => {
    const href = link.getAttribute('href');
    if (!permisos[role].includes(href)) {
      link.style.display = 'none';
    }
  });
});

// Notificaciones demo
document.addEventListener('DOMContentLoaded', function () {
  const notifBell = document.querySelector('.topbar-right > span');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifList = document.getElementById('notif-list');
  if (notifList && previewNotifs) {
    notifList.innerHTML = previewNotifs.map(n => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 18px;">
          <span style="background:${n.color}22;color:${n.color};border-radius:8px;padding:7px 9px 7px 9px;font-size:1.1rem;"><i class="fa ${n.icon}"></i></span>
          <div style="flex:1;">
            <div style="font-size:0.99rem;font-weight:600;">${n.text}</div>
            <div style="color:#888;font-size:0.93rem;">${n.time}</div>
          </div>
        </div>
      `).join('');
  }
  if (notifBell && notifDropdown) {
    notifBell.onclick = (e) => {
      e.stopPropagation();
      const rect = notifBell.getBoundingClientRect();
      notifDropdown.style.top = rect.bottom + 'px';
      notifDropdown.style.right = (window.innerWidth - rect.right) + 'px';
      notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.body.addEventListener('click', () => notifDropdown.style.display = 'none');
    notifDropdown.onclick = e => e.stopPropagation();
  }
});

// Dropdown usuario
document.addEventListener('DOMContentLoaded', function () {
  const userAvatar = document.querySelector('.avatar');
  const userDropdown = document.getElementById('user-dropdown');
  if (userAvatar && userDropdown) {
    userAvatar.onclick = (e) => {
      e.stopPropagation();
      userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
      userDropdown.style.right = '0';
    };
    document.body.addEventListener('click', () => userDropdown.style.display = 'none');
    userDropdown.onclick = e => e.stopPropagation();
  }
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => { 
      e.preventDefault(); 
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html'; 
    };
  }
  
  const configBtn = document.getElementById('config-btn');
  if (configBtn) {
    configBtn.onclick = () => { window.location.href = 'configuracion.html'; };
  }
});

(function () {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const avatarImg = document.getElementById('avatar-img');
  const avatarDropdown = document.getElementById('avatar-img-dropdown');
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
  const userEmail = document.getElementById('user-email');
  const dropdown = document.getElementById('user-dropdown');
  if (user && avatarImg) {
    avatarImg.src = user.foto || 'img/default-user.png';
    avatarImg.onerror = () => { avatarImg.src = 'img/default-user.png'; };
  }
  if (user && avatarDropdown) {
    avatarDropdown.src = user.foto || 'img/default-user.png';
    avatarDropdown.onerror = () => { avatarDropdown.src = 'img/default-user.png'; };
  }
  if (userName) userName.textContent = user.nombre || '';
  if (userRole) userRole.textContent = user.rol || '';
  if (userEmail) userEmail.textContent = user.correo || '';
})();
