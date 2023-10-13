let socket = io(); // connect to socket server
let connected_sockets={}; //socket ids connected by webrtc status 0 or 1
let connected_peers={} //peer instances by socket id 1 peer per socketid
socket.on('connect', ()=>{
    console.log("connected socket");
})

socket.on('the_clients',(values)=>{ //when first time connecting to socket server 
     for(const key in values){
	 addDiv(key,values[key]);
	 connected_sockets[key]=0;

     }
    console.log(connected_sockets);

});


socket.on('new_client',new_client=>{ //when a new client connects

    for(const key in new_client){

	addDiv(key,new_client[key]);
	connected_sockets[key]=0;
    }
    console.log(connected_sockets);
});

socket.on('deleted_client',client=>{ //when a client deletes from socket server
    console.log("deleted",client);
    
    for(const key in client){

	delete connected_sockets[key];
	if(connected_peers[key]){
	    connected_peers[key].destroy();
	    delete connected_peers[key];
	}
	delDiv(key);
    }
    console.log(connected_sockets);
    
    
});





socket.on('init',id=>{
    console.log("init received from",id);
    
    let peer = new SimplePeer({initiator:true,
			       trickle:false
			      });

    connected_peers[id]=peer;

    
    peer.on('signal',sdp=>{

	socket.emit('offer',{id:id,
			     sdp:sdp,
			     });
    });

    socket.on('ans',ans=>{
	console.log(connected_sockets,"answer dubugging");
	console.log("the answer ",ans,id);
	if(connected_sockets[id]==0){
	    if(!peer.destroyed){
		peer.signal(ans);
	    }
	}
    });
    peer.on('connect',()=>{
	connected_sockets[id]=1;
	console.log("Webrtc connected im init to id",id);
    });

    peer.on('close',()=>{
	peer.destroy();
	connected_sockets[id]=0;
	delete connected_peers[id];
	console.log("webrtc disconnect from",id);
    });
    let the_data = [];
    let totalSize = 0; /* for finding percentage complete */
    let currentSize = 0; /* for finding percentage complete */ 
    peer.on('data', data=>{
//	console.log(the_data);
	let statusDiv = document.getElementsByClassName('status_'+id)[0];
	if(data.toString().includes("done_$")){
	    peer.write(JSON.stringify({
		data : "finished downloading!"
	    }));
	    console.log("finished");
	    let combined_data = new Blob(the_data);
	    console.log(combined_data);
	    /*-----------------------------*/ //on finish dowloading create link in the respective div
	    const parse = JSON.parse(data);
	    const downloadLink = document.createElement('a');
	    downloadLink.href = URL.createObjectURL(combined_data);
	    downloadLink.download = parse.fileName;
	    downloadLink.innerHTML= "Download "+parse.fileName;
	    let current_div = document.getElementById(id);
	    
	    current_div.appendChild(downloadLink);

	    downloadLink.addEventListener('click',(event)=>{
		event.stopPropagation();
		
		console.log("the link clicked");
	    });
	    /*-----------------------------*/

	    
	    peer.destroy();
	}
	else if(data.toString().includes("total_size")){

	    let parse = JSON.parse(data);
	    totalSize = parse.total_size;
	    
	}
	else{
	    the_data.push(data);
	    currentSize += data.length; //collects net size downloaded


	    let percent_complete = (currentSize/totalSize)*100; //percentage of download
	    console.log(percent_complete);
	    statusDiv.innerHTML = percent_complete + '%'; //write this percentage to div
	    peer.write(JSON.stringify({
		data:percent_complete
	    }));
	}
	
    });
    
});



socket.on('offer',the_offer=>{
    let peer = new SimplePeer({
	initiator:false,
	trickle:false

    });
    connected_peers[the_offer.id]=peer;
    peer.on('signal',ans=>{

	socket.emit('ans',{
	    id:the_offer.id,
	    sdp:ans
	});
    });

    peer.on('data',(data)=>{  //percentage complete downloading by other peer sent here 
//	console.log("data-status",JSON.parse(data).data,data);
	let percent = JSON.parse(data);

	let statusDiv = document.getElementsByClassName('status_'+the_offer.id)[0];
	if(typeof percent.data == 'number'){
	    statusDiv.innerHTML = percent.data + '%'; //write the percentage to div
	    console.log(percent.data);

	    
	 
	}

    })
    peer.on('connect',()=>{
	console.log("im not init and webrtc Connected to id",the_offer.id);
	connected_sockets[the_offer.id]=1;
	console.log(files_by_id[the_offer.id],files_by_id[the_offer.id].size);
	const stream = files_by_id[the_offer.id].stream();
	const reader = stream.getReader();
	let file_size = files_by_id[the_offer.id].size;
	let percent_complete = 0; //for finding sender side percentage complete uploading
	let amount_complete=0; //for finding sender side percentage complete uploading
	peer.write(JSON.stringify({

	    total_size:file_size
	}));
	reader.read().then(obj=>{   //read file by chunks recursively and send data to peer
	    handlereading(obj.done,obj.value);
	    

	});

	function handlereading(done,value){


	    if(value){ /* for finding percentage of file uploaded */
		amount_complete += value.length;
		percent_complete = (amount_complete/file_size)*100;
//		console.log(percent_complete); 
	    }
	    
	    if(done){
		peer.write(JSON.stringify({
		    done_$: true,
		    fileName: files_by_id[the_offer.id].name
		}));
		return;
		
	    }			   
	    peer.write(value);
	    reader.read().then(obj=>{
		handlereading(obj.done,obj.value);
	    })
	}

    });

    peer.signal(the_offer.sdp);

    peer.on('close',()=>{
	peer.destroy();
	console.log("webrtc disconnect from",the_offer.id);
	connected_sockets[the_offer.id]=0;
	delete connected_peers[the_offer.id];
    });

});


let files_by_id = {} //store the files to be sent to id



function addDiv(id,ip){
    let peers_div=document.getElementById("peers");

    let the_div=document.createElement("div");
    the_div.setAttribute('id',id);
    the_div.className = "connected";
    let inside_div = document.createElement("div");
    inside_div.className="inside_connected";
    
    let input = document.createElement('input');
    input.type = "file";
    input.setAttribute('id',"input");
    inside_div.appendChild(input);
    let status_div = document.createElement("div");
    status_div.className  = "status_"+id;

    the_div.appendChild(inside_div);
    let the_ip = document.createElement('p');
    the_ip.innerHTML=ip;
    inside_div.appendChild(the_ip);
    inside_div.appendChild(status_div);
    peers_div.appendChild(the_div);
    input.addEventListener('change',()=>{ //trigered after user clicks on div
	
	const selectedFiles = input.files;
	files_by_id[id] = selectedFiles[0]; //store selected file by id

	console.log(connected_sockets);
	if(connected_sockets[id]==0){ //if div id not connected by webrtc send init request
	    
	    socket.emit('init',id);
	}
	
    });

    
    
	    
	
    the_div.addEventListener('click', ()=> { //when user click on a div to select file to send
	input.click();
	console.log(id,'clicked');
	
	
    });

    
    
}

function delDiv(id){

    let the_div=document.getElementById(id);
    the_div.remove();
}

