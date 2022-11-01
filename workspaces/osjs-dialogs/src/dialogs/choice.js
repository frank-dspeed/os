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
 * @licence Simplified BSD License
 */

import {h, app} from 'hyperapp';
import {SelectField, Box} from '@osjs/gui';
import Dialog from '../dialog';

/**
 * Default OS.js Choice Dialog
 */
export default class ChoiceDialog extends Dialog {

  /**
   * Constructor
   * @param {Core} core OS.js Core reference
   * @param {Object} args Arguments given from service creation
   * @param {String} [args.title] Dialog title
   * @param {String} [args.message] Dialog message
   * @param {String} [args.value] Set default selected value
   * @param {Map<String,*>} [args.choices] Choice map
   * @param {Function} callback The callback function
   */
  constructor(core, args, callback) {
    args = Object.assign({}, {
      title: 'Choice',
      message: '',
      value: undefined,
      choices: {}
    }, args);

    super(core, args, {
      className: 'alert',
      window: {
        title: args.title,
        attributes: {
          ontop: args.type === 'error'
        },
        dimension: {
          width: 400,
          height: 200
        }
      },
      buttons: ['ok', 'close']
    }, callback);

    this.value = typeof args.value !== 'undefined'
      ? this.args.value
      : Object.keys(this.args.choices)[0];
  }

  render(options) {
    super.render(options, ($content) => {
      app({
        current: this.value
      }, {
        setCurrent: current => state => {
          this.value = current;

          return {current};
        }
      }, (state, actions) => this.createView([
        h(Box, {grow: 1}, [
          h('div', {class: 'osjs-dialog-message'}, String(this.args.message)),
          h(SelectField, {
            choices: this.args.choices,
            value: state.current,
            onchange: (ev, val) => actions.setCurrent(val)
          })
        ])
      ]), $content);
    });
  }

}
