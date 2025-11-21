// Punto de entrada del proceso principal de Electron
// Aquí se inicializa la app y se crean las ventanas

const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Configurar switches ANTES de que la app esté lista
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
app.commandLine.appendSwitch('enable-features', 'PdfViewerUpdate');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true, // ✅ Seguridad activada (correcto)
      allowRunningInsecureContent: false, // ✅ No permitir contenido inseguro
      plugins: true, // ✅ Habilitar plugins (necesario para PDFs)
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // ✅ CAMBIO CRÍTICO: Cargar desde HTTP en lugar de file://
  win.loadURL('http://localhost:3001/login.html');

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  const publicPath = path.join(__dirname, '../../public');

  ipcMain.handle('read-file', async (_event, filePath) => {
    const resolvedPath = path.join(publicPath, filePath);
    if (!resolvedPath.startsWith(publicPath)) {
      throw new Error('Ruta inválida');
    }
    return fs.promises.readFile(resolvedPath, 'utf-8');
  });

  ipcMain.handle('read-file-data-url', async (_event, filePath) => {
    const resolvedPath = path.join(publicPath, filePath);
    if (!resolvedPath.startsWith(publicPath)) {
      throw new Error('Ruta inválida');
    }

    const data = await fs.promises.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return `data:${mimeType};base64,${data.toString('base64')}`;
  });

  // ✅ YA NO ES NECESARIO inyectar CSP aquí porque el servidor Express ya lo hace
  // Se eliminó session.defaultSession.webRequest.onHeadersReceived

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

