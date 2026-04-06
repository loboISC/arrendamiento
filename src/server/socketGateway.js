let ioInstance = null;
let wsServerInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

function setWSServer(wsServer) {
  wsServerInstance = wsServer;
}

function getWSServer() {
  return wsServerInstance;
}

function broadcastEvent(payload) {
  const data = JSON.stringify(payload);

  if (ioInstance) {
    ioInstance.emit('logistica:evento', payload);
    if (payload && payload.tipo === 'ubicacion') {
      ioInstance.emit('logistica:tracking:update', payload);
    }
  }

  if (wsServerInstance && wsServerInstance.clients) {
    wsServerInstance.clients.forEach((client) => {
      try {
        if (client.readyState === 1) {
          client.send(data);
        }
      } catch (err) {
        // Evitar romper broadcast por un cliente fallando
      }
    });
  }
}

module.exports = {
  setIO,
  getIO,
  setWSServer,
  getWSServer,
  broadcastEvent
};
