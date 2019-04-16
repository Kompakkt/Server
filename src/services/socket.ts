import { WebSocket } from './express';
import { Logger } from './logger';

// message
// newUser
// onlineCollaborators
// createAnnotation
// editAnnotation
// deleteAnnotation
// changeRanking
// lostConnection
// changeRoom
// myNewRoom

// CHEATSHEET FOR SOCKET.IO
// https://gist.github.com/alexpchin/3f257d0bb813e2c8c476

const Socket = {

  _handler: socket => {
    Logger.info(`SocketIO connection ${socket.id}`);

    // message
    socket.on('message', data => {
      socket.to(data[0])
        .emit('message', data);
      Logger.info(`'message': ${data} of User ${socket.id} in Room  '${data[0]}'`);
    });

    // newUser
    socket.on('newUser', data => {      // data => [room , annotations]
      // join room
      socket.join(data[0]);
      // Emit annotations of newUser to all online members of joined room
      WebSocket.to(data[0])
        .emit('newUser', [socket.id, data[1]]);
      Logger.info(`client '${socket.id}' joins to room: '${data[0]}'`);
    });

    // onlineCollaborator
    socket.on('onlineCollaborators', data => {  // [newUser, annotations]
      // Emit to newUser of the room your 'onlineCollaborator' annotations
      WebSocket.to(data[0])
        .emit('onlineCollaborators', [socket.id, data[1]]);
      Logger.info(`client '${socket.id}' sends annotations to new Collaborator '${data[0]}'`);
    });

    // createAnnotation
    socket.on('createAnnotation', data => {
      socket.to(data[0])
        .emit('createAnnotation', [socket.id, data[1]]);
      Logger.info(`'createAnnotation' ${data[1]._id} of User ${socket.id} in Room '${data[0]}'`);
    });

    // editAnnotation
    socket.on('editAnnotation', data => {
      socket.to(data[0])
        .emit('editAnnotation', [socket.id, data[1]]);
      Logger.info(`'editAnnotation' ${data[1]._id}  of User ${socket.id} in Room '${data[0]}'`);
    });

    // deleteAnnotation
    socket.on('deleteAnnotation', data => {
      socket.to(data[0])
        .emit('deleteAnnotation', [socket.id, data[1]]);
      Logger.info(`'deleteAnnotation' ${data[1]._id} of User ${socket.id} in Room '${data[0]}'`);
    });

    // changeRanking
    socket.on('changeRanking', data => {
      socket.to(data[0])
        .emit('changeRanking', [socket.id, data[1], data[2]]);
      Logger.info(`'changeRanking' of Annotations from User ${socket.id} in Room '${data[0]}'`);
    });

    // lostConnection
    // [this.annotationService.socketRoom, this.annotationService.annotations]
    socket.on('lostConnection', data => {
      // To Members of Room
      socket.to(data[0])
        .emit('lostConnection', [socket.id, data[1]]);
      // To Client (sender)
      socket.emit('logout', socket.id);
      Logger.info(`User '${socket.id}' disconnected from Socket.IO.`);
    });

    // changeRoom
    socket.on('changeRoom', data => { //  [oldSocketRoom, newSocketRoom, annotations]
      Logger.info(`User ${socket.id} 'changeRoom' from Room '${data[0]}' to Room '${data[1]}'`);
      // (To members of) old room:
      socket.to(data[0])
        .emit('changeRoom', [socket.id, data[2]]);
      socket.leave(data[0]);
      Logger.info(`client '${socket.id}' leafs room: '${data[0]}'`);
      // To Client (sender)
      socket.emit('myNewRoom', [data[0], data[1]]);
    });
    // To (members of) new room:
    socket.on('myNewRoom', data => { //
      socket.join(data[0]);
      socket.to(data[0])
        .emit('newUser', [socket.id, data[1]]);
      Logger.info(`client '${socket.id}' joins room: '${data[0]}'`);
    });

  },
};

export { Socket };
