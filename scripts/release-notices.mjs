import fs from 'node:fs';
import path from 'node:path';

// Collect the licenses shipped with the locked production dependencies.
const target = 'release/notices';
// Remove notices for the retired native helper when reusing a build directory.
for (const name of ['DOTNET-LICENSE.txt', 'DOTNET-THIRD-PARTY-NOTICES.txt']) {
  fs.rmSync(path.join(target, name), { force: true });
}
fs.mkdirSync(target, { recursive: true });
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const inventory = [];
let notices = 'Micbridge production dependency notices\n\n';
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev || !fs.existsSync(`${location}/package.json`)) continue;
  const pkg = JSON.parse(fs.readFileSync(`${location}/package.json`, 'utf8'));
  const files = fs.readdirSync(location).filter(name => /^(licen[cs]e|copying|notice)/i.test(name) && fs.statSync(path.join(location, name)).isFile());
  if (!files.length) throw new Error(`Missing license text for ${pkg.name}`);
  inventory.push({ name: pkg.name, version: pkg.version, license: pkg.license, files });
  notices += `\n=== ${pkg.name} ${pkg.version} (${pkg.license}) ===\n`;
  for (const name of files) notices += `\n${name}\n${fs.readFileSync(path.join(location, name), 'utf8')}\n`;
}
fs.writeFileSync(`${target}/DEPENDENCIES.json`, JSON.stringify(inventory, null, 2) + '\n');
fs.writeFileSync(`${target}/NODE-LICENSES.txt`, notices);
const runtimeNotices = [
  ['LICENSE', 'MICBRIDGE-LICENSE.txt'],
  ['node_modules/electron/dist/LICENSE', 'ELECTRON-LICENSE.txt'],
  ['node_modules/electron/dist/LICENSES.chromium.html', 'CHROMIUM-LICENSES.html'],
];
for (const [source, name] of runtimeNotices) {
  if (!fs.existsSync(source)) throw new Error(`Required notice missing: ${source}`);
  fs.copyFileSync(source, `${target}/${name}`);
}
console.log(`Collected notices for ${inventory.length} production packages and bundled runtimes (${process.platform}).`);
