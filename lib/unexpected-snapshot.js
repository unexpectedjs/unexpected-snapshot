const isNode = require('is-node');

const updating =
  isNode && /^(?:1|true|on|yes)$/i.test(process.env.UNEXPECTED_SNAPSHOT);

module.exports = updating
  ? require('./unexpected-snapshot-update')
  : require('./unexpected-snapshot-check');
