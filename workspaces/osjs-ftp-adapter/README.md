<p align="center">
  <img alt="OS.js Logo" src="https://raw.githubusercontent.com/os-js/gfx/master/logo-big.png" />
</p>

[OS.js](https://www.os-js.org/) is an [open-source](https://raw.githubusercontent.com/os-js/OS.js/master/LICENSE) web desktop platform with a window manager, application APIs, GUI toolkit, filesystem abstractions and much more.

[![Support](https://img.shields.io/badge/patreon-support-orange.svg)](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)
[![Support](https://img.shields.io/badge/opencollective-donate-red.svg)](https://opencollective.com/osjs)
[![Donate](https://img.shields.io/badge/liberapay-donate-yellowgreen.svg)](https://liberapay.com/os-js/)
[![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://paypal.me/andersevenrud)
[![Community](https://img.shields.io/badge/join-community-green.svg)](https://community.os-js.org/)

# OS.js FTP VFS Adapter

This is the FTP VFS (Server) Adapter for OS.js.

**This is a work in progress**

## Installation

```
npm install @osjs/ftp-adapter
```

## Usage

In your `src/server/index.js` bootstrap file:

```
const ftpAdapter = require('@osjs/ftp-adapter');

osjs.register(VFSServiceProvider, {
  args: {
    adapters: {
      ftp: ftpAdapter
    }
  }
});
```

Then create a mountpoint in your configuration files:

```
// src/server/config.js
{
  vfs: {
    mountpoints: [{
      name: 'myftp',
      adapter: 'ftp',
      attributes: {
        connection: {
          host: 'localhost',
          user: 'osjs',
          password: 'osjs',
          secure: false
        }
      }
     }]
   }
}

// src/client/config.js
{
  vfs: {
    mountpoints: [{
      name: 'myftp',
      label: 'My FTP Drive'
     }]
   }
}
```

*At some point users can create their own server mounts via the client*.

## Contribution

* **Sponsor on [Github](https://github.com/sponsors/andersevenrud)**
* **Become a [Patreon](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)**
* **Support on [Open Collective](https://opencollective.com/osjs)**
* [Contribution Guide](https://github.com/os-js/OS.js/blob/master/CONTRIBUTING.md)

## Documentation

See the [Official Manuals](https://manual.os-js.org/) for articles, tutorials and guides.

## Links

* [Official Chat](https://gitter.im/os-js/OS.js)
* [Community Forums and Announcements](https://community.os-js.org/)
* [Homepage](https://os-js.org/)
* [Twitter](https://twitter.com/osjsorg) ([author](https://twitter.com/andersevenrud))
* [Google+](https://plus.google.com/b/113399210633478618934/113399210633478618934)
* [Facebook](https://www.facebook.com/os.js.org)
* [Docker Hub](https://hub.docker.com/u/osjs/)
