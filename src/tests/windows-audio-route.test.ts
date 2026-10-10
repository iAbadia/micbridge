import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeWindowsAudio } from '../shared/windows-audio-route.js';
test('Windows microphone switches silently, clears queued audio, then resumes', async () => {
  const calls: string[] = [];
  await routeWindowsAudio({ suspend: async () => { calls.push('suspend'); },
    setSinkId: async id => { calls.push(`sink:${id}`); }, resume: async () => { calls.push('resume'); } },
  'owned-device', () => calls.push('reset'));
  assert.deepEqual(calls, ['suspend', 'sink:owned-device', 'reset', 'resume']);
});
test('removed microphone cannot fall back to playing phone audio on speakers', async () => {
  let resumed = false, reset = false;
  await assert.rejects(routeWindowsAudio({ suspend: async () => {},
    setSinkId: async () => { throw new Error('Device removed'); }, resume: async () => { resumed = true; } },
  'gone', () => { reset = true; }), /Device removed/);
  assert.equal(resumed, false); assert.equal(reset, false);
});
test('failed resume suspends the Windows route before reporting failure', async () => {
  let suspensions = 0;
  await assert.rejects(routeWindowsAudio({ suspend: async () => { suspensions++; },
    setSinkId: async () => {}, resume: async () => { throw new Error('Audio service unavailable'); } },
  'owned-device', () => {}), /Audio service unavailable/);
  assert.equal(suspensions, 2);
});
