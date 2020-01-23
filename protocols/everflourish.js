/* jshint node:true */
'use strict';

const methods = {
	TELLSTICK_TURNON: 1,
	TELLSTICK_TURNOFF: 2,
	//TELLSTICK_BELL: 4,
	//TELLSTICK_TOGGLE: 8,
	//TELLSTICK_DIM: 16,
	TELLSTICK_LEARN: 32,
	//TELLSTICK_EXECUTE: 64,
	//TELLSTICK_UP: 128,
	//TELLSTICK_DOWN: 256,
	//TELLSTICK_STOP: 512
};

function getStringSelflearningForCode(intHouse, intCode, method) {
	var action = 0;
	switch(method) {
		case methods.TELLSTICK_TURNON:
			action = 15;
			break;
		case methods.TELLSTICK_TURNOFF:
			action = 0;
			break;
		case methods.TELLSTICK_LEARN:
			action = 10;
			break;
		default:
			throw(`Unsupported method "${method}" in getStringSelflearningForCode call.`);
	}
	intCode--;

	var ssss = 85;
	var sssl = 84;  // 0
	var slss = 69;  // 1

	var bits = [sssl, slss];
	
	var strCode = [
		'R'.charCodeAt(0), 5,
		'T'.charCodeAt(0), 114, 60, 1, 1, 105, ssss, ssss
	];

	intHouse = (intHouse << 2) | intCode;
	var check = calculateChecksum(intHouse);
	var i;

	for(i = 15; i >= 0; i--) {
		strCode.push(bits[(intHouse >> i)&0x01]);
	}
	for(i = 3; i >= 0; i--) {
		strCode.push(bits[(check >> i)&0x01]);
	}
	for(i = 3; i >= 0; i--) {
		strCode.push(bits[(action >> i)&0x01]);
	}

	strCode.push(ssss, '+'.charCodeAt(0));

	return Buffer.from(strCode);
}

// The calculation used in this function is provided by Frank Stevenson
function calculateChecksum(x) {
	var bits = Buffer.from([
		0xf, 0xa, 0x7, 0xe,
		0xf, 0xd, 0x9, 0x1,
		0x1, 0x2, 0x4, 0x8,
		0x3, 0x6, 0xc, 0xb
	]);
	var bit = 1;
	var res = 0x5;
	var i;
	var lo, hi;

	if((x & 0x3) == 3) {
		lo = x & 0x00ff;
		hi = x & 0xff00;
		lo += 4;
		if(lo>0x100) {
			lo = 0x12;
		}
		x = lo | hi;
	}

	for(i = 0; i < 16; i++) {
		if(x & bit) {
			res = res ^ bits[i];
		}
		bit = bit << 1;
	}

	return res;
}

function decodeData(allData) {
	var house = (allData & 0xFFFC00) >> 10;
	var unit = ((allData & 0x300) >> 8) + 1;
	var method = allData & 0xF;
	
	const methodsAvailable = {
		15: 'turnon',
		0: 'turnoff',
		10: 'learn'
	};

	if(house > 16383 || unit < 1 || unit > 4 || !methodsAvailable[method]) {
		// not everflourish
		console.error('Could not decode Everflourish:', allData, {
			class: 'command',
			protocol: 'everflourish',
			model: 'selflearning',
			house: house,
			unit: unit,
			method:	method
		});
		return {error: 'Could not decode'};
	}
	
	return {
		class: 'command',
		protocol: 'everflourish',
		model: 'selflearning',
		house: house,
		unit: unit,
		method:	methodsAvailable[method]
	};
}

function normalizeDeviceId(params) {
	return `everflourish/${params.house}/${params.unit}`;
}
function normalizeDevice(params) {
	var pubs = [];
	var device = {
		//group: params.house,
	};
	if(!params.group) {
		//device.unit = params.unit;
	}
	var deviceId = normalizeDeviceId(params);
	
	if(['turnon', 'turnoff', 'dim'].indexOf(params.method) > -1) {
		device.power = params.method == 'turnon' || (params.method == 'dim' && params.level > 0) ? 'on' : 'off';
		pubs.push({
			topic: deviceId + '/power',
			payload: params.method == 'turnon' || (params.method == 'dim' && params.level > 0) ? 'on' : 'off'
		});
	}

	/*if(params.method == 'dim') {
		pubs.push({
			topic: deviceId + '/brightness',
			payload: ~~params.level
		});
	}*/
	return pubs;
}
function updateDevice(topic, value) {
	// everflourish/1234/1/power/set, 1
	var [protocol, house, unit, prop] = topic.split('/');
	if(prop == 'set') {
		prop = unit;
		unit = null;
	}
	var params = {
		protocol: 'everflourish',
		model: 'selflearning',
		house: house,
		unit: unit
	};
	if(prop == 'brightness') {
		params.method = 'dim';
		params.level = value;
	}
	else if(prop == 'power') {
		params.method = value == 'on' || value == 1 ? 'turnon' : 'turnoff';
	}
	if(!params.method) {
		return false;
	}
	return params;
}

function getEverflourishCommand(params) {
	params = Object.assign(
		{
			repeat: 3
		},
		params||{},
		{
			class: 'command',
			protocol: 'everflourish'
		}
	);
	var defaultParams = {
		model: ['selflearning'],
		house: null,
		unit: null,
		method:	null,
	};

	Object.keys(defaultParams).forEach((key) => {
		if(typeof params[key] === 'undefined') {
			throw(`Missing parameter "${key}" in getEverflourishCommand call.`);
		}
		if(defaultParams[key] instanceof Array) {
			if(defaultParams[key].indexOf(params[key]) === -1) {
				throw(`Invalid value (${params[key]}) for parameter "${key}" in getEverflourishCommand call.`);
			}
			return true;
		}
	});

	var command = [];
	if(params.model === 'selflearning') {
		command = getStringSelflearningForCode(params.house, params.unit, params.method);
	}
	/*else if(params.model === 'codeswitch') {
		command = getStringCodeSwitch(params.house, params.unit, params.method);
	}*/
	//command.unshift('R'.charCodeAt(0), params.repeat);
	return Buffer.from(command);
}

module.exports = {
	decodeData: function(params) {
		console.log('decodeData', params);
		if(typeof params === 'string') {
			params = params.substr(params[0] === '+' ? 2 : 0).split(';').filter(p=>!!p).reduce((carry, param) => {
				var [key, val] = param.split(':');
				carry[key] = val;
				return carry; // selflearning
			}, {});
		}
		//if(params.model == 'selflearning') {
			return Object.assign(params, decodeData(parseInt(params.data.substr(2), 16)));
		//}
		/*else {
			// codeswitch
			return Object.assign(params, decodeDataCodeSwitch(parseInt(params.data.substr(2), 16)));
		}*/
	},
	getCommand: getEverflourishCommand,
	methods: methods,

	normalizeDevice: normalizeDevice,
	updateDevice: updateDevice
};

if(require.main === module) {
	console.log(getStringSelflearningForCode(117, 1, methods.TELLSTICK_TURNOFF));
	//console.log(getStringSelflearningForCode(117, 1, methods.TELLSTICK_LEARN));
	console.log(module.exports.decodeData('+Wprotocol:everflourish;data:0xC1D29C;'));
	process.exit();
	//console.log(module.exports.decodeData('+Wprotocol:arctech;model:selflearning;data:0x25A0009B;'));
	//console.log(getArctechCommand(module.exports.decodeData('+Wprotocol:arctech;model:selflearning;data:0x25A0009B;')));

	//console.log(getArctechCommand({model:'selflearning', house: 15402826, unit: 3, method: methods.TELLSTICK_TURNON, repeat:5}));
	//console.log(getArctechCommand({model:'codeswitch', house: 15402826, unit: 3, method: methods.TELLSTICK_TURNON, repeat:5}));

	var dev = {
		protocol: 'everflourish',
		model: 'selflearning',
		house: '15402826',
		unit: '3',
		repeat: 5,
		method: 'on'
	};
	var normDev = normalizeDevice(dev);
	console.log('Normalize:', normalizeDeviceId(dev), dev, normDev);

	console.log('Set power on:', updateDevice('everflourish/15402826/3/power/set', 1));
}
