import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { sendReactMail } from 'src/mailer';

export const sendTestMails = async () => {
  const dir = join(__dirname, '..', 'emails');
  const entries = await readdir(dir);
  const valid = entries.filter(e => !e.startsWith('_') && e.endsWith('.template.tsx'));
  for (const file of valid) {
    const path = join(dir, file);
    const module = await import(path).then(m => m.default);

    sendReactMail({
      from: 'test@kompakkt.de',
      to: 'admin@kompakkt.de',
      subject: `Test mail: ${file}`,
      jsx: await module(module.PreviewProps),
    });
  }
};
