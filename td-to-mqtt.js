const ftdi = require('../hello_world/hello.js');
const fs = require('fs'); 
const { Transform } = require('stream');
var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://localhost');
var delegatedOut = null;

const state2method = {
	on: 'turnon',
	off: 'turnoff',
	dim: 'dim'
}

const protocols = {};

fs.readdirSync('./protocols/').forEach((protocolFile) => {
	//console.log(protocolFile.substr(0, protocolFile.lastIndexOf('.')));
	protocols[protocolFile.substr(0, protocolFile.lastIndexOf('.'))] = require('./protocols/' + protocolFile);
});

ftdi.find(0x1781, 0x0c31, function(err, devices) {
	if(err) {
		throw(err);
	}
	if(devices.length === 0)        {
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
						break;
					case '+T':
						if(delegatedOut) {
							client.publish(delegatedOut.topic, typeof delegatedOut.payload === 'object' ? JSON.stringify(delegatedOut.payload) : delegatedOut.payload, {
								retain: true,
								//qos: 1
							});
							delegatedOut = null;
						}
						break;
					case '+W':
              var params = msg.slice(2).toString().split(';').filter(p=>!!p).reduce((carry, param) => {
							var [key, val] = param.split(':');
							carry[key] = val;
							return carry;
						}, {});
						if(protocols[params.protocol]) {
							//console.log(params.protocol, protocols[params.protocol].decodeData(params));
							var parsed = protocols[params.protocol].decodeData(params);
							this.push(JSON.stringify(parsed) + "\n");
							if(protocols[params.protocol].normalizeDevice) {
								protocols[params.protocol].normalizeDevice(params).forEach(pub => {
									console.log('Publish:', 'tellstick/' + pub.topic, typeof pub.payload === 'object' ? JSON.stringify(pub.payload) : pub.payload);
									client.publish('tellstick/' + pub.topic, typeof pub.payload === 'object' ? JSON.stringify(pub.payload) : ''+pub.payload, {
										retain: true,
										//qos: 1
									});
								});
							}
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
		client.on('connect', function() {
			client.subscribe('tellstick/+/+/+/+/set', function(err) {
				if(err) { throw err; };
				console.log('Subscribed to tellstick/<protocol>/<group>/<unit>/<property>/set');
			});
			client.subscribe('tellstick/+/+/+/set', function(err) {
				if(err) { throw err; };
				console.log('Subscribed to tellstick/<protocol>/<group>/<property>/set');
			});
		});

		client.on('message', function (topic, message) {
			message = message.toString();
			console.log('message:', topic, message);
			var [root, protocol, group, unit, prop, path] = topic.split('/');
			if(prop == 'set') {
				prop = unit;
				unit = null;
			}
			console.log('Params', root, protocol, group, unit, prop, path);
			if(protocols[protocol] && protocols[protocol].updateDevice) {
				var obj = protocols[protocol].updateDevice(topic.slice(10), message);
				console.log('updateDevice:', obj);
				if(obj) {
					var out = protocols[protocol].getCommand(obj);
					delegatedOut = {
						topic: topic.slice(0, -4),
						payload: message
					};
					console.log('Delegate:', delegatedOut);

					out = Buffer.concat([out, Buffer.from([13, 10])]);

					td.write(out, function(err) {
						if(err) { throw err; }
					});
				}
			}
			//client.end()
		});
	});
});

