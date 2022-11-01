/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @license Simplified BSD License
 */

import Application from './application';
import Websocket from './websocket';
import Splash from './splash';
import {CoreBase} from '@osjs/common';
import {defaultConfiguration} from './config';
import {fetch} from './utils/fetch';
import {urlResolver} from './utils/url';
import logger from './logger';

/**
 * @callback SplashCallback
 * @param {Core} core
 * @return {Splash}
 */

/**
 * User Data
 * @typedef {Object} CoreUserData
 * @property {string} username
 * @property {number} [id]
 * @property {string[]} [groups=[]]
 */

/**
 * Core Options
 *
 * @typedef {Object} CoreOptions
 * @property {Element} [root] The root DOM element for elements
 * @property {Element} [resourceRoot] The root DOM element for resources
 * @property {String[]} [classNames] List of class names to apply to root dom element
 * @property {SplashCallback|Splash} [splash] Custom callback function for creating splash screen
 */

/*
 * Core Open File Options
 *
 * @typedef {Object} CoreOpenOptions
 * @property {boolean} [useDefault] Use saved default application preference
 * @property {boolean} [forceDialog] Force application choice dialog on multiple choices
 */

/**
 * Main Core class for OS.js service providers and bootstrapping.
 */
export default class Core extends CoreBase {

  /**
   * Create core instance
   * @param {CoreConfig} [config={}] Configuration tree
   * @param {CoreOptions} [options={}] Options
   */
  constructor(config = {}, options = {}) {
    options = {
      classNames: ['osjs-root'],
      root: document.body,
      ...options || {}
    };

    super(defaultConfiguration, config, options);

    const $contents = document.createElement('div');
    $contents.className = 'osjs-contents';

    this.logger = logger;

    /**
     * Websocket connection
     * @type {Websocket}
     */
    this.ws = null;

    /**
     * Ping (stay alive) interval
     * @type {number}
     */
    this.ping = null;

    /**
     * Splash instance
     * @type {Splash}
     * @readonly
     */
    this.splash = options.splash ? options.splash(this) : new Splash(this);

    /**
     * Main DOM element
     * @type {Element}
     * @readonly
     */
    this.$root = options.root;

    /**
     * Windows etc DOM element
     * @type {Element}
     * @readonly
     */
    this.$contents = $contents;

    /**
     * Resource script container DOM element
     * @type {Element}
     * @readonly
     */
    this.$resourceRoot = options.resourceRoot || document.querySelector('head');

    /**
     * Default fetch request options
     * @type {Object}
     */
    this.requestOptions = {};

    /**
     * Url Resolver
     * TODO: typedef
     * @type {function(): string}
     * @readonly
     */
    this.urlResolver = urlResolver(this.configuration);

    /**
     * Current user data
     * @type {CoreUserData}
     * @readonly
     */
    this.user = this.config('auth.defaultUserData');

    this.options.classNames.forEach(n => this.$root.classList.add(n));

    const {uri} = this.configuration.ws;
    if (!uri.match(/^wss?:/)) {
      const {protocol, host} = window.location;

      this.configuration.ws.uri = protocol.replace(/^http/, 'ws') + '//' + host + uri.replace(/^\/+/, '/');
    }

    this.splash.init();
  }

  /**
   * Destroy core instance
   * @return {boolean}
   */
  destroy() {
    if (this.destroyed) {
      return Promise.resolve();
    }

    this.emit('osjs/core:destroy');

    this.ping = clearInterval(this.ping);

    Application.destroyAll();

    if (this.ws) {
      this.ws.close();
    }

    if (this.$contents) {
      this.$contents.remove();
      this.$contents = undefined;
    }

    this.user = this.config('auth.defaultUserData');
    this.ws = null;
    this.ping = null;

    return super.destroy();
  }

  /**
   * Boots up OS.js
   * @return {Promise<boolean>}
   */
  boot() {
    const done = e => {
      if (e) {
        logger.error('Error while booting', e);
      }

      console.groupEnd();

      return this.start();
    };

    if (this.booted) {
      return Promise.resolve(false);
    }

    console.group('Core::boot()');

    this.$root.appendChild(this.$contents);
    this._attachEvents();
    this.emit('osjs/core:boot');

    return super.boot()
      .then(() => {
        this.emit('osjs/core:booted');

        if (this.has('osjs/auth')) {
          return this.make('osjs/auth').show(user => {
            const defaultData = this.config('auth.defaultUserData');
            this.user = {
              ...defaultData,
              ...user
            };

            if (this.has('osjs/settings')) {
              this.make('osjs/settings').load()
                .then(() => done())
                .catch(() => done());
            } else {
              done();
            }
          });
        } else {
          logger.debug('OS.js STARTED WITHOUT ANY AUTHENTICATION');
        }

        return done();
      }).catch(done);
  }

  /**
   * Starts all core services
   * @return {Promise<boolean>}
   */
  start() {
    const connect = () => new Promise((resolve, reject) => {
      try {
        const valid = this._createConnection(error => error ? reject(error) : resolve());
        if (valid === false) {
          // We can skip the connection
          resolve();
        }
      } catch (e) {
        reject(e);
      }
    });

    const done = (err) => {
      this.emit('osjs/core:started');

      if (err) {
        logger.warn('Error while starting', err);
      }

      console.groupEnd();

      return !err;
    };

    if (this.started) {
      return Promise.resolve(false);
    }

    console.group('Core::start()');

    this.emit('osjs/core:start');

    this._createListeners();

    return super.start()
      .then(result => {
        console.groupEnd();

        if (result) {
          return connect()
            .then(() => done())
            .catch(err => done(err));
        }

        return false;
      }).catch(done);
  }

  /**
   * Attaches some internal events
   * @private
   */
  _attachEvents() {
    // Attaches sounds for certain events
    this.on('osjs/core:started', () => {
      if (this.has('osjs/sounds')) {
        this.make('osjs/sounds').play('service-login');
      }
    });

    this.on('osjs/core:destroy', () => {
      if (this.has('osjs/sounds')) {
        this.make('osjs/sounds').play('service-logout');
      }
    });

    // Forwards messages to an application from internal websocket
    this.on('osjs/application:socket:message', ({pid, args}) => {
      const found = Application.getApplications()
        .find(proc => proc && proc.pid === pid);

      if (found) {
        found.emit('ws:message', ...args);
      }
    });

    // Sets up a server ping
    this.on('osjs/core:connected', config => {
      const enabled = this.config('http.ping');

      if (enabled) {
        const pingTime = typeof enabled === 'number'
          ? enabled
          : (30 * 60 * 1000);

        this.ping = setInterval(() => {
          if (this.ws) {
            if (this.ws.connected && !this.ws.reconnecting) {
              this.request('/ping').catch(e => logger.warn('Error on ping', e));
            }
          }
        }, pingTime);
      }
    });

    const updateRootLocale = () => {
      try {
        const s = this.make('osjs/settings');
        const l = s.get('osjs/locale', 'language');
        this.$root.setAttribute('data-locale', l);
      } catch (e) {
        console.warn(e);
      }
    };

    this.on('osjs/locale:change', updateRootLocale);
    this.on('osjs/settings:load', updateRootLocale);
    this.on('osjs/settings:save', updateRootLocale);
  }

  /**
   * Creates the main connection to server
   *
   * @private
   * @param {Function} cb Callback function
   * @return {boolean}
   */
  _createConnection(cb) {
    if (this.configuration.standalone || this.configuration.ws.disabled) {
      return false;
    }

    const {uri} = this.config('ws');
    let wasConnected = false;

    logger.debug('Creating websocket connection on', uri);

    this.ws = new Websocket('CoreSocket', uri, {
      interval: this.config('ws.connectInterval', 1000)
    });

    this.ws.once('connected', () => {
      // Allow for some grace-time in case we close prematurely
      setTimeout(() => {
        wasConnected = true;
        cb();
      }, 100);
    });

    this.ws.on('connected', (ev, reconnected) => {
      this.emit('osjs/core:connect', ev, reconnected);
    });

    this.ws.once('failed', ev => {
      if (!wasConnected) {
        cb(new Error('Connection closed'));
        this.emit('osjs/core:connection-failed', ev);
      }
    });

    this.ws.on('disconnected', ev => {
      this.emit('osjs/core:disconnect', ev);
    });

    this.ws.on('message', ev => {
      try {
        const data = JSON.parse(ev.data);
        const params = data.params || [];
        this.emit(data.name, ...params);
      } catch (e) {
        logger.warn('Exception on websocket message', e);
      }
    });

    return true;
  }

  /**
   * Creates event listeners*
   * @private
   */
  _createListeners() {
    const handle = data => {
      const {pid, wid, args} = data;

      const proc = Application.getApplications()
        .find(p => p.pid === pid);

      const win = proc
        ? proc.windows.find(w => w.wid === wid)
        : null;

      if (win) {
        win.emit('iframe:get', ...(args || []));
      }
    };

    window.addEventListener('message', ev => {
      const message = ev.data || {};
      if (message && message.name === 'osjs/iframe:message') {
        handle(...(message.params || []));
      }
    });
  }

  /**
   * Creates an URL based on configured public path
   *
   * If you give a options.type, the URL will be resolved
   * to the correct resource.
   *
   * @param {string} [endpoint=/] Endpoint
   * @param {object} [options] Additional options for resolving url
   * @param {boolean} [options.prefix=false] Returns a full URL complete with scheme, etc. (will always be true on websocket)
   * @param {string} [options.type] Optional URL type (websocket)
   * @param {PackageMetadata} [metadata] A package metadata
   * @return {string}
   */
  url(endpoint = '/', options = {}, metadata = {}) {
    return this.urlResolver(endpoint, options, metadata);
  }


  /**
   * Make a HTTP request
   *
   * This is a wrapper for making a 'fetch' request with some helpers
   * and integration with OS.js
   *
   * @param {string} url The endpoint
   * @param {Options} [options] fetch options
   * @param {string} [type] Request / Response type
   * @param {boolean} [force=false] Force request even when in standalone mode
   * @return {*}
   */
  request(url, options = {}, type = null, force = false) {
    const _ = this.has('osjs/locale')
      ? this.make('osjs/locale').translate
      : t => t;

    if (this.config('standalone') && !force) {
      return Promise.reject(new Error(_('ERR_REQUEST_STANDALONE')));
    }

    if (!url.match(/^((http|ws|ftp)s?:)/i)) {
      url = this.url(url);
      // FIXME: Deep merge
      options = {
        ...options || {},
        ...this.requestOptions || {}
      };
    }

    return fetch(url, options, type)
      .catch(error => {
        logger.warn(error);

        throw new Error(_('ERR_REQUEST_NOT_OK', error));
      });
  }

  /**
   * Create an application from a package
   *
   * @param {string} name Package name
   * @param {{foo: *}} [args] Launch arguments
   * @param {PackageLaunchOptions} [options] Launch options
   * @see {Packages}
   * @return {Promise<Application>}
   */
  run(name, args = {}, options = {}) {
    logger.debug('Core::run()', name, args, options);

    return this.make('osjs/packages').launch(name, args, options);
  }

  /**
   * Spawns an application based on the file given
   * @param {VFSFile} file A file object
   * @param {CoreOpenOptions} [options] Options
   * @return {Boolean|Application}
   */
  open(file, options = {}) {
    if (file.mime === 'osjs/application') {
      return this.run(file.path.split('/').pop());
    }

    const run = app => this.run(app, {file}, options);

    const compatible = this.make('osjs/packages')
      .getCompatiblePackages(file.mime);

    if (compatible.length > 0) {
      if (compatible.length > 1) {
        try {
          this._openApplicationDialog(options, compatible, file, run);

          return true;
        } catch (e) {
          logger.warn('Exception on compability check', e);
        }
      }

      run(compatible[0].name);

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /**
   * Wrapper method to create an application choice dialog
   * @private
   */
  _openApplicationDialog(options, compatible, file, run) {
    const _ = this.make('osjs/locale').translate;
    const useDefault = options.useDefault && this.has('osjs/settings');
    const setDefault = name => this.make('osjs/settings')
      .set('osjs/default-application', file.mime, name)
      .save();

    const value = useDefault
      ? this.make('osjs/settings').get('osjs/default-application', file.mime)
      : null;

    const type = useDefault
      ? 'defaultApplication'
      : 'choice';

    const args = {
      title: _('LBL_LAUNCH_SELECT'),
      message: _('LBL_LAUNCH_SELECT_MESSAGE', file.path),
      choices: compatible.reduce((o, i) => ({...o, [i.name]: i.name}), {}),
      value
    };

    if (value && !options.forceDialog) {
      run(value);
    } else {
      this.make('osjs/dialog', type, args, (btn, choice) => {
        if (btn === 'ok') {
          if (type === 'defaultApplication') {
            if (useDefault) {
              setDefault(choice.checked ? choice.value : null);
            }

            run(choice.value);
          } else if (choice) {
            run(choice);
          }
        }
      });
    }
  }

  /**
   * Removes an event handler
   * @param {string} name
   * @param {Function} [callback=null]
   * @param {boolean} [force=false]
   * @return {Core} this
   */
  off(name, callback = null, force = false) {
    if (name.match(/^osjs\//) && typeof callback !== 'function') {
      throw new TypeError('The callback must be a function');
    }

    return super.off(name, callback, force);
  }

  /**
   * Sends a 'broadcast' event with given arguments
   * to all applications matching given filter
   *
   * @param {string|Function} pkg The filter
   * @param {string} name The event name
   * @param {*} ...args Arguments to pass to emit
   * @return {string[]} List of application names emitted to
   */
  broadcast(pkg, name, ...args) {
    const filter = typeof pkg === 'function'
      ? pkg
      : p => p.metadata.name === pkg;


    const apps = Application
      .getApplications()
      .filter(filter);

    return apps.map(proc => {
      proc.emit(name, ...args);

      return proc.name;
    });
  }

  /**
   * Sends a signal to the server over websocket.
   * This will be interpreted as an event in the server core.
   * @param {string} name Event name
   * @param {*} ...params Event callback parameters
   */
  send(name, ...params) {
    return this.ws.send(JSON.stringify({
      name,
      params
    }));
  }

  /**
   * Set the internal fetch/request options
   * @param {object} options Request options
   */
  setRequestOptions(options) {
    this.requestOptions = {...options};
  }

  /**
   * Gets the current user
   * @return {CoreUserData} User object
   */
  getUser() {
    return {...this.user};
  }

  /**
   * Add middleware function to a group
   *
   * @param {string} group Middleware group
   * @param {Function} callback Middleware function to add
   */
  middleware(group, callback) {
    return this.make('osjs/middleware').add(group, callback);
  }

  /**
   * Kills the specified application
   * @param {string|number} match Application name or PID
   */
  kill(match) {
    const apps = Application.getApplications();
    const matcher = typeof match === 'number'
      ? app => app.pid === match
      : app => app.metadata.name === match;

    const found = apps.filter(matcher);
    found.forEach(app => app.destroy());
  }

}
