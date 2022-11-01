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

import {EventEmitter} from '@osjs/event-emitter';
import {basename, pathname} from './utils/vfs';

/**
 * Basic Application Options
 *
 * @typedef {Object} BasicApplicationOptions
 * @property {string[]} [mimeTypes] What MIME types to support (all/fallback)
 * @property {string[]} [loadMimeTypes] What MIME types to support on load
 * @property {string[]} [saveMimeTypes] What MIME types to support on save
 * @property {string} [defaultFilename] Default filename of a new file
 */

/**
 * Basic Application Helper
 *
 * A class for helping creating basic applications with open/load/create functionality.
 * Also sets the internal proc args for sessions.
 */
export class BasicApplication extends EventEmitter {

  /**
   * Basic Application Constructor
   * @param {Core} core OS.js Core API
   * @param {Application} proc The application process
   * @param {Window} win The main application window
   * @param {BasicApplicationOptions} [options={}] Basic application options
   */
  constructor(core, proc, win, options = {}) {
    super('BasicApplication<' + proc.name + '>');

    /**
     * Core instance reference
     * @type {Core}
     * @readonly
     */
    this.core = core;

    /**
     * Application instance reference
     * @type {Application}
     * @readonly
     */
    this.proc = proc;

    /**
     * Window instance reference
     * @type {Window}
     * @readonly
     */
    this.win = win;

    /**
     * Basic Application Options
     * @type {BasicApplicationOptions}
     * @readonly
     */
    this.options = {
      mimeTypes: proc.metadata.mimes || [],
      loadMimeTypes: [],
      saveMimeTypes: [],
      defaultFilename: 'New File',
      ...options
    };
  }

  /**
   * Destroys all Basic Application internals
   */
  destroy() {
    this.off();
    super.destroy();
  }

  /**
   * Initializes the application
   * @return {Promise<boolean>}
   */
  init() {
    if (this.proc.args.file) {
      this.open(this.proc.args.file);
    } else {
      this.create();
    }

    return Promise.resolve(true);
  }

  /**
   * Gets options for a dialog
   * @param {string} type Dialog type
   * @return {object}
   */
  getDialogOptions(type, options = {}) {
    const {
      file,
      ...rest
    } = options;

    const {
      defaultFilename,
      mimeTypes,
      loadMimeTypes,
      saveMimeTypes
    } = this.options;

    const currentFile = file ? file : this.proc.args.file;
    const defaultPath = this.core.config('vfs.defaultPath');
    const path = currentFile ? currentFile.path : null;

    let mime = type === 'open' ? loadMimeTypes : saveMimeTypes;
    if (!mime.length) {
      mime = mimeTypes;
    }

    return [{
      type,
      mime,
      filename: path ? basename(path) : defaultFilename,
      path: path ? pathname(path) : defaultPath,
      ...rest
    }, {
      parent: this.win,
      attributes: {
        modal: true
      }
    }];
  }

  /**
   * Updates the window title to match open file
   */
  updateWindowTitle() {
    if (this.win) {
      const {translatableFlat} = this.core.make('osjs/locale');
      const prefix = translatableFlat(this.proc.metadata.title);
      const title = this._createTitle(prefix);

      this.win.setTitle(title);
    }
  }

  /**
   * Creates a new dialog of a type
   * @param {string} type Dialog type
   * @param {Function} cb Callback
   * @param {object} [options] Override options
   */
  createDialog(type, cb, options = {}) {
    const [args, opts] = this.getDialogOptions(type, options);

    if (this.core.has('osjs/dialog')) {
      this.core.make('osjs/dialog', 'file', args, opts, (btn, item) => {
        if (btn === 'ok') {
          cb(item);
        }
      });
    }
  }

  /**
   * Opens given file
   *
   * Does not do any actual VFS operation
   *
   * @param {VFSFile} file A file
   */
  open(item) {
    this._setFile(item, 'open-file');
  }

  /**
   * Saves given file
   *
   * Does not do any actual VFS operation
   *
   * @param {VFSFile} file A file
   */
  save(item) {
    this._setFile(item, 'save-file');
  }

  /**
   * Create new file
   *
   * Does not do any actual VFS operation
   */
  create() {
    this.proc.args.file = null;

    this.emit('new-file');

    this.updateWindowTitle();
  }

  /**
   * Create new file
   * @see BasicApplication#create
   */
  createNew() {
    this.create();
  }

  /**
   * Creates a new save dialog
   * @param {object} [options] Dialog options
   */
  createSaveDialog(options = {}) {
    this.createDialog('save', item => this.save(item), options);
  }

  /**
   * Creates a new load dialog
   * @param {object} [options] Dialog options
   */
  createOpenDialog(options = {}) {
    this.createDialog('open', item => this.open(item), options);
  }

  /**
   * Sets file from open/save action
   *
   * @private
   * @param {VFSFile} item File
   * @param {string} eventName Event to fire
   */
  _setFile(item, eventName) {
    this.proc.args.file = {...item};
    this.emit(eventName, item);
    this.updateWindowTitle();
  }

  /**
   * Creates the window title
   *
   * @private
   * @param {string} prefix Title prefix
   * @return {string}
   */
  _createTitle(prefix) {
    const title = this.proc.args.file
      ? basename(this.proc.args.file.path)
      : this.options.defaultFilename;

    return title
      ? `${prefix} - ${title}`
      : prefix;
  }
}
