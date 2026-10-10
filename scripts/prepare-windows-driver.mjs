import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Pin the Microsoft framework; never apply transformations to a moving branch.
const revision = '2dc3fd3a0cc84a2933f2194e7ec0871584979071';
const root = path.resolve('.tools/micbridge-driver');
const upstream = path.resolve('.tools/windows-driver-samples');
try { await fs.access(path.join(upstream, '.git')); } catch {
  execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', 'https://github.com/microsoft/Windows-driver-samples.git', upstream], { stdio: 'inherit' });
}
execFileSync('git', ['-C', upstream, 'sparse-checkout', 'set', 'audio/simpleaudiosample'], { stdio: 'inherit' });
execFileSync('git', ['-C', upstream, 'checkout', '--detach', revision], { stdio: 'inherit' });
const generated = path.join(root, 'audio/simpleaudiosample');
await fs.mkdir(root, { recursive: true });
await fs.cp(path.join(upstream, 'audio/simpleaudiosample'), generated, { recursive: true, force: true });
for (const name of ['Directory.Build.props', 'packages.config', 'LICENSE']) {
  await fs.copyFile(path.join(upstream, name), path.join(root, name));
}
// Keep the upstream filenames/project layout; only replace the device identity.
const main = path.join(generated, 'Source/Main');
async function transform(relative, apply) {
  const file = path.join(generated, relative);
  const text = (await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n');
  await fs.writeFile(file, apply(text));
}
function replaceOnce(text, old, value) {
  if (!text.includes(old)) throw new Error(`Pinned driver source changed: ${old.slice(0, 80)}`);
  return text.replace(old, value);
}
for (const name of ['bridge-buffer.h', 'bridge-kernel.h']) {
  await fs.copyFile(path.resolve('native/windows-driver', name), path.join(main, name));
}
await transform('Source/Main/adapter.cpp', text => {
  text = replaceOnce(text, '#include "minipairs.h"', '#include "minipairs.h"\n#include "bridge-kernel.h"\nMicbridgeBuffer g_MicbridgeBuffer;\nKSPIN_LOCK g_MicbridgeLock;');
  text = replaceOnce(text, 'DPF(D_TERSE, ("[DriverEntry]"));', 'KeInitializeSpinLock(&g_MicbridgeLock);\n    MicbridgeReset(false);\n    DPF(D_TERSE, ("[DriverEntry]"));');
  // Disable all sample recording and test-tone registry overrides.
  return text.replace('RTL_QUERY_REGISTRY_DIRECT | RTL_QUERY_REGISTRY_TYPECHECK, L"DoNotCreateDataFiles"', 'RTL_QUERY_REGISTRY_DIRECT | RTL_QUERY_REGISTRY_TYPECHECK, L"MicbridgeReservedNoFiles"');
});
await transform('Source/Main/minwavertstream.cpp', text => {
  text = replaceOnce(text, '#include "minwavertstream.h"', '#include "minwavertstream.h"\n#include "bridge-kernel.h"');
  const start = text.indexOf('    if (m_bCapture)\n    {\n        ReadRegistrySettings();');
  const end = text.indexOf('    else if (!g_DoNotCreateDataFiles)', start);
  if (start < 0 || end < 0) throw new Error('Capture initialization patch failed');
  text = text.slice(0, start) + '    if (!m_bCapture && !g_DoNotCreateDataFiles)' + text.slice(end + '    else if (!g_DoNotCreateDataFiles)'.length);
  text = replaceOnce(text, '    switch (State_)', '    if (!m_bCapture) MicbridgeReset(State_ == KSSTATE_RUN);\n    else if (State_ == KSSTATE_RUN && m_KsState != KSSTATE_RUN) MicbridgeFlush();\n    switch (State_)');
  text = replaceOnce(text, '        m_ToneGenerator.GenerateSine(m_pDmaBuffer + bufferOffset, runWrite);', '        MicbridgeTransfer(m_pDmaBuffer + bufferOffset, runWrite, true);');
  text = replaceOnce(text, '        m_SaveData.WriteData(m_pDmaBuffer + bufferOffset, runWrite);', '        MicbridgeTransfer(m_pDmaBuffer + bufferOffset, runWrite, false);');
  text = replaceOnce(text, '        if (!g_DoNotCreateDataFiles)\n        {\n            // Read from buffer and write to a file.\n            ReadBytes(ByteDisplacement);\n        }', '        ReadBytes(ByteDisplacement);');
  // All other sample persistence paths stay disabled regardless of registry.
  return text.replaceAll('!g_DoNotCreateDataFiles', 'false');
});
await transform('Source/Filters/micarraywavtable.h', text => text
  .replaceAll('MICARRAY_32_BITS_PER_SAMPLE_PCM', 'MICARRAY_16_BITS_PER_SAMPLE_PCM')
  .replace(/(MICARRAY_16_BITS_PER_SAMPLE_PCM\s+)32/, (_, prefix) => `${prefix}16`)
  .replace('384000,', '192000,').replace('                8,', '                4,')
  .replaceAll('                32,', '                16,').replace('            32,', '            16,')
  .replace('48 KHz 32-bit', '48 KHz 16-bit'));
await transform('Source/Main/SimpleAudioSample.inx', text => text
  .replaceAll('ROOT\\SimpleAudioSample', 'ROOT\\Micbridge')
  .replaceAll('SimpleAudioSample.cat', 'Micbridge.cat')
  .replace('ProviderName = "TODO-Set-Provider"', 'ProviderName = "Iñaki Abadia"')
  .replace('MfgName      = "TODO-Set-Manufacturer"', 'MfgName      = "Micbridge"')
  .replace('MsCopyRight  = "TODO-Set-Copyright"', 'MsCopyRight  = "Copyright 2026 Iñaki Abadia"')
  .replaceAll('Virtual Audio Device (WDM) - Simple Audio Sample Driver', 'Micbridge Virtual Audio Driver')
  .replaceAll('Virtual Audio Device (WDM) - Simple Audio Sample', 'Micbridge Virtual Audio')
  .replaceAll('Simple Audio Sample Wave Speaker', 'Micbridge Input')
  .replaceAll('Simple Audio Sample Topology Speaker', 'Micbridge Input')
  .replaceAll('Simple Audio Sample Wave Microphone Array - Front', 'Micbridge Microphone')
  .replaceAll('Simple Audio Sample Topology Microphone Array - Front', 'Micbridge Microphone')
  .replaceAll('Internal Microphone Array - Front', 'Micbridge Microphone')
  .replace('DriverVer   = 02/22/2016, 1.0.0.1', 'DriverVer   = 10/10/2026, 0.4.0.0'));
console.log(`Prepared Micbridge driver from Microsoft ${revision}\n${generated}`);
