import { Socket } from 'socket.io';

import { WebSocket } from './express';
import { Logger } from './logger';

interface IAnnotation {
  annotation: any;
  user: IUser;
}

interface IMessage {
  message: string;
  user: IUser;
}

interface IUser {
  _id: string;
  socketId: string;
  username: string;
  fullname: string;
  room: string;
}

interface IUserInfo {
  user: IUser;
  annotations: any[];
}

interface IChangeRoom {
  newRoom: string;
  annotations: any[];
}

interface IChangeRanking {
  user: IUser;
  oldRanking: any[];
  newRanking: any[];
}

interface IRoomData {
  requester: IUserInfo;
  recipient: string;
  info: IUserInfo;
}

// For mapping socket.id to a roomname
const Users: {
  [key: string]: IUser;
} = {};

const Socket = {

  _handler: (socket: Socket) => {
    Logger.info(`SocketIO connection ${socket.id}`);

    // SocketIO Internals
    Users[socket.id] = {
      room: 'none',
      fullname: 'none',
      username: 'none',
      socketId: 'none',
      _id: 'none',
    };

    socket.on('disconnect', () => {
      WebSocket.to(Users[socket.id].room)
        .emit('lostConnection', { user: Users[socket.id], annotations: [] });
    });

    // Custom Events
    socket.on('message', (data: IMessage) => {
      socket.to(Users[socket.id].room)
        .emit('message', { ...data, user: Users[socket.id] });
    });

    socket.on('newUser', (data: IUserInfo) => {
      const newUser: IUser = {
        socketId: socket.id,
        fullname: data.user.fullname,
        username: data.user.username,
        room: data.user.room,
        _id: data.user._id,
      };
      const emitUser: IUserInfo = {
        user: newUser,
        annotations: data.annotations,
      };
      Users[socket.id] = newUser;
      socket.join(data.user.room);
      WebSocket.to(data.user.room)
        .emit('newUser', emitUser);
    });

    socket.on('roomDataRequest', (data: IRoomData) => {
      data.requester.user.socketId = socket.id;
      socket.to(data.recipient)
        .emit('roomDataRequest', data);
    });

    socket.on('roomDataAnswer', (data: IRoomData) => {
      data.info.user.socketId = socket.id;
      socket.to(data.requester.user.socketId)
        .emit('roomDataAnswer', data);
    });

    socket.on('createAnnotation', (data: IAnnotation) => {
      socket.to(Users[socket.id].room)
        .emit('createAnnotation', { ...data, user: Users[socket.id] });
    });

    socket.on('editAnnotation', (data: IAnnotation) => {
      socket.to(Users[socket.id].room)
        .emit('editAnnotation', { ...data, user: Users[socket.id] });
    });

    socket.on('deleteAnnotation', (data: IAnnotation) => {
      socket.to(Users[socket.id].room)
        .emit('deleteAnnotation', { ...data, user: Users[socket.id] });
    });

    socket.on('changeRanking', (data: IChangeRanking) => {
      socket.to(Users[socket.id].room)
        .emit('changeRanking', { ...data, user: Users[socket.id]});
    });

    socket.on('changeRoom', (data: IChangeRoom) => {
      const emitData: IUserInfo = {
        user: Users[socket.id],
        annotations: data.annotations,
      };
      socket.to(Users[socket.id].room)
        .emit('changeRoom', emitData);
      socket.leave(Users[socket.id].room);
    });

    socket.on('logout', (data: IUserInfo) => {
      socket.to(Users[socket.id].room)
        .emit('lostConnection', { ...data, user: Users[socket.id] });
    });
  },
};

export { Socket };
