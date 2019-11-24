### v0.7.0 (2019-11-24)

#### Pull requests

- [#41](https://github.com/unexpectedjs/unexpected-snapshot/pull/41) Run the fixed source through prettier if available and configured ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [#42](https://github.com/unexpectedjs/unexpected-snapshot/pull/42) Make sure we write out all fixed files, even when multiple plugin instances are in play ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [#40](https://github.com/unexpectedjs/unexpected-snapshot/pull/40) Upgrade prettier to version 1.19.1 ([depfu[bot]](mailto:23717796+depfu[bot]@users.noreply.github.com))
- [#39](https://github.com/unexpectedjs/unexpected-snapshot/pull/39) Upgrade puppeteer to version 2.0.0 ([depfu[bot]](mailto:23717796+depfu[bot]@users.noreply.github.com))
- [#38](https://github.com/unexpectedjs/unexpected-snapshot/pull/38) Upgrade eslint-plugin-node to version 10.0.0 ([depfu[bot]](mailto:23717796+depfu[bot]@users.noreply.github.com))
- [#37](https://github.com/unexpectedjs/unexpected-snapshot/pull/37) Upgrade eslint-config-standard to version 14.0.0 ([depfu[bot]](mailto:23717796+depfu[bot]@users.noreply.github.com))
- [#35](https://github.com/unexpectedjs/unexpected-snapshot/pull/35) Upgrade karma-chrome-launcher to version 3.0.0 ([depfu[bot]](mailto:23717796+depfu[bot]@users.noreply.github.com))

#### Commits to master

- [Add CHANGELOG.md](https://github.com/unexpectedjs/unexpected-snapshot/commit/f6a38fa69c4740a83a3c96c3511964b024cb02b8) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Travis: Run with 'latest' node instead of explicitly 12](https://github.com/unexpectedjs/unexpected-snapshot/commit/2d0d3b737548689e01727b193d250dd07c605587) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Add the entries from .eslintignore to .prettierignore](https://github.com/unexpectedjs/unexpected-snapshot/commit/85a2981e65f469156758dc8d345b1a5df478a09c) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Fix .eslintignore entry for the nyc output dir](https://github.com/unexpectedjs/unexpected-snapshot/commit/164e8840e826d2c168f7fd310fe037605bc8b7c8) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [eslint --fix . && prettier --write '\*\*\/\*.js'](https://github.com/unexpectedjs/unexpected-snapshot/commit/14087fccd7620fce98f3052cbf84b929d907ce59) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [+8 more](https://github.com/unexpectedjs/unexpected-snapshot/compare/v0.6.0...v0.7.0)

### v0.6.0 (2019-06-17)

#### Pull requests

- [#32](https://github.com/unexpectedjs/unexpected-snapshot/pull/32) Don't fail on snapshot mismatches while updating snapshots ([Sune Simonsen](mailto:sune@we-knowhow.dk))

#### Commits to master

- [Take compound assertions into account when replacing 'to equal snapshot' with 'to inspect as snapshot'](https://github.com/unexpectedjs/unexpected-snapshot/commit/c893771bda3a0cad6153e70e09a36eedcfe8402f) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Escape backticks when injecting expect.unindent`...`](https://github.com/unexpectedjs/unexpected-snapshot/commit/5f6269457a7b32894ff56263b9efb3d9d6bd0a94) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))

### v0.5.0 (2019-06-14)

- [#31](https://github.com/unexpectedjs/unexpected-snapshot/pull/31) Transpile the files that goes into the browser build ([Sune Simonsen](mailto:sune@we-knowhow.dk))

### v0.4.0 (2019-06-14)

- [#29](https://github.com/unexpectedjs/unexpected-snapshot/pull/29) Always inspect snapshots with infinite depth ([Sune Simonsen](mailto:sune@we-knowhow.dk))

### v0.3.2 (2019-06-14)

- [#28](https://github.com/unexpectedjs/unexpected-snapshot/pull/28) Split the updating and checking part into to separate plugins ([Sune Simonsen](mailto:sune@we-knowhow.dk))
- [#27](https://github.com/unexpectedjs/unexpected-snapshot/pull/27) Testing that matching snapshots works correctly ([Sune Simonsen](mailto:sune@we-knowhow.dk))
- [#26](https://github.com/unexpectedjs/unexpected-snapshot/pull/26) Testing snapshot inspected snapshots  ([Andreas Lind](mailto:andreaslindpetersen@gmail.com), [Sune Simonsen](mailto:sune@we-knowhow.dk))
- [#25](https://github.com/unexpectedjs/unexpected-snapshot/pull/25) Upgrade prettier to version 1.18.2 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))

### v0.3.1 (2019-05-25)

- [Tweak copy in output when snapshot assertions fail](https://github.com/unexpectedjs/unexpected-snapshot/commit/846d75ed9646f1e88d9657e6c3a60dfab41e677e) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Drop the interactive mode entirely, in its current form it doesn't really deliver any value above git add -p](https://github.com/unexpectedjs/unexpected-snapshot/commit/10089c59064215733a41cb7438f9cec0ac966c0e) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Small whitespace fix](https://github.com/unexpectedjs/unexpected-snapshot/commit/a7c6a12d48e1f3ccba601d8f65c2356c12fef4e6) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Also accept unexpected 11 as a peer dep](https://github.com/unexpectedjs/unexpected-snapshot/commit/619393caaf8f45645bd8ffc4448dff18949d7e49) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Add quick docs and @Munter's funnypic](https://github.com/unexpectedjs/unexpected-snapshot/commit/9b83bfa7c512ec55fadfbcaa16576d7bf8cda114) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))

### v0.3.0 (2019-05-24)

- [Add missing nyc configuration](https://github.com/unexpectedjs/unexpected-snapshot/commit/93d4c6ce1b1fae10b1d709d7be6fae52c8cf24cf) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Travis: Also test with node 12](https://github.com/unexpectedjs/unexpected-snapshot/commit/65b6a26005912cdf5e8380a8c6da149c9c7359fe) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [npm run {travis =&gt; ci}](https://github.com/unexpectedjs/unexpected-snapshot/commit/d600650ee5443d8d5ee89222db4f415684d0e10b) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Move the coveralls submission to after\_success](https://github.com/unexpectedjs/unexpected-snapshot/commit/40ad93ad88be87ef4d13efd36dc76f0db2e8ee56) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Add quick browser test to make sure that the browser build runs](https://github.com/unexpectedjs/unexpected-snapshot/commit/cf783828c3f1103cf78e12a80a24f59448724aa6) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [+9 more](https://github.com/unexpectedjs/unexpected-snapshot/compare/v0.2.0...v0.3.0)

### v0.2.0
#### Pull requests

- [#24](https://github.com/unexpectedjs/unexpected-snapshot/pull/24) Upgrade detect-indent to version 6.0.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#23](https://github.com/unexpectedjs/unexpected-snapshot/pull/23) Upgrade nyc to version 14.0.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#22](https://github.com/unexpectedjs/unexpected-snapshot/pull/22) Upgrade prettier to version 1.17.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#21](https://github.com/unexpectedjs/unexpected-snapshot/pull/21) Upgrade mocha to version 6.0.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#20](https://github.com/unexpectedjs/unexpected-snapshot/pull/20) Upgrade prettier to version 1.16.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#19](https://github.com/unexpectedjs/unexpected-snapshot/pull/19) Upgrade eslint to version 5.10.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#18](https://github.com/unexpectedjs/unexpected-snapshot/pull/18) Upgrade espree to version 5.0.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#17](https://github.com/unexpectedjs/unexpected-snapshot/pull/17) Upgrade inquirer to version 6.2.1 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#16](https://github.com/unexpectedjs/unexpected-snapshot/pull/16) Upgrade eslint to version 5.9.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#14](https://github.com/unexpectedjs/unexpected-snapshot/pull/14) Upgrade eslint to version 5.8.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#13](https://github.com/unexpectedjs/unexpected-snapshot/pull/13) Upgrade eslint to version 5.7.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#12](https://github.com/unexpectedjs/unexpected-snapshot/pull/12) Upgrade eslint-plugin-prettier to version 3.0.0 ([depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))
- [#9](https://github.com/unexpectedjs/unexpected-snapshot/pull/9) Upgrade eslint to version 5.6.0 ([Andreas Lind](mailto:andreaslindpetersen@gmail.com), [depfu[bot]](mailto:depfu[bot]@users.noreply.github.com))

#### Commits to master

- [Release 0.2.0](https://github.com/unexpectedjs/unexpected-snapshot/commit/a16c3b0266af74c28bb4a370a9a0e54fafb223b9) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Fix and test inspection of Date and Buffer instances](https://github.com/unexpectedjs/unexpected-snapshot/commit/ea68dcc998c93976cbea64a7ecfc4fef140f566e) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Use expect.testDescription](https://github.com/unexpectedjs/unexpected-snapshot/commit/006470d8ac3a8f8bc8905a77f433f41119d6702c) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [Call the assertions something else, make the unindent explicit](https://github.com/unexpectedjs/unexpected-snapshot/commit/cd883b3c15efa778f7cf99508425fba58933463a) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [to {match =&gt; equal} snapshot](https://github.com/unexpectedjs/unexpected-snapshot/commit/a359bda42b136ea7cb5f74b6b11dc97adce6e9fb) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [+21 more](https://github.com/unexpectedjs/unexpected-snapshot/compare/v0.1.2...v0.2.0)

### v0.1.2 (2017-04-17)

- [Use expect.child to make plugins installed after fixpect available to expectForRendering :\)](https://github.com/unexpectedjs/unexpected-snapshot/commit/1883e066b7d5a33aef3c5d6f3e9ee7a79cc21256) ([Andreas Lind](mailto:andreas@one.com))
- [Okay, we still need to link against the feature\/fixpectPlusHook branch of Unexpected](https://github.com/unexpectedjs/unexpected-snapshot/commit/ca195965ae5c07acc2fc64fc1b77cf72cca8a2a1) ([Andreas Lind](mailto:andreas@one.com))

### v0.1.1 (2017-04-17)

- [Switch to Unexpected 10.27.0](https://github.com/unexpectedjs/unexpected-snapshot/commit/815e729855bfb174d810f32c5e658c8f6b1bff29) ([Andreas Lind](mailto:andreas@one.com))

### v0.1.0 (2017-04-17)

- [Fix test that expected the wrong thing](https://github.com/unexpectedjs/unexpected-snapshot/commit/47d998ac793d41ada6dc8b10eed1c7cfbd0226d6) ([Andreas Lind](mailto:andreas@one.com))
- [Revert me: Update to unexpectedjs\/unexpected\#26a700fb78d84d0dc7759ea39c800c0da7ff5d00](https://github.com/unexpectedjs/unexpected-snapshot/commit/2d0dd34d3cf762b26925b21a95a22c3a6cebb9b6) ([Andreas Lind](mailto:andreas@one.com))
- [Fix footgun](https://github.com/unexpectedjs/unexpected-snapshot/commit/da860ac6e215f2412ebf3ec513914dbca3da2c64) ([Andreas Lind](mailto:andreas@one.com))
- [Whoops, add missing dependency.](https://github.com/unexpectedjs/unexpected-snapshot/commit/ac55997d96eda0f16e80f27d12dfa79c03e57345) ([Andreas Lind](mailto:andreas@one.com))
- [Make sure that we exit with non-zero when fixpect fails due to git problems](https://github.com/unexpectedjs/unexpected-snapshot/commit/35d1e17eeaf0442a5c34bff9b8a46ab7466c145e) ([Andreas Lind](mailto:andreas@one.com))
- [+54 more](https://github.com/unexpectedjs/unexpected-snapshot/compare/47d998ac793d41ada6dc8b10eed1c7cfbd0226d6%5E...v0.1.0)

