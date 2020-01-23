// var ftdi = require('../ftdi');
//var ftdi = require('../index');
var ftdi = require('ftdi');

var fs = require('fs'), protocols = {};





//var dataToWrite = [0x04, 0x00, 0x02, 0x79, 0x40];
fs.readdirSync('./protocols/').forEach((protocolFile) => {
        console.log('Protocol loaded:', protocolFile.substr(0, protocolFile.lastIndexOf('.'))); 
  	protocols[protocolFile.substr(0, protocolFile.lastIndexOf('.'))] = require('./protocols/' + protocolFile);
});

ftdi.find(0x1781, 0x0c31, function(status, devices) {
	if(devices.length > 0) {
		var device = new ftdi.FtdiDevice(devices[0]);
		loop(device);
	}
	else {
		console.log("No Device found");
	}
});
var buf = Buffer.alloc(0);
var loop = function(device) {
	device.on('error', function(error) {
		console.log("Error: " + error);
	});

	device.on('data', function(data) {
		console.log('Output: ', data.length, data.toString('hex'));
		buf = Buffer.concat([buf, data]);
		console.log('Buffer:', buf.toString('hex'));
		if(buf.indexOf(10) > -1) {
			var offset = 0;
			console.log('test', buf.indexOf(10));
//			buf = Buffer.from(buf.slice(buf.indexOf(10) + 1));
			while(buf.indexOf(0x2b, offset) > -1 && offset < 5) {
				var msg = Buffer.from(buf.slice(buf.indexOf(0x2b, offset), buf.indexOf(13)));
				console.log('Fragment:', msg.toString('utf8'));
				switch(msg.slice(0, 2).toString()) {
					case '+V':
						console.log('Firmware version:', msg.slice(2).toString());
						buf = Buffer.from(buf.slice(buf.indexOf(10) + 1))
						break;
					case '+W':
						console.log('data', msg.toString());
						var params = {}; 
						msg.slice(2).toString().split(';')
							.filter((keyval) => keyval.length != '')
							.forEach(function(keyval) {
								console.log(keyval);
								var tmp = keyval.split(':');
								params[tmp[0]] = tmp[1];
							}); 
						if(protocols[params.protocol]) {
							console.log(params.protocol, protocols[params.protocol].decodeData(params));
						}
						buf = Buffer.from(buf.slice(buf.indexOf(10) + 1))
						break;
					default:
						console.log('Default, data', msg.toString(), msg.toString('hex'));
						offset++;
						break;
				}
			}
		}


		device.close(function(status) {
			console.log("JS Close Device");
			//setTimeout(function() {loop(device);}, 5000);
			loop(device);
		});
	});

	device.open({
			baudrate: device.deviceSettings.productId == 0x0C31 ? 9600 : 4800,
			databits: 8,
			stopbits: 1,
			parity: 'none'
		}, function(status) {
			console.log("Connected..");
//			device.write(dataToWrite);
		});
}





// var device = ftdi.Ftdi();
// var devices = ftdi.find(0x18d9, 0x01a0, function() {});
// console.log( devices );

// device.on('data', function(data)
// {
// 	console.log('Output:');
// 	console.log( data );
// });

// if(devices.length > 0)
// {
// 	device.open(devices[0].serial);


// 	setInterval(function() 
// 	{
// 		device.write(dataToWrite);
// 	}, 2000);
// }
// else
// {
// 	console.log("No Device found");
// }

