import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFrame, encodeFrame, waveHeader } from '../shared/audio.js';
test('20 ms audio frame preserves signed samples and wrapped sequence', () => {
  const samples = new Int16Array(960); samples.set([-32768, -1, 0, 1, 32767]);
  const decoded = decodeFrame(encodeFrame({ samples, sequence: 0xffffffff, timestamp: 12.5, sampleRate: 48000 }));
  assert.deepEqual(decoded.samples, samples); assert.equal(decoded.sequence, 0xffffffff); assert.equal(decoded.timestamp, 12.5);
});
test('rejects malformed and oversized audio without reading outside buffers', () => {
  for (const bytes of [new Uint8Array(0), new Uint8Array(21), new Uint8Array(8194)]) assert.throws(() => decodeFrame(bytes));
  const valid = encodeFrame({ samples: new Int16Array(960), sequence: 1, timestamp: 0, sampleRate: 48000 });
  valid[0] = 0; assert.throws(() => decodeFrame(valid), /protocol/);
});
test('WAV header describes mono PCM16 at capture rate', () => {
  const header = waveHeader(1920, 48000);
  assert.equal(header.toString('ascii', 0, 4), 'RIFF'); assert.equal(header.readUInt32LE(4), 1956);
  assert.equal(header.readUInt16LE(22), 1); assert.equal(header.readUInt32LE(24), 48000); assert.equal(header.readUInt16LE(34), 16); assert.equal(header.readUInt32LE(40), 1920);
});
