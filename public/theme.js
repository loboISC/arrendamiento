// Modo oscuro global y color primario para ScaffoldPro
(function() {
  try {
    var config = localStorage.getItem('scaffoldpro_config');
    config = config ? JSON.parse(config) : null;
    var tema = config && config.apariencia ? config.apariencia.tema : 'light';
    var color = config && config.apariencia ? config.apariencia.colorPrimario : '#2979ff';
    document.documentElement.style.setProperty('--primary-color', color);
    var isDark = false;
    if (tema === 'dark') isDark = true;
    if (tema === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (isDark) document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
  } catch(e) {}
})(); 