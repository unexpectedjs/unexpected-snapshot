function trapMethod(obj, methodName) {
  const originalMethod = obj[methodName];
  const replayArgsArrays = [];
  obj[methodName] = function (...args) {
    replayArgsArrays.push(args);
  };

  // Replay calls that happened while the method was trapped:
  return function restoreAndReplay() {
    obj[methodName] = originalMethod;
    for (const args of replayArgsArrays) {
      obj[methodName](...args);
    }
  };
}

module.exports = trapMethod;
