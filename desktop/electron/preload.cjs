const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('medx', {
  isElectron: true,
  /**
   * Print arbitrary HTML.
   * In Electron main we can do silent printing to a specific deviceName.
   */
  printHtml: (payload) => ipcRenderer.invoke('print:html', payload),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
});

