import { test } from './tests';
import readdirp from 'readdirp';
import { hrtime } from 'process';
import { join } from 'path';
import colors from 'colors';
colors.enable();

(async () => {
  const entries = await readdirp.promise(join(__dirname, 'tests'));
  for (const entry of entries) {
    if (entry.basename.includes('index')) continue;
    await import(entry.fullPath);
  }

  test.before(async () => {
    await new Promise<void>((resolve, _) => setTimeout(() => resolve(), 1000));
  });

  test.before.each(context => {
    context.__hrtime__ = hrtime();
  });

  test.after.each(context => {
    const nanoseconds = hrtime(context.__hrtime__)[1];
    const milliseconds = Math.ceil(nanoseconds / 1_000_000).toString();
    const log =
      'TEST:\t'.yellow + `${milliseconds.padStart(5, ' ')}ms`.green + '\t' + context.__test__.blue;
    console.log(log);
  });

  test.run();
})();
