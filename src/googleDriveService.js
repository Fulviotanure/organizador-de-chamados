const fs = require('fs');
const path = require('path');
const mimetypes = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif'
};

const DRIVE_SHARED_DRIVE_ID = "0AGVqProAKWRcUk9PVA";
const DRIVE_ROOT_LAYOUTS_ID = "1_3QEK8ng4F8IhzYysJuyxcbjYNjk4obh";

const CATEGORIAS = {
  BANCOS: {
    label: "Bancos",
    folder_name: "BANCOS",
    drive_id: "1yUoFurRtBZG2Sn8wso-d8d87xoeS8poJ",
    alternate_ids: ["17cQEfu4mnwskAgfApP7dBAyQfYC9rP-S"],
    has_entity_subfolder: true
  },
  SISTEMAS: {
    label: "Sistemas Diversos",
    folder_name: "SISTEMAS DIVERSOS",
    drive_id: "1F76wSE5ULqpQ2oEv9p3QvVkoLiYUGpgD",
    alternate_ids: ["1rzovNuD0AU-7s3fMrjxBTmWKT6_kdvex"],
    has_entity_subfolder: true
  },
  CARTAO_CREDITO: {
    label: "Cartões de Crédito",
    folder_name: "CARTÕES DE CRÉDITO",
    drive_id: "1YWpCgbd1kiJXJmp_RTrK-89FFn1jbmb5",
    alternate_ids: ["12UUI7QP6DtIhaxC8EaYgWyXQketLfs81"],
    has_entity_subfolder: true
  },
  PREFEITURAS: {
    label: "Prefeituras / Estado",
    folder_name: "PREFEITURAS-ESTADO",
    drive_id: "1evKY1UGCXbgF6fz38EVaUQZUDCGXd9xd",
    alternate_ids: ["1xzpREfjNYrNCkMOja6iYpRXgltOxyj0u"],
    has_entity_subfolder: true
  },
  GOVERNO_FEDERAL: {
    label: "Governo Federal - Receita",
    folder_name: "GOVERNO FEDERAL / RECEITA FEDERAL",
    drive_id: "15ODaVAGHdTSNV45SK1qo4WUo-x0j0YdO",
    alternate_ids: ["10ZSdtHSzL6zOckPoZODCd3IBozMgItOS"],
    has_entity_subfolder: false
  },
  DESCONHECIDOS: {
    label: "Desconhecidos",
    folder_name: "1DESCONHECIDOS",
    drive_id: "1mzFTHigzEUVB3eMJCeCckGPzhule9kgS",
    alternate_ids: ["1lf4eA9Ja9kfVGrv5b5HBIV2t0XMcfHxZ"],
    has_entity_subfolder: false
  }
};

const DEFAULT_CREDENTIALS = {
  client_id: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
  client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
  token_uri: "https://oauth2.googleapis.com/token"
};

const DEFAULT_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "";

class GoogleDriveService {
  constructor(options = {}) {
    this.userDataPath = options.userDataPath || '';
    this.cachedAccessToken = null;
    this.tokenExpiry = 0;
    this.tokenFilePath = null;
  }

  getCredentials() {
    const candidatePaths = [
      'C:\\Users\\fulvi\\Desktop\\PROJETOS\\autodrive\\credentials.json',
      path.join(process.env.LOCALAPPDATA || '', 'AutoDrive', 'credentials.json'),
      this.userDataPath ? path.join(this.userDataPath, 'credentials.json') : null,
      path.join(__dirname, '..', 'credentials.json')
    ].filter(Boolean);

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
          const creds = raw.installed || raw.web || raw;
          if (creds && creds.client_id) {
            return {
              client_id: creds.client_id,
              client_secret: creds.client_secret,
              token_uri: creds.token_uri || DEFAULT_CREDENTIALS.token_uri
            };
          }
        } catch (e) {
          console.warn('Erro ao ler credenciais de:', p, e.message);
        }
      }
    }

    return DEFAULT_CREDENTIALS;
  }

  getRefreshToken() {
    const candidatePaths = [
      'C:\\Users\\fulvi\\Desktop\\PROJETOS\\autodrive\\token.json',
      path.join(process.env.LOCALAPPDATA || '', 'AutoDrive', 'token.json'),
      this.userDataPath ? path.join(this.userDataPath, 'token.json') : null,
      path.join(__dirname, '..', 'token.json')
    ].filter(Boolean);

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (raw && raw.refresh_token) {
            this.tokenFilePath = p;
            return raw.refresh_token;
          }
        } catch (e) {
          console.warn('Erro ao ler token de:', p, e.message);
        }
      }
    }

    return DEFAULT_REFRESH_TOKEN;
  }

  async getAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cachedAccessToken && this.tokenExpiry > now + 60000) {
      return this.cachedAccessToken;
    }

    const creds = this.getCredentials();
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('Nenhum refresh_token do Google Drive encontrado.');
    }

    const params = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const res = await fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Falha ao autenticar no Google OAuth (HTTP ${res.status}): ${errBody}`);
    }

    const data = await res.json();
    this.cachedAccessToken = data.access_token;
    this.tokenExpiry = now + ((data.expires_in || 3600) * 1000);

    // Save token if possible
    if (this.tokenFilePath) {
      try {
        const existing = fs.existsSync(this.tokenFilePath)
          ? JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'))
          : {};
        existing.token = data.access_token;
        existing.expiry = new Date(this.tokenExpiry).toISOString();
        fs.writeFileSync(this.tokenFilePath, JSON.stringify(existing, null, 2), 'utf-8');
      } catch (e) {
        // Non-critical if token file can't be updated
      }
    }

    return this.cachedAccessToken;
  }

  async getStatus() {
    try {
      const token = await this.getAccessToken();
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        return { connected: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        connected: true,
        user: {
          displayName: data.user?.displayName || 'Google Drive',
          emailAddress: data.user?.emailAddress || ''
        }
      };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  sanitizeText(text) {
    if (!text) return '';
    return text.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  buildStandardizedNames(numeroLayout, nomeDocumento, entidade, imageExt = '.png', mappingCount = 1) {
    const num = this.sanitizeText(numeroLayout);
    const doc = this.sanitizeText(nomeDocumento);
    const ent = this.sanitizeText(entidade);

    let cleanExt = (imageExt || '.png').trim();
    if (!cleanExt.startsWith('.')) cleanExt = '.' + cleanExt;
    const imgExt = cleanExt.toUpperCase();

    let layoutBase = '';
    if (num && doc) {
      layoutBase = `${num} - ${doc}`;
    } else if (num) {
      layoutBase = num;
    } else {
      layoutBase = doc || 'LAYOUT_SEM_NOME';
    }

    const count = Math.max(1, parseInt(mappingCount, 10) || 1);
    const imageFilenames = [];
    if (count === 1) {
      imageFilenames.push(`${layoutBase} - MAPEAMENTO${imgExt}`);
    } else {
      for (let i = 0; i < count; i++) {
        imageFilenames.push(`${layoutBase} - MAPEAMENTO ${i + 1}${imgExt}`);
      }
    }

    return {
      folderEntityName: ent,
      folderLayoutName: layoutBase,
      pdfFilename: `${layoutBase}.PDF`,
      imageFilename: imageFilenames[0],
      imageFilenames
    };
  }

  async searchEntityFolder(accessToken, catFolderIds, entityName) {
    if (!entityName) return { found: false, id: null, name: null };
    const safeName = entityName.replace(/'/g, "\\'");
    const folderIds = (Array.isArray(catFolderIds) ? catFolderIds : [catFolderIds]).filter(Boolean);

    for (const catId of folderIds) {
      // 1. Exact match
      const qExact = `'${catId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
      let res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qExact)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,capabilities)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      let json = await res.json();
      if (json.files && json.files.length > 0) {
        const writable = json.files.find(f => f.capabilities?.canAddChildren !== false);
        if (writable) {
          return { found: true, id: writable.id, name: writable.name, parentId: catId, canAddChildren: true };
        }
      }

      // 2. Contains match
      const qContains = `'${catId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '${safeName}' and trashed = false`;
      res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qContains)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,capabilities)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      json = await res.json();
      if (json.files && json.files.length > 0) {
        const writable = json.files.find(f => f.capabilities?.canAddChildren !== false);
        if (writable) {
          return { found: true, id: writable.id, name: writable.name, parentId: catId, canAddChildren: true };
        }
      }
    }

    return { found: false, id: null, name: null };
  }

  async searchLayoutFolder(accessToken, parentFolderId, layoutFolderName, numeroLayout) {
    const safeName = layoutFolderName.replace(/'/g, "\\'");

    // 1. Exact name match
    const qExact = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
    let res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qExact)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,webViewLink)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    let json = await res.json();
    if (json.files && json.files.length > 0) {
      return { found: true, id: json.files[0].id, name: json.files[0].name, webViewLink: json.files[0].webViewLink };
    }

    // 2. Number match if provided
    if (numeroLayout) {
      const safeNum = String(numeroLayout).trim().replace(/'/g, "\\'");
      const qNum = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '${safeNum}' and trashed = false`;
      res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qNum)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,webViewLink)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      json = await res.json();
      if (json.files && json.files.length > 0) {
        return { found: true, id: json.files[0].id, name: json.files[0].name, webViewLink: json.files[0].webViewLink };
      }
    }

    return { found: false, id: null, name: null, webViewLink: null };
  }

  async createFolder(accessToken, folderName, parentFolderId) {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName.toUpperCase(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro ao criar pasta '${folderName}': ${errText}`);
    }
    return await res.json();
  }

  async uploadFile(accessToken, buffer, destFilename, parentFolderId, mimeType) {
    const boundary = 'autodrive_bound_' + Date.now() + Math.random().toString(36).substring(2);
    const metadata = {
      name: destFilename.toUpperCase(),
      parents: [parentFolderId]
    };

    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`),
      Buffer.from(buffer),
      Buffer.from(`\r\n--${boundary}--`)
    ]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro no upload do arquivo '${destFilename}': ${errText}`);
    }

    return await res.json();
  }

  async listFolderFiles(accessToken, folderId) {
    if (!folderId) return [];
    try {
      const q = `'${folderId}' in parents and trashed = false`;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,size,webViewLink)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      return data.files || [];
    } catch (e) {
      console.warn('Erro ao listar arquivos da pasta:', e);
      return [];
    }
  }

  async checkLayoutPreFlight(data) {
    const {
      numero_layout,
      entidade,
      nome_documento,
      categoria = 'BANCOS',
      imageName = 'mapeamento.png',
      mappingImages = []
    } = data;

    const accessToken = await this.getAccessToken();

    const catKey = CATEGORIAS[categoria] ? categoria : 'BANCOS';
    const catData = CATEGORIAS[catKey];
    const catFolderId = catData.drive_id;

    if (!catFolderId) {
      throw new Error(`ID da categoria '${catData.folder_name}' não configurado no Drive.`);
    }

    const mappingCount = (Array.isArray(mappingImages) && mappingImages.length > 0)
      ? mappingImages.length
      : 1;
    const firstImgName = (mappingImages && mappingImages[0]?.name) || imageName || 'mapeamento.png';
    const imageExt = firstImgName ? path.extname(firstImgName) : '.PNG';
    const stdNames = this.buildStandardizedNames(numero_layout, nome_documento, entidade, imageExt, mappingCount);

    const candidateCatIds = [catData.drive_id, ...(catData.alternate_ids || [])].filter(Boolean);
    let parentForLayout = catData.drive_id;
    let entityFound = false;
    let entityFolderId = null;
    let entityExactName = null;

    if (catData.has_entity_subfolder && stdNames.folderEntityName) {
      const entRes = await this.searchEntityFolder(accessToken, candidateCatIds, stdNames.folderEntityName);
      if (entRes.found) {
        entityFound = true;
        entityFolderId = entRes.id;
        entityExactName = entRes.name;
        parentForLayout = entityFolderId;
      }
    }

    let layoutFound = false;
    let layoutFolderId = null;
    let layoutExactName = null;
    let layoutLink = null;
    let existingFiles = [];
    let pdfConflict = false;
    let imageConflict = false;

    if (parentForLayout) {
      const layRes = await this.searchLayoutFolder(accessToken, parentForLayout, stdNames.folderLayoutName, numero_layout);
      if (layRes.found) {
        layoutFound = true;
        layoutFolderId = layRes.id;
        layoutExactName = layRes.name;
        layoutLink = layRes.webViewLink;

        // List files inside existing layout folder
        existingFiles = await this.listFolderFiles(accessToken, layoutFolderId);
        pdfConflict = existingFiles.some(f => f.name && f.name.toUpperCase() === stdNames.pdfFilename.toUpperCase());
        const allTargetImgs = (stdNames.imageFilenames || [stdNames.imageFilename]).map(fn => fn.toUpperCase());
        imageConflict = existingFiles.some(f => f.name && allTargetImgs.includes(f.name.toUpperCase()));
      }
    }

    // Check mirror path on local disk
    const baseDir = data.customMirrorDir || 'C:\\Users\\fulvi\\Desktop\\PROJETOS\\autodrive\\espelho_local';
    let mirrorTargetDir = path.join(baseDir, catData.folder_name);
    if (catData.has_entity_subfolder && stdNames.folderEntityName) {
      mirrorTargetDir = path.join(mirrorTargetDir, stdNames.folderEntityName);
    }
    mirrorTargetDir = path.join(mirrorTargetDir, stdNames.folderLayoutName);
    const mirrorExists = fs.existsSync(mirrorTargetDir);

    return {
      success: true,
      categoria: {
        key: catKey,
        label: catData.label,
        folderName: catData.folder_name,
        hasEntitySubfolder: !!catData.has_entity_subfolder
      },
      stdNames,
      entity: {
        checked: !!catData.has_entity_subfolder,
        name: stdNames.folderEntityName,
        exists: entityFound,
        id: entityFolderId,
        matchedName: entityExactName
      },
      layout: {
        name: stdNames.folderLayoutName,
        exists: layoutFound,
        id: layoutFolderId,
        matchedName: layoutExactName,
        webViewLink: layoutLink
      },
      existingFiles,
      fileConflicts: {
        pdfExists: pdfConflict,
        imageExists: imageConflict
      },
      mirror: {
        targetDir: mirrorTargetDir,
        exists: mirrorExists
      }
    };
  }

  saveLocalMirror({ categoriaFolderName, folderEntityName, folderLayoutName, pdfBuffer, pdfFilename, imageBuffer, imageFilename, images = [], customMirrorDir, senha }) {
    try {
      const baseDir = customMirrorDir || 'C:\\Users\\fulvi\\Desktop\\PROJETOS\\autodrive\\espelho_local';
      let targetDir = path.join(baseDir, categoriaFolderName);
      if (folderEntityName) {
        targetDir = path.join(targetDir, folderEntityName);
      }
      targetDir = path.join(targetDir, folderLayoutName);

      fs.mkdirSync(targetDir, { recursive: true });

      if (senha && senha.trim()) {
        const senhaPath = path.join(targetDir, 'SENHA.txt');
        fs.writeFileSync(senhaPath, `SENHA DO ARQUIVO / PDF: ${senha.trim()}\r\n`, 'utf-8');
      }

      let pdfSavedPath = null;
      const imgSavedPaths = [];

      if (pdfBuffer && pdfFilename) {
        pdfSavedPath = path.join(targetDir, pdfFilename);
        fs.writeFileSync(pdfSavedPath, Buffer.from(pdfBuffer));
      }

      const allImages = [...images];
      if (imageBuffer && imageFilename && !allImages.some(img => img.filename === imageFilename)) {
        allImages.unshift({ buffer: imageBuffer, filename: imageFilename });
      }

      for (const img of allImages) {
        if (img && img.buffer && img.filename) {
          const p = path.join(targetDir, img.filename);
          fs.writeFileSync(p, Buffer.from(img.buffer));
          imgSavedPaths.push(p);
        }
      }

      return {
        success: true,
        targetDir,
        pdfSavedPath,
        imgSavedPath: imgSavedPaths[0] || null,
        imgSavedPaths
      };
    } catch (err) {
      console.warn('Erro ao salvar espelho local:', err);
      return { success: false, error: err.message };
    }
  }

  async processLayoutUpload(data, onProgress = () => {}) {
    const {
      numero_layout,
      entidade,
      nome_documento,
      categoria = 'BANCOS',
      pdfBuffer,
      pdfName,
      imageBuffer,
      imageName,
      mappingImages = [],
      customMirrorDir,
      senha
    } = data;

    onProgress({ step: 'auth', message: 'Conectando ao Google Drive...' });
    const accessToken = await this.getAccessToken();

    const catKey = CATEGORIAS[categoria] ? categoria : 'BANCOS';
    const catData = CATEGORIAS[catKey];
    const catFolderId = catData.drive_id;

    if (!catFolderId) {
      throw new Error(`ID da categoria '${catData.folder_name}' não configurado no Drive.`);
    }

    // Assemble list of images to upload as mapping
    const imagesToUpload = [];
    if (Array.isArray(mappingImages) && mappingImages.length > 0) {
      mappingImages.forEach((img, i) => {
        if (img && img.buffer) {
          imagesToUpload.push({
            buffer: Buffer.from(img.buffer),
            originalName: img.name || `mapeamento_${i + 1}.png`
          });
        }
      });
    } else if (imageBuffer) {
      imagesToUpload.push({
        buffer: Buffer.from(imageBuffer),
        originalName: imageName || 'mapeamento.png'
      });
    }

    const firstImageExt = imagesToUpload[0]?.originalName
      ? path.extname(imagesToUpload[0].originalName)
      : (imageName ? path.extname(imageName) : '.PNG');

    const stdNames = this.buildStandardizedNames(
      numero_layout,
      nome_documento,
      entidade,
      firstImageExt,
      imagesToUpload.length
    );

    // Assign final target filenames to each image
    imagesToUpload.forEach((img, i) => {
      const ext = path.extname(img.originalName) || '.PNG';
      if (imagesToUpload.length <= 1) {
        img.targetFilename = stdNames.imageFilename;
      } else {
        img.targetFilename = stdNames.imageFilenames[i] || `${stdNames.folderLayoutName} - MAPEAMENTO ${i + 1}${ext.toUpperCase()}`;
      }
    });

    const candidateCatIds = [catData.drive_id, ...(catData.alternate_ids || [])].filter(Boolean);
    let parentForLayout = catData.drive_id;
    let entityFolderId = null;
    let entityFound = false;

    // Only look for or create entity folder if the category uses entity subfolders
    if (catData.has_entity_subfolder && stdNames.folderEntityName) {
      onProgress({ step: 'search_entity', message: `Localizando pasta da entidade '${stdNames.folderEntityName}'...` });
      const searchRes = await this.searchEntityFolder(accessToken, candidateCatIds, stdNames.folderEntityName);
      if (searchRes.found) {
        entityFolderId = searchRes.id;
        entityFound = true;
      } else {
        onProgress({ step: 'create_entity', message: `Criando pasta da entidade '${stdNames.folderEntityName}'...` });
        const created = await this.createFolder(accessToken, stdNames.folderEntityName, catData.drive_id);
        entityFolderId = created.id;
      }
      parentForLayout = entityFolderId;
    }

    onProgress({ step: 'search_layout', message: `Verificando pasta do layout '${stdNames.folderLayoutName}'...` });
    const layoutSearch = await this.searchLayoutFolder(accessToken, parentForLayout, stdNames.folderLayoutName, numero_layout);
    let layoutFolderId = null;
    let layoutLink = null;

    if (layoutSearch.found) {
      layoutFolderId = layoutSearch.id;
      layoutLink = layoutSearch.webViewLink;
    } else {
      onProgress({ step: 'create_layout', message: `Criando pasta do layout '${stdNames.folderLayoutName}'...` });
      const createdLayout = await this.createFolder(accessToken, stdNames.folderLayoutName, parentForLayout);
      layoutFolderId = createdLayout.id;
      layoutLink = createdLayout.webViewLink;
    }

    let uploadedPdf = null;
    if (pdfBuffer) {
      onProgress({ step: 'upload_pdf', message: `Enviando manual PDF '${stdNames.pdfFilename}'...` });
      uploadedPdf = await this.uploadFile(
        accessToken,
        pdfBuffer,
        stdNames.pdfFilename,
        layoutFolderId,
        'application/pdf'
      );
    }

    const uploadedImages = [];
    for (let i = 0; i < imagesToUpload.length; i++) {
      const img = imagesToUpload[i];
      const counterText = imagesToUpload.length > 1 ? ` (${i + 1}/${imagesToUpload.length})` : '';
      onProgress({ step: 'upload_image', message: `Enviando imagem do mapeamento${counterText}: '${img.targetFilename}'...` });
      const extNoDot = (path.extname(img.targetFilename) || '.png').replace('.', '').toLowerCase();
      const mime = mimetypes[extNoDot] || 'image/png';
      const uploaded = await this.uploadFile(
        accessToken,
        img.buffer,
        img.targetFilename,
        layoutFolderId,
        mime
      );
      uploadedImages.push({
        filename: img.targetFilename,
        ...uploaded
      });
    }

    onProgress({ step: 'mirror', message: 'Salvando cópia no espelho local...' });
    const mirrorRes = this.saveLocalMirror({
      categoriaFolderName: catData.folder_name,
      folderEntityName: catData.has_entity_subfolder ? stdNames.folderEntityName : null,
      folderLayoutName: stdNames.folderLayoutName,
      pdfBuffer,
      pdfFilename: stdNames.pdfFilename,
      images: imagesToUpload.map(img => ({ buffer: img.buffer, filename: img.targetFilename })),
      customMirrorDir,
      senha
    });

    onProgress({ step: 'done', message: 'Upload e sincronização concluídos com sucesso!' });

    return {
      success: true,
      layoutFolderId,
      layoutLink: layoutLink || `https://drive.google.com/drive/folders/${layoutFolderId}`,
      pdfLink: uploadedPdf?.webViewLink || null,
      imageLink: uploadedImages[0]?.webViewLink || null,
      uploadedImages,
      stdNames,
      mirror: mirrorRes
    };
  }
}

module.exports = {
  GoogleDriveService,
  CATEGORIAS,
  DRIVE_SHARED_DRIVE_ID,
  DRIVE_ROOT_LAYOUTS_ID
};
