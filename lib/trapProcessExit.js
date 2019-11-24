function trapProcessExit() {
  const originalProcessExit = process.exit;
  const processExitArgs = [];
  process.exit = function(...args) {
    processExitArgs.push(args);
  };

  // Replay process.exit calls that happened while we were prompting and writing files:
  // eslint-disable-next-line no-inner-declarations
  return function replayAndRestoreProcessExit() {
    process.exit = originalProcessExit;
    for (const args of processExitArgs) {
      process.exit(...args);
    }
  };
}

module.exports = trapProcessExit;
