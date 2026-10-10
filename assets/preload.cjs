const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('micbridgeDesktop', {
  setupMicrophone: () => ipcRenderer.invoke('micbridge:setup-microphone'),
  renameMicrophone: () => ipcRenderer.invoke('micbridge:rename-microphone'),
});
