var ftdi = require('ftdi'),
	fs = require('fs'),
	WebSocket = require('ws'),
	clients = [],
	protocols = {};

fs.readdirSync('./protocols/').forEach((protocolFile) => {
	console.log(protocolFile.substr(0, protocolFile.lastIndexOf('.')));
	protocols[protocolFile.substr(0, protocolFile.lastIndexOf('.'))] = require('./protocols/' + protocolFile);
});

console.log(protocols);

ftdi.find(0x1781, 0x0c31, function(err, devices) {
	if(err) {
		throw(err);
	}
	var td = new ftdi.FtdiDevice(devices[0]);
	console.log(td);

	var wss = new WebSocket.Server({port:1337});
	wss.on('connection', function connection(ws) {
		clients.push(ws);
	    ws.on('message', function incoming(msg) {
        	var data = JSON.parse(msg);
    	    console.log('received:', data);
			td.write(protocols['arctech'].getCommand(data), function(err) {
//	        td.write(protocols['arctech'].getStringSelflearningForCode(data.house, data.unit, data.command), function(err) {
        	    console.log('Device command sent', err);
    	    });
	    });
		ws.on('close', function incoming(msg) {
			clients.splice(clients.indexOf(ws), 1);
		});
	});
	

	buf = new Buffer([]);
	td.on('data', function(data) {
		buf = Buffer.concat([buf, data]);
		if(buf.indexOf(10) > -1) {
			var msg = Buffer.from(buf.slice(0, buf.indexOf(13)));
			buf = Buffer.from(buf.slice(buf.indexOf(10) + 1));
			//console.log(msg.toString('hex') + '    ' + buf.toString('hex'));

			switch(msg.slice(0, 2).toString()) {
				case '+V':
					console.log('Firmware version:', msg.slice(2).toString());
					break;
				case '+W':
					console.log('data', msg.toString());
					var params = {};
					msg.slice(2).toString().split(';').filter((keyval) => keyval.length != '')
						.forEach(function(keyval) { console.log(keyval);var tmp = keyval.split(':'); params[tmp[0]] = tmp[1]; });
					if(protocols[params.protocol]) {
						console.log(params.protocol, protocols[params.protocol].decodeData(params));
					}
					break;
				default:
					console.log('data', msg.toString(), msg.toString('hex'));
					break;
			}
		}
	});

	td.open({
		    baudrate: td.deviceSettings.productId == 0x0C31 ? 9600 : 4800,
    		databits: 8,
	    	stopbits: 1,
	    	parity: 'none'
		}, function(err) {
		if(err) {
			throw(err);
		}
		console.log(err, arguments);
	});
});
