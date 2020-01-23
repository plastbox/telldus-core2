const methods = {
	TELLSTICK_TURNON: 1,
	TELLSTICK_TURNOFF: 2,
	TELLSTICK_BELL: 4,
	TELLSTICK_TOGGLE: 8,
	TELLSTICK_DIM: 16,
	TELLSTICK_LEARN: 32,
	TELLSTICK_EXECUTE: 64,
	TELLSTICK_UP: 128,
	TELLSTICK_DOWN: 256,
	TELLSTICK_STOP: 512
};

function normalizeDeviceId(params) {
	return `arctech/${params.house}${params.unit && !params.group ? '/' + params.unit : ''}`;
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

	if(params.method == 'dim') {
		pubs.push({
			topic: deviceId + '/brightness',
			payload: ~~params.level
		});
	}
	return pubs;
}
function updateDevice(topic, value) {
	// arctech/1234/power/set, 1
	// arctech/1234/1/power/set, 1
	var [protocol, house, unit, prop] = topic.split('/');
	if(prop == 'set') {
		prop = unit;
		unit = null;
	}
	var params = {
		protocol: 'arctech',
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


function decodeDataSelfLearning(allData) {
	var house = 0,
		unit = 0,
		group = 0,
		method = 0,
		methodsAvailable = ['turnoff', 'turnon'];

	//house = allData & 0xFFFFFFC0;
	house = allData	& 0b11111111111111111111111111000000;
	house >>= 6;

	//group = allData & 0x20;
	group = allData	& 0b00100000;
	group >>= 5;

	//method = allData & 0x10;
	method = allData & 0b00010000;
	method >>= 4;

	//unit = allData & 0xF;
	unit = allData	& 0b00001111;
	unit++;

	if(house < 1 || house > 67108863 || unit < 1 || unit > 16 || typeof methodsAvailable[method] === 'undefined') {
		// not arctech selflearning
		return {error: 'Could not decode'};
	}

	return {
		class: 'command',
		protocol: 'arctech',
		model: 'selflearning',
		house: house,
		unit: unit,
		group: group,
		method:	methodsAvailable[method]
	};
}

function decodeDataCodeSwitch(allData) {
	var house = 0,
		unit = 0,
		method = 0,
		methodsAvailable = {
			6: 'turnoff',
			14: 'turnon',
			15: 'bell'
		};
	
	//house = allData & 0xF;
	house = allData		& 0b0000000000001111;

	//unit = allData & 0xF0;
	unit = allData		& 0b0000000011110000;
	unit >>= 4;
	unit++;

	//method = allData & 0xF00;
	method = allData	& 0b0000111100000000;
	method >>= 8;

	if(typeof methodsAvailable[method] === 'undefined') {
		// not arctech codeswitch
		return {error: 'Could not decode'};
	}

	return {
		class: 'command',
		protocol: 'arctech',
		model: 'codeswitch',
		house: String.fromCharCode(65 + house),
		unit: unit,
		method: methodsAvailable[method]
	};
}

function getStringSelflearningForCode(intHouse, intCode, method, level) {
	var arrMessage = ['T'.charCodeAt(0), 127, 255, 24, 1];
	//var arrMessage = ['T'.charCodeAt(0), 135, 255, 28, 1];
	// const char START[] = {'T',130,255,26,24,0};
	if(intCode !== null) {
		intCode--;
	}
	if(typeof method === 'string') {
		method = methods['TELLSTICK_' + method.toUpperCase()];
	}
	arrMessage.push(method == methods.TELLSTICK_DIM ? 147 : 132);  // Number of pulses

	var m = '';
	var i;
	for(i = 25; i >= 0; --i) {
		m += ( intHouse & 1 << i ? '10' : '01' );
	}
	if(intCode !== null) {
		m += '01';  // Not group
	}
	else {
		m += '10';  // Group
	}

	// On/off
	if(method == methods.TELLSTICK_DIM) {
		m += '00';
	}
	else if(method == methods.TELLSTICK_TURNOFF) {
		m += '01';
	}
	else if(method == methods.TELLSTICK_TURNON) {
		m += '10';
	}else {
		return [];
	}

	for(i = 3; i >= 0; --i) {
		m += ( intCode & 1 << i ? '10' : '01' );
	}

	if(method == methods.TELLSTICK_DIM) {
		var newLevel = level / 16;
		for(i = 3; i >= 0; --i) {
			m += (newLevel & 1 << i ? '10' : '01');
		}
	}

	// The number of data is odd.
	// Add this to make it even, otherwise the following loop will not work
	m += '0';
	var code = 9;  // b1001, startcode
	for(i = 0; i < m.length; ++i) {
		code <<= 4;
		if(m[i] == '1') {
			code |= 8;  // b1000
		}
		else {
			code |= 10;  // b1010
		}
		if(i % 2 == 0) {
			arrMessage.push(code);
			code = 0;
		}
	}
	arrMessage.push('+'.charCodeAt(0));

	return arrMessage;
}

function getCodeSwitchTuple(intCode) {
	var strReturn = '';
	for( var i = 0; i < 4; ++i ) {
		if (intCode & 1) {  // Convert 1
			strReturn += '$kk$';
		}
		else {  // Convert 0
			strReturn+= '$k$k';
		}
		intCode >>= 1;
	}
	return strReturn;
}
function getStringCodeSwitch(intHouse, intCode, method) {
	var strReturn = 'S';

	if(method == methods.TELLSTICK_BELL && intCode === null) {
		intCode = 7; // According to the telldus-core source code, a bell command is always sent to unit 7. Go figure.
	}
	strReturn += getCodeSwitchTuple(intHouse);
	strReturn += getCodeSwitchTuple(0);//getIntParameter(intUnit, 1, 16));

	if (method == methods.TELLSTICK_TURNON) {
		strReturn += '$k$k$kk$$kk$$kk$$k+';
	}
	else if (method == methods.TELLSTICK_TURNOFF) {
		strReturn += '$k$k$kk$$kk$$k$k$k+';
	}
	else if (method == methods.TELLSTICK_BELL) {
		strReturn += '$kk$$kk$$kk$$kk$$k+';
	}
	
	else {
		return "";
	}
	return strReturn.split('');
}

function getArctechCommand(params) {
	params = Object.assign(
		{
			repeat: 3
		},
		params||{},
		{
			class: 'command',
			protocol: 'arctech'
		}
	);
	var defaultParams = {
		model: ['codeswitch', 'selflearning'],
		house: null,
		unit: null,
		method:	null,
	};

	Object.keys(defaultParams).forEach((key) => {
		if(typeof params[key] === 'undefined') {
			throw(`Missing parameter "${key}" in getArctechCommand call.`);
		}
		if(defaultParams[key] instanceof Array) {
			if(defaultParams[key].indexOf(params[key]) === -1) {
				throw(`Invalid value (${params[key]}) for parameter "${key}" in getArctechCommand call.`);
			}
			return true;
		}
	});

	var command = [];
	if(params.model === 'selflearning') {
		command = getStringSelflearningForCode(params.house, params.unit, params.method, params.level);
	}
	else if(params.model === 'codeswitch') {
		command = getStringCodeSwitch(params.house, params.unit, params.method);
	}
	//command.unshift('R'.charCodeAt(0), params.repeat);
	return Buffer.from(command);
}

module.exports = {
	decodeData: function(params) {
		if(typeof params === 'string') {
			params = params.substr(params[0] === '+' ? 2 : 0).split(';').filter(p=>!!p).reduce((carry, param) => {
				var [key, val] = param.split(':');
				carry[key] = val;
				return carry; // selflearning
			}, {});
		}
		if(params.model == 'selflearning') {
			return Object.assign(params, decodeDataSelfLearning(parseInt(params.data.substr(2), 16)));
		}
		else {
			// codeswitch
			return Object.assign(params, decodeDataCodeSwitch(parseInt(params.data.substr(2), 16)));
		}
	},
	getCommand: getArctechCommand,
	methods: methods,

	normalizeDevice: normalizeDevice,
	updateDevice: updateDevice
};

if(require.main === module) {
	console.log(Buffer.from(getStringSelflearningForCode(117, 1, methods.TELLSTICK_TURNON)));
	process.exit();

	//console.log(module.exports.decodeData('+Wprotocol:arctech;model:selflearning;data:0x25A0009B;'));
	//console.log(getArctechCommand(module.exports.decodeData('+Wprotocol:arctech;model:selflearning;data:0x25A0009B;')));

	//console.log(getArctechCommand({model:'selflearning', house: 15402826, unit: 3, method: methods.TELLSTICK_TURNON, repeat:5}));
	//console.log(getArctechCommand({model:'codeswitch', house: 15402826, unit: 3, method: methods.TELLSTICK_TURNON, repeat:5}));

	var dev = {
		protocol: 'arctech',
		model: 'selflearning',
		house: '15402826',
		unit: '3',
		level: '242',
		repeat: 5,
		method: 'dim'
	};
	var normDev = normalizeDevice(dev);
	console.log('Normalize:', normalizeDeviceId(dev), dev, normDev);

	console.log('Set power on:', updateDevice('arctech/15402826/3/power/set', 1));
	console.log('Set dim 127:', updateDevice('arctech/15402826/3/brightness/set', 127));
	console.log('Set dim 0:', updateDevice('arctech/15402826/3/brightness/set', 0));


	var grp = {
		protocol: 'arctech',
		model: 'selflearning',
		house: '15402826',
		group: 1,
		level: '242',
		repeat: 5,
		method: 'dim'
	};
	var normGrp = normalizeDevice(grp)
	console.log('Normalize:', normalizeDeviceId(grp), grp, normalizeDevice(grp));
}
