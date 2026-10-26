import { expect, it, vi } from 'vitest';
import { Autosave } from './autosave';

it('flushes the latest draft before switching and preserves failed drafts for retry', async () => {
  const save = new Autosave();
  const writes: string[] = [];
  const error = vi.fn();
  save.schedule(async () => {
    writes.push('old');
  }, error);
  save.schedule(async () => {
    writes.push('note-a');
  }, error);
  await save.flush();
  expect(writes).toEqual(['note-a']);
  let fail = true;
  save.schedule(async () => {
    if (fail) throw new Error('disk full');
    writes.push('retry');
  }, error);
  await expect(save.flush()).rejects.toThrow('disk full');
  fail = false;
  await save.flush();
  expect(writes).toEqual(['note-a', 'retry']);
});
