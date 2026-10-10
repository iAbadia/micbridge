import { app, BrowserWindow, Menu, Tray, nativeImage, session, dialog } from 'electron';
import { startServer } from '../server/server.js';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
let win: BrowserWindow | null = null;
let backend: Awaited<ReturnType<typeof startServer>> | null = null;
let tray: Tray | null = null, quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.on('activate', () => win?.show());
  app.on('before-quit', event => {
    if (!quitting) { event.preventDefault(); quitting = true; void backend?.close().finally(() => app.quit()); }
  });
  // Let the ESM entry module finish loading before waiting for Electron readiness.
  void app.whenReady().then(async () => {
  try {
    const tls = process.env.MICBRIDGE_TLS_KEY && process.env.MICBRIDGE_TLS_CERT ? { key: await fs.readFile(process.env.MICBRIDGE_TLS_KEY, 'utf8'), cert: await fs.readFile(process.env.MICBRIDGE_TLS_CERT, 'utf8') } : undefined;
    backend = await startServer({ directory: process.env.MICBRIDGE_DATA ?? app.getPath('userData'), mobilePort: Number(process.env.MICBRIDGE_PORT ?? 8443), setupPort: Number(process.env.MICBRIDGE_SETUP_PORT ?? 8442), tls });
  } catch (err) {
    dialog.showErrorBox('Micbridge could not start', (err as Error).message); app.exit(1); throw err;
  }
  if (process.env.MICBRIDGE_LOG_STARTUP === '1') console.log(`Desktop: ${backend.localUrl}`);
  const origin = new URL(backend.localUrl).origin;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(contents.getURL().startsWith(`${origin}/`) && ['media', 'speaker-selection'].includes(permission)));
  const icon = nativeImage.createFromPath(fileURLToPath(new URL('../../assets/icon.png', import.meta.url)));
  win = new BrowserWindow({ width: 1160, height: 820, minWidth: 850, minHeight: 650, title: 'Micbridge', icon,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#10181d', symbolColor: '#eef2eb', height: 60 },
    trafficLightPosition: { x: 18, y: 23 }, autoHideMenuBar: true, backgroundColor: '#10181d', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  win.on('close', event => { if (!quitting) { event.preventDefault(); win?.hide(); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Micbridge', submenu: [{ label: 'Show window', click: () => win?.show() }, { label: 'Start at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: process.platform !== 'linux', click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) }, { role: 'quit' }] },
    { role: 'editMenu' }, { role: 'viewMenu' }
  ]));
  tray = new Tray(icon.resize({ width: 20, height: 20 })); tray.setToolTip('Micbridge — browser microphone');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Show Micbridge', click: () => win?.show() }, { label: 'Quit', click: () => app.quit() }]));
  tray.on('click', () => win?.show());
  const desktopUrl = new URL(backend.localUrl); desktopUrl.searchParams.set('desktop', process.platform);
  await win.loadURL(desktopUrl.toString());
  if (process.env.MICBRIDGE_LOG_STARTUP === '1') console.log('Desktop window loaded');
  }).catch(error => { console.error(error); dialog.showErrorBox('Micbridge startup error', String(error)); app.exit(1); });
}
