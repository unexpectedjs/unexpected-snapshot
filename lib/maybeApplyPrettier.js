let prettier;
if (!/^(?:0|false|off|no)$/.test(process.env.UNEXPECTED_SNAPSHOT_PRETTIER)) {
  try {
    prettier = require('prettier');
  } catch (err) {}
}

function maybeApplyPrettier(code, fileName) {
  if (prettier) {
    code = prettier.format(code, {
      // Silence warning about using the default babel parser
      // The parser is still overridable from .prettierrc, as that will come out in the resolved prettier config
      parser: 'babel',
      ...prettier.resolveConfig.sync(fileName)
    });
  }
  return code;
}

module.exports = maybeApplyPrettier;
