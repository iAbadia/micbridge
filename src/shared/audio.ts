export const HEADER_BYTES = 20;
export const MAX_FRAME_BYTES = 8192;
export const MAGIC = 0x3142434d; // MCB1, little-endian
export interface AudioFrame { sequence: number; timestamp: number; sampleRate: number; samples: Int16Array }

// Version 1: PCM16 mono, 20 ms, all integer fields little-endian.
export function encodeFrame(frame: AudioFrame): Uint8Array {
  const result = new Uint8Array(HEADER_BYTES + frame.samples.length * 2);
  const v = new DataView(result.buffer);
  v.setUint32(0, MAGIC, true); v.setUint32(4, frame.sequence, true);
  v.setFloat64(8, frame.timestamp, true); v.setUint32(16, frame.sampleRate, true);
  for (let i = 0; i < frame.samples.length; i++) v.setInt16(HEADER_BYTES + i * 2, frame.samples[i], true);
  return result;
}

export function decodeFrame(bytes: Uint8Array): AudioFrame {
  if (bytes.length < HEADER_BYTES + 2 || bytes.length > MAX_FRAME_BYTES || (bytes.length - HEADER_BYTES) % 2) throw new Error('Invalid frame size');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, true) !== MAGIC) throw new Error('Invalid audio protocol');
  const sampleRate = v.getUint32(16, true), timestamp = v.getFloat64(8, true);
  if (![16000, 24000, 44100, 48000].includes(sampleRate) || !Number.isFinite(timestamp)) throw new Error('Invalid audio format');
  const count = (bytes.length - HEADER_BYTES) / 2;
  if (count !== Math.round(sampleRate / 50)) throw new Error('Expected 20 ms mono frame');
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) samples[i] = v.getInt16(HEADER_BYTES + i * 2, true);
  return { sequence: v.getUint32(4, true), timestamp, sampleRate, samples };
}

export function rms(samples: Int16Array): number {
  let total = 0;
  for (const sample of samples) total += (sample / 32768) ** 2;
  return Math.sqrt(total / samples.length);
}

export function waveHeader(dataLength: number, sampleRate: number): Buffer {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(dataLength + 36, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(dataLength, 40);
  return b;
}
