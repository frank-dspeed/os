/*!
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

import osjs from 'osjs';
import {name as applicationName} from './metadata.json';

import {
  h,
  app
} from 'hyperapp';

import {
  Box,
  BoxContainer,
  Image,
  Video,
  Menubar,
  MenubarItem
} from '@osjs/gui';

const view = (core, proc, win, _) =>
  (state, actions) => h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: ev => actions.menu(ev)
      }, _('LBL_FILE'))
    ]),
    h(BoxContainer, {grow: 1, shrink: 1, style: {overflow: state.image ? 'auto' : 'hidden'}}, [
      state.image ? h(Image, {src: state.image.url, onload: (ev) => actions.resizeFit(ev.target)}) : null,
      state.video ? h(Video, {src: state.video.url, onload: (ev) => actions.resizeFit(ev.target)}) : null
    ].filter(i => !!i)),
  ]);

const openFile = async (core, proc, win, a, file, restore) => {
  const url = await core.make('osjs/vfs').url(file);
  const ref = Object.assign({}, file, {url});

  if (file.mime.match(/^image/)) {
    a.setImage({image: ref, restore});
  } else if (file.mime.match(/^video/)) {
    a.setVideo({video: ref, restore});
  }

  win.setTitle(`${proc.metadata.title.en_EN} - ${file.filename}`);
  proc.args.file = file;
};


osjs.register(applicationName, (core, args, options, metadata) => {
  const _ = core.make('osjs/locale').translate;
  const proc = core.make('osjs/application', {
    args,
    options,
    metadata
  });

  const title = core.make('osjs/locale')
    .translatableFlat(metadata.title);

  proc.createWindow({
    id: 'PreviewWindow',
    title,
    icon: proc.resource(metadata.icon),
    dimension: {width: 400, height: 400}
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .on('drop', (ev, data) => {
      if (data.isFile && data.mime) {
        const found = metadata.mimes.find(m => (new RegExp(m)).test(data.mime));
        if (found) {
          proc.emit('readFile', data, false);
        }
      }
    })
    .render(($content, win) => {
      const a = app({
        image: null,
        video: null,
        restore: false
      }, {
        resizeFit: target => state => {
          if (!state.restore) {
            try {
              win.resizeFit(target);
            } catch (e) {
              console.warn(e);
            }
          }
        },

        setVideo: ({video, restore}) => ({video, restore}),
        setImage: ({image, restore}) => ({image, restore}),
        menu: (ev) => {
          core.make('osjs/contextmenu').show({
            menu: [
              {label: _('LBL_OPEN'), onclick: () => {
                core.make('osjs/dialog', 'file', {type: 'open', mime: metadata.mimes}, (btn, item) => {
                  if (btn === 'ok') {
                    proc.emit('readFile', item, false);
                  }
                });
              }},
              {label: _('LBL_QUIT'), onclick: () => proc.destroy()}
            ],
            position: ev.target
          });
        }
      }, view(core, proc, win, _), $content);

      proc.on('readFile', (file, restore) => openFile(core, proc, win, a, file, restore));

      if (args.file) {
        proc.emit('readFile', args.file, !!proc.options.restore);
      }
    });

  return proc;
});
