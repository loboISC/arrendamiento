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

  // Manejar la apertura de nuevas ventanas
  win.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');

    // Revisar si es una URL externa (http/https y no es localhost)
    const isExternal = url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1');

    // Si es PDF o URL externa, abrir en navegador del sistema
    if (url.includes('/api/pdf/') || url.includes('/pdfs/temp/') || isExternal) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    // Permitir ventanas internas (ej: reportes, otras vistas de la app)
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        // parent: win, // Comentado para permitir ventanas independientes
        modal: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false, // Importante: mantener consistencia con la ventana principal
          plugins: true,  // Importante para PDFs si se abren dentro
          preload: path.join(__dirname, 'preload.js'),
        }
      }
    };
  });

  // Configurar handler para ventanas secundarias también
  win.webContents.on('did-create-window', (childWindow) => {
    const { shell } = require('electron');
    childWindow.webContents.setWindowOpenHandler(({ url }) => {
      // Si es URL de PDF temporal, abrir en navegador del sistema
      if (url.includes('/api/pdf/') || url.includes('/pdfs/temp/')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      // Permitir otras ventanas internas
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            plugins: true,
            preload: path.join(__dirname, 'preload.js'),
          }
        }
      };
    });
  });

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

  // Handler para guardar PDF y abrirlo con el visor del sistema
  ipcMain.handle('save-and-open-pdf', async (_event, { base64Data, fileName }) => {
    const { shell } = require('electron');
    const tempDir = app.getPath('temp');
    const filePath = path.join(tempDir, fileName);
    
    // Decodificar base64 y guardar
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    
    // Abrir con el visor del sistema
    await shell.openPath(filePath);
    return filePath;
  });

  // Handler para abrir URL en navegador externo
  ipcMain.handle('open-external', async (_event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
  });

  // ✅ YA NO ES NECESARIO inyectar CSP aquí porque el servidor Express ya lo hace
  // Se eliminó session.defaultSession.webRequest.onHeadersReceived

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

