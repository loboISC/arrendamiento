// Punto de entrada del proceso principal de Electron
// Aquí se inicializa la app y se crean las ventanas

const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Variable para mantener una referencia al proceso del servidor
let serverProcess = null;

// Función para iniciar el servidor Node
function startServer() {
  return new Promise((resolve, reject) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const nodeModulesPath = path.join(__dirname, '../../node_modules/.bin');
    const serverPath = path.join(__dirname, '../server.js');
    
    // En desarrollo, usar node directamente
    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit', // Mostrar logs del servidor en consola
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    });
    
    serverProcess.on('error', (err) => {
      console.error('Error al iniciar servidor:', err);
      reject(err);
    });
    
    // Esperar un poco para que el servidor esté listo
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

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

app.whenReady().then(async () => {
  // Iniciar el servidor Node primero
  try {
    console.log('[Electron] Iniciando servidor Node...');
    await startServer();
    console.log('[Electron] Servidor Node iniciado correctamente');
  } catch (err) {
    console.error('[Electron] Error al iniciar servidor:', err);
    // Continuar de todos modos
  }

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
  // Cerrar el servidor cuando se cierren todas las ventanas
  if (serverProcess) {
    console.log('[Electron] Cerrando servidor Node...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Asegurar que el servidor se cierra al salir de la app
  if (serverProcess) {
    console.log('[Electron] Cerrando servidor al salir de la app...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});

