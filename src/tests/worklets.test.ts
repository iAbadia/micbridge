import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
function worklet(file: string, sampleRate: number) {
  const messages: any[] = []; let Processor: any;
  const context = vm.createContext({ sampleRate, currentTime: 0, Int16Array, Float32Array, Math,
    AudioWorkletProcessor: class { port = { onmessage: null as any, postMessage: (data: any) => messages.push(data) }; },
    registerProcessor: (_name: string, constructor: any) => { Processor = constructor; }
  });
  vm.runInContext(readFileSync(new URL(`../../web/${file}`, import.meta.url), 'utf8'), context);
  return { processor: new Processor(), messages };
}
test('capture emits exact 20 ms frames, averages channels, clips gain, and mutes', () => {
  const { processor: p, messages } = worklet('capture-worklet.js', 48000);
  const output = [new Float32Array(128).fill(1)];
  p.port.onmessage({ data: { gain: 3, muted: false } });
  for (let i = 0; i < 8; i++) p.process([[new Float32Array(128).fill(.8), new Float32Array(128).fill(.4)]], [output]);
  assert.equal(messages.length, 1); assert.equal(messages[0].samples.length, 960); assert.equal(messages[0].samples[0], 32767); assert.equal(output[0][0], 0);
  p.port.onmessage({ data: { gain: 1, muted: true } });
  for (let i = 0; i < 8; i++) p.process([[new Float32Array(128).fill(.8)]], [output]);
  assert.equal(messages[1].samples[64], 0);
});
test('playback primes, resamples mono to stereo, caps stale queues and reports underruns', () => {
  const { processor: p } = worklet('playback-worklet.js', 48000);
  const output = [new Float32Array(128), new Float32Array(128)];
  p.process([], [output]); assert.equal(output[0][0], 0);
  p.port.onmessage({ data: { sampleRate: 44100, samples: new Int16Array(4410).fill(16384) } });
  p.process([], [output]); assert.equal(output[0][0], .5); assert.equal(output[1][0], .5);
  p.port.onmessage({ data: { sampleRate: 44100, samples: new Int16Array(12000).fill(16384) } });
  assert.ok(p.dropped > 0); assert.ok(p.write - p.read <= 44100 * .061);
  for (let i = 0; i < 100; i++) p.process([], [output]); assert.ok(p.underruns > 0);
});
