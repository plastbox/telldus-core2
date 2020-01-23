const ftdi = require('../hello_world/hello.js');
const fs = require('fs');
const { Transform } = require('stream');
const protocols = {};

fs.readdirSync('./protocols/').forEach((protocolFile) => {
	//console.log(protocolFile.substr(0, protocolFile.lastIndexOf('.')));
	protocols[protocolFile.substr(0, protocolFile.lastIndexOf('.'))] = require('./protocols/' + protocolFile);
});

ftdi.find(0x1781, 0x0c31, function(err, devices) {
	if(err) {
		throw(err);
	}
	if(devices.length === 0)  {
		console.log('Tellstick not found.');
		process.exit();
	}
	var td = new ftdi.FtdiDevice(devices[0]);
	var buf = Buffer.alloc(0);

	td.createReadStream()
		.pipe(require('binary-split')("\r\n"))
		.pipe(new Transform({
			transform(msg, encoding, next) {
				switch(msg.slice(0, 2).toString()) {
					case '+V':
						console.log('Firmware version:', msg.slice(2).toString());
						/*var static = Buffer.concat([
							Buffer.from('T'),
							Buffer.from('7F FF 18 01 84 9A 8A 88 A8 A8 AA 88 AA 88 A8 AA 8A 8A 8A 8A 88 A8 A8 AA 88 AA 8A 88 AA 88 AA 8A 88 AA 8A 88 AA 8A'.replace(/ /g, ''), 'hex'),
							Buffer.from('+')
						]);
						console.log('Send static command:', static.toString('hex'));
						setTimeout(() => {
							td.write(static, function(err) {
								if(err) { throw err; }
				      	console.log('Command sent');
							});
						}, 500);*/
						break;
					case '+W':
						var params = msg.slice(2).toString().split(';').filter(p=>!!p).reduce((carry, param) => {
							var [key, val] = param.split(':');
							carry[key] = val;
							return carry;
						}, {});
						if(protocols[params.protocol]) {
							//console.log(params.protocol, protocols[params.protocol].decodeData(params));
							this.push(JSON.stringify(protocols[params.protocol].decodeData(params)) + "\n");
						}
						else {
							console.log('No parser available', params);
						}
						break;
					default:
						console.log('data', msg.toString(), msg.toString('hex'));
						break;
				}
				next();
			}
		})).pipe(process.stdout);

	td.open({
		baudrate: td.deviceSettings.productId == 0x0C31 ? 9600 : 4800,
    		databits: 8,
	    	stopbits: 1,
	    	parity: 'none'
		}, function(err) {
		td.write(Buffer.from('V+'), function(err) {
			if(err) { throw err; }
			console.log('Version info requested');
		});
		
/*		var lastMethod;
		setInterval(() => {
			if(lastMethod == protocols['arctech'].methods.TELLSTICK_TURNOFF) {
				lastMethod = protocols['arctech'].methods.TELLSTICK_TURNON;
			}
			else {
				lastMethod = protocols['arctech'].methods.TELLSTICK_TURNOFF;
			}
			var out = protocols['arctech'].getCommand({model:'selflearning', house: 15402826, unit: null, method: lastMethod, repeat:5});
			out = Buffer.concat([out, Buffer.from([13, 10])]);
			console.log('Sending:', out);
			td.write(out, function(err) {
				console.log('Device command sent', err);
			});
		}, 2000);*/
	});
});
