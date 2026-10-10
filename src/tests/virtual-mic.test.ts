import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualMicrophone } from '../server/virtual-mic.js';

test('Windows and macOS native routing fails gracefully and leaves monitoring available', { skip: process.platform === 'linux' }, async () => {
  const statuses: string[] = [];
  const output = new VirtualMicrophone(status => statuses.push(status));
  await output.start();
  assert.match(statuses.at(-1)!, /^Unavailable: Use Desktop output/);
  // Incoming audio after a failed routing request must remain safe.
  output.write(Buffer.alloc(0));
  await output.stop();
  assert.equal(statuses.at(-1), 'Stopped');
});
