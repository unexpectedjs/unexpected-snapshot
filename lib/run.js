const childProcess = require('child_process');
const byLine = require('byline');

module.exports = function run(command, args, options) {
  if (!Array.isArray(args)) {
    options = args;
    args = [];
  }
  options = options || {};
  const proc = childProcess.spawn(command, args, options);

  const commandLine = command + (args.length > 0 ? ` ${args.join(' ')}` : '');

  const bufferedLinesByStreamName = {};

  proc.commandLine = commandLine;

  ['stderr', 'stdout'].forEach(function (streamName) {
    if (options.bufferLines) {
      bufferedLinesByStreamName[streamName] = [];
    }
    byLine(proc[streamName]).on('data', function (chunk) {
      const line = chunk.toString('utf-8');
      if (options.bufferLines) {
        bufferedLinesByStreamName[streamName].push(line);
      }
      setImmediate(function () {
        proc.emit('output', line, streamName);
      });
    });
  });
  return new Promise((resolve, reject) => {
    proc
      .on('error', (err) =>
        resolve([
          null,
          err,
          bufferedLinesByStreamName.stdout,
          bufferedLinesByStreamName.stderr,
        ]),
      )
      .on('exit', (exitCode) => {
        resolve([
          exitCode,
          null,
          bufferedLinesByStreamName.stdout,
          bufferedLinesByStreamName.stderr,
        ]);
      });
  });
};
