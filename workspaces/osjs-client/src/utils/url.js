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

/**
 * @typedef {Object} URLResolverOptions
 * @property {string} [type] URL type (ws/http)
 * @property {string} [boolean] Add prefix to URL
 */

/**
 * Resolves an URL
 * @param {CoreConfig} configuration
 */
export const urlResolver = configuration => {
  const {http, ws} = configuration;

  /**
   * @param {string} [endpoint='/']
   * @param {URLResolverOptions} [options={}]
   * @param {PackageMetadata} [metadata={}] Metadata for package resolving
   */
  return (endpoint = '/', options = {}, metadata = {}) => {
    if (typeof endpoint !== 'string') {
      return http.public;
    } else if (endpoint.match(/^(http|ws|ftp)s?:/i)) {
      return endpoint;
    }

    const {type, prefix} = {
      type: null,
      prefix: options.type === 'websocket',
      ...options
    };

    const str = type === 'websocket' ? ws.uri : http.uri;

    let url = endpoint.replace(/^\/+/, '');
    if (metadata.type) {
      const path = endpoint.replace(/^\/?/, '/');
      const type = metadata.type === 'theme' ? 'themes' : (
        metadata.type === 'icons' ? 'icons' : 'apps'
      );

      url = `${type}/${metadata.name}${path}`;
    }

    return prefix
      ? str.replace(/\/$/, '') + url.replace(/^\/?/, '/')
      : http.public.replace(/^\/?/, '/') + url;
  };
};
