class MockWebSocket {
  constructor(uri) {
    this.onmessage = () => {};
    this.onopen = () => {};
    this.onclose = () => {};
    this.onerror = () => {};
    this.url = uri;

    if (uri === 'ws://fail') {
      setTimeout(() => this.onclose(), 1);
    } else {
      setTimeout(() => this.onopen(), 1);
    }
  }

  close() {
    this.onclose();
  }

  send(...args) {}
}

class Worker {
  terminate() {

  }
}

const noop = () => {};

const fetchMocks = {
  text: {

  },
  json: {
    '/vfs/search': [],
    '/vfs/readdir': [],
    '/vfs/writefile': -1,
    '/vfs/exists': true,
    '/vfs/rename': true,
    '/vfs/copy': true,
    '/vfs/mkdir': true,
    '/vfs/touch': true,
    '/vfs/unlink': true,
    '/success-test': true,

    '/apps/Jest/test': true,

    '/metadata.json': [{
      name: 'ValidApplication',
      mimes: ['valid/bazz'],
      files: []
    }],

    '/settings': ({method}) => String(method).toLowerCase() === 'post'
      ? true
      : {
        foo: 'bar'
      },

    '/logout': true,

    '/register': ({body}) => {
      const parsed = JSON.parse(body);
      return {username: parsed.username};
    },

    '/login': ({body}) => Object.assign({
      id: 0,
      groups: []
    }, JSON.parse(body))
  }
};

const getFetchMock = (type, url, options) => {
  let data = fetchMocks[type][url];
  if (typeof data === 'function') {
    data = data(options);
  } else if (!data) {
    data = type === 'json' ? {} : '';
  }

  return Promise.resolve(data);
};

global.fetch = (url, options = {}) => {
  url = url.split('?')[0];

  if (url === '/fail-test') {
    return Promise.resolve({
      ok: false,
      headers: {
        get: () => ''
      },
      text: () => Promise.resolve({error: 'Simulated failure'})
    });
  }

  return Promise.resolve({
    ok: true,
    headers: {
      get: () => ''
    },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer()),
    text: () => getFetchMock('text', url, options),
    json: () => getFetchMock('json', url, options)
  });
};

console.debug = noop;
console.group = noop;
console.groupEnd = noop;

const originalCreateElement = document.createElement;
document.createElement = type => {
  const el = originalCreateElement.call(document, type);
  if (type === 'script' || type === 'link') {
    setTimeout(() => {
      const src = (el.src || el.href || '').replace(/\.(css|js)$/, '');
      if (src === 'http://localhost/onreadystatechange') {
        el.readyState = 'loaded';
        el.onreadystatechange();
      } else if (src === 'http://localhost/onerror') {
        el.onerror(new Error('Simulated failure'));
      } else {
        if (typeof el.onload === 'function') {
          el.onload();
        }
      }
    }, 10);
  }

  return el;
};

window.URL = {
  createObjectURL: () => {},
  revokeObjectURL: () => {}
};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.matchMedia = () => false;
window.WebSocket = MockWebSocket;
window.Worker = Worker;
window.alert = () => {};
