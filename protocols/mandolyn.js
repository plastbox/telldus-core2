module.exports = {
	decodeData: function(params) {

		var value = parseInt(params.data.substr(2), 16);
		value >>= 1;
		
		var temp = Math.round(((value & 0x7FFF) - 6400) / 128 * 100) / 100;
		value >>= 15;
		
		var humidity = (value & 0x7F);
		value >>= 7;

		var battOk = value & 0x1;
		value >>= 3;

		var channel = (value & 0x3)+1;
		value >>= 2;

		var house = value & 0xF;
		
		return Object.assign(params, {
			temperature: temp,
			humidity: humidity,
			batteryOk: battOk,
			channel: channel,
			house: house
		});
	}
}

//module.exports.decodeData('+Wclass:sensor;protocol:mandolyn;model:temperaturehumidity;data:0x7F8E5043;');
