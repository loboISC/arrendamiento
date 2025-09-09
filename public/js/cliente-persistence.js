/**
 * Cliente Persistence Manager
 * Maneja la persistencia de datos del cliente en localStorage y sessionStorage
 */

class ClientePersistenceManager {
  constructor() {
    this.storageKeys = {
      clienteActual: 'cliente_actual',
      datosTemporales: 'datos_cliente_temporales',
      productosSeleccionados: 'productos_seleccionados_cotizacion',
      cotizacionTemporal: 'cotizacion_temporal',
      historialCotizaciones: 'historial_cotizaciones_cliente'
    };
  }

  /**
   * Guardar datos del cliente actual
   */
  guardarClienteActual(cliente) {
    try {
      localStorage.setItem(this.storageKeys.clienteActual, JSON.stringify(cliente));
      console.log('Cliente actual guardado:', cliente);
      return true;
    } catch (error) {
      console.error('Error al guardar cliente actual:', error);
      return false;
    }
  }

  /**
   * Obtener cliente actual
   */
  obtenerClienteActual() {
    try {
      const cliente = localStorage.getItem(this.storageKeys.clienteActual);
      return cliente ? JSON.parse(cliente) : null;
    } catch (error) {
      console.error('Error al obtener cliente actual:', error);
      return null;
    }
  }

  /**
   * Guardar datos temporales del cliente (sessionStorage)
   */
  guardarDatosTemporales(datos) {
    try {
      sessionStorage.setItem(this.storageKeys.datosTemporales, JSON.stringify(datos));
      console.log('Datos temporales guardados:', datos);
      return true;
    } catch (error) {
      console.error('Error al guardar datos temporales:', error);
      return false;
    }
  }

  /**
   * Obtener datos temporales del cliente
   */
  obtenerDatosTemporales() {
    try {
      const datos = sessionStorage.getItem(this.storageKeys.datosTemporales);
      return datos ? JSON.parse(datos) : null;
    } catch (error) {
      console.error('Error al obtener datos temporales:', error);
      return null;
    }
  }

  /**
   * Limpiar datos temporales
   */
  limpiarDatosTemporales() {
    try {
      sessionStorage.removeItem(this.storageKeys.datosTemporales);
      console.log('Datos temporales limpiados');
      return true;
    } catch (error) {
      console.error('Error al limpiar datos temporales:', error);
      return false;
    }
  }

  /**
   * Guardar productos seleccionados para cotización
   */
  guardarProductosSeleccionados(productos) {
    try {
      localStorage.setItem(this.storageKeys.productosSeleccionados, JSON.stringify(productos));
      console.log('Productos seleccionados guardados:', productos);
      return true;
    } catch (error) {
      console.error('Error al guardar productos seleccionados:', error);
      return false;
    }
  }

  /**
   * Obtener productos seleccionados
   */
  obtenerProductosSeleccionados() {
    try {
      const productos = localStorage.getItem(this.storageKeys.productosSeleccionados);
      return productos ? JSON.parse(productos) : [];
    } catch (error) {
      console.error('Error al obtener productos seleccionados:', error);
      return [];
    }
  }

  /**
   * Guardar cotización temporal
   */
  guardarCotizacionTemporal(cotizacion) {
    try {
      sessionStorage.setItem(this.storageKeys.cotizacionTemporal, JSON.stringify(cotizacion));
      console.log('Cotización temporal guardada:', cotizacion);
      return true;
    } catch (error) {
      console.error('Error al guardar cotización temporal:', error);
      return false;
    }
  }

  /**
   * Obtener cotización temporal
   */
  obtenerCotizacionTemporal() {
    try {
      const cotizacion = sessionStorage.getItem(this.storageKeys.cotizacionTemporal);
      return cotizacion ? JSON.parse(cotizacion) : null;
    } catch (error) {
      console.error('Error al obtener cotización temporal:', error);
      return null;
    }
  }

  /**
   * Limpiar cotización temporal
   */
  limpiarCotizacionTemporal() {
    try {
      sessionStorage.removeItem(this.storageKeys.cotizacionTemporal);
      console.log('Cotización temporal limpiada');
      return true;
    } catch (error) {
      console.error('Error al limpiar cotización temporal:', error);
      return false;
    }
  }

  /**
   * Guardar cotización en historial del cliente
   */
  guardarCotizacionEnHistorial(cotizacion) {
    try {
      const clienteActual = this.obtenerClienteActual();
      if (!clienteActual) {
        console.warn('No hay cliente actual para guardar en historial');
        return false;
      }

      const historialKey = `${this.storageKeys.historialCotizaciones}_${clienteActual.id_cliente}`;
      const historial = this.obtenerHistorialCotizaciones(clienteActual.id_cliente);
      
      // Agregar nueva cotización al historial
      historial.push({
        ...cotizacion,
        fecha_creacion: new Date().toISOString(),
        id_temporal: Date.now()
      });

      localStorage.setItem(historialKey, JSON.stringify(historial));
      console.log('Cotización guardada en historial:', cotizacion);
      return true;
    } catch (error) {
      console.error('Error al guardar cotización en historial:', error);
      return false;
    }
  }

  /**
   * Obtener historial de cotizaciones del cliente
   */
  obtenerHistorialCotizaciones(clienteId) {
    try {
      const historialKey = `${this.storageKeys.historialCotizaciones}_${clienteId}`;
      const historial = localStorage.getItem(historialKey);
      return historial ? JSON.parse(historial) : [];
    } catch (error) {
      console.error('Error al obtener historial de cotizaciones:', error);
      return [];
    }
  }

  /**
   * Sincronizar datos del cliente con el backend
   */
  async sincronizarClienteConBackend(clienteId) {
    try {
      const response = await fetch(`/api/clientes/${clienteId}`);
      if (!response.ok) {
        throw new Error('Error al obtener datos del cliente');
      }

      const clienteCompleto = await response.json();
      this.guardarClienteActual(clienteCompleto);
      
      console.log('Cliente sincronizado con backend:', clienteCompleto);
      return clienteCompleto;
    } catch (error) {
      console.error('Error al sincronizar cliente:', error);
      return null;
    }
  }

  /**
   * Crear nuevo cliente y guardarlo
   */
  async crearCliente(datosCliente) {
    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datosCliente)
      });

      if (!response.ok) {
        throw new Error('Error al crear cliente');
      }

      const nuevoCliente = await response.json();
      this.guardarClienteActual(nuevoCliente);
      
      console.log('Nuevo cliente creado y guardado:', nuevoCliente);
      return nuevoCliente;
    } catch (error) {
      console.error('Error al crear cliente:', error);
      return null;
    }
  }

  /**
   * Actualizar cliente existente
   */
  async actualizarCliente(clienteId, datosActualizados) {
    try {
      const response = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datosActualizados)
      });

      if (!response.ok) {
        throw new Error('Error al actualizar cliente');
      }

      const clienteActualizado = await response.json();
      this.guardarClienteActual(clienteActualizado);
      
      console.log('Cliente actualizado:', clienteActualizado);
      return clienteActualizado;
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      return null;
    }
  }

  /**
   * Buscar clientes en el backend
   */
  async buscarClientes(termino) {
    try {
      const response = await fetch(`/api/clientes/search?q=${encodeURIComponent(termino)}`);
      if (!response.ok) {
        throw new Error('Error al buscar clientes');
      }

      const clientes = await response.json();
      console.log('Clientes encontrados:', clientes);
      return clientes;
    } catch (error) {
      console.error('Error al buscar clientes:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas del cliente
   */
  obtenerEstadisticasCliente() {
    const cliente = this.obtenerClienteActual();
    if (!cliente || !cliente.estadisticas) {
      return null;
    }
    return cliente.estadisticas;
  }

  /**
   * Limpiar todos los datos del cliente
   */
  limpiarTodosLosDatos() {
    try {
      // Limpiar localStorage
      localStorage.removeItem(this.storageKeys.clienteActual);
      localStorage.removeItem(this.storageKeys.productosSeleccionados);
      
      // Limpiar sessionStorage
      sessionStorage.removeItem(this.storageKeys.datosTemporales);
      sessionStorage.removeItem(this.storageKeys.cotizacionTemporal);
      
      console.log('Todos los datos del cliente limpiados');
      return true;
    } catch (error) {
      console.error('Error al limpiar datos del cliente:', error);
      return false;
    }
  }

  /**
   * Exportar datos del cliente
   */
  exportarDatosCliente() {
    try {
      const cliente = this.obtenerClienteActual();
      const productos = this.obtenerProductosSeleccionados();
      const cotizacionTemporal = this.obtenerCotizacionTemporal();
      
      const datosExport = {
        cliente,
        productos_seleccionados: productos,
        cotizacion_temporal: cotizacionTemporal,
        fecha_exportacion: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(datosExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `datos_cliente_${cliente?.id_cliente || 'temp'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Datos del cliente exportados');
      return true;
    } catch (error) {
      console.error('Error al exportar datos del cliente:', error);
      return false;
    }
  }

  /**
   * Importar datos del cliente
   */
  importarDatosCliente(archivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const datos = JSON.parse(e.target.result);
          
          if (datos.cliente) {
            this.guardarClienteActual(datos.cliente);
          }
          
          if (datos.productos_seleccionados) {
            this.guardarProductosSeleccionados(datos.productos_seleccionados);
          }
          
          if (datos.cotizacion_temporal) {
            this.guardarCotizacionTemporal(datos.cotizacion_temporal);
          }
          
          console.log('Datos del cliente importados:', datos);
          resolve(datos);
        } catch (error) {
          console.error('Error al importar datos del cliente:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error al leer archivo:', error);
        reject(error);
      };
      
      reader.readAsText(archivo);
    });
  }
}

// Crear instancia global
const clientePersistence = new ClientePersistenceManager();

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClientePersistenceManager;
} else {
  // Para uso en navegador
  window.clientePersistence = clientePersistence;
}





