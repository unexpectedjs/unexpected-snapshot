const createInspector = expect => {
  const expectForRendering = expect.child();

  if (typeof Buffer === 'function') {
    expectForRendering.addType({
      name: 'infiniteBuffer',
      base: 'Buffer',
      identify(obj) {
        return this.baseType.identify(obj);
      },
      inspect(value, depth, output, inspect) {
        if (value.length > 32) {
          return output.code(
            `Buffer.from('${value.toString('base64')}', 'base64')`,
            'javascript'
          );
        } else {
          return this.baseType.inspect.call(
            this,
            value,
            depth,
            output,
            inspect
          );
        }
      },
      prefix(output) {
        return output.code('Buffer.from([', 'javascript');
      },
      suffix(output) {
        return output.code('])', 'javascript');
      },
      hexDumpWidth: Infinity // Prevents Buffer instances > 16 bytes from being truncated
    });
  }

  expectForRendering.addType({
    base: 'Error',
    name: 'overriddenError',
    identify(obj) {
      return this.baseType.identify(obj);
    },
    inspect(value, depth, output, inspect) {
      var obj = {};
      Object.keys(value).forEach(key => {
        obj[key] = value[key];
      });

      var keys = Object.keys(obj);
      if (keys.length === 0) {
        output
          .text('new Error(')
          .append(inspect(value.message || ''))
          .text(')');
      } else {
        output
          .text('(function () {')
          .text(`var err = new ${value.constructor.name || 'Error'}(`)
          .append(inspect(value.message || ''))
          .text(');');
        keys.forEach(function(key, i) {
          output.sp();
          if (/^[a-z$_][a-z0-9$_]*$/i.test(key)) {
            output.text(`err.${key}`);
          } else {
            output
              .text('err[')
              .append(inspect(key))
              .text(']');
          }
          output
            .text(' = ')
            .append(inspect(obj[key]))
            .text(';');
        });
        output.sp().text('return err;}())');
      }
    }
  });

  return (value, indentationWidth = 2) => {
    expectForRendering.output.indentationWidth = indentationWidth;
    return expectForRendering.inspect(value, Infinity).toString('text');
  };
};

module.exports = createInspector;
