const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Define user settings file in userData directory
const getUserDataFile = (filename) => path.join(app.getPath('userData'), filename);

function loadJsonFile(filename, defaultValue = {}) {
  try {
    const filePath = getUserDataFile(filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error loading ${filename}:`, err);
  }
  return defaultValue;
}

function saveJsonFile(filename, data) {
  try {
    const filePath = getUserDataFile(filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    console.error(`Error saving ${filename}:`, err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Custom sleek titlebar
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // Allows loading local and API resources seamlessly
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links safely in system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// Window control IPC handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Safe external links
ipcMain.handle('open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// Storage handlers (persisted to appData)
ipcMain.handle('storage-load', (event, key, defaultValue) => {
  const store = loadJsonFile('storage.json', {});
  return store[key] !== undefined ? store[key] : defaultValue;
});

ipcMain.handle('storage-save', (event, key, value) => {
  const store = loadJsonFile('storage.json', {});
  store[key] = value;
  return saveJsonFile('storage.json', store);
});

ipcMain.handle('storage-get-all', () => {
  return loadJsonFile('storage.json', {});
});

// Native notifications
ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return true;
  }
  return false;
});

// Open attachment in default OS program (PDF reader, Excel, Word, etc.)
ipcMain.handle('open-buffer-temp', async (event, { fileName, buffer }) => {
  try {
    const tempDir = app.getPath('temp');
    const safeName = (fileName || 'anexo').replace(/[/\\?%*:|"<>]/g, '_');
    const tempFilePath = path.join(tempDir, safeName);
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));
    const openErr = await shell.openPath(tempFilePath);
    if (openErr) {
      console.warn('shell.openPath returned:', openErr);
      return { success: false, error: openErr };
    }
    return { success: true, path: tempFilePath };
  } catch (err) {
    console.error('Error opening temp file:', err);
    return { success: false, error: err.message };
  }
});

// ------------------- Auto Updater (GitHub Releases) -------------------
function sendUpdaterStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', payload);
  }
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
if (!app.isPackaged) {
  autoUpdater.forceDevUpdateConfig = true;
}

autoUpdater.on('checking-for-update', () => {
  sendUpdaterStatus({ status: 'checking', message: 'Verificando atualizações...' });
});

autoUpdater.on('update-available', (info) => {
  sendUpdaterStatus({
    status: 'available',
    message: `Nova versão ${info.version} encontrada! Baixando...`,
    version: info.version
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdaterStatus({
    status: 'not-available',
    message: 'Seu Organizador de Chamados está na versão mais recente.'
  });
});

autoUpdater.on('error', (err) => {
  console.warn('AutoUpdater warning:', err.message);
  sendUpdaterStatus({
    status: 'error',
    message: `Erro ao verificar atualizações: ${err.message}`
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent || 0);
  sendUpdaterStatus({
    status: 'downloading',
    percent,
    message: `Baixando atualização: ${percent}%`
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdaterStatus({
    status: 'downloaded',
    version: info.version,
    message: `Versão ${info.version} baixada e pronta para instalar!`
  });

  if (Notification.isSupported()) {
    new Notification({
      title: 'Atualização Pronta',
      body: `A versão ${info.version} foi baixada com sucesso. Reinicie o aplicativo para aplicar as novidades.`
    }).show();
  }
});

// Auto-updater IPC handlers
ipcMain.handle('updater-check', async () => {
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: res?.updateInfo };
  } catch (err) {
    let msg = err.message || 'Erro ao verificar atualizações';
    if (msg.includes('404') || msg.includes('releases.atom')) {
      msg = 'Nenhuma versão publicada encontrada no GitHub (404). Certifique-se de que o repositório é público e de que existe pelo menos uma Release publicada.';
    }
    return { success: false, error: msg };
  }
});

ipcMain.handle('updater-restart-install', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

app.whenReady().then(() => {
  createWindow();

  // Check for updates 5 seconds after startup if in production package
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => console.warn('Silent auto-update check:', e.message));
    }, 5000);

    // Periodically check for updates every 20 minutes while app is running
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(e => console.warn('Periodic auto-update check:', e.message));
    }, 20 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
