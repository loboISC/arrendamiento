document.addEventListener('DOMContentLoaded', function() {
    // Configurar navegación
    setupNavigation();
    
    // Configurar modales
    setupModals();
    
    // Cargar datos iniciales
    loadInventoryData();
    
    // Mostrar sección por defecto
    showDefaultSection();
    
    // Cargar contenido de todas las secciones
    loadAllSections();
    
    // Configurar información del usuario
    setupUserInfo();
});

// Configurar información del usuario
function setupUserInfo() {
    // Escuchar el evento de usuario cargado desde auth.js
    document.addEventListener('userLoaded', function(e) {
        const user = e.detail;
        updateUserFooter(user);
    });
    
    // También intentar cargar desde localStorage si ya existe
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            updateUserFooter(user);
        } catch (e) {
            console.log('Error parsing saved user:', e);
        }
    }
}

// Actualizar información del usuario en header y footer
function updateUserFooter(user) {
    if (!user) return;
    
    // Actualizar en el header
    const headerUserInfo = document.querySelector('#userInfo');
    if (headerUserInfo) {
        // Verificar si la foto es base64 o URL
        let fotoSrc = user.foto || 'img/default-user.png';
        if (user.foto && user.foto.startsWith('data:image/')) {
            fotoSrc = user.foto; // Es base64, usar directamente
        } else if (user.foto && !user.foto.startsWith('http')) {
            fotoSrc = `img/${user.foto}`; // Es nombre de archivo, agregar ruta
        }
        
        headerUserInfo.innerHTML = `
            <div class="user-info">
                <img src="${fotoSrc}" alt="Usuario" class="avatar" onerror="this.src='img/default-user.png'">
                <div class="user-details">
                    <span class="user-name">${user.nombre || 'Usuario'}</span>
                    <span class="user-role">${user.rol || 'Rol no especificado'}</span>
                </div>
            </div>
        `;
    }
    
    // Actualizar en el footer
    const userNameEl = document.querySelector('.user-footer .user-name');
    const userRoleEl = document.querySelector('.user-footer .user-role');
    const avatarEl = document.querySelector('.user-footer .avatar');
    
    if (userNameEl) {
        userNameEl.textContent = user.nombre || 'Usuario';
    }
    
    if (userRoleEl) {
        userRoleEl.textContent = user.rol || 'Rol no especificado';
    }
    
    if (avatarEl && user.foto) {
        // Verificar si la foto es base64 o URL
        let fotoSrc = user.foto;
        if (user.foto && user.foto.startsWith('data:image/')) {
            fotoSrc = user.foto; // Es base64, usar directamente
        } else if (user.foto && !user.foto.startsWith('http')) {
            fotoSrc = `img/${user.foto}`; // Es nombre de archivo, agregar ruta
        }
        
        avatarEl.src = fotoSrc;
        avatarEl.onerror = function() {
            this.src = 'img/default-user.png';
        };
    }
}

// Mostrar sección por defecto
function showDefaultSection() {
    // Activar el nav item de productos
    const productosNavItem = document.querySelector('.nav-item[data-page="productos"]');
    if (productosNavItem) {
        productosNavItem.classList.add('active');
    }
    
    // Mostrar la sección de productos
    const productosSection = document.getElementById('productos-section');
    if (productosSection) {
        productosSection.classList.add('active');
    }
}

// Configuración de navegación entre secciones
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(navItem => {
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remover clase active de todos los nav items
            navItems.forEach(item => item.classList.remove('active'));
            
            // Agregar clase active al item clickeado
            navItem.classList.add('active');
            
            // Obtener la página objetivo
            const targetPage = navItem.getAttribute('data-page');
            
            // Ocultar todas las secciones
            sections.forEach(section => section.classList.remove('active'));
            
            // Mostrar la sección objetivo
            const targetSection = document.getElementById(`${targetPage}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

// Cargar contenido de todas las secciones
function loadAllSections() {
    loadProductosSection();
    loadCategoriasSection();
    loadMantenimientoSection();
    loadAlertasSection();
    
    // Inicializar gráficas con un pequeño delay para asegurar que el DOM esté listo
    setTimeout(() => {
        initializeCharts();
    }, 100);
}

// Variables globales para las gráficas
window.categoryChart = null;
window.statusChart = null;

// Inicializar gráficas
function initializeCharts() {
    // Verificar si Chart.js está disponible
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está cargado');
        return;
    }
    
    // Destruir gráficas existentes si existen
    if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
        window.categoryChart.destroy();
        window.categoryChart = null;
    }
    if (window.statusChart && typeof window.statusChart.destroy === 'function') {
        window.statusChart.destroy();
        window.statusChart = null;
    }
    
    // Gráfica de categorías
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        // Verificar si el canvas ya tiene una instancia de Chart
        const existingChart = Chart.getChart(categoryCtx);
        if (existingChart) {
            existingChart.destroy();
        }
        
        window.categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['Andamio Marco y Cruceta', 'Multidireccional', 'Templetes', 'Accesorios'],
                datasets: [{
                    data: [254, 45, 0, 139],
                    backgroundColor: [
                        '#2979ff',
                        '#00c853',
                        '#ffd600',
                        '#ff3d00'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    // Gráfica de estado del inventario
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        // Verificar si el canvas ya tiene una instancia de Chart
        const existingChart = Chart.getChart(statusCtx);
        if (existingChart) {
            existingChart.destroy();
        }
        
        window.statusChart = new Chart(statusCtx, {
            type: 'bar',
            data: {
                labels: ['Disponible', 'En Renta', 'Mantenimiento', 'Reservado'],
                datasets: [{
                    label: 'Cantidad',
                    data: [299, 83, 5, 12],
                    backgroundColor: [
                        '#00c853',
                        '#2979ff',
                        '#ff9800',
                        '#9c27b0'
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Gráfica de productos más rentados (pie chart)
    const topRentedCtx = document.getElementById('topRentedChart');
    if (topRentedCtx) {
        const existingChart = Chart.getChart(topRentedCtx);
        if (existingChart) {
            existingChart.destroy();
        }
        
        window.topRentedChart = new Chart(topRentedCtx, {
            type: 'pie',
            data: {
                labels: ['Marco Andamio 2.00x1.20m', 'Cruceta Diagonal 2.00m', 'Roseta Multidireccional', 'Base Regulable'],
                datasets: [{
                    data: [88.7, 55.1, 69.5, 41.2],
                    backgroundColor: [
                        '#4285f4',
                        '#9ccc65',
                        '#5c6bc0',
                        '#ff8a65'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const dataset = data.datasets[0];
                                        const value = dataset.data[i];
                                        const total = dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return {
                                            text: `${label}: ${value} (${percentage}%)`,
                                            fillStyle: dataset.backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} rentas (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Gráfica de tendencias de ventas (line chart)
    const salesTrendsCtx = document.getElementById('salesTrendsChart');
    if (salesTrendsCtx) {
        const existingChart = Chart.getChart(salesTrendsCtx);
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Configurar datos iniciales (anual)
        window.salesTrendsChart = createSalesTrendsChart(salesTrendsCtx, 'yearly');
        
        // Configurar filtro de período
        const periodFilter = document.getElementById('salesPeriodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', function() {
                const existingChart = Chart.getChart(salesTrendsCtx);
                if (existingChart) {
                    existingChart.destroy();
                }
                window.salesTrendsChart = createSalesTrendsChart(salesTrendsCtx, this.value);
            });
        }
    }
}

// Función para crear gráfica de tendencias de ventas con diferentes períodos
function createSalesTrendsChart(ctx, period) {
    let chartData = getSalesDataByPeriod(period);
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Marco Andamio',
                    data: chartData.datasets.marcoAndamio,
                    borderColor: '#4285f4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Cruceta Diagonal',
                    data: chartData.datasets.crucetaDiagonal,
                    borderColor: '#9ccc65',
                    backgroundColor: 'rgba(156, 204, 101, 0.1)',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Roseta Multidireccional',
                    data: chartData.datasets.rosetaMulti,
                    borderColor: '#5c6bc0',
                    backgroundColor: 'rgba(92, 107, 192, 0.1)',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Base Regulable',
                    data: chartData.datasets.baseRegulable,
                    borderColor: '#ff8a65',
                    backgroundColor: 'rgba(255, 138, 101, 0.1)',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: $${value.toLocaleString()} en ventas`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f0f0f0'
                    },
                    title: {
                        display: true,
                        text: 'Ventas (MXN)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: chartData.xAxisLabel
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Función para obtener datos de ventas según el período
function getSalesDataByPeriod(period) {
    switch (period) {
        case 'weekly':
            return {
                labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
                xAxisLabel: 'Semanas',
                datasets: {
                    marcoAndamio: [45000, 52000, 48000, 58000, 61000, 55000, 49000, 63000],
                    crucetaDiagonal: [32000, 35000, 31000, 38000, 42000, 39000, 34000, 44000],
                    rosetaMulti: [28000, 31000, 29000, 33000, 36000, 32000, 30000, 38000],
                    baseRegulable: [18000, 22000, 20000, 24000, 27000, 23000, 21000, 29000]
                }
            };
        case 'monthly':
            return {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                xAxisLabel: 'Meses',
                datasets: {
                    marcoAndamio: [180000, 195000, 210000, 225000, 240000, 220000, 205000, 230000, 245000, 260000, 235000, 250000],
                    crucetaDiagonal: [120000, 135000, 140000, 155000, 160000, 145000, 130000, 150000, 165000, 170000, 155000, 175000],
                    rosetaMulti: [95000, 105000, 110000, 125000, 130000, 115000, 100000, 120000, 135000, 140000, 125000, 145000],
                    baseRegulable: [65000, 75000, 80000, 90000, 95000, 85000, 70000, 85000, 100000, 105000, 90000, 110000]
                }
            };
        case 'quarterly':
            return {
                labels: ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
                xAxisLabel: 'Trimestres',
                datasets: {
                    marcoAndamio: [585000, 685000, 680000, 745000, 620000, 720000, 715000, 780000],
                    crucetaDiagonal: [395000, 460000, 445000, 500000, 415000, 485000, 470000, 525000],
                    rosetaMulti: [310000, 370000, 355000, 410000, 330000, 390000, 375000, 430000],
                    baseRegulable: [220000, 270000, 255000, 305000, 240000, 290000, 275000, 325000]
                }
            };
        case 'yearly':
        default:
            return {
                labels: ['2019', '2020', '2021', '2022', '2023', '2024'],
                xAxisLabel: 'Años',
                datasets: {
                    marcoAndamio: [2400000, 2650000, 2800000, 2550000, 2695000, 2835000],
                    crucetaDiagonal: [1650000, 1750000, 1820000, 1680000, 1800000, 1895000],
                    rosetaMulti: [1280000, 1380000, 1450000, 1320000, 1445000, 1525000],
                    baseRegulable: [890000, 980000, 1050000, 920000, 1050000, 1130000]
                }
            };
    }
}

// Configurar modales
function setupModals() {
    // Configurar botón para abrir modal de nuevo producto
    const btnNuevoProducto = document.getElementById('newProductBtn');
    
    if (btnNuevoProducto) {
        btnNuevoProducto.addEventListener('click', () => openModal('newProductModal'));
    }
    
    // Configurar botones de cerrar modales
    const closeButtons = document.querySelectorAll('.modal-close, .btn-secondary');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-secondary') || e.target.classList.contains('modal-close')) {
                closeModal();
            }
        });
    });
    
    // Cerrar modal al hacer click fuera del contenido
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
    
    // Configurar previsualizaciones de imagen
    setupImagePreviews();
    
    // Configurar formularios de modales
    setupModalForms();
    
    // Configurar campos dinámicos
    setupDynamicFields();
}

// Abrir modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevenir scroll del body
    }
}

// Cerrar modal
function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
    });
    document.body.style.overflow = ''; // Restaurar scroll del body
    
    // Limpiar formularios
    const forms = document.querySelectorAll('.modal-form form');
    forms.forEach(form => {
        form.reset();
        // Limpiar previsualizaciones de imagen
        const previews = form.querySelectorAll('.image-preview');
        previews.forEach(preview => {
            preview.classList.remove('has-image');
            const img = preview.querySelector('img');
            if (img) {
                img.remove();
            }
            const span = preview.querySelector('span');
            if (span) {
                span.textContent = 'Haz clic para seleccionar una imagen';
            }
        });
    });
}

// Configurar previsualizaciones de imagen
function setupImagePreviews() {
    const imageInputs = document.querySelectorAll('input[type="file"]');
    
    imageInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = this.closest('.image-upload').querySelector('.image-preview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.classList.add('has-image');
                    
                    // Remover imagen anterior si existe
                    const existingImg = preview.querySelector('img');
                    if (existingImg) {
                        existingImg.remove();
                    }
                    
                    // Crear nueva imagen
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Vista previa';
                    
                    // Insertar antes del span
                    const span = preview.querySelector('span');
                    if (span) {
                        preview.insertBefore(img, span);
                        span.textContent = file.name;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

// Configurar formularios de modales
function setupModalForms() {
    const forms = document.querySelectorAll('.modal-form form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Obtener datos del formulario
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            // Determinar tipo de elemento basado en el modal
            const modal = this.closest('.modal');
            let tipo = '';
            if (modal.id === 'newProductModal') tipo = 'producto';
            
            // Simular guardado (aquí se integraría con el backend)
            console.log(`Guardando ${tipo}:`, data);
            
            // Mostrar mensaje de éxito
            showSuccessMessage(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} agregado exitosamente`);
            
            // Cerrar modal
            closeModal();
            
            // Recargar datos (en el futuro esto actualizaría desde el backend)
        });
    });
}

// Funciones para campos dinámicos
function addSpecification() {
    const container = document.getElementById('dynamicSpecs');
    const specRow = document.createElement('div');
    specRow.className = 'spec-row';
    specRow.innerHTML = `
        <input type="text" placeholder="Especificación" class="spec-input">
        <input type="text" placeholder="Valor" class="spec-value">
        <button type="button" class="btn-remove-spec" onclick="removeSpecification(this)">×</button>
    `;
    container.appendChild(specRow);
}

function removeSpecification(button) {
    button.parentElement.remove();
}

function addCertification() {
    const container = document.getElementById('dynamicCerts');
    const certRow = document.createElement('div');
    certRow.className = 'cert-row';
    certRow.innerHTML = `
        <input type="text" placeholder="Certificación" class="cert-input">
        <input type="text" placeholder="Número/Código" class="cert-code">
        <button type="button" class="btn-remove-cert" onclick="removeCertification(this)">×</button>
    `;
    container.appendChild(certRow);
}

function removeCertification(button) {
    button.parentElement.remove();
}

function setupDynamicFields() {
    // Configurar botones de agregar especificaciones
    const btnAddSpec = document.querySelector('.btn-add-spec');
    if (btnAddSpec) {
        btnAddSpec.addEventListener('click', addSpecification);
    }
    
    // Configurar botones de agregar certificaciones
    const btnAddCert = document.querySelector('.btn-add-cert');
    if (btnAddCert) {
        btnAddCert.addEventListener('click', addCertification);
    }
}

function setupEventListeners() {
    // Toggle del sidebar
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // Toggle del tema oscuro
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-theme');
            // Guardar preferencia en localStorage
            localStorage.setItem('darkTheme', document.body.classList.contains('darkTheme'));
        });
    }

    // Botones de vista (grid/lista)
    const viewButtons = document.querySelectorAll('.view-options .btn-icon');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Cambiar vista del inventario según el botón
            toggleInventoryView(btn.title.includes('tabla'));
        });
    });

    // Modal de nuevo producto
    const newProductBtn = document.querySelector('.btn-primary');
    const modal = document.getElementById('newProductModal');
    const closeModal = document.querySelector('.modal-close');

    if (newProductBtn && modal && closeModal) {
        newProductBtn.addEventListener('click', () => {
            modal.classList.add('show');
        });

        closeModal.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
}

function toggleInventoryView(isTableView) {
    const inventoryGrid = document.querySelector('.inventory-grid');
    if (isTableView) {
        inventoryGrid.classList.add('table-view');
    } else {
        inventoryGrid.classList.remove('table-view');
    }
}

function loadInventoryData() {
    // Aquí iría la lógica para cargar los datos del inventario
    const mockData = [
        {
            id: 'AND-MAR-001',
            name: 'Marco de Andamio 2.00 x 1.20m',
            category: 'Andamio Marco y Cruceta',
            image: 'img/default.jpg',
            stock: {
                total: 150,
                available: 98,
                rented: 45
            },
            price: {
                sale: 85000,
                rent: 50000
            },
            condition: 'Bueno'
        }
    ];

    renderInventoryGrid(mockData);
}

// Cargar sección de productos
function loadProductosSection() {
    const productosData = [
        {
            id: 'AND-MAR-001',
            name: 'Marco de Andamio 2.00 x 1.20m',
            category: 'Andamio Marco y Cruceta',
            image: 'img/default.jpg',
            stock: { total: 150, available: 98, rented: 45 },
            condition: 'Bueno',
            status: 'Activo'
        },
        {
            id: 'AND-CRU-001',
            name: 'Cruceta Diagonal 2.00m',
            category: 'Andamio Marco y Cruceta',
            image: 'img/default.jpg',
            stock: { total: 200, available: 156, rented: 38 },
            condition: 'Bueno',
            status: 'Activo'
        },
        {
            id: 'AND-MUL-001',
            name: 'Roseta Multidireccional 8 Conexiones',
            category: 'Multidireccional',
            image: 'img/default.jpg',
            stock: { total: 80, available: 45, rented: 30 },
            condition: 'Nuevo',
            status: 'Activo'
        }
    ];
    
    renderProductosGrid(productosData);
}

// Cargar sección de categorías
function loadCategoriasSection() {
    const categoriasData = [
        {
            name: 'Andamio Marco y Cruceta',
            description: 'Sistemas de andamio con marcos y crucetas',
            productCount: 2,
            totalUnits: 350
        },
        {
            name: 'Multidireccional',
            description: 'Sistemas de andamio multidireccional modular',
            productCount: 1,
            totalUnits: 80
        },
        {
            name: 'Templetes',
            description: 'Sistemas de templetes y soporte',
            productCount: 0,
            totalUnits: 0
        },
        {
            name: 'Accesorios',
            description: 'Accesorios para sistemas de andamio',
            productCount: 3,
            totalUnits: 200
        }
    ];
    
    renderCategoriasGrid(categoriasData);
}

// Cargar sección de mantenimiento
function loadMantenimientoSection() {
    const mantenimientoData = [
        {
            producto: 'Marco de Andamio 2.00 x 1.20m',
            sku: 'AND-MAR-001',
            estado: 'Activo',
            enMantenimiento: '2 unidades',
            condicion: 'Bueno',
            acciones: ['Ver', 'Editar']
        },
        {
            producto: 'Cruceta Diagonal 2.00m',
            sku: 'AND-CRU-001',
            estado: 'Activo',
            enMantenimiento: '2 unidades',
            condicion: 'Bueno',
            acciones: ['Ver', 'Editar']
        },
        {
            producto: 'Roseta Multidireccional 8 Conexiones',
            sku: 'AND-MUL-001',
            estado: 'Activo',
            enMantenimiento: '1 unidades',
            condicion: 'Nuevo',
            acciones: ['Ver', 'Editar']
        }
    ];
    
    renderMantenimientoTable(mantenimientoData);
}

// Cargar sección de alertas
function loadAlertasSection() {
    const alertasData = [
        {
            type: 'warning',
            icon: 'fas fa-exclamation-triangle',
            title: 'Stock Bajo',
            message: 'El producto "Cruceta Diagonal 2.00m" tiene menos de 10 unidades disponibles.',
            time: 'Hace 2 horas'
        },
        {
            type: 'info',
            icon: 'fas fa-info-circle',
            title: 'Mantenimiento Programado',
            message: 'Revisión programada para 5 marcos de andamio el próximo lunes.',
            time: 'Hace 1 día'
        },
        {
            type: 'success',
            icon: 'fas fa-check-circle',
            title: 'Inventario Actualizado',
            message: 'Se han agregado 20 nuevas rosetas multidireccionales al inventario.',
            time: 'Hace 3 días'
        }
    ];
    
    renderAlertasGrid(alertasData);
}

function renderInventoryGrid(products) {
    const grid = document.querySelector('.inventory-grid');
    if (!grid) return;

    grid.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <div class="product-stats">
                    <div class="stat">
                        <div class="stat-value">${product.stock.total}</div>
                        <div class="stat-label">Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${product.stock.available}</div>
                        <div class="stat-label">Disponible</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${product.stock.rented}</div>
                        <div class="stat-label">En Renta</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Renderizar grid de productos
function renderProductosGrid(products) {
    const grid = document.querySelector('.productos-grid');
    if (!grid) return;

    grid.innerHTML = products.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <div class="product-stats">
                    <div class="stat">
                        <div class="stat-value">${product.stock.total}</div>
                        <div class="stat-label">Stock Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${product.stock.available}</div>
                        <div class="stat-label">Disponible</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${product.stock.rented}</div>
                        <div class="stat-label">En Renta</div>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="btn-sm"><i class="fas fa-eye"></i> Ver</button>
                    <button class="btn-sm"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-sm" style="color: #f44336;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

// Renderizar grid de categorías
function renderCategoriasGrid(categorias) {
    const grid = document.querySelector('.categorias-grid');
    if (!grid) return;

    grid.innerHTML = categorias.map(categoria => `
        <div class="categoria-card">
            <h3 class="categoria-title">${categoria.name}</h3>
            <p class="categoria-description">${categoria.description}</p>
            <div class="categoria-stats">
                <div>
                    <div class="categoria-count">${categoria.productCount}</div>
                    <div class="categoria-units">productos</div>
                </div>
                <div>
                    <div class="categoria-count">${categoria.totalUnits}</div>
                    <div class="categoria-units">unidades</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Renderizar tabla de mantenimiento
function renderMantenimientoTable(data) {
    const table = document.querySelector('.mantenimiento-table');
    if (!table) return;

    table.innerHTML = `
        <div class="table-header">
            <div>Producto</div>
            <div>SKU</div>
            <div>Estado</div>
            <div>En Mantenimiento</div>
            <div>Condición</div>
            <div>Acciones</div>
        </div>
        ${data.map(item => `
            <div class="table-row">
                <div>${item.producto}</div>
                <div>${item.sku}</div>
                <div><span class="status-badge ${item.estado.toLowerCase()}">${item.estado}</span></div>
                <div><span class="maintenance-count">${item.enMantenimiento}</span></div>
                <div><span class="status-badge ${item.condicion.toLowerCase()}">${item.condicion}</span></div>
                <div>
                    <button class="btn-icon" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Configurar"><i class="fas fa-cog"></i></button>
                </div>
            </div>
        `).join('')}
    `;
}

// Renderizar grid de alertas
function renderAlertasGrid(alertas) {
    const grid = document.querySelector('.alertas-grid');
    if (!grid) return;

    grid.innerHTML = alertas.map(alerta => `
        <div class="alert-card ${alerta.type}">
            <div class="alert-header">
                <div class="alert-icon" style="background: ${getAlertColor(alerta.type)}">
                    <i class="${alerta.icon}"></i>
                </div>
                <h3 class="alert-title">${alerta.title}</h3>
            </div>
            <p class="alert-message">${alerta.message}</p>
            <div class="alert-time">${alerta.time}</div>
        </div>
    `).join('');
}

// Obtener color de alerta
function getAlertColor(type) {
    const colors = {
        warning: '#ff9800',
        info: '#2196f3',
        success: '#4caf50',
        error: '#f44336'
    };
    return colors[type] || '#757575';
}

// Función para aplicar tema oscuro si está guardado en localStorage
function applyTheme() {
    const darkTheme = localStorage.getItem('darkTheme') === 'true';
    if (darkTheme) {
        document.body.classList.add('dark-theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = true;
        }
    }
}

// Aplicar tema al cargar
applyTheme();

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    alertsContainer.appendChild(alert);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// Handle product image preview and storage
const productImageInput = document.getElementById('productImage');
const productImagePreview = document.getElementById('productImagePreview');
let productImageBase64 = null;

if (productImageInput && productImagePreview) {
    productImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Display the image preview
                productImagePreview.innerHTML = '';
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '150px';
                productImagePreview.appendChild(img);
                
                // Store the base64 string
                productImageBase64 = e.target.result.split(',')[1]; // Remove the data:image/*;base64, part
            };
            reader.readAsDataURL(file);
        }
    });
}

// Modify the form submission to include the image data, barcode, and serial number
const newProductForm = document.getElementById('newProductForm');
if (newProductForm) {
    newProductForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Create the product object
        const product = {
            clave: document.getElementById('productSKU').value,
            numero_de_serie: document.getElementById('productSerial').value, // Added serial number
            nombre_del_producto: document.getElementById('productName').value,
            descripcion: document.getElementById('productDescription').value,
            marca: document.getElementById('productBrand').value,
            modelo: document.getElementById('productModel').value,
            material: document.getElementById('productMaterial').value,
            id_categoria: document.getElementById('productCategory').value,
            peso: parseFloat(document.getElementById('productWeight').value) || 0,
            capacidad_de_carga: parseFloat(document.getElementById('productCapacity').value) || 0,
            largo: parseFloat(document.getElementById('productLength').value) || 0,
            ancho: parseFloat(document.getElementById('productWidth').value) || 0,
            alto: parseFloat(document.getElementById('productHeight').value) || 0,
            stock_total: parseInt(document.getElementById('stockTotal').value) || 0,
            stock_disponible: parseInt(document.getElementById('stockDisponible').value) || 0,
            en_renta: parseInt(document.getElementById('stockEnRenta').value) || 0,
            reservado: parseInt(document.getElementById('stockReservado').value) || 0,
            en_mantenimiento: parseInt(document.getElementById('stockMantenimiento').value) || 0,
            estado: document.getElementById('productStatus').value,
            condicion: document.getElementById('productCondition').value,
            codigo_de_barras: document.getElementById('productBarcode').value // Barcode
        };
        
        // Prepare the image data
        const imageData = {
            imagen_data: productImageBase64,
            nombre_archivo: productImageInput.files[0]?.name || 'imagen_producto.jpg'
        };
        
        // Send the product and image data to the server
        // Example: using fetch
        fetch('/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product, image: imageData })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            // Close modal and refresh
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
}
