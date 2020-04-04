var puppeteer = require('puppeteer');
process.env.CHROME_BIN = puppeteer.executablePath();

module.exports = function (config) {
  config.set({
    frameworks: ['mocha'],

    files: [
      './node_modules/unexpected/unexpected.js',
      './unexpected-snapshot-browser.js',
      './test/browser/index.js',
    ],

    client: {
      mocha: {
        reporter: 'html',
        timeout: 60000,
      },
    },

    browsers: ['ChromeHeadless'],
  });
};
