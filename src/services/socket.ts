import { Logger } from './logger';

const Socket = {
  _handler: socket => {
    Logger.info(`SocketIO connection ${socket.id}`);
    socket.on('message', data => socket.emit('message', data));
  }
};

export { Socket };
