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

import Notification from './notification';
import {createCssText} from './utils/dom';

/**
 * Notification Factory
 */
export default class Notifications {

  /**
   * @param {Core} core OS.js Core instance reference
   */
  constructor(core) {
    /**
     * Core instance reference
     * @type {Core}
     * @readonly
     */
    this.core = core;

    /**
     * @type {Element}
     */
    this.$element = null;
  }

  /**
   * Destroy notification handler
   */
  destroy() {
    this.$element.remove();
    this.$element = null;
  }

  /**
   * Initialize notification handler
   */
  init() {
    this.$element = document.createElement('div');
    this.$element.classList.add('osjs-notifications');
    this.core.$root.appendChild(this.$element);

    this.core.on('osjs/desktop:applySettings', () => {
      this.setElementStyles();
    });

    this.setElementStyles();
  }

  /**
   * Create a new notification
   * @param {NotificationOptions} options See notification class for options
   * @return {Notification}
   */
  create(options) {
    if (!options) {
      throw new Error('Notification options not given');
    }

    const notification = new Notification(this.core, this.$element, options);
    notification.render();
    return notification;
  }

  /**
   * Sets the element styles
   */
  setElementStyles() {
    const styles = createCssText(this.createElementStyles());
    this.$element.style.cssText = styles;
  }

  /**
   * Creates a new CSS style object
   * @return {{property: string}}
   */
  createElementStyles() {
    const defaultPosition = this.core
      .config('desktop.settings.notifications.position', 'top-right');

    const position = this.core.make('osjs/settings')
      .get('osjs/desktop', 'notifications.position', defaultPosition);

    if (position.split('-').length !== 2) {
      return {};
    }

    return ['left', 'right', 'top', 'bottom']
      .reduce((carry, key) => ({
        [key]: position.indexOf(key) === -1 ? 'auto' : '0',
        ...carry
      }), {});
  }
}
