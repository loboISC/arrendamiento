const fs = require('fs');
const path = require('path');

// Función para actualizar los enlaces del menú
function updateMenuLinks(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Definir los enlaces correctos
    const correctLinks = [
      '<li><a href="dashboard.html"><i class="fa fa-house"></i> Dashboard</a></li>',
      '<li><a href="inventario.html"><i class="fa fa-cube"></i> Inventario</a></li>',
      '<li><a href="contratos.html"><i class="fa fa-file-contract"></i> Contratos</a></li>',
      '<li><a href="clientes.html"><i class="fa fa-users"></i> Clientes</a></li>',
      '<li><a href="facturacion.html"><i class="fa fa-file-invoice-dollar"></i> Facturación</a></li>',
      '<li><a href="mantenimiento.html"><i class="fa fa-screwdriver-wrench"></i> Mantenimiento</a></li>',
      '<li><a href="logistica.html"><i class="fa fa-truck"></i> Logística</a></li>',
      '<li><a href="proyectos.html"><i class="fa fa-diagram-project"></i> Proyectos</a></li>',
      '<li><a href="calidad.html"><i class="fa fa-shield-halved"></i> Calidad</a></li>',
      '<li><a href="analisis.html"><i class="fa fa-chart-bar"></i> Analytics</a></li>',
      '<li><a href="notificaciones.html"><i class="fa fa-bell"></i> Notificaciones</a></li>',
      '<li><a href="configuracion.html"><i class="fa fa-gear"></i> Configuración</a></li>'
    ];

    // Enlaces antiguos que necesitan ser reemplazados
    const oldLinks = [
      '<li><a href="#"><i class="fa fa-house"></i> Dashboard</a></li>',
      '<li><a href="#"><i class="fa fa-cube"></i> Inventario</a></li>',
      '<li><a href="#"><i class="fa fa-file-contract"></i> Contratos</a></li>',
      '<li><a href="#"><i class="fa fa-users"></i> Clientes</a></li>',
      '<li><a href="#"><i class="fa fa-file-invoice-dollar"></i> Facturación</a></li>',
      '<li><a href="#"><i class="fa fa-screwdriver-wrench"></i> Mantenimiento</a></li>',
      '<li><a href="#"><i class="fa fa-truck"></i> Logística</a></li>',
      '<li><a href="#"><i class="fa fa-diagram-project"></i> Proyectos</a></li>',
      '<li><a href="#"><i class="fa fa-clipboard-check"></i> Calidad</a></li>',
      '<li><a href="#"><i class="fa fa-chart-bar"></i> Analytics</a></li>',
      '<li><a href="#"><i class="fa fa-bell"></i> Notificaciones</a></li>',
      '<li><a href="#"><i class="fa fa-gear"></i> Configuración</a></li>'
    ];

    // Reemplazar enlaces antiguos con los correctos
    for (let i = 0; i < oldLinks.length; i++) {
      content = content.replace(new RegExp(oldLinks[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correctLinks[i]);
    }

    // Determinar cuál es la página actual y marcar como activa
    const fileName = path.basename(filePath);
    const pageName = fileName.replace('.html', '');
    
    // Mapeo de nombres de archivo a enlaces
    const pageMap = {
      'dashboard': 'dashboard.html',
      'inventario': 'inventario.html', 
      'contratos': 'contratos.html',
      'clientes': 'clientes.html',
      'facturacion': 'facturacion.html',
      'mantenimiento': 'mantenimiento.html',
      'logistica': 'logistica.html',
      'proyectos': 'proyectos.html',
      'calidad': 'calidad.html',
      'analisis': 'analisis.html',
      'notificaciones': 'notificaciones.html',
      'configuracion': 'configuracion.html'
    };

    if (pageMap[pageName]) {
      // Remover clase active de todos los enlaces
      content = content.replace(/class="active"/g, '');
      // Agregar clase active al enlace correspondiente
      const activeLink = `<li><a href="${pageMap[pageName]}" class="active">`;
      const normalLink = `<li><a href="${pageMap[pageName]}">`;
      content = content.replace(new RegExp(normalLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), activeLink);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Actualizado: ${fileName}`);
    
  } catch (error) {
    console.error(`❌ Error actualizando ${filePath}:`, error.message);
  }
}

// Lista de archivos a actualizar
const filesToUpdate = [
  'public/facturacion.html',
  'public/mantenimiento.html', 
  'public/logistica.html',
  'public/analisis.html',
  'public/notificaciones.html',
  'public/configuracion.html'
];

console.log('🔄 Actualizando enlaces del menú...\n');

filesToUpdate.forEach(file => {
  if (fs.existsSync(file)) {
    updateMenuLinks(file);
  } else {
    console.log(`⚠️  Archivo no encontrado: ${file}`);
  }
});

console.log('\n✅ Proceso completado!'); 