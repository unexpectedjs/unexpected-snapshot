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

    browsers: ['ChromeHeadless', 'ie11'],

    customLaunchers: {
      ie11: {
        base: 'BrowserStack',
        browser: 'IE',
        browser_version: '11',
        os: 'Windows',
        os_version: '7',
      },
    },

    reporters: ['dots', 'BrowserStack'],
  });
};
