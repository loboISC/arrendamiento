// Configuración de gráficas para el inventario
let categoryChart = null;
let statusChart = null;

function initCharts() {
    // Destruir gráficas existentes si las hay
    if (categoryChart) categoryChart.destroy();
    if (statusChart) statusChart.destroy();

    // Gráfica de distribución por categoría
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: ['Andamio Marco y Cruceta', 'Multidireccional', 'Templete', 'Accesorios'],
            datasets: [{
                label: 'Stock disponible',
                data: [254, 45, 0, 139],
                backgroundColor: [
                    'rgba(41, 121, 255, 0.8)',
                    'rgba(46, 125, 50, 0.8)',
                    'rgba(230, 81, 0, 0.8)',
                    'rgba(194, 24, 91, 0.8)'
                ],
                borderColor: [
                    'rgba(41, 121, 255, 1)',
                    'rgba(46, 125, 50, 1)',
                    'rgba(230, 81, 0, 1)',
                    'rgba(194, 24, 91, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Gráfica de estado del inventario
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Disponible', 'En Renta', 'Mantenimiento'],
            datasets: [{
                data: [630, 163, 3],
                backgroundColor: [
                    'rgba(46, 125, 50, 0.8)',
                    'rgba(41, 121, 255, 0.8)',
                    'rgba(194, 24, 91, 0.8)'
                ],
                borderColor: [
                    'rgba(46, 125, 50, 1)',
                    'rgba(41, 121, 255, 1)',
                    'rgba(194, 24, 91, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
        });
}

// Inicializar las gráficas cuando el documento esté listo
document.addEventListener('DOMContentLoaded', initCharts);
