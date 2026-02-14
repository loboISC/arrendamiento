// Verificar si API_CONFIG ya está definido
if (!window.API_CONFIG) {
  // Configuración de la API
  window.API_CONFIG = {
    // Determinar si estamos en entorno de desarrollo (localhost) o producción
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',

    // Obtener la URL base de la API
    getBaseUrl() {
      // Si estamos en andamiostorres.com (Hostinger), usar el túnel
      if (window.location.hostname.includes('andamiostorres.com')) {
        return 'https://api.andamiostorres-api.com';
      }

      // Si es localhost o IP local
      if (window.location.protocol === 'file:' || this.isLocalhost) {
        return window.location.origin;
      }

      return window.location.origin;
    },

    // URLs de la API
    getApiUrl(path = '') {
      const base = this.getBaseUrl();
      const apiPath = path.startsWith('/api/') || path === '' ? path : `/api/${path}`;
      return `${base}${apiPath}`;
    },

    // Headers comunes
    getHeaders() {
      const token = localStorage.getItem('token');
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
    },

    // Configuración de fetch
    async fetch(path, options = {}) {
      const url = this.getApiUrl(path);
      const headers = { ...this.getHeaders(), ...(options.headers || {}) };

      console.log(`[API] ${options.method || 'GET'} ${url}`);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include', // Importante para manejar cookies de sesión
          mode: 'cors' // Asegurar modo CORS
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Redirigir al login si no está autenticado
            window.location.href = '/login.html';
            throw new Error('No autorizado');
          }
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Error ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.error('[API] Error en la petición:', error);
        throw error;
      }
    },

    // Métodos HTTP con manejo de errores
    async get(path) {
      const response = await this.fetch(path);
      return response.json();
    },

    async post(path, data) {
      const response = await this.fetch(path, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },

    async put(path, data) {
      const response = await this.fetch(path, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },

    async delete(path) {
      const response = await this.fetch(path, {
        method: 'DELETE'
      });
      return response.json();
    }
  };
}

// Verificar configuración en consola
console.log('API Config loaded:', {
  baseUrl: window.API_CONFIG.getBaseUrl(),
  isLocalhost: window.API_CONFIG.isLocalhost
});
