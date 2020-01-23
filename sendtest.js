const ftdi = require('../hello_world/hello.js');
const fs = require('fs');
const { Transform } = require('stream');

const protocols = fs.readdirSync('./protocols/').reduce((carry, protocolFile) => {
	//console.log(protocolFile.substr(0, protocolFile.lastIndexOf('.')));
	carry[protocolFile.substr(0, protocolFile.lastIndexOf('.'))] = require('./protocols/' + protocolFile);
	return carry;
}, {});

ftdi.find(0x1781, 0x0c31, function(err, devices) {
	if(err) {
		throw(err);
	}
	if(devices.length === 0)  {
		console.log('Tellstick not found.');
		process.exit();
	}
	var td = new ftdi.FtdiDevice(devices[0]);
	td.open({
		baudrate: td.deviceSettings.productId == 0x0C31 ? 9600 : 4800,
    		databits: 8,
	    	stopbits: 1,
	    	parity: 'none'
		}, function(err) {
		var static = protocols['everflourish'].getCommand(117, 1, methods.TELLSTICK_TURNON);
		console.log('Send static command:', static);
		td.write(Buffer.concat([static, Buffer.from([13, 10])]), function(err, bytesSent) {
			if(err) { throw err; }
    	console.log('Bytes sent:', bytesSent);
		});
		/*td.write(Buffer.from('V+'), function(err) {
			if(err) { throw err; }
			console.log('Version info requested');
		});*/
	});
});
