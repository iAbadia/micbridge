import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeWindowsAudio, findVbCableOutput } from '../shared/windows-audio-route.js';
test('VB-CABLE selection excludes default speakers, capture, extra cables and 16-channel output', () => {
  const device = (deviceId: string, label: string, kind = 'audiooutput') => ({ deviceId, label, kind });
  const wrong = [device('default', 'CABLE Input (VB-Audio Virtual Cable)'),
    device('communications', 'CABLE Input (VB-Audio Virtual Cable)'),
    device('speakers', 'Speakers'), device('mic', 'CABLE Output (VB-Audio Virtual Cable)', 'audioinput'),
    device('extra', 'CABLE-A Input (VB-Audio Cable A)'), device('sixteen', 'CABLE In 16 Ch (VB-Audio Virtual Cable)')];
  assert.equal(findVbCableOutput(wrong), undefined);
  const cable = device('cable', 'CABLE Input (VB-Audio Virtual Cable)');
  assert.equal(findVbCableOutput([...wrong, cable]), cable);
});
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
