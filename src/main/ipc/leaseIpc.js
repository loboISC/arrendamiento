// Canal IPC para exponer funciones de arrendamiento al frontend
const { ipcMain } = require('electron');
const lease = require('../modules/lease');

ipcMain.handle('lease:crear', async (event, contrato) => {
    return lease.crearContrato(contrato);
});

ipcMain.handle('lease:obtenerTodos', async () => {
    return lease.obtenerContratos();
});
