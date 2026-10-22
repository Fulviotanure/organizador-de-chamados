const { app, BrowserWindow, ipcMain, shell, Notification, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
} catch (e) {
  console.warn('electron-updater não disponível no ambiente atual:', e.message);
}

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

// Google Drive & AutoDrive Native Integration
const { GoogleDriveService } = require('./src/googleDriveService');
const initialStorage = loadJsonFile('storage.json', {});
const driveService = new GoogleDriveService({
  userDataPath: app.getPath('userData'),
  customMirrorDir: initialStorage.googleDriveMirrorPath || null,
  configuredEmail: initialStorage.googleDriveEmail || null,
  configuredPassword: initialStorage.googleDrivePassword || null
});

function getDefaultMirrorPath() {
  const documentsDir = app.getPath('documents');
  return path.join(documentsDir, 'OrganizadorChamados', 'Backup_Drive');
}

ipcMain.handle('drive-get-config', () => {
  const store = loadJsonFile('storage.json', {});
  return {
    email: store.googleDriveEmail || '',
    password: store.googleDrivePassword || '',
    mirrorPath: store.googleDriveMirrorPath || getDefaultMirrorPath()
  };
});

ipcMain.handle('drive-disconnect', async () => {
  try {
    const store = loadJsonFile('storage.json', {});
    delete store.googleDriveEmail;
    delete store.googleDrivePassword;
    delete store.googleDriveMirrorPath;
    saveJsonFile('storage.json', store);

    if (driveService) {
      driveService.setDriveConfig({ email: '', password: '', mirrorPath: '' });
      driveService.cachedAccessToken = null;
      driveService.tokenExpiry = 0;
    }

    const userTokenPath = path.join(app.getPath('userData'), 'token.json');
    if (fs.existsSync(userTokenPath)) {
      try { fs.unlinkSync(userTokenPath); } catch (e) {}
    }

    return { success: true };
  } catch (err) {
    console.error('Error in drive-disconnect:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clear-all-credentials', async () => {
  try {
    const store = loadJsonFile('storage.json', {});
    delete store.token;
    delete store.currentUser;
    delete store.savedCredentials;
    delete store.googleDriveEmail;
    delete store.googleDrivePassword;
    delete store.cachedDemands;
    delete store.lastSync;
    saveJsonFile('storage.json', store);

    if (driveService) {
      driveService.setDriveConfig({ email: '', password: '', mirrorPath: '' });
      driveService.cachedAccessToken = null;
      driveService.tokenExpiry = 0;
    }

    const userTokenPath = path.join(app.getPath('userData'), 'token.json');
    if (fs.existsSync(userTokenPath)) {
      try { fs.unlinkSync(userTokenPath); } catch (e) {}
    }

    return { success: true };
  } catch (err) {
    console.error('Error in clear-all-credentials:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('drive-save-config', async (event, config = {}) => {
  try {
    const store = loadJsonFile('storage.json', {});
    if (config.email !== undefined) store.googleDriveEmail = config.email;
    if (config.password !== undefined) store.googleDrivePassword = config.password;
    if (config.mirrorPath !== undefined) store.googleDriveMirrorPath = config.mirrorPath;
    saveJsonFile('storage.json', store);

    if (driveService) {
      driveService.setDriveConfig({
        email: config.email,
        password: config.password,
        mirrorPath: config.mirrorPath
      });
    }

    const status = await driveService.getStatus();
    return { success: true, status };
  } catch (err) {
    console.error('Error in drive-save-config:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-directory', async (event, defaultPath) => {
  try {
    const store = loadJsonFile('storage.json', {});
    const targetDefault = defaultPath || store.googleDriveMirrorPath || undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecione a Pasta de Backup (Espelho Local)',
      defaultPath: targetDefault && fs.existsSync(targetDefault) ? targetDefault : undefined,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('drive-get-status', async () => {
  try {
    return await driveService.getStatus();
  } catch (err) {
    return { connected: false, error: err.message };
  }
});

ipcMain.handle('drive-check-layout', async (event, data = {}) => {
  try {
    const store = loadJsonFile('storage.json', {});
    if (!data.customMirrorDir && store.googleDriveMirrorPath) {
      data.customMirrorDir = store.googleDriveMirrorPath;
    }
    const result = await driveService.checkLayoutPreFlight(data);
    return { success: true, ...result };
  } catch (err) {
    console.error('Error in drive-check-layout:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('drive-upload-layout', async (event, data = {}) => {
  try {
    const store = loadJsonFile('storage.json', {});
    if (!data.customMirrorDir && store.googleDriveMirrorPath) {
      data.customMirrorDir = store.googleDriveMirrorPath;
    }
    const result = await driveService.processLayoutUpload(data, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('drive-upload-progress', progress);
      }
    });
    return { success: true, ...result };
  } catch (err) {
    console.error('Error in drive-upload-layout:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-path', async (event, targetPath) => {
  try {
    if (targetPath && fs.existsSync(targetPath)) {
      await shell.openPath(targetPath);
      return { success: true };
    }
    return { success: false, error: 'Caminho não encontrado no disco.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Launch AutoDrive Desktop with prefilled demand data (External Python fallback)
ipcMain.handle('launch-autodrive', async (event, data) => {
  try {
    const autodriveDir = data?.customPath || path.join(app.getPath('documents'), 'AutoDrive');
    if (!fs.existsSync(autodriveDir)) {
      return { success: false, error: `Diretório do AutoDrive não encontrado em: ${autodriveDir}` };
    }

    const tempDir = app.getPath('temp');
    let pdfFilePath = null;
    let imgFilePath = null;

    if (data?.pdfBuffer && data?.pdfName) {
      const safePdfName = (data.pdfName || 'manual.pdf').replace(/[/\\?%*:|"<>]/g, '_');
      pdfFilePath = path.join(tempDir, safePdfName);
      fs.writeFileSync(pdfFilePath, Buffer.from(data.pdfBuffer));
    }

    if (data?.imageBuffer && data?.imageName) {
      const safeImgName = (data.imageName || 'mapeamento.png').replace(/[/\\?%*:|"<>]/g, '_');
      imgFilePath = path.join(tempDir, safeImgName);
      fs.writeFileSync(imgFilePath, Buffer.from(data.imageBuffer));
    }

    const payload = {
      quick: data?.quick || '',
      numero_layout: data?.numero_layout || '',
      entidade: data?.entidade || '',
      nome_documento: data?.nome_documento || '',
      categoria: data?.categoria || '',
      senha: data?.senha || '',
      pdf: pdfFilePath,
      image: imgFilePath
    };

    const jsonLaunchPath = path.join(tempDir, 'autodrive_launch.json');
    fs.writeFileSync(jsonLaunchPath, JSON.stringify(payload, null, 2), 'utf-8');

    // Find Python executable
    const knownPythonPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      'python.exe',
      'python',
      'py'
    ];

    let pythonExe = 'python';
    for (const p of knownPythonPaths) {
      if (p.includes('\\') && fs.existsSync(p)) {
        pythonExe = p;
        break;
      }
    }

    const mainPyPath = path.join(autodriveDir, 'main.py');
    if (!fs.existsSync(mainPyPath)) {
      return { success: false, error: `Arquivo main.py não encontrado em: ${mainPyPath}` };
    }

    // Spawn detached Python process so AutoDrive runs independently
    const child = spawn(pythonExe, [mainPyPath, '--json', jsonLaunchPath], {
      cwd: autodriveDir,
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    return { success: true, payload };
  } catch (err) {
    console.error('Error launching AutoDrive:', err);
    return { success: false, error: err.message };
  }
});

// ------------------- Auto Updater (GitHub Releases) -------------------
function sendUpdaterStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', payload);
  }
}

if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.logger = console;
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
    const speedNum = progressObj.bytesPerSecond || 0;
    const speed = speedNum > 1024 * 1024
      ? `${(speedNum / (1024 * 1024)).toFixed(1)} MB/s`
      : `${Math.round(speedNum / 1024)} KB/s`;
    const transferred = `${((progressObj.transferred || 0) / (1024 * 1024)).toFixed(1)} MB`;
    const total = `${((progressObj.total || 0) / (1024 * 1024)).toFixed(1)} MB`;

    sendUpdaterStatus({
      status: 'downloading',
      percent,
      speed,
      transferred,
      total,
      message: `Baixando atualização: ${percent}%`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus({
      status: 'downloaded',
      version: info.version,
      percent: 100,
      message: `Versão ${info.version} baixada! Reiniciando e aplicando atualização...`
    });

    if (Notification.isSupported()) {
      new Notification({
        title: 'Instalando Atualização',
        body: `A versão ${info.version} foi baixada com sucesso. O sistema reiniciará automaticamente para concluir a instalação.`
      }).show();
    }

    // Reiniciar sozinho logo após baixar conforme solicitação do usuário
    setTimeout(() => {
      try {
        console.log('Reiniciando automaticamente para aplicar atualização...');
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        console.error('Erro ao reiniciar para aplicar atualização:', err);
      }
    }, 2200);
  });
}

// Auto-updater IPC handlers
ipcMain.handle('updater-check', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Módulo de atualização não disponível no ambiente atual.' };
  }
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
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

app.whenReady().then(() => {
  createWindow();

  // Check for updates 5 seconds after startup if in production package
  if (app.isPackaged && autoUpdater) {
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
