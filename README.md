## unexpected-snapshot

[![NPM version](https://badge.fury.io/js/unexpected-snapshot.svg)](http://badge.fury.io/js/unexpected-snapshot)
[![Build Status](https://github.com/unexpectedjs/unexpected-snapshot/workflows/Tests/badge.svg)](https://github.com/unexpectedjs/unexpected-snapshot)
[![Coverage Status](https://img.shields.io/coveralls/unexpectedjs/unexpected-snapshot.svg?style=flat)](https://coveralls.io/r/unexpectedjs/unexpected-snapshot?branch=master)

![Snap!](https://raw.githubusercontent.com/unexpectedjs/unexpected-snapshot/master/unexpected-snapshot.jpg)

Unexpected plugin for capturing and matching inline snapshots.

An assertion that matches against a snapshot looks almost like a regular `to equal` assertion:

```js
const expect = require('unexpected')
  .clone()
  .use(require('unexpected-snapshot'));

expect(something, 'to equal snapshot', 'the value');

expect(somethingElse, 'to equal snapshot', { foo: 123 });
```

There's a string-based variant for values that involve non-trivial object trees:

```js
function Person(name) {
  this.name = name;
}

expect(
  new Person('Eigil'),
  'to inspect as snapshot',
  "Person({ name: 'Eigil' })"
);
```

Specify the `UNEXPECTED_SNAPSHOT=yes` environment variable to update the
snapshots for the tests that fail.

Tip: You can easily make an initial recording by leaving out the 3rd argument:

```js
expect(something, 'to equal snapshot');
```

Note that this recording/injection feature only works when running your tests in
node.js. The matching against the snapshot works in all test runners, including
the browser.

## RELEASES

See the [changelog](CHANGELOG.md).
