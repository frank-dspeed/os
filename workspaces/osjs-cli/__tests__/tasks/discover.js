const logger = require('consola');
const path = require('path');
const temp = require('temp');
const fs = require('fs-extra');
const utils = require('../../src/utils.js');
const task = require('../../src/tasks/discover.js');

// FIXME: Memory fs
describe('task > package:discover', () => {
  const root = temp.mkdirSync('osjs-cli-jest');
  const fname = str => path.resolve(root, str);

  afterAll(() => fs.removeSync(root));

  test('should discover packages', async () => {
    const defaults = utils.createOptions({root});

    const options =  utils.resolveOptions(defaults, {
      discover: [
        path.resolve(__dirname, '../../__mocks__/packages'),
        path.resolve(__dirname, '../../__mocks__/packages')
      ]
    });

    await task['package:discover']
      .action({
        logger,
        options,
        args: {},
        commander: null
      });

    expect(fs.existsSync(fname('dist/metadata.json')))
      .toBe(true);

    expect(require(fname('dist/metadata.json')))
      .toMatchObject([{
        name: 'Application'
      }, {
        name: 'Theme',
        type: 'theme'
      }]);

    expect(fs.existsSync(fname('dist/apps/Application/main.js')))
      .toBe(true);

    expect(fs.existsSync(fname('dist/themes/Theme/main.js')))
      .toBe(true);

    expect(fs.existsSync(fname('dist/apps/Failed')))
      .toBe(false);
  });
});
