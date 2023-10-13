const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');
const port = 3000;

const ip_addr = '192.168.43.177';
app.use('/',express.static('public'));
server.listen(port,ip_addr, () => {
    console.log('listening on ',ip_addr,"port",port);
});

let clients = [];//stores the socket.id of socket instances
let clients_values = {}; //stores the socket instances of connected sockets with socket.id as key
io.on('connection', (socket) => {

    socket.emit('the_clients',clients_values);
    console.log(socket.handshake.address," connected with id ",socket.id);
    clients.push(socket.id); 
    clients_values[socket.id] = socket.handshake.address;
    console.log(clients);
    socket.broadcast.emit('new_client',{
	[socket.id] : clients_values[socket.id]
    });

    socket.on('disconnect',()=>{

	socket.broadcast.emit('deleted_client',{[socket.id] : clients_values[socket.id]});
	console.log(socket.id,"disconnected");
	clients.splice(clients.indexOf(socket.id),1);
	delete clients_values[socket.id];

    });

    socket.on('init',id=>{

	io.to(id).emit('init',socket.id);
	
	
    });

    socket.on('offer', offer=>{           //Webrtc offer from client to offer.id
	io.to(offer.id).emit('offer',{
	    id:socket.id,
	    sdp:offer.sdp
	});
    });
    socket.on('ans', ans=>{              //Webrtc answer from client to ans.id
	
	io.to(ans.id).emit('ans',ans.sdp);

    });
});
