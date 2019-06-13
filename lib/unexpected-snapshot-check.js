module.exports = {
  name: 'unexpected-snapshot',
  version: require('../package.json').version,
  installInto(expect) {
    expect.unindent = require('@gustavnikolaj/string-utils').deindent;

    const snapshotMessage =
      'UNEXPECTED_SNAPSHOT environment not given, not updating snapshots in source files\n' +
      'Rerun the command with UNEXPECTED_SNAPSHOT=yes to update the snapshots';

    const withSnapshotMessageAppended = (expect, cb) => {
      expect.withError(cb, err => {
        expect.errorMode = 'bubble';
        expect.fail(output => {
          if (!err.isUnexpected) {
            throw err;
          }

          output.appendErrorMessage(err);
          output.nl(2).jsComment(snapshotMessage);
        });
      });
    };

    expect.addAssertion('<any> to equal snapshot', expect => {
      withSnapshotMessageAppended(expect, () => {
        expect.fail();
      });
    });

    expect.addAssertion(
      '<any> to equal snapshot <any>',
      (expect, subject, value) => {
        withSnapshotMessageAppended(expect, () => {
          expect(subject, 'to equal', value);
        });
      }
    );

    expect.addAssertion('<any> to inspect as snapshot', expect => {
      withSnapshotMessageAppended(expect, () => {
        expect.fail();
      });
    });

    expect.addAssertion(
      '<any> to inspect as snapshot <string>',
      (expect, subject, value) => {
        withSnapshotMessageAppended(expect, () => {
          expect(expect.inspect(subject).toString('text'), 'to equal', value);
        });
      }
    );
  }
};