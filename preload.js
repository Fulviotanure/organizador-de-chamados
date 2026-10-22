const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // External browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Local storage persistence on disk
  loadStorage: (key, defaultValue) => ipcRenderer.invoke('storage-load', key, defaultValue),
  saveStorage: (key, value) => ipcRenderer.invoke('storage-save', key, value),
  getAllStorage: () => ipcRenderer.invoke('storage-get-all'),

  // Native notifications
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  // Open temp attachment file with default system app
  openBufferTemp: (fileName, buffer) => ipcRenderer.invoke('open-buffer-temp', { fileName, buffer }),

  // AutoDrive Integration
  launchAutoDrive: (data) => ipcRenderer.invoke('launch-autodrive', data),
  getDriveStatus: () => ipcRenderer.invoke('drive-get-status'),
  checkDriveLayout: (data) => ipcRenderer.invoke('drive-check-layout', data),
  uploadDriveLayout: (data) => ipcRenderer.invoke('drive-upload-layout', data),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  onDriveProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('drive-upload-progress', handler);
    return () => ipcRenderer.removeListener('drive-upload-progress', handler);
  },

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('updater-check'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('updater-restart-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdaterStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('updater-status', handler);
    return () => ipcRenderer.removeListener('updater-status', handler);
  }
});
