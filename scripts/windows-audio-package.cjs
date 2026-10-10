module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  if (process.platform !== 'win32' || context.arch !== 1) throw new Error('Bundled VB-CABLE releases currently require a Windows x64 build.');
  const { prepareVbCable } = await import('./prepare-vb-cable.mjs');
  await prepareVbCable();
};
