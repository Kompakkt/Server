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
                                                                                                              //  on change model...


const Socket = {

  _handler: socket => {
    Logger.info(`SocketIO connection ${socket.id}`);
  
    // message
    socket.on('message', data => {
      socket.to(data[0]).emit('message', data);
      Logger.info(`'message': ${data} of User ${socket.id} in Room  '${data[0]}'` );
    });


    // newUser
    socket.on('newUser', data => {      // data => [room , annotations]
      
      //join room
      socket.join(data[0]);
      // Emit annotations of newUser to all online members of joined room
      socket.to(data[0]).emit('newUser', [socket.id, data[1]]);
      Logger.info(`client '${socket.id}' joins to room: '${data}'`);
    });


    // onlineCollaborator
    socket.on('onlineCollaborators', data => {      // data => [newUser, annotations]  
      
      // Emit to newUser of the room your 'onlineCollaborator' annotations 
      socket.to(data[0]).emit('onlineCollaborators', [socket.id, data[1]]);
      Logger.info(`client '${socket.id}' sends annotations to new Collaborator '${data[0]}'`);
    });


    // createAnnotation
    socket.on('createAnnotation', data => {
      socket.to(data[0]).emit('createAnnotation', [socket.id, data[1]]);
      Logger.info(`'createAnnotation' ${data[1]._id} of User ${socket.id} in Room '${data[0]}'` );
    });


    // editAnnotation
    socket.on('editAnnotation', data => {
      socket.to(data[0]).emit('editAnnotation',  [socket.id, data[1]]);
      Logger.info(`'editAnnotation' ${data[1]._id}  of User ${socket.id} in Room '${data[0]}'` );
    });


    // deleteAnnotation
    socket.on('deleteAnnotation', data => {
      socket.to(data[0]).emit('deleteAnnotation', [socket.id, data[1]]);
      Logger.info(`'deleteAnnotation' ${data[1]._id} of User ${socket.id} in Room '${data[0]}'` );
    });


    // changeRanking
    socket.on('changeRanking', data => { 
      socket.to(data[0]).emit('changeRanking', [socket.id, data[1], data[2]]);
      Logger.info(`'changeRanking' of Annotations from User ${socket.id} in Room '${data[0]}'` );
    });

    
    // lostConnection
    socket.on('lostConnection', data => { 

      socket.to(data[0]).emit('lostConnection', [socket.id, data[1]]);
      Logger.info(`User '${socket.id}' disconnected from Socket.IO.` );
    });


    // changeRoom
    // socket.on('changeRoom', data => { //  [newSocketRoom]

    //   socket.to(data[0]).emit('changeRoom', [socket.id, data[1], data[2]]);
    //   Logger.info(`'changeRoom' of Annotations from User ${socket.id} in Room '${data[0]}'` );
    // });
    
  }
};

export { Socket };
