import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const tag = process.env.RELEASE_TAG;
if (tag && tag !== `v${version}`) throw new Error(`Tag ${tag} must match package version v${version}`);
const target = 'release/assets';
fs.mkdirSync(target, { recursive: true });
if (process.argv.includes('--checksums')) {
  const names = fs.readdirSync(target).filter(name => name !== 'SHA256SUMS.txt').sort();
  if (!names.length) throw new Error('No release assets to checksum');
  const lines = names.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(target, name))).digest('hex')}  ${name}`);
  fs.writeFileSync(path.join(target, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
  console.log(`Checksummed ${names.length} release assets.`);
} else {
  const platform = process.env.RELEASE_PLATFORM;
  const arch = process.env.RELEASE_ARCH;
  const extensions = { windows: ['.exe'], linux: ['.AppImage', '.deb'], macos: ['.dmg'] }[platform];
  if (!extensions || !['x64', 'arm64'].includes(arch)) throw new Error('Specify RELEASE_PLATFORM and RELEASE_ARCH');
  if (platform === 'windows') {
    for (const kind of ['setup', 'portable']) {
      const name = `Micbridge-${version}-windows-${arch}-${kind}.exe`;
      if (!fs.existsSync(path.join('release', name))) throw new Error(`Missing Windows ${kind} package: ${name}`);
      fs.copyFileSync(path.join('release', name), path.join(target, name));
    }
  }
  for (const ext of platform === 'windows' ? [] : extensions) {
    const candidates = fs.readdirSync('release').filter(name => name.endsWith(ext));
    if (candidates.length !== 1) throw new Error(`Expected one ${ext} package, found ${candidates.length}`);
    fs.copyFileSync(path.join('release', candidates[0]), path.join(target, `Micbridge-${version}-${platform}-${arch}${ext}`));
  }
  execFileSync('tar', ['-czf', path.join(target, `Micbridge-${version}-${platform}-${arch}-notices.tar.gz`), '-C', 'release', 'notices']);
  console.log(`Staged ${platform}/${arch} downloads and notices.`);
}
