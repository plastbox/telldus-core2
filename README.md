# telldus-core2
Replacement service for telldus-core

## Prerequisites:

This project requires a working FTDI-driver. Follow the instructions on getting [node-ftdi](https://github.com/thomaschaaf/node-ftdi/) up and running.

## What
The aim of this project is to replace [telldus-core](https://github.com/telldus/telldus) with a service providing a simple and concise interface for the [Tellstick Classic](http://telldus.se/produkt/tellstick-classic-gateway-433mhz/) and [Tellstick Duo](http://telldus.se/produkt/tellstick-duo/) products.

Most likely, the interface will be TCP/IP, with data exchanged as [ndjson](http://ndjson.org/) (with each package being a "line"). How the objects will look will depend on the unit with which the Tellstick is communicating.

For example, turning off a Nexa switch (which uses the Arctech protocol) might cause the following to be sent to all connected TCP clients:
```nodejs
{
	protocol: 'arctech',
	model: 'selflearning',
	house: 15492321,
	unit: 2,
	method: 2 // Corresponding to the TELLSTICK_TURNOFF method
}
```

The same object can be sent the other way, from the TCP clients to the server, to send the corresponding RF command (f.ex. to turn something on):
```nodejs
{
	protocol: 'arctech',
	model: 'selflearning',
	house: 15492321,
	unit: 2,
	method: 1, // Corresponding to the TELLSTICK_TURNON method
	repeat: 5 // The number of times to repeat the package
}
```

Data from temperature and humidity sensors (like those sold at Clas Ohlson) speaking the Mandolyn protocol will appear as follows:
```nodejs
{
	class: 'sensor',
	protocol: 'mandolyn',
	model: 'temperaturehumidity',
	data: '0x7F8E4AB8',
	temperature: 24.72,
	humidity: 14,
	batteryOk: 1,
	channel: 4,
	house: 7
}
```

## Why

This project came about because Tellstick Classic/Duo are older products which Telldus has been less-than-amazing at providing documentation and feedback for (beyond an outdated wiki and a source code dump). The main software, telldus-core, hasn't received any updates since 2013 despite the products relying on it still being sold. In my opinion, it also fails at separation-of-concerns, rolling package transmission, interfacing, and device management into the same piece of software.

Regardless, I want a 433MHz tranceiver controlled by locally hosted software. The Tellstick Duo is exactly that, it just needs better software.

## Todo:

### Core:
- Settle on package exchange format
- Implement protocol logic from [telldus-core/service](https://github.com/telldus/telldus/tree/master/telldus-core/service)
  - Brateck
  - Comen
  - Everflourish
  - Fineoffset
  - Fuhaote
  - Group
  - Hasta
  - Ikea
  - ~~Mandolyn~~
  - ~~Arctech (referred to as Nexa by Telldus)~~
  - Oregon
  - RisingSun
  - Sartano
  - Scene
  - SilvanChip
  - Upm
  - Waveman
  - X10
  - Yidong
- Implement simple TCP/IP [ndjson](http://ndjson.org/) interface
- Possibly implement auto-discovery using mdns

### "tdtool" / tdcat
The original software has a command line utility called tdtool which allows for listing of and sending commands to registred devices. As telldus-core2 won't include device management, a simple cli tool to talk to auto-discovered instances of telldus-core2 might be included, modelled after the inspired [wscat](https://github.com/websockets/wscat).
```
tdcat
Connected to 127.0.0.1:5234
Connected to 192.168.10.231:5234
< {"controller":"A6WQ3CU3","class":"sensor","protocol":"mandolyn","model":"temperaturehumidity","data":"0x7F8E4AB8","temperature":24.72,"humidity":14,"batteryOk":1,"channel":4,"house":7}
> {"controller":"A6WQ3CU3","protocol":"arctech","model":"selflearning","house":15492321,"unit":2,"method":1,"repeat":5}
...etc
```


## Disclaimer:
This software is in no way affiliated with Telldus, Proove, or any other commercial entity.
