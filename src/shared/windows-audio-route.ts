export interface WindowsAudioContext {
  suspend(): Promise<void>;
  resume(): Promise<void>;
  setSinkId(id: string): Promise<void>;
}
// Match only the base VB-CABLE playback endpoint, not its recording endpoint,
// additional A/B/C/D cables, 16-channel endpoint, or system-default aliases.
export function findVbCableOutput<T extends { kind: string; deviceId: string; label: string }>(devices: readonly T[]): T | undefined {
  return devices.find(device => device.kind === 'audiooutput'
    && !['default', 'communications'].includes(device.deviceId)
    && /\bCABLE Input\b/i.test(device.label)
    && /VB-Audio Virtual Cable/i.test(device.label));
}
// Switching must stay silent if Windows rejects or removes the target device.
export async function routeWindowsAudio(context: WindowsAudioContext, deviceId: string, reset: () => void) {
  await context.suspend();
  await context.setSinkId(deviceId);
  reset();
  try { await context.resume(); }
  catch (error) { await context.suspend().catch(() => {}); throw error; }
}
