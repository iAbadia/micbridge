export interface WindowsAudioContext {
  suspend(): Promise<void>;
  resume(): Promise<void>;
  setSinkId(id: string): Promise<void>;
}
// Switching must stay silent if Windows rejects or removes the target device.
export async function routeWindowsAudio(context: WindowsAudioContext, deviceId: string, reset: () => void) {
  await context.suspend();
  await context.setSinkId(deviceId);
  reset();
  try { await context.resume(); }
  catch (error) { await context.suspend().catch(() => {}); throw error; }
}
