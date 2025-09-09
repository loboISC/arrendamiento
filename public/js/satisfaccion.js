// Módulo para manejar métricas de satisfacción de clientes

// Función para cargar métricas de satisfacción
async function cargarMetricasSatisfaccion() {
    try {
        const headers = getAuthHeaders();
        const response = await fetch('http://localhost:3001/api/clientes/stats', { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Error al cargar métricas de satisfacción');
        }
        
        const stats = await response.json();
        mostrarMetricasSatisfaccion(stats.satisfaccion);
        
    } catch (error) {
        console.error('Error al cargar métricas de satisfacción:', error);
        showMessage('Error al cargar métricas de satisfacción', 'error');
    }
}

// Función para mostrar las métricas de satisfacción
function mostrarMetricasSatisfaccion(satisfaccion) {
    const satisfaccionArea = document.getElementById('satisfaccion-area');
    if (!satisfaccionArea) return;
    
    const satisfechos = parseInt(satisfaccion.clientes_satisfechos || 0);
    const insatisfechos = parseInt(satisfaccion.clientes_insatisfechos || 0);
    const total = satisfechos + insatisfechos;
    const porcentajeSatisfaccion = total > 0 ? ((satisfechos / total) * 100).toFixed(1) : 0;
    
    satisfaccionArea.innerHTML = `
        <div class="satisfaction-overview">
            <div class="satisfaction-summary">
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-smile" style="color: #2ecc71;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${satisfechos}</h3>
                        <p>Clientes Satisfechos</p>
                        <span class="satisfaction-percentage">${porcentajeSatisfaccion}%</span>
                    </div>
                </div>
                
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-frown" style="color: #e74c3c;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${insatisfechos}</h3>
                        <p>Clientes Insatisfechos</p>
                        <span class="satisfaction-percentage">${(100 - porcentajeSatisfaccion).toFixed(1)}%</span>
                    </div>
                </div>
                
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-star" style="color: #f39c12;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${(satisfaccion.calificacion_general || 0).toFixed(1)}</h3>
                        <p>Calificación Promedio</p>
                        <span class="satisfaction-percentage">de 5.0</span>
                    </div>
                </div>
            </div>
            
            <div class="satisfaction-metrics">
                <h3>Métricas Detalladas de Satisfacción</h3>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-label">Calificación General</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(satisfaccion.calificacion_general || 0) * 20}%"></div>
                        </div>
                        <div class="metric-value">${(satisfaccion.calificacion_general || 0).toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Puntualidad de Pago</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(satisfaccion.calificacion_pago || 0) * 20}%"></div>
                        </div>
                        <div class="metric-value">${(satisfaccion.calificacion_pago || 0).toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Comunicación</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(satisfaccion.calificacion_comunicacion || 0) * 20}%"></div>
                        </div>
                        <div class="metric-value">${(satisfaccion.calificacion_comunicacion || 0).toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Calidad de Equipos</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(satisfaccion.calificacion_equipos || 0) * 20}%"></div>
                        </div>
                        <div class="metric-value">${(satisfaccion.calificacion_equipos || 0).toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Satisfacción General</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(satisfaccion.calificacion_satisfaccion || 0) * 20}%"></div>
                        </div>
                        <div class="metric-value">${(satisfaccion.calificacion_satisfaccion || 0).toFixed(1)}/5</div>
                    </div>
                </div>
            </div>
            
            <div class="satisfaction-actions">
                <button class="btn btn-primary" onclick="generarReporteSatisfaccion()">
                    <i class="fas fa-file-pdf"></i> Generar Reporte
                </button>
                <button class="btn btn-secondary" onclick="enviarEncuestaSatisfaccion()">
                    <i class="fas fa-paper-plane"></i> Enviar Encuesta
                </button>
            </div>
        </div>
    `;
}

// Función para generar reporte de satisfacción
function generarReporteSatisfaccion() {
    showMessage('Función de reporte en desarrollo', 'error');
    // TODO: Implementar generación de reporte PDF
}

// Función para enviar encuesta de satisfacción
function enviarEncuestaSatisfaccion() {
    // Abrir la modal de encuesta de satisfacción
    if (typeof mostrarModalEncuestaSatisfaccion === 'function') {
        mostrarModalEncuestaSatisfaccion();
    } else {
        // Fallback: mostrar mensaje y intentar cargar la función
        console.log('Función mostrarModalEncuestaSatisfaccion no encontrada, intentando cargar...');
        setTimeout(() => {
            if (typeof mostrarModalEncuestaSatisfaccion === 'function') {
                mostrarModalEncuestaSatisfaccion();
            } else {
                showMessage('Modal de encuesta no disponible. Recarga la página.', 'error');
            }
        }, 1000);
    }
}

// Hacer funciones disponibles globalmente
window.cargarMetricasSatisfaccion = cargarMetricasSatisfaccion;
window.generarReporteSatisfaccion = generarReporteSatisfaccion;
window.enviarEncuestaSatisfaccion = enviarEncuestaSatisfaccion;
