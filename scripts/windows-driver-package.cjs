const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const directory = path.resolve('native/windows-driver/package');
  if (!fs.existsSync(directory)) return;
  for (const file of ['MicbridgeDriverSetup.exe', 'install.ps1', 'MS-PL.txt']) {
    if (!fs.existsSync(path.join(directory, file))) throw new Error(`Incomplete driver package: ${file}`);
  }
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
    path.resolve('scripts/verify-windows-driver.ps1'), '-Package', directory], { stdio: 'inherit' });
};
