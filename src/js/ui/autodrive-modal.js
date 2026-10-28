// UI Module: Google Drive & AutoDrive Native Integration Modal
// ------------------- AutoDrive Integration Module -------------------
let currentAutoDriveTicket = null;
let stagedAutoDriveImages = [];
let stagedAutoDrivePdfs = [];
let autoDriveLastResult = null;
let isGoogleDriveChecking = false;

async function checkGoogleDriveStatus() {
  if (isGoogleDriveChecking) return;
  isGoogleDriveChecking = true;

  const dotEl = document.getElementById('autoDriveStatusDot');
  const emailEl = document.getElementById('autoDriveAccountEmail');
  const pillEl = document.getElementById('autoDriveAccountStatus');

  const setDotEl = document.getElementById('settingsDriveStatusDot');
  const setEmailEl = document.getElementById('settingsDriveEmail');
  const setPillEl = document.getElementById('settingsDriveStatusPill');

  if (emailEl) emailEl.textContent = 'Verificando Google Drive...';
  if (dotEl) dotEl.textContent = '⏳';
  if (setEmailEl) setEmailEl.textContent = 'Verificando Google Drive...';
  if (setDotEl) setDotEl.textContent = '⏳';

  try {
    if (window.electronAPI && window.electronAPI.getDriveStatus) {
      const status = await window.electronAPI.getDriveStatus();
      if (status && status.connected) {
        const emailText = status.user?.emailAddress || 'Conectado';
        const displayLabel = status.user?.displayName ? `${status.user.displayName} (${emailText})` : `Drive: ${emailText}`;
        if (dotEl) dotEl.textContent = '🟢';
        if (emailEl) emailEl.textContent = `Drive: ${emailText}`;
        if (pillEl) {
          pillEl.style.background = 'rgba(16, 185, 129, 0.14)';
          pillEl.style.color = '#34d399';
          pillEl.style.borderColor = 'rgba(16, 185, 129, 0.38)';
        }
        if (setDotEl) setDotEl.textContent = '🟢';
        if (setEmailEl) setEmailEl.textContent = displayLabel;
        if (setPillEl) {
          setPillEl.style.background = 'rgba(16, 185, 129, 0.14)';
          setPillEl.style.color = '#34d399';
          setPillEl.style.borderColor = 'rgba(16, 185, 129, 0.38)';
        }
      } else {
        if (dotEl) dotEl.textContent = '⚪';
        if (emailEl) emailEl.textContent = 'Drive não conectado';
        if (pillEl) {
          pillEl.style.background = 'rgba(100, 116, 139, 0.15)';
          pillEl.style.color = 'var(--text-secondary)';
          pillEl.style.borderColor = 'rgba(100, 116, 139, 0.3)';
        }
        if (setDotEl) setDotEl.textContent = '⚪';
        if (setEmailEl) setEmailEl.textContent = 'Google Drive: Não conectado';
        if (setPillEl) {
          setPillEl.style.background = 'rgba(100, 116, 139, 0.15)';
          setPillEl.style.color = 'var(--text-secondary)';
          setPillEl.style.borderColor = 'rgba(100, 116, 139, 0.3)';
        }
      }
    } else {
      if (dotEl) dotEl.textContent = '⚪';
      if (emailEl) emailEl.textContent = 'Disponível no Desktop';
    }
  } catch (err) {
    if (dotEl) dotEl.textContent = '⚪';
    if (emailEl) emailEl.textContent = 'Drive não conectado';
    if (setDotEl) setDotEl.textContent = '⚪';
    if (setEmailEl) setEmailEl.textContent = 'Google Drive: Não conectado';
  } finally {
    isGoogleDriveChecking = false;
  }
}

function sanitizeAutoDriveText(text) {
  if (!text) return '';
  return text.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function guessAutoDriveCategory(entidade, nomeDocumento) {
  const text = `${entidade || ''} ${nomeDocumento || ''}`.toUpperCase();

  const bancosKeywords = [
    "BANCO", "BANK", "SICOOB", "SICREDI", "BRADESCO", "ITAU", "ITAÚ", "SANTANDER",
    "CAIXA", "SAFRA", "BTG", "NUBANK", "INTER", "PAGSEGURO", "MUMBUCA", "AGIBANK",
    "BANESES", "BANCOOB", "BANRISUL", "DAYCOVAL", "ORIGINAL", "PINE", "BV", "C6"
  ];
  if (bancosKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(text))) {
    return "BANCOS";
  }

  const prefeiturasKeywords = [
    "PREFEITURA", "MUNICIPIO", "MUNICÍPIO", "PM.", "PM ", "SEFAZ", "GOVERNO DE",
    "DISTRITO FEDERAL", "ESTADO DE", "UBERABA", "GOIANIA", "IPATINGA", "LINHARES"
  ];
  if (prefeiturasKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(text))) {
    return "PREFEITURAS";
  }

  const govKeywords = [
    "RECEITA FEDERAL", "RECEITA", "DARF", "ECAC", "E-CAC", "GPS", "GRU",
    "CARNE LEAO", "CARNÊ LEÃO", "MINISTERIO DA FAZENDA", "GOVERNO FEDERAL"
  ];
  if (govKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(text))) {
    return "GOVERNO_FEDERAL";
  }

  const cartoesKeywords = [
    "CARTAO", "CARTÃO", "CARTÕES", "CREDITO", "CRÉDITO", "CIELO", "REDE",
    "GETNET", "STONE", "PAGBANK", "ALELO", "SODEXO", "TICKET", "MASTERCARD", "VISA"
  ];
  if (cartoesKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(text))) {
    return "CARTAO_CREDITO";
  }

  const sistemasKeywords = [
    "SIAF", "TOTVS", "PROTHEUS", "SAP", "SENIOR", "ALTERDATA", "DOMINIO",
    "DOMÍNIO", "ERP", "SOFTWARE", "SISTEMA", "SISTEMAS", "INFORMATICA",
    "INFORMÁTICA", "TECH", "WINFOOD", "ADVBOX", "ACTIVESOFT", "360 ERP",
    "AC SISTEMAS", "INOVAR", "2TASK"
  ];
  if (sistemasKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(text))) {
    return "SISTEMAS";
  }

  return "BANCOS";
}

function parseDemandForAutoDrive(ticket) {
  if (!ticket) return null;

  const rawTitle = (ticket.title || '').trim();
  const rawDb = (ticket.clientDatabase || '').trim().toUpperCase();
  const ticketNumber = ticket.number != null ? String(ticket.number).trim() : '';
  const layoutCode = ticket.layout?.code != null ? String(ticket.layout.code).trim() : '';
  const layoutName = (ticket.layout?.name || '').trim();

  let numeroLayout = layoutCode || ticketNumber || '';
  let remainingTitle = rawTitle;

  // 1. Extrair número no início do título (#10328 - ...)
  const numMatch = remainingTitle.match(/^\s*#?(\d+)\s*[-–—:]\s*(.*)$/i);
  if (numMatch) {
    if (!numeroLayout) numeroLayout = numMatch[1];
    remainingTitle = numMatch[2].trim();
  }

  // 2. Remover prefixos de operação comuns (NOVO LAYOUT -, etc.)
  const ignorePrefixes = ["NOVO LAYOUT", "NOVO", "ALTERACAO", "ALTERAÇÃO", "AJUSTE", "ATUALIZACAO", "ATUALIZAÇÃO", "CORRECAO", "CORREÇÃO", "LAYOUT", "MELHORIA", "ERRO"];
  for (const p of ignorePrefixes) {
    const reg = new RegExp(`^${p}\\s*[-–—:]\\s*(.*)$`, 'i');
    const m = remainingTitle.match(reg);
    if (m) {
      remainingTitle = m[1].trim();
      break;
    }
  }

  // 3. Normalizar variações de -CONT- ou -CONT_ no título
  remainingTitle = remainingTitle.replace(/[-–—]\s*CONT(?=[-_\s]|$)/gi, ' - CONT');

  // 4. Separar segmentos pelo traço
  let parts = remainingTitle.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);

  // 5. Ignorar qualquer termo de banco de dados/cliente (-CONT-, CONT_..., CONT-...)
  // Se esse termo estiver no final, descarta-o para pegar o nome do documento antes dele
  function isContPart(p) {
    if (!p) return false;
    const up = p.toUpperCase();
    if (up === 'CONT' || up === 'CONT-' || up === 'CONT_' || up === '-CONT-') return true;
    if (up.startsWith('CONT_') || up.startsWith('CONT-') || up.startsWith('CONT ')) return true;
    if (rawDb && (up === rawDb || up.includes(rawDb))) return true;
    return false;
  }

  const contIdx = parts.findIndex(isContPart);
  if (contIdx !== -1) {
    parts = parts.slice(0, contIdx);
  }

  // Remover sufixo de banco de dados se colado no último termo
  if (parts.length > 0 && rawDb) {
    let last = parts[parts.length - 1];
    if (last.toUpperCase().endsWith(rawDb)) {
      last = last.substring(0, last.length - rawDb.length).replace(/[-–—_\s]+$/, '').trim();
      if (last) parts[parts.length - 1] = last;
      else parts.pop();
    }
  }

  let entidade = '';
  let nomeDocumento = '';

  if (parts.length >= 2) {
    // A última informação do título depois do traço é sempre o NOME DO DOCUMENTO
    nomeDocumento = parts[parts.length - 1];
    // O que vem antes dele (entre o número e o último traço) é o BANCO OU SISTEMA
    entidade = parts.slice(0, parts.length - 1).join(' - ');
  } else if (parts.length === 1) {
    nomeDocumento = parts[0];
    entidade = layoutName || parts[0];
  } else {
    nomeDocumento = layoutName || '';
    entidade = layoutName || '';
  }

  const cleanEntidade = sanitizeAutoDriveText(entidade);
  const cleanDocumento = sanitizeAutoDriveText(nomeDocumento);
  const cleanNumero = sanitizeAutoDriveText(numeroLayout);

  const categoria = guessAutoDriveCategory(cleanEntidade, cleanDocumento);

  // Formato padrão: [NUMERO] - [BANCO OU SISTEMA] - [NOME DO DOCUMENTO]
  const quickParts = [];
  if (cleanNumero) quickParts.push(cleanNumero);
  if (cleanEntidade) quickParts.push(cleanEntidade);
  if (cleanDocumento && cleanDocumento !== cleanEntidade) quickParts.push(cleanDocumento);

  const quickText = quickParts.join(' - ');

  return {
    numero_layout: cleanNumero,
    entidade: cleanEntidade,
    nome_documento: cleanDocumento,
    categoria: categoria || 'BANCOS',
    quick: quickText
  };
}

async function openAutoDriveModal(ticket) {
  if (!ticket) return;
  currentAutoDriveTicket = ticket;
  stagedAutoDriveImages = [];
  stagedAutoDrivePdfs = [];
  autoDriveLastResult = null;

  const modal = document.getElementById('modalAutoDrive');
  if (!modal) return;

  // Reset Approval, Progress and Success screens
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
  const progressBox = document.getElementById('autoDriveProgressBox');
  if (progressBox) progressBox.style.display = 'none';
  const successBox = document.getElementById('autoDriveSuccessBox');
  if (successBox) successBox.style.display = 'none';

  // Check Drive status in background
  checkGoogleDriveStatus();

  // Update dynamic mirror notice path in modal
  const noticePathEl = document.getElementById('autoDriveMirrorNoticePath');
  if (noticePathEl) {
    let currentMirror = '';
    if (window.electronAPI?.getDriveConfig) {
      const cfg = await window.electronAPI.getDriveConfig();
      if (cfg?.mirrorPath) currentMirror = cfg.mirrorPath;
    } else if (window.electronAPI?.loadStorage) {
      currentMirror = (await window.electronAPI.loadStorage('googleDriveMirrorPath', '')) || '';
    }
    noticePathEl.textContent = currentMirror || 'Pasta padrão do sistema';
    noticePathEl.title = currentMirror || 'Pasta padrão';
  }

  const parsed = parseDemandForAutoDrive(ticket);

  const inputQuick = document.getElementById('autoDriveQuickText');
  const inputNum = document.getElementById('autoDriveNumeroLayout');
  const selCat = document.getElementById('autoDriveCategoria');
  const inputEnt = document.getElementById('autoDriveEntidade');
  const inputDoc = document.getElementById('autoDriveDocumento');
  const inputSenha = document.getElementById('autoDriveSenha');

  if (inputQuick) inputQuick.value = parsed.quick;
  if (inputNum) inputNum.value = parsed.numero_layout;
  if (selCat) selCat.value = parsed.categoria;
  if (inputEnt) inputEnt.value = parsed.entidade;
  if (inputDoc) inputDoc.value = parsed.nome_documento;

  // Auto-detect password from ticket description or title or stored notes
  let detectedSenha = '';
  const textToSearch = `${ticket.title || ''} ${ticket.description || ''}`;
  const senhaMatch = textToSearch.match(/(?:senha|password|pass|chave)\s*(?:do\s*(?:pdf|arquivo|layout))?\s*[:=]\s*([A-Za-z0-9@#$_!.\-]+)/i);
  if (senhaMatch) {
    detectedSenha = senhaMatch[1].trim();
  }
  const savedSenha = window.appStore.localNotes?.[`autodrive_pwd_${ticket.id}`];
  if (savedSenha) {
    detectedSenha = savedSenha;
  }
  if (inputSenha) {
    inputSenha.value = detectedSenha;
    inputSenha.type = 'password';
  }
  const togglePwdBtn = document.getElementById('btnToggleAutoDrivePassword');
  if (togglePwdBtn) togglePwdBtn.textContent = '👁️ Ver';

  // Initial placeholder rendering
  const imagesGrid = document.getElementById('autoDriveImagesGrid');
  if (imagesGrid) {
    imagesGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; grid-column: 1 / -1; padding: 12px 0;">🔍 Baixando e renderizando imagens da demanda...</div>';
  }
  const pdfContainer = document.getElementById('autoDrivePdfCardContainer');
  if (pdfContainer) {
    pdfContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 8px 0;">Carregando manuais PDF...</div>';
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  // Load ticket details and attachments if needed
  let attachments = ticket.attachments || [];
  if (!attachments || attachments.length === 0) {
    try {
      const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);
      if (details && details.attachments) {
        ticket.attachments = details.attachments;
        attachments = details.attachments;
      }
    } catch (err) {
      console.warn('Erro ao carregar anexos para o AutoDrive:', err);
    }
  }

  // Process attachments
  const imgExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
  for (const att of attachments) {
    const fName = att.fileName || att.filename || att.originalName || att.name || 'arquivo';
    const ext = (fName.split('.').pop() || '').toLowerCase();

    if (ext === 'pdf') {
      try {
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, att.id);
        const buffer = await blob.arrayBuffer();
        stagedAutoDrivePdfs.push({
          id: String(att.id || Math.random().toString(36).substring(2)),
          name: fName,
          size: blob.size,
          blob,
          buffer
        });
        renderAutoDrivePdfCards();
      } catch (err) {
        console.warn('Erro ao carregar PDF:', err);
      }
    } else if (imgExtensions.includes(ext)) {
      try {
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, att.id);
        const objectUrl = URL.createObjectURL(blob);
        stagedAutoDriveImages.push({
          id: String(att.id || Math.random().toString(36).substring(2)),
          name: fName,
          size: blob.size,
          blob,
          objectUrl,
          isMapping: false
        });
        renderAutoDriveImagesGrid();
      } catch (err) {
        console.warn('Erro ao carregar imagem:', err);
      }
    }
  }

  // Automatic best guess for mapping image
  if (stagedAutoDriveImages.length > 0) {
    const candidate = stagedAutoDriveImages.find(img => {
      const n = img.name.toLowerCase();
      return n.includes('map') || n.includes('layout') || n.includes('tela') || n.includes('print');
    });
    if (candidate) {
      candidate.isMapping = true;
    } else {
      stagedAutoDriveImages[0].isMapping = true;
    }
  }

  renderAutoDriveImagesGrid();
  renderAutoDrivePdfCards();
}

function renderAutoDriveImagesGrid() {
  const grid = document.getElementById('autoDriveImagesGrid');
  const countBadge = document.getElementById('autoDriveImagesCountBadge');
  if (!grid) return;

  const count = stagedAutoDriveImages.length;
  if (countBadge) {
    countBadge.textContent = `${count} imagem${count === 1 ? '' : 's'}`;
  }

  if (count === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-muted); background: var(--bg-sidebar); border-radius: 8px; border: 1px dashed var(--border-color);">
        <div style="font-size: 24px; margin-bottom: 6px;">🖼️</div>
        <div style="font-size: 12px; font-weight: 600; color: var(--text-primary);">Nenhuma imagem anexada</div>
        <div style="font-size: 11px; margin-top: 4px;">Você pode colar um print diretamente com <strong>Ctrl+V</strong> ou clicar no botão "Adicionar Imagem".</div>
      </div>
    `;
    return;
  }

  // Calculate mapping images count and indices
  const mappingImages = stagedAutoDriveImages.filter(img => img.isMapping);

  grid.innerHTML = stagedAutoDriveImages.map(img => {
    const isMap = !!img.isMapping;
    let badgeHtml = '';
    if (isMap) {
      if (mappingImages.length > 1) {
        const mapNum = mappingImages.findIndex(m => String(m.id) === String(img.id)) + 1;
        badgeHtml = `<span class="autodrive-mapping-badge">🌟 Mapeamento ${mapNum}</span>`;
      } else {
        badgeHtml = `<span class="autodrive-mapping-badge">🌟 Mapeamento Oficial</span>`;
      }
    } else {
      badgeHtml = `<span style="font-size: 10px; color: var(--text-secondary); font-weight: 600;">🖼️ Imagem Anexa</span>`;
    }

    return `
      <div class="autodrive-image-card ${isMap ? 'is-mapping' : ''}" data-id="${escapeHtml(img.id)}">
        <!-- Top row: Badge and Delete Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <div>
            ${badgeHtml}
          </div>
          <button type="button" class="autodrive-delete-btn btn-delete-autodrive-img" data-id="${escapeHtml(img.id)}" title="Apagar esta imagem da lista (não será enviada ao Google Drive)">
            <span>🗑️</span> <span>Apagar</span>
          </button>
        </div>

        <!-- Thumbnail Image Container (Clickable to Lightbox with full gallery navigation) -->
        <div class="autodrive-thumb-wrap btn-zoom-autodrive-img" data-id="${escapeHtml(img.id)}" title="Clique para ver em tela cheia (com navegação por setas)">
          <img src="${img.objectUrl}" alt="${escapeHtml(img.name)}">
          <div class="autodrive-thumb-zoom-overlay">
            <span>🔍</span> <span>Ver em Tela Cheia</span>
          </div>
        </div>

        <!-- Bottom Info & Mapping Selector -->
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #f0f6fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(img.name)}">
            ${escapeHtml(img.name)}
          </div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
            ${formatFileSize(img.size)}
          </div>
        </div>

        <!-- Mapping Selection Button (Toggleable for Multiple Mappings) -->
        <div style="margin-top: auto; padding-top: 4px;">
          ${isMap
            ? `<button type="button" class="autodrive-select-mapping-btn active btn-toggle-as-mapping" data-id="${escapeHtml(img.id)}" style="width: 100%;" title="Clique para desmarcar como mapeamento">✓ Mapeamento Selecionado</button>`
            : `<button type="button" class="autodrive-select-mapping-btn btn-toggle-as-mapping" data-id="${escapeHtml(img.id)}" style="width: 100%;" title="Clique para adicionar como mapeamento">⭐ Marcar como Mapeamento</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Attach delete buttons
  grid.querySelectorAll('.btn-delete-autodrive-img').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleDeleteAutoDriveImage(id);
    });
  });

  // Attach toggle mapping selectors (Multiple allowed)
  grid.querySelectorAll('.btn-toggle-as-mapping').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleToggleAutoDriveMapping(id);
    });
  });

  // Attach zoom lightbox with full gallery and arrows support
  grid.querySelectorAll('.btn-zoom-autodrive-img').forEach(wrap => {
    wrap.addEventListener('click', () => {
      const imgId = wrap.getAttribute('data-id');
      const gallery = stagedAutoDriveImages.map(i => ({
        blobUrl: i.objectUrl,
        fileName: i.name,
        id: i.id
      }));
      const idx = stagedAutoDriveImages.findIndex(i => String(i.id) === String(imgId));
      const initialIdx = idx !== -1 ? idx : 0;
      openImageLightbox(gallery[initialIdx].blobUrl, gallery[initialIdx].fileName, currentAutoDriveTicket?.id, null, gallery, initialIdx);
    });
  });
}

function handleDeleteAutoDriveImage(imgId) {
  const idx = stagedAutoDriveImages.findIndex(img => String(img.id) === String(imgId));
  if (idx !== -1) {
    const removed = stagedAutoDriveImages.splice(idx, 1)[0];
    if (removed && removed.objectUrl) {
      try { URL.revokeObjectURL(removed.objectUrl); } catch (e) {}
    }
    // If no image is marked as mapping after deletion, ensure first remaining is marked
    if (!stagedAutoDriveImages.some(img => img.isMapping) && stagedAutoDriveImages.length > 0) {
      stagedAutoDriveImages[0].isMapping = true;
    }
    renderAutoDriveImagesGrid();
    showToast('Imagem removida com sucesso');
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function handleToggleAutoDriveMapping(imgId) {
  const img = stagedAutoDriveImages.find(i => String(i.id) === String(imgId));
  if (img) {
    img.isMapping = !img.isMapping;
  }
  renderAutoDriveImagesGrid();
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
}

async function handleAddAutoDriveImageFiles(files) {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) continue;
    const objectUrl = URL.createObjectURL(file);
    stagedAutoDriveImages.push({
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2),
      name: file.name || 'print_mapeamento.png',
      size: file.size,
      blob: file,
      objectUrl,
      isMapping: (stagedAutoDriveImages.length === 0)
    });
  }
  renderAutoDriveImagesGrid();
}

async function handleAddAutoDrivePdfFiles(files) {
  if (!files || files.length === 0) return;
  const fileList = Array.from(files);
  let addedCount = 0;
  for (const file of fileList) {
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') continue;
    try {
      const buffer = await file.arrayBuffer();
      stagedAutoDrivePdfs.push({
        id: 'pdf_local_' + Date.now() + '_' + Math.random().toString(36).substring(2),
        name: file.name || 'manual.pdf',
        size: file.size,
        blob: file,
        buffer
      });
      addedCount++;
    } catch (err) {
      console.warn('Erro ao carregar arquivo PDF:', err);
    }
  }
  if (addedCount > 0) {
    renderAutoDrivePdfCards();
    showToast(`${addedCount} manual(is) PDF adicionado(s)`);
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function handleDeleteAutoDrivePdf(pdfId) {
  const idx = stagedAutoDrivePdfs.findIndex(p => String(p.id) === String(pdfId));
  if (idx !== -1) {
    stagedAutoDrivePdfs.splice(idx, 1);
    renderAutoDrivePdfCards();
    showToast('Manual PDF removido');
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function renderAutoDrivePdfCards() {
  const container = document.getElementById('autoDrivePdfCardContainer');
  const badge = document.getElementById('autoDrivePdfStatusBadge');
  if (!container) return;

  const count = stagedAutoDrivePdfs.length;
  if (count === 0) {
    if (badge) {
      badge.textContent = 'Nenhum';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#f87171';
    }
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-sidebar); border: 1px dashed var(--border-color); border-radius: 6px;">
        <span style="font-size: 11px; color: var(--text-muted);">Nenhum manual PDF anexado. Caso a demanda possua manuais de layout, clique em "Adicionar PDF(s)".</span>
      </div>
    `;
    return;
  }

  if (badge) {
    badge.textContent = `${count} arquivo${count === 1 ? '' : 's'}`;
    badge.style.background = 'rgba(16, 185, 129, 0.2)';
    badge.style.color = '#34d399';
  }

  container.innerHTML = stagedAutoDrivePdfs.map((pdf, idx) => {
    return `
      <div class="autodrive-pdf-card" data-id="${escapeHtml(pdf.id)}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-sidebar); border: 1px solid var(--border-color); border-radius: 6px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
          <span style="font-size: 18px; flex-shrink: 0;">📕</span>
          <div style="overflow: hidden; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
              ${count > 1 ? `<span style="font-size: 10px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border-radius: 4px; padding: 0 4px; flex-shrink: 0;">#${idx + 1}</span>` : ''}
              <div style="font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(pdf.name)}">
                ${escapeHtml(pdf.name)}
              </div>
            </div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">
              ${formatFileSize(pdf.size)}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button type="button" class="btn-secondary btn-preview-autodrive-pdf" data-id="${escapeHtml(pdf.id)}" style="height: 26px; font-size: 11px; padding: 0 10px; gap: 4px;" title="Visualizar arquivo PDF">
            <span>👁️</span> <span>Visualizar</span>
          </button>
          <button type="button" class="autodrive-delete-btn btn-delete-autodrive-pdf" data-id="${escapeHtml(pdf.id)}" title="Remover este PDF da lista">
            <span>🗑️</span> <span>Remover</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire preview buttons
  container.querySelectorAll('.btn-preview-autodrive-pdf').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const targetPdf = stagedAutoDrivePdfs.find(p => String(p.id) === String(id));
      if (targetPdf && window.electronAPI && window.electronAPI.openBufferTemp) {
        const buf = targetPdf.buffer || (await targetPdf.blob.arrayBuffer());
        window.electronAPI.openBufferTemp(targetPdf.name, buf);
      }
    });
  });

  // Wire delete buttons
  container.querySelectorAll('.btn-delete-autodrive-pdf').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleDeleteAutoDrivePdf(id);
    });
  });
}

function closeAutoDriveModal() {
  const modal = document.getElementById('modalAutoDrive');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
  const progressBox = document.getElementById('autoDriveProgressBox');
  if (progressBox) progressBox.style.display = 'none';
  const successBox = document.getElementById('autoDriveSuccessBox');
  if (successBox) successBox.style.display = 'none';

  // Clean up object URLs
  stagedAutoDriveImages.forEach(img => {
    if (img.objectUrl) {
      try { URL.revokeObjectURL(img.objectUrl); } catch (e) {}
    }
  });
  stagedAutoDriveImages = [];
  stagedAutoDrivePdfs = [];
  currentAutoDriveTicket = null;
}

async function handlePreFlightCheck() {
  if (!currentAutoDriveTicket) return;

  const btn = document.getElementById('btnLaunchAutoDriveNow');
  const btnIcon = document.getElementById('autoDriveBtnIcon');
  const btnText = document.getElementById('autoDriveBtnText');
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  const approvalDetails = document.getElementById('autoDriveApprovalDetails');

  const num = (document.getElementById('autoDriveNumeroLayout')?.value || '').trim();
  const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
  const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();
  const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
  const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';

  if (!num) {
    showAppAlert('Por favor, informe o Número do Layout.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveNumeroLayout')?.focus();
    return;
  }
  if (cat !== 'DESCONHECIDOS' && !ent) {
    showAppAlert('Por favor, informe o Banco ou Instituição.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveEntidade')?.focus();
    return;
  }
  if (!doc) {
    showAppAlert('Por favor, informe o Nome do Sistema / Documento.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveDocumento')?.focus();
    return;
  }

  // Collect all images marked as mapping
  const effectiveMappings = stagedAutoDriveImages.filter(img => img.isMapping);
  if (effectiveMappings.length === 0 && stagedAutoDriveImages.length > 0) {
    effectiveMappings.push(stagedAutoDriveImages[0]);
  }

  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Verificando no Google Drive...';

  try {
    if (!window.electronAPI || !window.electronAPI.checkDriveLayout) {
      throw new Error('Função de verificação requer execução no aplicativo Desktop Electron.');
    }

    // Verificar se o Google Drive está conectado antes de tentar a busca
    if (window.electronAPI.getDriveStatus) {
      const driveStatus = await window.electronAPI.getDriveStatus();
      if (!driveStatus || !driveStatus.connected) {
        if (btn) btn.disabled = false;
        if (btnIcon) btnIcon.textContent = '🔍';
        if (btnText) btnText.textContent = 'Verificar no Google Drive';

        const openSettings = await showAppConfirm(
          'O Google Drive não está conectado neste computador.\n\nPara verificar layouts e enviar arquivos, conecte sua conta Google ou sincronize com o AutoDrive nas Configurações.\n\nDeseja abrir as Configurações agora?',
          'Google Drive Não Conectado',
          { confirmText: 'Abrir Configurações', cancelText: 'Agora Não' }
        );
        if (openSettings) {
          closeAutoDriveModal();
          openUserSettingsModal();
          setTimeout(() => {
            document.getElementById('settingsDriveStatusPill')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
        return;
      }
    }

    const savedMirrorDir = document.getElementById('settingsLocalMirrorPath')?.value || undefined;
    const checkData = {
      categoria: cat,
      entidade: ent,
      numero_layout: num,
      nome_documento: doc,
      senha,
      customMirrorDir: savedMirrorDir,
      pdfFiles: stagedAutoDrivePdfs.map(p => ({ name: p.name, size: p.size })),
      pdfName: stagedAutoDrivePdfs[0]?.name || null,
      mappingImages: effectiveMappings.map(img => ({ name: img.name, size: img.size })),
      extraImages: stagedAutoDriveImages.filter(img => !effectiveMappings.includes(img)).map(img => ({ name: img.name, size: img.size }))
    };

    const res = await window.electronAPI.checkDriveLayout(checkData);

    if (!res.success) {
      throw new Error(res.error || 'Erro desconhecido na verificação do Drive.');
    }

    if (approvalDetails) {
      const isDirectCategory = !res.categoria?.hasEntitySubfolder || cat === 'DESCONHECIDOS';
      const entityExists = !!(res.entity?.exists || res.entityFolder?.exists);
      const entityName = res.entity?.matchedName || res.entity?.name || res.stdNames?.folderEntityName || ent;
      const layoutExists = !!(res.layout?.exists || res.layoutFolder?.exists);
      const layoutName = res.layout?.matchedName || res.layout?.name || res.stdNames?.folderLayoutName;
      const conflicts = res.conflicts || [];
      const existingFiles = res.existingFiles || [];

      let entityStatusHtml = '';
      if (isDirectCategory) {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(56, 139, 253, 0.12); border: 1px solid rgba(56, 139, 253, 0.35); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Destino Categoria: ${escapeHtml(res.categoria?.folderName || '1DESCONHECIDOS')}</div>
                <div style="color: #8b949e; font-size: 11px;">Criação direta na categoria raiz (sem criar pasta intermediária de banco/sistema)</div>
              </div>
            </div>
            <span style="background: rgba(56, 139, 253, 0.25); color: #58a6ff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">Subpasta Direta</span>
          </div>
        `;
      } else if (entityExists) {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(35, 134, 54, 0.1); border: 1px solid rgba(46, 160, 67, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Pasta da Entidade / Banco:</div>
                <div style="font-family: Consolas, monospace; color: #58a6ff; font-size: 11px;">${escapeHtml(entityName)}</div>
              </div>
            </div>
            <span style="background: rgba(35, 134, 54, 0.25); color: #3fb950; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✓ Já existe no Drive</span>
          </div>
        `;
      } else {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(210, 153, 34, 0.1); border: 1px solid rgba(210, 153, 34, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Pasta da Entidade / Banco:</div>
                <div style="font-family: Consolas, monospace; color: #e3b341; font-size: 11px;">${escapeHtml(entityName)}</div>
              </div>
            </div>
            <span style="background: rgba(210, 153, 34, 0.25); color: #e3b341; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✨ Será criada nova</span>
          </div>
        `;
      }

      let layoutStatusHtml = '';
      if (layoutExists) {
        layoutStatusHtml = `
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📂</span>
                <div>
                  <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Subpasta do Layout:</div>
                  <div style="font-family: Consolas, monospace; color: #f87171; font-size: 11px;">${escapeHtml(layoutName)}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${res.layout?.webViewLink ? `
                  <button type="button" class="btn-secondary btn-open-existing-drive-link" data-link="${escapeHtml(res.layout.webViewLink)}" style="font-size: 11px; height: 24px; padding: 0 8px; gap: 4px;" title="Ver pasta existente no Google Drive">
                    <span>🌐</span> <span>Abrir no Drive</span>
                  </button>
                ` : ''}
                <span style="background: rgba(239, 68, 68, 0.25); color: #f87171; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">⚠️ Já existe no Drive</span>
              </div>
            </div>
            ${existingFiles.length > 0 ? `
              <div style="font-size: 11px; color: #8b949e; border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 4px; margin-top: 2px;">
                <strong>Arquivos atuais na pasta:</strong> ${existingFiles.map(f => `<code style="color: #c9d1d9;">${escapeHtml(f.name)}</code>`).join(', ')}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        layoutStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(56, 139, 253, 0.1); border: 1px solid rgba(56, 139, 253, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📂</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Subpasta do Layout:</div>
                <div style="font-family: Consolas, monospace; color: #58a6ff; font-size: 11px;">${escapeHtml(layoutName)}</div>
              </div>
            </div>
            <span style="background: rgba(56, 139, 253, 0.25); color: #58a6ff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✨ Será criada nova</span>
          </div>
        `;
      }

      const plannedPdfs = res.stdNames?.pdfFilenames || (res.stdNames?.pdfFilename ? [res.stdNames.pdfFilename] : []);
      const plannedMappings = res.stdNames?.imageFilenames || (res.stdNames?.imageFilename ? [res.stdNames.imageFilename] : []);

      const pdfItemsHtml = plannedPdfs.map((pdfName, idx) => {
        const hasConflict = existingFiles.some(f => f.name && f.name.toUpperCase() === pdfName.toUpperCase());
        const label = plannedPdfs.length > 1 ? `Manual PDF ${idx + 1}:` : 'Manual PDF:';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>📕</span> <strong>${label}</strong> <code style="color: #79c0ff;">${escapeHtml(pdfName)}</code>
            </span>
            ${hasConflict
              ? '<span style="color: #f87171; font-weight: 700;">⚠️ Já existe (será atualizado)</span>'
              : '<span style="color: #3fb950; font-weight: 600;">✓ Novo envio</span>'
            }
          </div>
        `;
      }).join('');

      const mappingItemsHtml = plannedMappings.map((imgName, idx) => {
        const hasConflict = existingFiles.some(f => f.name && f.name.toUpperCase() === imgName.toUpperCase());
        const label = plannedMappings.length > 1 ? `Mapeamento ${idx + 1}:` : 'Mapeamento:';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>🖼️</span> <strong>${label}</strong> <code style="color: #79c0ff;">${escapeHtml(imgName)}</code>
            </span>
            ${hasConflict
              ? '<span style="color: #f87171; font-weight: 700;">⚠️ Já existe (será atualizado)</span>'
              : '<span style="color: #3fb950; font-weight: 600;">✓ Novo envio</span>'
            }
          </div>
        `;
      }).join('');

      const filesHtml = `
        <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; background: rgba(22, 27, 34, 0.8); border: 1px solid var(--border-color); border-radius: 6px;">
          <div style="font-weight: 700; color: #c9d1d9; font-size: 11px; text-transform: uppercase;">Arquivos preparados para envio:</div>
          ${pdfItemsHtml || `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>📕</span> <strong>Manual PDF:</strong> <span style="color: #8b949e;">Nenhum anexado</span>
              </span>
              <span style="color: #8b949e;">-</span>
            </div>
          `}
          ${mappingItemsHtml || '<div style="font-size: 11px; color: #8b949e;">Nenhuma imagem de mapeamento selecionada</div>'}
          ${senha ? `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px; margin-top: 2px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>🔑</span> <strong>Senha do Arquivo / PDF:</strong> <code style="color: #38bdf8;">${escapeHtml(senha)}</code>
              </span>
              <span style="color: #38bdf8; font-weight: 600;">✓ Protegido</span>
            </div>
          ` : ''}
        </div>
      `;

      const mirrorDir = res.mirror?.targetDir || res.mirrorFolder || '';
      const mirrorExists = !!(res.mirror?.exists || res.mirrorExists);
      const mirrorHtml = `
        <div style="font-size: 11px; color: #8b949e; padding: 4px 6px;">
          💾 <strong>Espelho Local:</strong> <code style="color: #c9d1d9;">${escapeHtml(mirrorDir)}</code>
          ${mirrorExists ? '<span style="color: #e3b341; margin-left: 6px;">(pasta local já existe)</span>' : '<span style="color: #3fb950; margin-left: 6px;">(será criada localmente)</span>'}
        </div>
      `;

      approvalDetails.innerHTML = entityStatusHtml + layoutStatusHtml + filesHtml + mirrorHtml;

      // Wire existing layout link button if present
      approvalDetails.querySelectorAll('.btn-open-existing-drive-link').forEach(btnEl => {
        btnEl.addEventListener('click', () => {
          const lk = btnEl.getAttribute('data-link');
          if (lk) {
            if (window.electronAPI && window.electronAPI.openExternal) window.electronAPI.openExternal(lk);
            else window.open(lk, '_blank');
          }
        });
      });
    }

    if (approvalBox) {
      approvalBox.style.display = 'block';
      approvalBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

  } catch (err) {
    if (err.message && (err.message.includes('Google Drive não está conectado') || err.message.includes('refresh_token'))) {
      const openSettings = await showAppConfirm(
        'O Google Drive não está conectado neste computador.\n\nPara verificar layouts e enviar arquivos, conecte sua conta Google ou sincronize com o AutoDrive nas Configurações.\n\nDeseja abrir as Configurações agora?',
        'Google Drive Não Conectado',
        { confirmText: 'Abrir Configurações', cancelText: 'Agora Não' }
      );
      if (openSettings) {
        closeAutoDriveModal();
        openUserSettingsModal();
        setTimeout(() => {
          document.getElementById('settingsDriveStatusPill')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    } else {
      showAppError('Verificação no Google Drive', err);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = '🔍';
    if (btnText) btnText.textContent = 'Verificar no Google Drive';
  }
}

async function executeAutoDriveLaunch() {
  if (!currentAutoDriveTicket) return;

  const btn = document.getElementById('btnLaunchAutoDriveNow');
  const btnIcon = document.getElementById('autoDriveBtnIcon');
  const btnText = document.getElementById('autoDriveBtnText');
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  const progressBox = document.getElementById('autoDriveProgressBox');
  const progressMsg = document.getElementById('autoDriveProgressMsg');
  const progressStepText = document.getElementById('autoDriveProgressStepText');
  const successBox = document.getElementById('autoDriveSuccessBox');

  const quick = document.getElementById('autoDriveQuickText')?.value || '';
  const num = (document.getElementById('autoDriveNumeroLayout')?.value || '').trim();
  const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
  const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();
  const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
  const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';
  const saveMirror = document.getElementById('chkAutoDriveSaveMirror')?.checked ?? true;

  if (!num) {
    showAppAlert('Por favor, preencha o Número do Layout.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveNumeroLayout')?.focus();
    return;
  }
  if (cat !== 'DESCONHECIDOS' && !ent) {
    showAppAlert('Por favor, preencha o Banco ou Instituição.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveEntidade')?.focus();
    return;
  }
  if (!doc) {
    showAppAlert('Por favor, preencha o Nome do Sistema / Documento.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveDocumento')?.focus();
    return;
  }

  // Selected mapping images (support multiple)
  let effectiveMappings = stagedAutoDriveImages.filter(img => img.isMapping);
  if (effectiveMappings.length === 0 && stagedAutoDriveImages.length > 0) {
    effectiveMappings = [stagedAutoDriveImages[0]];
  }

  if (effectiveMappings.length === 0 && stagedAutoDrivePdfs.length === 0) {
    const confirmNoMedia = await showAppConfirm(
      'Nenhuma imagem de mapeamento nem manual PDF foi selecionado. Deseja criar apenas as pastas organizadas no Google Drive?',
      'Criar Pastas no Google Drive',
      { confirmText: 'Criar Pastas Apenas' }
    );
    if (!confirmNoMedia) return;
  }

  // Esconder caixa de aprovação ao iniciar envio
  if (approvalBox) approvalBox.style.display = 'none';

  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Sincronizando com o Drive...';

  if (progressBox) progressBox.style.display = 'block';
  if (successBox) successBox.style.display = 'none';

  try {
    const preparedPdfs = [];
    for (let i = 0; i < stagedAutoDrivePdfs.length; i++) {
      const p = stagedAutoDrivePdfs[i];
      const buf = p.buffer || (await p.blob.arrayBuffer());
      preparedPdfs.push({
        id: p.id,
        name: p.name,
        buffer: buf,
        size: p.size
      });
    }

    const preparedMappingImages = [];
    for (let i = 0; i < effectiveMappings.length; i++) {
      const mImg = effectiveMappings[i];
      const buf = await mImg.blob.arrayBuffer();
      preparedMappingImages.push({
        id: mImg.id,
        name: mImg.name,
        buffer: buf
      });
    }

    const savedMirrorDir = document.getElementById('settingsLocalMirrorPath')?.value || undefined;
    const payload = {
      quick,
      numero_layout: num,
      entidade: ent,
      nome_documento: doc,
      categoria: cat,
      senha,
      pdfBuffer: preparedPdfs[0]?.buffer || null,
      pdfName: preparedPdfs[0]?.name || null,
      pdfFiles: preparedPdfs,
      imageBuffer: preparedMappingImages[0]?.buffer || null,
      imageName: preparedMappingImages[0]?.name || null,
      mappingImages: preparedMappingImages,
      saveMirror,
      customMirrorDir: savedMirrorDir
    };

    if (window.electronAPI && window.electronAPI.uploadDriveLayout) {
      if (progressMsg) progressMsg.textContent = 'Iniciando upload e sincronização com Google Drive...';

      let unsubProgress = null;
      if (window.electronAPI.onDriveProgress) {
        unsubProgress = window.electronAPI.onDriveProgress((p) => {
          if (progressMsg) progressMsg.textContent = p.message || 'Processando...';
          if (progressStepText) progressStepText.textContent = p.step || '';
        });
      }

      const res = await window.electronAPI.uploadDriveLayout(payload);
      if (unsubProgress) unsubProgress();

      if (!res.success) {
        throw new Error(res.error || 'Erro ao sincronizar com Google Drive');
      }

      autoDriveLastResult = res;

      // Show success screen and scroll smoothly to it
      if (progressBox) progressBox.style.display = 'none';
      if (successBox) {
        successBox.style.display = 'block';
        const sumEl = document.getElementById('autoDriveSuccessSummary');
        if (sumEl) {
          const mappedListHtml = (res.uploadedImages && res.uploadedImages.length > 0)
            ? res.uploadedImages.map((upImg, idx) => `<div>🖼️ <strong>Mapeamento ${res.uploadedImages.length > 1 ? (idx + 1) + ': ' : ''}</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(upImg.filename || res.stdNames.imageFilename)}</span></div>`).join('')
            : (res.stdNames?.imageFilename ? `<div>🖼️ <strong>Mapeamento:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.stdNames.imageFilename)}</span></div>` : '');

          const pdfsListHtml = (res.uploadedPdfs && res.uploadedPdfs.length > 0)
            ? res.uploadedPdfs.map((upPdf, idx) => `<div>📕 <strong>Manual PDF ${res.uploadedPdfs.length > 1 ? (idx + 1) + ': ' : ''}</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(upPdf.filename || res.stdNames.pdfFilename)}</span></div>`).join('')
            : (res.stdNames?.pdfFilename ? `<div>📕 <strong>Manual PDF:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.stdNames.pdfFilename)}</span></div>` : '');

          sumEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
              <div>📁 <strong>Pasta no Drive:</strong> <span style="font-family: Consolas, monospace; color: #58a6ff; font-weight: 700;">${escapeHtml(res.stdNames.folderLayoutName)}</span></div>
              ${pdfsListHtml}
              ${mappedListHtml}
              ${senha ? `<div>🔑 <strong>Senha do Arquivo / PDF:</strong> <span style="font-family: Consolas, monospace; color: #38bdf8;">${escapeHtml(senha)}</span></div>` : ''}
              ${res.mirror?.targetDir ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">💾 <strong>Espelho Local:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.mirror.targetDir)}</span></div>` : ''}
            </div>
          `;
        }
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Check minimize
      const shouldMinimize = document.getElementById('chkAutoDriveMinimizeApp')?.checked;
      if (shouldMinimize && window.electronAPI && window.electronAPI.minimize) {
        window.electronAPI.minimize();
      }

      // Show native notification
      if (window.electronAPI && window.electronAPI.showNotification) {
        window.electronAPI.showNotification('AutoDrive • Sucesso', `Layout ${res.stdNames.folderLayoutName} sincronizado com sucesso!`);
      }

    } else {
      throw new Error('Integração com Google Drive requer execução no aplicativo Desktop Electron.');
    }

  } catch (err) {
    if (progressBox) progressBox.style.display = 'none';
    if (err.message && (err.message.includes('Google Drive não está conectado') || err.message.includes('refresh_token'))) {
      showAppAlert(
        'O Google Drive não está conectado neste computador.\n\nAcesse as Configurações ⚙️ para conectar sua conta Google ou sincronizar com o AutoDrive.',
        'Google Drive Não Conectado',
        'warning'
      );
    } else {
      showAppError('Erro ao enviar layout para o Google Drive', err);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = '🚀';
    if (btnText) btnText.textContent = 'Enviar para o Google Drive';
  }
}

async function executeExternalPythonLaunch() {
  if (!currentAutoDriveTicket) return;

  try {
    const quick = document.getElementById('autoDriveQuickText')?.value || '';
    const num = document.getElementById('autoDriveNumeroLayout')?.value || '';
    const ent = document.getElementById('autoDriveEntidade')?.value || '';
    const doc = document.getElementById('autoDriveDocumento')?.value || '';
    const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
    const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';

    const mappingImg = stagedAutoDriveImages.find(img => img.isMapping) || stagedAutoDriveImages[0];
    const preparedPdfs = [];
    for (let i = 0; i < stagedAutoDrivePdfs.length; i++) {
      const p = stagedAutoDrivePdfs[i];
      const buf = p.buffer || (await p.blob.arrayBuffer());
      preparedPdfs.push({
        id: p.id,
        name: p.name,
        buffer: buf,
        size: p.size
      });
    }

    let imageBuffer = null;
    let imageName = null;
    if (mappingImg) {
      imageName = mappingImg.name || 'mapeamento.png';
      imageBuffer = await mappingImg.blob.arrayBuffer();
    }

    const launchData = {
      quick,
      numero_layout: num,
      entidade: ent,
      nome_documento: doc,
      categoria: cat,
      senha,
      pdfBuffer: preparedPdfs[0]?.buffer || null,
      pdfName: preparedPdfs[0]?.name || null,
      pdfFiles: preparedPdfs,
      imageBuffer,
      imageName
    };

    if (window.electronAPI && window.electronAPI.launchAutoDrive) {
      const res = await window.electronAPI.launchAutoDrive(launchData);
      if (!res.success) {
        showAppError('Erro ao abrir AutoDrive externo', res.error || 'Falha ao executar executável');
        return;
      }
      showToast('AutoDrive externo iniciado');
      closeAutoDriveModal();
    } else {
      showAppAlert('Disponível apenas no Desktop Electron.', 'Recurso Desktop', 'info');
    }
  } catch (err) {
    showAppError('Erro ao iniciar AutoDrive externo', err);
  }
}


