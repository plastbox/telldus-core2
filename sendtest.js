const ftdi = require('../hello_world/hello.js');
const fs = require('fs');
const { Transform } = require('stream');

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
		var static = Buffer.from('54 7F FF 18 01 84 9A 8A 88 A8 A8 AA 88 AA 88 A8 AA 8A 8A 8A 8A 88 A8 A8 AA 88 AA 8A 88 AA 88 AA 8A 88 AA 8A 88 AA 8A 2B'.replace(/ /g, ''), 'hex');
		console.log('Send static command:', static);
		td.write(static, function(err, bytesSent) {
			if(err) { throw err; }
    	console.log('Bytes sent:', bytesSent);
		});
		/*td.write(Buffer.from('V+'), function(err) {
			if(err) { throw err; }
			console.log('Version info requested');
		});*/
	});
});
