var ftdi = require('../hello_world/hello.js'),
	fs = require('fs'),
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
	console.log('Devices:', devices);
	if(devices.length === 0)  {
		console.log('Tellstick not found.');
		process.exit();
	}
	var td = new ftdi.FtdiDevice(devices[0]);
	console.log(td);
	var buf = Buffer.alloc(0);
	td.open({
		baudrate: td.deviceSettings.productId == 0x0C31 ? 9600 : 4800,
    		databits: 8,
	    	stopbits: 1,
	    	parity: 'none'
		}, function(err) {
		console.log('Open:', err, arguments);

		var sub = td.on('data', function(data) {
			//console.log('Received:', data.toString('hex'));
			buf = Buffer.concat([buf, data]);
			if(buf.indexOf(10) > -1) {
				var msg = Buffer.from(buf.slice(0, buf.indexOf(13)));
				buf = Buffer.from(buf.slice(buf.indexOf(10) + 1));
				console.log('Processing:', msg.toString());

				switch(msg.slice(0, 2).toString()) {
					case '+V':
						console.log('Firmware version:', msg.slice(2).toString());
						break;
					case '+W':
						var params = {};
						msg.slice(2)
							.toString()
							.split(';')
							.filter((keyval) => keyval.length != '')
							.forEach(function(keyval) {
								var tmp = keyval.split(':');
								params[tmp[0]] = tmp[1];
						});
						if(protocols[params.protocol]) {
							console.log(params.protocol, protocols[params.protocol].decodeData(params));
						}
						else {
							console.log('No parser available', params);
						}
						break;
					default:
						console.log('data', msg.toString(), msg.toString('hex'));
						break;
				}
			}
		});

		td.write(Buffer.from('V+'), function(err) {
			console.log('Version info requested', err);
		});
		td.write(Buffer.from('D+'), function(err) {
			console.log('Debug requested', err);
		});
		//console.log(protocols['arctech'].getStringSelflearningForCode(15402826, 3, 1));
//		var c=1, t=300;
//		td.write(protocols['arctech'].getCommand({model:'selflearning', house: 15402826, unit: null, method: protocols['arctech'].methods.TELLSTICK_TURNOFF, repeat:5}), function(err) {
//			console.log('Device command sent', err);
			/*setTimeout(() => {
				td.write(protocols['arctech'].getStringSelflearningForCode(15402826, 1, c), function(err) {
					console.log('Device command sent', err);
					setTimeout(() => {
						td.write(protocols['arctech'].getStringSelflearningForCode(15402826, 2, c), function(err) {
							console.log('Device command sent', err);
							setTimeout(() => {
								td.write(protocols['arctech'].getStringSelflearningForCode(15402826, 3, c), function(err) {
									console.log('Device command sent', err);
								});
							}, t);
						});
					}, t);
				});
			}, t);*/
//		});
	});
});
