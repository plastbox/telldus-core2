function normalizeDeviceId(params) {
	return `mandolyn/${params.house}/${params.channel}`;
}
function normalizeDevice(params) {
	var pubs = [];
	var deviceId = normalizeDeviceId(params);

	pubs.push({
		topic: deviceId + '/temperature',
		payload: params.temperature
	});
	pubs.push({
		topic: deviceId + '/humidity',
		payload: params.humidity
	});
	/*pubs.push({
		topic: deviceId + '/batteryOk',
		payload: ~~params.batteryOk
	});*/

	return pubs;
}


module.exports = {
	decodeData: function(params) {
		var tempAndParity = parseInt(params.data.substr(6), 16);
		var parity =  (tempAndParity & 0b0000000000000001);
		var temp   = ((tempAndParity & 0b1111111111111110) >> 1) / 128 - 50; 

		var humidityAndBattOk = parseInt(params.data.substr(4, 2), 16);
		var humidity  = (humidityAndBattOk & 0b01111111);
		var batteryOk = (humidityAndBattOk & 0b10000000) >> 8;

		var channelAndHouse = parseInt(params.data.substr(2, 2), 16);	
		var channel = ((channelAndHouse & 0b00001100) >> 2) + 1;
		var house =    (channelAndHouse & 0b11110000) >> 4;
		
		return Object.assign(params, {
			temperature: Math.round(temp * 100) / 100,
			humidity: humidity,
			batteryOk: batteryOk,
			channel: channel,
			house: house
		});
	},
	normalizeDeviceId: normalizeDeviceId,
	normalizeDevice: normalizeDevice
}

//module.exports.decodeData('+Wclass:sensor;protocol:mandolyn;model:temperaturehumidity;data:0x7F8E5043;');
