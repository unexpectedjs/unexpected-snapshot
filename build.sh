#!/bin/bash

set -e

mkdir -p build
buble -o build/createInspector.js lib/createInspector.js
buble -o build/unexpected-snapshot-check.js lib/unexpected-snapshot-check.js
rollup --config rollup.config.js --sourcemap --format umd --name unexpectedSnapshot -o unexpected-snapshot-browser.js build/unexpected-snapshot-check.js
