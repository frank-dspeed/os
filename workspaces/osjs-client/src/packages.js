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
import Preloader from './utils/preloader';
import logger from './logger';
import {
  createPackageAvailabilityCheck,
  createManifestFromArray,
  filterMetadataFilesByType,
  metadataFilesToFilenames
} from './utils/packages';

/**
 * A registered package reference
 *
 * @typedef {Object} PackageReference
 * @property {PackageMetadata} metadata Package metadata
 * @property {Function} callback Callback to instanciate
 */

/**
 * A package metadata
 *
 * @typedef {Object} PackageMetadata
 * @property {string} name The package name
 * @property {string} [category] Package category
 * @property {string} [icon] Package icon
 * @property {boolean} [singleton] If only one instance allowed
 * @property {boolean} [autostart] Autostart on boot
 * @property {boolean} [hidden] Hide from launch menus etc.
 * @property {string} [server] Server script filename
 * @property {string[]} [groups] Only available for users in this group
 * @property {Object[]|string[]} [files] Files to preload
 * @property {{key: string}} title A map of locales and titles
 * @property {{key: string}} description A map of locales and titles
 */

/**
 * Package Launch Options
 *
 * @typedef {Object} PackageLaunchOptions
 * @property {boolean} [forcePreload=false] Force preload reloading
 */

/**
 * Package Manager
 *
 * Handles indexing, loading and launching of OS.js packages
 */
export default class Packages {

  /**
   * Create package manage
   *
   * @param {Core} core Core reference
   */
  constructor(core) {
    /**
     * Core instance reference
     * @type {Core}
     * @readonly
     */
    this.core = core;

    /**
     * A list of registered packages
     * @type {PackageReference[]}
     */
    this.packages = [];

    /**
     * The lost of loaded package metadata
     * @type {PackageMetadata[]}
     */
    this.metadata = [];

    /**
     * A list of running application names
     *
     * Mainly used for singleton awareness
     *
     * @private
     * @type {string[]}
     */
    this._running = [];

    /**
     * Preloader
     * @type {Preloader}
     * @readonly
     */
    this.preloader = new Preloader(core.$resourceRoot);

    /**
     * If inited
     * @type {boolean}
     */
    this.inited = false;
  }

  /**
   * Destroy package manager
   */
  destroy() {
    this.packages = [];
    this.metadata = [];

    this.preloader.destroy();
  }

  /**
   * Initializes package manager
   * @return {Promise<boolean>}
   */
  init() {
    logger.debug('Packages::init()');

    if (!this.inited) {
      this.core.on('osjs/core:started', () => this._autostart());
    }

    this.metadata = this.core.config('packages.metadata', [])
      .map(iter => ({type: 'application', ...iter}));

    this.inited = true;

    const manifest = this.core.config('packages.manifest');

    return manifest
      ? this.core.request(manifest, {}, 'json', true)
        .then(metadata => this.addPackages(metadata))
        .then(metadata => this._preloadBackgroundFiles(metadata))
        .then(() => true)
        .catch(error => logger.error(error))
      : Promise.resolve(true);
  }

  /**
   * Launches a (application) package
   *
   * @param {string} name Package name
   * @param {{foo: *}} [args={}] Launch arguments
   * @param {PackageLaunchOptions} [options={}] Launch options
   * @see PackageServiceProvider
   * @throws {Error}
   * @return {Promise<Application>}
   */
  launch(name, args = {}, options = {}) {
    logger.debug('Packages::launch()', name, args, options);

    const _ = this.core.make('osjs/locale').translate;
    const metadata = this.metadata.find(pkg => pkg.name === name);
    if (!metadata) {
      throw new Error(_('ERR_PACKAGE_NOT_FOUND', name));
    }

    if (['theme', 'icons', 'sounds'].indexOf(metadata.type) !== -1) {
      return this._launchTheme(name, metadata);
    }

    return this._launchApplication(name, metadata, args, options);
  }

  /**
   * Launches an application package
   *
   * @private
   * @param {string} name Application package name
   * @param {Metadata} metadata Application metadata
   * @param {{foo: *}} args Launch arguments
   * @param {PackageLaunchOptions} options Launch options
   * @return {Promise<Application>}
   */
  _launchApplication(name, metadata, args, options) {
    let signaled = false;

    if (metadata.singleton) {
      const foundApp = Application.getApplications()
        .find(app => app.metadata.name === metadata.name);

      if (foundApp) {
        foundApp.emit('attention', args, options);
        signaled = true;

        return Promise.resolve(foundApp);
      }

      const found = this._running.filter(n => n === name);

      if (found.length > 0) {
        return new Promise((resolve, reject) => {
          this.core.once(`osjs/application:${name}:launched`, a => {
            if (signaled) {
              resolve(a);
            } else {
              a.emit('attention', args, options);
              resolve(a);
            }
          });
        });
      }
    }

    this.core.emit('osjs/application:launch', name, args, options);

    this._running.push(name);

    return this._launch(name, metadata, args, options);
  }

  /**
   * Launches a (theme) package
   *
   * @private
   * @param {string} name Package name
   * @param {Metadata} metadata Application metadata
   * @throws {Error}
   * @return {Promise<object>}
   */
  _launchTheme(name, metadata) {
    const preloads = this._getPreloads(metadata, 'preload', 'theme');

    return this.preloader.load(preloads)
      .then(result => {
        return {
          elements: {},
          ...result,
          ...this.packages.find(pkg => pkg.metadata.name === name) || {}
        };
      });
  }

  /**
   * Returns preloads
   *
   * @private
   * @param {Metadata} metadata Application metadata
   * @param {string} fileType Files type
   * @param {string} packageType Package type
   * @return {string[]}
   */
  _getPreloads(metadata, fileType, packageType) {
    return metadataFilesToFilenames(
      filterMetadataFilesByType(metadata.files, fileType)
    ).map(f => this.core.url(f, {}, {type: packageType, ...metadata}));
  }

  /**
   * Wrapper for launching a (application) package
   *
   * @private
   * @param {string} name Package name
   * @param {{foo: *}} args Launch arguments
   * @param {PackageLaunchOptions} options Launch options
   * @return {Promise<Application>}
   */
  _launch(name, metadata, args, options) {
    const _ = this.core.make('osjs/locale').translate;
    const canLaunch = createPackageAvailabilityCheck(this.core);

    const dialog = e => {
      if (this.core.has('osjs/dialog')) {
        this.core.make('osjs/dialog', 'alert', {
          type: 'error',
          title: _('ERR_PACKAGE_EXCEPTION', name),
          message: _('ERR_PACKAGE_EXCEPTION', name),
          error: e
        }, () => { /* noop */});
      } else {
        alert(`${_('ERR_PACKAGE_EXCEPTION', name)}: ${e.stack || e}`);
      }
    };

    const fail = err => {
      this.core.emit('osjs/application:launched', name, false);
      this.core.emit(`osjs/application:${name}:launched`, false);

      dialog(err);

      throw new Error(err);
    };

    const preloads = this._getPreloads(metadata, 'preload', 'apps');

    const create = found => {
      let app;

      try {
        console.group('Packages::_launch()');
        app = found.callback(this.core, args, options, found.metadata);

        if (app instanceof Application) {
          app.on('destroy', () => {
            const foundIndex = this._running.findIndex(n => n === name);
            if (foundIndex !== -1) {
              this._running.splice(foundIndex, 1);
            }
          });
        } else {
          logger.warn('The application', name, 'did not return an Application instance from registration');
        }
      } catch (e) {
        dialog(e);

        logger.warn('Exception when launching', name, e);
      } finally {
        this.core.emit('osjs/application:launched', name, app);
        this.core.emit(`osjs/application:${name}:launched`, app);
        console.groupEnd();
      }

      return app;
    };

    if (!canLaunch(metadata)) {
      fail(_('ERR_PACKAGE_PERMISSION_DENIED', name));
    }

    return this.preloader.load(preloads, options.forcePreload === true)
      .then(({errors}) => {
        if (errors.length) {
          fail(_('ERR_PACKAGE_LOAD', name, errors.join(', ')));
        }

        const found = this.packages.find(pkg => pkg.metadata.name === name);
        if (!found) {
          fail(_('ERR_PACKAGE_NO_RUNTIME', name));
        }

        return create(found);
      });
  }

  /**
   * Autostarts tagged packages
   * @private
   */
  _autostart() {
    const meta = this.metadata
      .filter(pkg => pkg.autostart === true);

    const configured = this.core
      .config('application.autostart', [])
      .map(value => typeof value === 'string' ? {name: value} : value);

    [...meta, ...configured].forEach(({name, args}) => this.launch(name, args || {}));
  }

  /**
   * Registers a package
   *
   * @param {string} name Package name
   * @param {Function} callback Callback function to construct application instance
   * @throws {Error}
   */
  register(name, callback) {
    logger.debug('Packages::register()', name);

    const _ = this.core.make('osjs/locale').translate;
    const metadata = this.metadata.find(pkg => pkg.name === name);
    if (!metadata) {
      throw new Error(_('ERR_PACKAGE_NO_METADATA', name));
    }

    const foundIndex = this.packages.findIndex(pkg => pkg.metadata.name === name);
    if (foundIndex !== -1) {
      this.packages.splice(foundIndex, 1);
    }

    this.packages.push({
      metadata,
      callback
    });
  }

  /**
   * Adds a set of packages
   * @param {PackageMetadata[]} list Package list
   * @return {PackageMetadata[]} Current list of packages
   */
  addPackages(list) {
    if (list instanceof Array) {
      const override = this.core.config('packages.overrideMetadata', {});
      const append = createManifestFromArray(list)
        .map(meta => override[meta.name] ? {...meta, ...override[meta.name]} : meta);

      this.metadata = [...this.metadata, ...append];
    }

    return this.getPackages();
  }

  /**
   * Gets a list of packages (metadata)
   * @param {Function} [filter] A filter function
   * @return {PackageMetadata[]}
   */
  getPackages(filter) {
    filter = filter || (() => true);

    const metadata = this.metadata.map(m => ({...m}));
    const hidden = this.core.config('packages.hidden', []);
    const filterAvailable = createPackageAvailabilityCheck(this.core);

    const filterConfigHidden = iter => hidden instanceof Array
      ? hidden.indexOf(iter.name) === -1
      : true;

    return metadata
      .filter(filterAvailable)
      .filter(filterConfigHidden)
      .filter(filter);
  }

  /**
   * Gets a list of packages compatible with the given mime type
   * @param {string} mimeType MIME Type
   * @see PackageManager#getPackages
   * @return {PackageMetadata[]}
   */
  getCompatiblePackages(mimeType) {
    return this.getPackages(meta => {
      if (meta.mimes) {
        return !!meta.mimes.find(mime => {
          try {
            const re = new RegExp(mime);
            return re.test(mimeType);
          } catch (e) {
            logger.warn('Compability check failed', e);
          }

          return mime === mimeType;
        });
      }

      return false;
    });
  }

  /**
   * Preloads background files of a set of packages
   * @param {PackageMetadata[]} list Package list
   */
  _preloadBackgroundFiles(list) {
    const backgroundFiles = list.reduce((filenames, iter) => [
      ...filenames,
      ...this._getPreloads(iter, 'background', 'apps')
    ], []);

    return this.preloader.load(backgroundFiles)
      .then(({errors = []}) => {
        errors.forEach(error => logger.error(error));
      });
  }

  /**
   * Gets a list of running packages
   * @return {string[]}
   */
  running() {
    return this._running;
  }
}
