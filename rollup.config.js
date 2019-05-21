module.exports = {
  plugins: [
    require('rollup-plugin-json')(),
    require('rollup-plugin-commonjs')(),
    require('rollup-plugin-node-resolve')(),
    require('rollup-plugin-terser').terser()
  ],
  output: {
    exports: 'named'
  }
};
