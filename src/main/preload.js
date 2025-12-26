const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readFileDataUrl: (filePath) => ipcRenderer.invoke('read-file-data-url', filePath),
  saveAndOpenPdf: (base64Data, fileName) => ipcRenderer.invoke('save-and-open-pdf', { base64Data, fileName }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});