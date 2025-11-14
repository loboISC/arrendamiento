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

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'), // si usas preload
    },
  });

  win.loadFile(path.join(__dirname, '../../public/login.html'));
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

  // Set a custom Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' http://localhost:3001; font-src 'self' data: https://cdnjs.cloudflare.com; frame-src 'self' data:; child-src 'self' data:;"
        ]
      }
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

