// Modo oscuro global y color primario para ScaffoldPro
(function() {
  try {
    var config = localStorage.getItem('scaffoldpro_config');
    config = config ? JSON.parse(config) : null;

    function getTheme() {
      var tema = config && config.apariencia ? config.apariencia.tema : 'light';
      if (tema === 'system') {
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      return tema;
    }

    function getPrimary() {
      return (config && config.apariencia && config.apariencia.colorPrimario) ? config.apariencia.colorPrimario : '#1B3C5E';
    }

    function isCustomLogo(val) {
      return !!val && (val.startsWith('data:image') || !/img\/(LOGO_ANDAMIOS_02\.png|logo-demo\.(png|jpg))/i.test(val));
    }
    function getLogoSrc(isDark) {
      // Si el usuario subió un logo personalizado, úsalo siempre
      if (config && config.empresa && isCustomLogo(config.empresa.logo)) return config.empresa.logo;
      // Defaults por tema
      return isDark ? 'img/LOGO_ANDAMIOS_02.png' : 'img/logo-demo.jpg';
    }

    function applyThemeEarly() {
      var isDark = getTheme() === 'dark';
      document.documentElement.style.setProperty('--primary-color', getPrimary());
      if (isDark) document.body.classList.add('dark-theme');
      else document.body.classList.remove('dark-theme');
      if (isDark) {
        var bg = "linear-gradient(180deg, rgba(27,60,94,0.98) 10%, rgba(156,170,184,0.60) 60%, rgba(27,60,94,0.98) 100%), url(imagenes/bg-login.jpg)";
        document.body.style.setProperty('background', bg, 'important');
        document.body.style.setProperty('background-size', 'cover', 'important');
        document.body.style.setProperty('background-position', 'center', 'important');
        document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
      } else {
        document.body.style.removeProperty('background');
        document.body.style.removeProperty('background-size');
        document.body.style.removeProperty('background-position');
        document.body.style.removeProperty('background-repeat');
      }
    }

    function replaceBranding() {
      var isDark = getTheme() === 'dark';
      var src = getLogoSrc(isDark);

      function ensureImgIn(container) {
        if (!container) return;
        var img = container.querySelector('img.brand-img');
        var closeBtn = container.querySelector('.close');
        if (!img) {
          img = document.createElement('img');
          img.className = 'brand-img';
          img.alt = 'Logo';
          img.style.width = '140px';
          img.style.height = 'auto';
          img.style.borderRadius = '12px';
          img.style.display = 'block';
          img.style.boxSizing = 'border-box';
          img.style.maxWidth = '160px';
          // limpiar solo contenido y volver a anexar close si existía
          container.innerHTML = '';
          container.appendChild(img);
          if (closeBtn) container.appendChild(closeBtn);
        }
        // Estilos dependientes del tema en cada ejecución
        // Estilo adaptado por tema
        img.style.objectFit = 'contain';
        if (isDark) {
          img.style.background = 'transparent';
          img.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
          img.style.border = '1px solid rgba(255,255,255,0.22)';
          img.style.padding = '8px';
        } else {
          img.style.background = '#fff';
          img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
          img.style.border = '1px solid #e6eef5';
          img.style.padding = '10px';
        }
        img.src = src;
        img.onerror = function() {
          // Fallback a PNG/JPG esperados
          var altSrc = isDark ? 'img/LOGO_ANDAMIOS_02.png' : 'img/logo-demo.jpg';
          if (this.src.indexOf(altSrc) === -1) this.src = altSrc;
        };
      }

      // Contenedores típicos de marca
      var containers = document.querySelectorAll('.sidebar .logo, .topbar .logo, .app-logo, .brand-logo');
      containers.forEach(ensureImgIn);

      // También soportar un #app-logo directo
      var direct = document.querySelector('#app-logo');
      if (direct) {
        direct.src = src;
        direct.onerror = function(){ this.src = isDark ? 'img/LOGO_ANDAMIOS_02.png' : 'img/logo-demo.jpg'; };
      }
    }

    // Observer para reconstrucciones dinámicas de la barra lateral
    function observeSidebar() {
      try {
        var sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        if (observeSidebar._obs) return; // evitar múltiples observadores
        observeSidebar._obs = new MutationObserver(function() {
          // Si cambian nodos hijos o estructura, volvemos a aplicar la marca
          replaceBranding();
          ensureSidebarLayout();
          enableSidebarWheel();
        });
        observeSidebar._obs.observe(sidebar, { childList: true, subtree: true });
      } catch(_) {}
    }

    // Forzar estilos mínimos para que el menú sea scrollable en todas las páginas
    function ensureSidebarLayout() {
      try {
        var sidebar = document.querySelector('.sidebar');
        var list = document.querySelector('.sidebar ul');
        if (!sidebar || !list) return;
        // Sidebar fijo sin scroll propio
        sidebar.style.overflow = 'hidden';
        sidebar.style.display = 'flex';
        sidebar.style.flexDirection = 'column';
        sidebar.style.height = sidebar.style.height || '100vh';
        // Lista como contenedor de scroll
        list.style.overflowY = 'auto';
        list.style.minHeight = '0';
        list.style.flex = list.style.flex || '1 1 auto';
      } catch(_) {}
    }

    // Asegurar scroll con rueda en la barra lateral
    function enableSidebarWheel() {
      try {
        var sidebar = document.querySelector('.sidebar');
        var list = document.querySelector('.sidebar ul');
        if (!sidebar || !list) return;
        // si el nodo cambió, volvemos a enlazar
        if (enableSidebarWheel._list === list && enableSidebarWheel._sidebar === sidebar) return;
        // quitar listeners previos
        if (enableSidebarWheel._list && enableSidebarWheel._handler) {
          try { enableSidebarWheel._list.removeEventListener('wheel', enableSidebarWheel._handler); } catch(_) {}
        }
        if (enableSidebarWheel._sidebar && enableSidebarWheel._handler) {
          try { enableSidebarWheel._sidebar.removeEventListener('wheel', enableSidebarWheel._handler); } catch(_) {}
        }
        enableSidebarWheel._handler = function(e){
          var delta = e.deltaY;
          if (delta === 0) return;
          var prev = list.scrollTop;
          list.scrollTop += delta;
          // si podemos desplazar, evitamos que la página haga scroll
          if (list.scrollTop !== prev) {
            e.preventDefault();
          }
        };
        list.addEventListener('wheel', enableSidebarWheel._handler, { passive: false });
        sidebar.addEventListener('wheel', enableSidebarWheel._handler, { passive: false });
        enableSidebarWheel._list = list;
        enableSidebarWheel._sidebar = sidebar;
      } catch(_) {}
    }

    // Aplicar tema cuando el body exista
    if (document.readyState === 'loading' || !document.body) {
      document.addEventListener('DOMContentLoaded', function(){
        applyThemeEarly();
        replaceBranding();
        observeSidebar();
        ensureSidebarLayout();
        enableSidebarWheel();
      });
    } else {
      applyThemeEarly();
      replaceBranding();
      observeSidebar();
      ensureSidebarLayout();
      enableSidebarWheel();
    }

    // Observar cambios de clase en body (p.ej. al cambiar tema en Configuración)
    try {
      var obs = new MutationObserver(function() { replaceBranding(); });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch(_) {}

    // Si otro tab cambia configuración, actualiza
    window.addEventListener('storage', function(e) {
      if (e.key === 'scaffoldpro_config') {
        try { config = e.newValue ? JSON.parse(e.newValue) : config; } catch(_) {}
        applyThemeEarly();
        replaceBranding();
        observeSidebar();
        ensureSidebarLayout();
        enableSidebarWheel();
      }
    });
  } catch(e) {}
})();