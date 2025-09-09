const { contextBridge } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  // Aquí puedes agregar funciones específicas de Electron si las necesitas
  isElectron: true
}); 