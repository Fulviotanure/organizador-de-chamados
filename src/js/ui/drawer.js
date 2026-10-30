// UI Module: Demand Details Drawer, Sanitized HTML Description, Activity Stream, Attachments & Workflow Actions
// Slide-over / Expanded Demand Details Workspace Handling
let drawerActiveTab = 'details';
let isDrawerExpanded = false;
let drawerCurrentFilter = 'all'; // 'all' | 'comments' | 'events'
let drawerCurrentComments = [];
let drawerCurrentEvents = [];
let selectedDrawerLabels = new Set();
let isEditingDescription = false;
let drawerLayoutSearchDebounce = null;
let drawerDeliveryCalYear = new Date().getFullYear();
let drawerDeliveryCalMonth = new Date().getMonth();
let drawerClientCalYear = new Date().getFullYear();
let drawerClientCalMonth = new Date().getMonth();

function formatDateToBrInput(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
}

function parseBrDateToIso(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(Number);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y) {
        return new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString();
      }
    }
  } else if (trimmed.includes('-')) {
    const parts = trimmed.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (d && m && y) {
        return new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString();
      }
    }
  }
  return null;
}

function formatStatusLabel(st) {
  if (!st) return 'Triagem';
  let val = st;
  if (typeof st === 'object') {
    val = st.status || st.name || st.title || st.label || st.code || st.value || '';
    if (typeof val === 'object') {
      val = val.status || val.name || val.title || val.label || '';
    }
  }
  const s = String(val || '').toLowerCase().trim();
  switch (s) {
    case 'triage': return 'Triagem';
    case 'open':
    case 'queued': return 'Na Fila';
    case 'in_progress':
    case 'progress': return 'Em Progresso';
    case 'review': return 'Em Revisão';
    case 'waiting':
    case 'waiting_creator':
    case 'waiting_requester': return 'Aguardando Resposta do N2';
    case 'paused': return 'Pausado';
    case 'closed':
    case 'done':
    case 'completed':
    case 'finished': return 'Concluído';
    default:
      if (val && typeof val === 'string') return val;
      return typeof st === 'string' ? st : 'Atualizado';
  }
}

// Safely stringifies values from timeline events avoiding any [object Object]
function stringifySafeValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (val.name) return String(val.name);
    if (val.title) return String(val.title);
    if (val.status) return formatStatusLabel(val.status);
    if (val.priority) return formatPriorityLabel(val.priority);
    if (val.label) return String(val.label);
    if (val.assignedToName) return String(val.assignedToName);
    if (val.reviewerName) return String(val.reviewerName);
    if (val.code) return `Layout ${val.code}`;
    if (val.clientDatabase) return String(val.clientDatabase);
    if (val.clientDueDate) return formatDisplayDate(val.clientDueDate);
    if (val.deliveryDueDate) return formatDisplayDate(val.deliveryDueDate);
    const strValues = Object.values(val).filter(v => typeof v === 'string' || typeof v === 'number');
    if (strValues.length > 0) return String(strValues[0]);
    return '';
  }
  return '';
}

// Robust product dropdown population and auto-selection
function populateAndSelectProduct(selectEl, item, prods) {
  if (!selectEl) return;
  prods = (prods || window.appStore.getProducts()).slice();

  // Extract raw candidate IDs and names from all possible API fields
  const rawId = item?.productId || item?.product_id || item?.product?.id || item?.layout?.productId || item?.layout?.product_id || null;
  const rawName = (typeof item?.product === 'string' ? item?.product : item?.product?.name) ||
                  item?.productName || item?.product_name ||
                  (typeof item?.layout?.product === 'string' ? item?.layout?.product : item?.layout?.product?.name) ||
                  null;

  let matched = null;

  // 1. Match by exact ID
  if (rawId) {
    matched = prods.find(p => p.id === rawId);
  }

  // 2. Match by exact name
  if (!matched && rawName) {
    const cleanName = String(rawName).trim().toLowerCase();
    matched = prods.find(p => p.name.toLowerCase() === cleanName);
  }

  // 3. Match by partial name or keywords
  if (!matched && (rawName || rawId)) {
    const searchTarget = String(rawName || rawId).toLowerCase();
    if (searchTarget.includes('importer')) {
      matched = prods.find(p => p.name.toLowerCase() === 'importer');
    } else if (searchTarget.includes('reconcilia')) {
      matched = prods.find(p => p.name.toLowerCase() === 'reconcilia');
    } else if (searchTarget.includes('web')) {
      matched = prods.find(p => p.name.toLowerCase() === 'conciliador web');
    } else if (searchTarget.includes('conciliador')) {
      matched = prods.find(p => p.name.toLowerCase() === 'conciliador');
    }
  }

  // 4. If an item has an unknown product name/id not in prods list, add it dynamically
  if (!matched && (rawName || rawId)) {
    const dynId = rawId || `custom_${Date.now()}`;
    const dynName = rawName || (rawId ? `Produto (${rawId.slice(0, 8)})` : 'Produto');
    matched = { id: dynId, name: dynName };
    prods.push(matched);
  }

  // 5. Fallback if still no match: if demand has layout or type, default to 'Conciliador'
  if (!matched) {
    const defaultProd = prods.find(p => p.name.toLowerCase() === 'conciliador') || prods[0];
    if (defaultProd) matched = defaultProd;
  }

  // Re-render options so the select is always fully populated and synchronized
  selectEl.innerHTML = '<option value="">Selecione o produto...</option>' +
    prods.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

  if (matched) {
    selectEl.value = matched.id;
  }
}

// Caching blob URLs for image attachments & descriptions
const attachmentBlobCache = new Map();
let currentLightboxAttachment = null;

async function getOrFetchAttachmentBlobUrl(ticketId, attachmentId) {
  const cacheKey = `${ticketId}_${attachmentId}`;
  if (attachmentBlobCache.has(cacheKey)) {
    return attachmentBlobCache.get(cacheKey);
  }
  try {
    const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticketId, attachmentId);
    const objUrl = URL.createObjectURL(blob);
    attachmentBlobCache.set(cacheKey, objUrl);
    return objUrl;
  } catch (e) {
    console.warn('Failed to load blob for attachment:', attachmentId, e);
    return null;
  }
}

// Renomeia o anexo antes do download conforme o layout e tipo de arquivo:
// Exemplo: Layout 13 -> 13-doc-1.pdf, 13-doc-2.pdf, 13-img-1.jpg, 13-img-2.jpg
function getFormattedAttachmentName(ticket, att, customList = null) {
  const t = ticket || selectedTicket;

  // 1. Obter prefixo do código do layout
  const layoutInfo = (typeof getTicketLayoutInfo === 'function' && t) ? getTicketLayoutInfo(t) : null;
  let layoutPrefix = null;

  if (layoutInfo && layoutInfo.code != null) {
    layoutPrefix = String(layoutInfo.code).trim();
  } else if (t?.layout?.code != null) {
    layoutPrefix = String(t.layout.code).trim();
  } else if (t?.layoutCode != null) {
    layoutPrefix = String(t.layoutCode).trim();
  } else if (t?.layout?.name) {
    const numMatch = String(t.layout.name).match(/\b(\d{2,5})\b/);
    if (numMatch) layoutPrefix = numMatch[1];
  }

  if (layoutPrefix) {
    layoutPrefix = layoutPrefix.replace(/^layout\s*[-–—:]?\s*/i, '').trim();
  }

  // Fallback caso não haja layout associado: número do chamado ou 'anexo'
  if (!layoutPrefix) {
    layoutPrefix = t?.number ? `${t.number}` : 'anexo';
  }

  // 2. Extrair extensão do arquivo
  const rawName = (typeof att === 'string')
    ? att
    : (att?.fileName || att?.filename || att?.originalName || att?.name || '');
  const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'dat';

  // 3. Categoria: img vs doc
  const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff']);
  const isImg = imageExts.has(ext) ||
    (att && typeof att === 'object' && (
      att.category === 'image' ||
      (att.mimeType && att.mimeType.startsWith('image/')) ||
      (att.mimetype && att.mimetype.startsWith('image/'))
    ));
  const categoryTag = isImg ? 'img' : 'doc';

  // 4. Determinar numeração sequencial (1, 2, 3...)
  let index = 1;
  const attList = customList || t?.attachments || [];

  if (Array.isArray(attList) && attList.length > 0) {
    let countInCat = 0;
    let found = false;
    for (const item of attList) {
      const itemRawName = item?.fileName || item?.filename || item?.originalName || item?.name || '';
      const itemExtMatch = itemRawName.match(/\.([a-zA-Z0-9]+)$/);
      const itemExt = itemExtMatch ? itemExtMatch[1].toLowerCase() : '';
      const itemIsImg = imageExts.has(itemExt) ||
        (item?.category === 'image') ||
        (item?.mimeType && item.mimeType.startsWith('image/')) ||
        (item?.mimetype && item.mimetype.startsWith('image/'));

      const itemCat = itemIsImg ? 'img' : 'doc';
      if (itemCat === categoryTag) {
        countInCat++;
        if (att && typeof att === 'object' && att.id && item.id && String(att.id) === String(item.id)) {
          index = countInCat;
          found = true;
          break;
        } else if (rawName && itemRawName === rawName) {
          index = countInCat;
          found = true;
          break;
        }
      }
    }
    if (!found && countInCat > 0) {
      index = countInCat + 1;
    }
  }

  return `${layoutPrefix}-${categoryTag}-${index}.${ext}`;
}

async function downloadAttachmentFile(ticketId, attId, fileName, customTicket = null, customList = null) {
  try {
    const ticket = customTicket || selectedTicket || (ticketId ? window.appStore?.demands?.find(d => d.id === ticketId) : null);
    const list = customList || ticket?.attachments || [];
    const targetFileName = getFormattedAttachmentName(ticket, { id: attId, fileName }, list);

    const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticketId, attId);

    // Salvar diretamente na pasta Downloads do Windows no Electron (sem diálogo de confirmação ou substituição)
    if (window.electronAPI && window.electronAPI.saveToDownloads) {
      const buffer = await blob.arrayBuffer();
      const res = await window.electronAPI.saveToDownloads(targetFileName, buffer);
      if (res && res.success) {
        if (!customList && window.electronAPI.showNotification) {
          window.electronAPI.showNotification('Download Concluído', `Arquivo ${targetFileName} salvo na pasta Downloads.`);
        }
        return res;
      }
    }

    // Fallback para navegador web
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    showAppError('Erro ao Baixar Anexo', err);
  }
}

async function openAttachmentFile(ticketId, attId, fileName) {
  const ticket = selectedTicket || (ticketId ? window.appStore?.demands?.find(d => d.id === ticketId) : null);
  const targetFileName = getFormattedAttachmentName(ticket, { id: attId, fileName });
  const ext = (targetFileName.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
    const blobUrl = await getOrFetchAttachmentBlobUrl(ticketId, attId);
    if (blobUrl) {
      openImageLightbox(blobUrl, targetFileName, ticketId, attId);
      return;
    }
  }
  try {
    const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticketId, attId);
    // Use native desktop application if running in Electron
    if (window.electronAPI && window.electronAPI.openBufferTemp) {
      const buffer = await blob.arrayBuffer();
      const res = await window.electronAPI.openBufferTemp(targetFileName, buffer);
      if (res && res.success) return;
    }
    // Fallback directly to downloads
    if (window.electronAPI && window.electronAPI.saveToDownloads) {
      const buffer = await blob.arrayBuffer();
      const res = await window.electronAPI.saveToDownloads(targetFileName, buffer);
      if (res && res.success) return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    showAppError('Erro ao Abrir Anexo', err);
  }
}

let lightboxGallery = [];
let currentLightboxIndex = 0;

function openImageLightbox(blobUrl, fileName, ticketId, attId, gallery = null, initialIndex = 0) {
  const overlay = document.getElementById('imageLightboxOverlay');
  const imgEl = document.getElementById('lightboxImage');
  if (!overlay || !imgEl) return;

  if (Array.isArray(gallery) && gallery.length > 0) {
    lightboxGallery = gallery.map(item => ({
      blobUrl: item.blobUrl || item.url || '',
      fileName: item.fileName || item.name || 'imagem.png',
      ticketId: item.ticketId || ticketId,
      attId: item.attId || attId
    }));
    currentLightboxIndex = (initialIndex >= 0 && initialIndex < lightboxGallery.length) ? initialIndex : 0;
  } else {
    lightboxGallery = [{
      blobUrl,
      fileName: fileName || 'imagem.png',
      ticketId,
      attId
    }];
    currentLightboxIndex = 0;
  }

  updateLightboxView();
  overlay.style.display = 'flex';
}

function updateLightboxView() {
  if (!lightboxGallery || lightboxGallery.length === 0) return;
  const current = lightboxGallery[currentLightboxIndex] || lightboxGallery[0];
  const imgEl = document.getElementById('lightboxImage');
  const nameEl = document.getElementById('lightboxFileName');
  const counterEl = document.getElementById('lightboxCounter');
  const btnPrev = document.getElementById('btnLightboxPrev');
  const btnNext = document.getElementById('btnLightboxNext');
  const btnDownload = document.getElementById('btnLightboxDownload');

  currentLightboxAttachment = current;
  if (imgEl) imgEl.src = current.blobUrl;
  if (nameEl) nameEl.textContent = current.fileName;

  const total = lightboxGallery.length;
  if (counterEl) {
    if (total > 1) {
      counterEl.textContent = `${currentLightboxIndex + 1} de ${total}`;
      counterEl.style.display = 'inline-block';
    } else {
      counterEl.style.display = 'none';
    }
  }

  if (btnPrev && btnNext) {
    if (total > 1) {
      btnPrev.classList.remove('hidden');
      btnNext.classList.remove('hidden');
      btnPrev.style.display = 'flex';
      btnNext.style.display = 'flex';
    } else {
      btnPrev.classList.add('hidden');
      btnNext.classList.add('hidden');
      btnPrev.style.display = 'none';
      btnNext.style.display = 'none';
    }
  }

  if (btnDownload) {
    btnDownload.onclick = async () => {
      if (current.ticketId && current.attId) {
        await downloadAttachmentFile(current.ticketId, current.attId, current.fileName);
      } else if (current.blobUrl) {
        const targetFileName = getFormattedAttachmentName(selectedTicket, { fileName: current.fileName });
        try {
          const resp = await fetch(current.blobUrl);
          const blob = await resp.blob();
          if (window.electronAPI && window.electronAPI.saveToDownloads) {
            const buffer = await blob.arrayBuffer();
            const res = await window.electronAPI.saveToDownloads(targetFileName, buffer);
            if (res && res.success) {
              if (window.electronAPI.showNotification) {
                window.electronAPI.showNotification('Download Concluído', `Imagem ${targetFileName} salva na pasta Downloads.`);
              }
              return;
            }
          }
        } catch (e) {
          console.warn('Fallback lightbox download error:', e);
        }
        const a = document.createElement('a');
        a.href = current.blobUrl;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  }
}

function navigateLightbox(dir) {
  if (!lightboxGallery || lightboxGallery.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + dir + lightboxGallery.length) % lightboxGallery.length;
  updateLightboxView();
}

function closeImageLightbox() {
  const overlay = document.getElementById('imageLightboxOverlay');
  if (overlay) overlay.style.display = 'none';
  currentLightboxAttachment = null;
  lightboxGallery = [];
  currentLightboxIndex = 0;
}

async function renderAuthenticatedDescription(descHtml, ticketId, containerEl) {
  if (!descHtml) {
    containerEl.innerHTML = '<span style="color: var(--text-muted);">Nenhuma descrição detalhada informada.</span>';
    return;
  }

  let formatted = descHtml.replace(
    /src="\/api\/v1\//g,
    'src="https://api.importer.conciliadorcontabil.com.br/api/v1/'
  );
  containerEl.innerHTML = sanitizeHtml(formatted);

  // Replace any embedded attachments with authenticated blobs so they actually load and are clickable
  const imgs = containerEl.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (src && src.includes('/attachments/')) {
      const match = src.match(/\/attachments\/([^\/]+)\/download/);
      if (match) {
        const attId = match[1];
        getOrFetchAttachmentBlobUrl(ticketId, attId).then(blobUrl => {
          if (blobUrl) {
            img.src = blobUrl;
            img.style.cursor = 'zoom-in';
            img.title = 'Clique para ampliar imagem';
            img.onclick = () => openImageLightbox(blobUrl, 'Imagem da descrição', ticketId, attId);
          }
        });
      }
    }
  }
}

function formatEventContent(ev) {
  const authorName = ev.user?.name || 'Sistema';
  let title = 'Evento na demanda';
  let dotIcon = '⚡';
  let dotColor = '#38bdf8';
  let detail = '';

  const fromVal = ev.fromValue || {};
  const toVal = ev.toValue || {};

  switch (ev.kind) {
    case 'created':
    case 'ticket_created':
      title = `Demanda aberta por <strong>${escapeHtml(authorName)}</strong>`;
      dotIcon = '➕';
      dotColor = '#10b981';
      if (toVal.title) {
        detail = `<div class="stream-event-desc">"${escapeHtml(toVal.title)}"</div>`;
      }
      break;

    case 'status_change':
    case 'status_changed':
    case 'status':
      const fromSt = formatStatusLabel(fromVal.status !== undefined ? fromVal.status : fromVal);
      const toSt = formatStatusLabel(toVal.status !== undefined ? toVal.status : toVal);
      title = `Situação alterada de <strong>${escapeHtml(fromSt)}</strong> para <strong>${escapeHtml(toSt)}</strong>`;
      dotIcon = '🔄';
      dotColor = '#38bdf8';
      if (ev.reason) {
        detail = `<div class="stream-event-reason">Motivo: ${escapeHtml(ev.reason)}</div>`;
      }
      break;

    case 'assigned':
    case 'assignee_changed':
    case 'developer_assigned':
      const devName = toVal.assignedToName || toVal.assignedTo?.name || toVal.name || stringifySafeValue(toVal) || 'Desenvolvedor';
      title = `Atribuído a <strong>${escapeHtml(String(devName))}</strong> por ${escapeHtml(authorName)}`;
      dotIcon = '👤';
      dotColor = '#818cf8';
      break;

    case 'reviewer_assigned':
    case 'reviewer_changed':
      const revName = toVal.reviewerName || toVal.reviewer?.name || toVal.name || stringifySafeValue(toVal) || 'Validador';
      title = `Validador definido: <strong>${escapeHtml(String(revName))}</strong> por ${escapeHtml(authorName)}`;
      dotIcon = '🧐';
      dotColor = '#a855f7';
      break;

    case 'returned':
    case 'return':
    case 'rejected':
      title = `Chamado retornado para ajustes por <strong>${escapeHtml(authorName)}</strong>`;
      dotIcon = '↩️';
      dotColor = '#ef4444';
      if (ev.reason) {
        detail = `<div class="stream-event-reason">Motivo: ${escapeHtml(ev.reason)}</div>`;
      }
      break;

    case 'layout_linked':
    case 'layout_changed':
    case 'layout':
      const lCode = toVal.layoutCode || toVal.code || toVal.layout?.code || (typeof toVal === 'number' ? toVal : '');
      const lName = toVal.layoutName || toVal.name || toVal.layout?.name || '';
      title = lCode
        ? `Layout <strong>${escapeHtml(String(lCode))}</strong> ${lName ? '(' + escapeHtml(lName) + ') ' : ''}vinculado por <strong>${escapeHtml(authorName)}</strong>`
        : `Layout vinculado à demanda por <strong>${escapeHtml(authorName)}</strong>`;
      dotIcon = '📐';
      dotColor = '#06b6d4';
      break;

    case 'client_due_changed':
    case 'client_due_date_changed':
      const fromDue = fromVal.clientDueDate ? formatDisplayDate(fromVal.clientDueDate) : stringifySafeValue(fromVal);
      const toDue = toVal.clientDueDate ? formatDisplayDate(toVal.clientDueDate) : stringifySafeValue(toVal);
      title = `Prazo do cliente alterado${fromDue ? ' de <strong>' + fromDue + '</strong>' : ''} para <strong>${toDue || '-'}</strong> por ${escapeHtml(authorName)}`;
      dotIcon = '📅';
      dotColor = '#6366f1';
      break;

    case 'delivery_due_changed':
    case 'delivery_due_date_changed':
      const fromDel = fromVal.deliveryDueDate ? formatDisplayDate(fromVal.deliveryDueDate) : stringifySafeValue(fromVal);
      const toDel = toVal.deliveryDueDate ? formatDisplayDate(toVal.deliveryDueDate) : stringifySafeValue(toVal);
      title = `Prazo de entrega alterado${fromDel ? ' de <strong>' + fromDel + '</strong>' : ''} para <strong>${toDel || '-'}</strong> por ${escapeHtml(authorName)}`;
      dotIcon = '📅';
      dotColor = '#6366f1';
      break;

    case 'priority_change':
    case 'priority_changed':
    case 'priority':
      const fromPri = formatPriorityLabel(fromVal.priority !== undefined ? fromVal.priority : fromVal);
      const toPri = formatPriorityLabel(toVal.priority !== undefined ? toVal.priority : toVal);
      title = `Prioridade alterada de <strong>${escapeHtml(fromPri)}</strong> para <strong>${escapeHtml(toPri)}</strong> por ${escapeHtml(authorName)}`;
      dotIcon = '⚡';
      dotColor = '#f59e0b';
      break;

    case 'updated':
      if (toVal.description !== undefined || fromVal.description !== undefined) {
        const descStr = String(toVal.description || '');
        const hadImg = String(fromVal.description || '').includes('<img');
        const hasImg = descStr.includes('<img');
        if (!hadImg && hasImg) {
          title = `Imagem ou anexo adicionado à descrição por <strong>${escapeHtml(authorName)}</strong>`;
          dotIcon = '🖼️';
          dotColor = '#06b6d4';
        } else {
          title = `Descrição da demanda atualizada por <strong>${escapeHtml(authorName)}</strong>`;
          dotIcon = '📝';
          dotColor = '#64748b';
        }
      } else if (toVal.labels !== undefined) {
        title = `Etiquetas da demanda atualizadas por <strong>${escapeHtml(authorName)}</strong>`;
        dotIcon = '🏷️';
        dotColor = '#8b5cf6';
      } else if (toVal.title !== undefined) {
        title = `Título alterado para <strong>"${escapeHtml(toVal.title)}"</strong> por ${escapeHtml(authorName)}`;
        dotIcon = '✏️';
        dotColor = '#38bdf8';
      } else if (toVal.clientDatabase !== undefined) {
        title = `Banco de dados atualizado para <strong>"${escapeHtml(toVal.clientDatabase || 'Sem banco')}"</strong> por ${escapeHtml(authorName)}`;
        dotIcon = '📦';
        dotColor = '#38bdf8';
      } else if (toVal.movideskTicketId !== undefined) {
        title = `Ticket Movidesk associado: <strong>#${escapeHtml(String(toVal.movideskTicketId))}</strong> por ${escapeHtml(authorName)}`;
        dotIcon = '🎫';
        dotColor = '#38bdf8';
      } else {
        const fromStr = stringifySafeValue(fromVal);
        const toStr = stringifySafeValue(toVal);
        if (fromStr && toStr) {
          title = `Atualização de <strong>${escapeHtml(fromStr)}</strong> para <strong>${escapeHtml(toStr)}</strong> por ${escapeHtml(authorName)}`;
        } else if (toStr) {
          title = `Atualizado para <strong>${escapeHtml(toStr)}</strong> por ${escapeHtml(authorName)}`;
        } else {
          title = `Demanda atualizada por <strong>${escapeHtml(authorName)}</strong>`;
        }
        dotIcon = 'ℹ️';
        dotColor = '#64748b';
      }
      if (ev.reason) {
        detail = `<div class="stream-event-reason">Motivo: ${escapeHtml(ev.reason)}</div>`;
      }
      break;

    default:
      const fallbackFrom = stringifySafeValue(fromVal);
      const fallbackTo = stringifySafeValue(toVal);
      if (fallbackFrom && fallbackTo) {
        title = `Alteração de <strong>${escapeHtml(fallbackFrom)}</strong> para <strong>${escapeHtml(fallbackTo)}</strong> por ${escapeHtml(authorName)}`;
      } else if (fallbackTo) {
        title = `Definido como <strong>${escapeHtml(fallbackTo)}</strong> por ${escapeHtml(authorName)}`;
      } else {
        title = `Alteração registrada por <strong>${escapeHtml(authorName)}</strong>`;
      }
      dotIcon = '⚡';
      dotColor = '#64748b';
      if (ev.reason) {
        detail = `<div class="stream-event-reason">${escapeHtml(ev.reason)}</div>`;
      }
      break;
  }

  return { title, dotIcon, dotColor, detail };
}

function toggleDrawerExpand() {
  const drawer = document.getElementById('demandDrawer');
  const icon = document.getElementById('drawerExpandIcon');
  if (!drawer) return;
  isDrawerExpanded = !isDrawerExpanded;
  if (isDrawerExpanded) {
    drawer.classList.add('expanded');
    drawer.classList.remove('compact');
    if (icon) icon.textContent = '🗗';
  } else {
    drawer.classList.remove('expanded');
    if (icon) icon.textContent = '🗖';
  }
}

function switchDrawerTab(tabName) {
  drawerActiveTab = tabName;
  const tabs = {
    details: { btn: 'drawerTabBtnDetails', pane: 'drawerPaneDetails' },
    comments: { btn: 'drawerTabBtnComments', pane: 'drawerPaneComments' },
    attachments: { btn: 'drawerTabBtnAttachments', pane: 'drawerPaneAttachments' },
    notes: { btn: 'drawerTabBtnNotes', pane: 'drawerPaneNotes' }
  };

  Object.entries(tabs).forEach(([name, ids]) => {
    const btn = document.getElementById(ids.btn);
    const pane = document.getElementById(ids.pane);
    if (btn) btn.classList.toggle('active', name === tabName);
    if (pane) {
      if (name === tabName) {
        pane.style.display = 'flex';
        pane.classList.add('active');
      } else {
        pane.style.display = 'none';
        pane.classList.remove('active');
      }
    }
  });

  if (tabName === 'comments') {
    document.getElementById('drawerNewCommentText')?.focus();
  }
}

let drawerLabelsSearchQuery = '';
let drawerLabelsInitialized = false;

function initDrawerLabelsListeners() {
  if (drawerLabelsInitialized) return;
  drawerLabelsInitialized = true;

  const btn = document.getElementById('btnDrawerLabels');
  const panel = document.getElementById('panelDrawerLabels');
  const searchInput = document.getElementById('searchDrawerLabels');
  const clearBtn = document.getElementById('actionDrawerLabelsClear');

  if (btn && panel) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = panel.style.display !== 'none';
      document.querySelectorAll('.filter-dropdown-panel').forEach(p => {
        if (p !== panel) p.style.display = 'none';
      });
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && searchInput) {
        setTimeout(() => searchInput.focus(), 60);
      }
    });

    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      drawerLabelsSearchQuery = e.target.value || '';
      renderDrawerLabelsPicker();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedDrawerLabels.clear();
      renderDrawerLabelsPicker();
    });
  }
}

function renderDrawerLabelsPicker() {
  initDrawerLabelsListeners();

  const listEl = document.getElementById('listDrawerLabels');
  const btnText = document.getElementById('btnDrawerLabelsText');
  const badgeEl = document.getElementById('btnDrawerLabelsBadge');
  const countText = document.getElementById('drawerLabelsCountText');
  const previewBox = document.getElementById('drawerActiveLabelsPreview');
  const btn = document.getElementById('btnDrawerLabels');

  if (!listEl) return;

  const allLabels = window.appStore ? window.appStore.getAvailableLabels() : [];
  const q = drawerLabelsSearchQuery.trim().toLowerCase();
  const filtered = q ? allLabels.filter(l => l.name.toLowerCase().includes(q)) : allLabels;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding: 12px; text-align: center; font-size: 11.5px; color: var(--text-muted);">Nenhuma etiqueta encontrada</div>';
  } else {
    filtered.forEach(l => {
      const isSelected = selectedDrawerLabels.has(l.id);
      const color = l.color || '#6366f1';
      const row = document.createElement('label');
      row.className = `filter-option-row ${isSelected ? 'selected' : ''}`;
      row.innerHTML = `
        <input type="checkbox" value="${escapeHtml(l.id)}" ${isSelected ? 'checked' : ''}>
        <span class="filter-option-color-dot" style="background-color: ${escapeHtml(color)}"></span>
        <span class="filter-option-text">${escapeHtml(l.name)}</span>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
          selectedDrawerLabels.add(l.id);
        } else {
          selectedDrawerLabels.delete(l.id);
        }
        renderDrawerLabelsPicker();
      });
      listEl.appendChild(row);
    });
  }

  const selectedCount = selectedDrawerLabels.size;
  const selectedObjs = allLabels.filter(l => selectedDrawerLabels.has(l.id));

  if (countText) {
    countText.textContent = `${selectedCount} selecionada${selectedCount === 1 ? '' : 's'}`;
  }

  if (selectedCount === 0) {
    if (btnText) btnText.textContent = 'Nenhuma etiqueta';
    if (badgeEl) badgeEl.style.display = 'none';
    if (btn) btn.classList.remove('active');
  } else if (selectedCount <= 2) {
    if (btnText) btnText.textContent = selectedObjs.map(l => l.name).join(', ');
    if (badgeEl) {
      badgeEl.textContent = String(selectedCount);
      badgeEl.style.display = 'inline-flex';
    }
    if (btn) btn.classList.add('active');
  } else {
    if (btnText) btnText.textContent = `${selectedCount} etiquetas selecionadas`;
    if (badgeEl) {
      badgeEl.textContent = String(selectedCount);
      badgeEl.style.display = 'inline-flex';
    }
    if (btn) btn.classList.add('active');
  }

  if (previewBox) {
    if (selectedCount === 0) {
      previewBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Nenhuma etiqueta atribuída</span>';
    } else {
      previewBox.innerHTML = selectedObjs.map(l => {
        const color = l.color || '#6366f1';
        return `
          <span class="drawer-label-active-pill" data-label-id="${l.id}" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; background: ${color}22; color: ${color}; border: 1px solid ${color}66; cursor: pointer;" title="Clique para remover">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
            <span>${escapeHtml(l.name)}</span>
            <span style="font-size: 9px; opacity: 0.7; margin-left: 2px;">✕</span>
          </span>
        `;
      }).join('');

      previewBox.querySelectorAll('.drawer-label-active-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = pill.dataset.labelId;
          selectedDrawerLabels.delete(id);
          renderDrawerLabelsPicker();
        });
      });
    }
  }
}

// Formata o badge de status do layout (Em Revisão, Publicado, Aprovado, Rascunho, Rejeitado, etc.)
function formatLayoutStatusBadge(status) {
  if (!status) return null;
  const s = String(status).toLowerCase().trim();
  switch (s) {
    case 'in_review':
    case 'review':
    case 'em_revisao':
    case 'em revisão':
      return {
        label: 'Em Revisão',
        icon: '🟠',
        className: 'layout-badge-in-review',
        isReview: true
      };
    case 'published':
    case 'publicado':
      return {
        label: 'Publicado',
        icon: '🟢',
        className: 'layout-badge-published',
        isReview: false
      };
    case 'approved':
    case 'aprovado':
      return {
        label: 'Aprovado',
        icon: '✅',
        className: 'layout-badge-approved',
        isReview: false
      };
    case 'draft':
    case 'rascunho':
    case 'empty':
      return {
        label: 'Rascunho',
        icon: '📝',
        className: 'layout-badge-draft',
        isReview: false
      };
    case 'deprecated':
    case 'descontinuado':
      return {
        label: 'Descontinuado',
        icon: '⚪',
        className: 'layout-badge-deprecated',
        isReview: false
      };
    case 'rejected':
    case 'rejeitado':
      return {
        label: 'Rejeitado',
        icon: '❌',
        className: 'layout-badge-rejected',
        isReview: false
      };
    case 'skeleton_only':
    case 'somente_identificacao':
    case 'somente identificação':
    case 'somente identificacao':
      return {
        label: 'Somente Identificação',
        icon: '🔹',
        className: 'layout-badge-skeleton',
        isReview: false
      };
    default:
      return {
        label: s.replace(/_/g, ' '),
        icon: '•',
        className: 'layout-badge-draft',
        isReview: false
      };
  }
}

// Ação de Aprovar Layout diretamente no Importer Ultra
async function handleApproveLayout(layoutId, layoutCode, layoutName) {
  let targetId = resolveLayoutId(layoutId, layoutCode);

  if (!targetId && layoutCode && window.conciliadorAPI?.searchLayouts) {
    try {
      showToast(`Localizando ID do Layout ${layoutCode}...`, 'info');
      const res = await window.conciliadorAPI.searchLayouts(String(layoutCode), 10);
      const items = res?.data || [];
      const exact = items.find(l => String(l.code != null ? l.code : '').trim() === String(layoutCode).trim()) || items[0];
      if (exact && exact.id) {
        targetId = String(exact.id);
        registerLayoutInCache(exact);
      }
    } catch (e) {
      console.warn('Erro ao resolver ID do layout para aprovação:', e);
    }
  }

  if (!targetId) {
    showAppAlert(`Não foi possível localizar o identificador do Layout ${layoutCode ? '#' + layoutCode : ''} no Importer Ultra.`, 'Erro ao Aprovar', 'error');
    return;
  }

  const ok = await showAppConfirm(
    `Deseja realmente aprovar o Layout ${layoutCode ? `#${layoutCode}` : ''} ${layoutName ? `(${layoutName}) ` : ''}diretamente no Importer Ultra? O status passará para "Publicado / Aprovado".`,
    'Aprovar Layout',
    {
      confirmText: 'Aprovar Layout',
      confirmClass: 'btn-confirm-approve',
      icon: '✅',
      type: 'success',
      subtitle: 'Aprovação Direta de Layout no Importer'
    }
  );

  if (!ok) return;

  const btnApprove = document.getElementById('btnDrawerApproveLayout');

  if (btnApprove) {
    btnApprove.disabled = true;
    btnApprove.innerHTML = '<span>⏳</span> Aprovando...';
  }

  try {
    await window.conciliadorAPI.approveLayout(targetId);

    showAppAlert(`Layout ${layoutCode ? `#${layoutCode}` : ''} aprovado com sucesso no Importer Ultra!`, 'Layout Aprovado', 'success');

    // Atualizar no cache de layout
    registerLayoutInCache({ id: targetId, code: layoutCode, name: layoutName, status: 'published' });

    // Atualizar no selectedTicket
    if (selectedTicket) {
      if (selectedTicket.layout) selectedTicket.layout.status = 'published';
      selectedTicket.layoutStatus = 'published';
    }

    // Atualizar interface do drawer
    renderDrawerLayoutField(targetId, layoutCode, layoutName, 'published');

    // Atualizar cabeçalho do drawer
    if (selectedTicket) {
      renderDrawerHeaderMetaAndTitle(selectedTicket, 'published');
    }

    // Re-renderizar lista de demandas
    renderDemands();
  } catch (err) {
    console.error('Erro ao aprovar layout:', err);
    showAppAlert('Falha ao aprovar layout no Importer Ultra: ' + translateErrorMessage(err), 'Erro', 'error');
  } finally {
    if (btnApprove) {
      btnApprove.disabled = false;
      btnApprove.innerHTML = '<span>✅</span> Aprovar Layout';
    }
  }
}
window.handleApproveLayout = handleApproveLayout;

// Renderiza o campo de Layout Selecionado (DENTRO do próprio campo, com status e botão de aprovação direta)
function renderDrawerLayoutField(layoutId, layoutCode, layoutName, layoutStatus = null) {
  const hiddenId = document.getElementById('drawerEditLayoutId');
  const selectedBox = document.getElementById('drawerSelectedLayoutBox');
  const searchBox = document.getElementById('drawerLayoutSearchBox');
  const labelEl = document.getElementById('drawerSelectedLayoutLabel');
  const subEl = document.getElementById('drawerSelectedLayoutSub');
  const statusEl = document.getElementById('drawerSelectedLayoutStatus');
  const btnApprove = document.getElementById('btnDrawerApproveLayout');
  const btnOpen = document.getElementById('btnDrawerOpenLayoutFromField');
  const searchInput = document.getElementById('drawerEditLayoutSearch');
  const dropdown = document.getElementById('drawerLayoutSearchResults');

  if (hiddenId) hiddenId.value = layoutId || '';

  const cleanName = layoutName ? String(layoutName).replace(/^[\s\-_:]+/, '').trim() : '';

  if (layoutCode) {
    if (labelEl) labelEl.textContent = String(layoutCode);
    if (subEl) {
      subEl.textContent = cleanName ? `• ${cleanName}` : '';
      subEl.title = cleanName ? `${layoutCode} • ${cleanName}` : String(layoutCode);
    }

    // Se layoutStatus não foi passado explicitamente, consultar cache
    let currentStatus = layoutStatus;
    if (!currentStatus && layoutCode) {
      const cached = layoutCodeToIdCache.get(String(layoutCode).trim());
      if (cached && cached.status) currentStatus = cached.status;
    }

    // Status do Layout
    const statusInfo = formatLayoutStatusBadge(currentStatus);
    if (statusEl) {
      if (statusInfo) {
        statusEl.className = `badge-layout-status ${statusInfo.className}`;
        statusEl.innerHTML = `<span>${statusInfo.icon}</span> <span>${statusInfo.label}</span>`;
        statusEl.style.display = 'inline-flex';
      } else {
        statusEl.style.display = 'none';
      }
    }

    // Botão de Aprovação de Layout (ativo apenas quando em revisão, exclusivamente no campo do layout associado)
    const isReview = statusInfo && statusInfo.isReview;
    if (btnApprove) {
      btnApprove.style.display = isReview ? 'inline-flex' : 'none';
      if (isReview) {
        btnApprove.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await handleApproveLayout(layoutId, layoutCode, cleanName);
        };
      }
    }

    if (selectedBox) selectedBox.style.display = 'flex';
    if (searchBox) searchBox.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';

    // Torna o layout clicável diretamente no próprio campo para abrir no Importer Ultra
    const layoutContentEl = document.getElementById('drawerSelectedLayoutContent') || selectedBox?.querySelector('.layout-field-content');
    if (layoutContentEl) {
      layoutContentEl.classList.add('clickable');
      layoutContentEl.title = `Clique para abrir o Layout ${layoutCode} no Importer Ultra ↗`;
      layoutContentEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLayoutInImporter(layoutId, layoutCode);
      };
    }

    if (btnOpen) {
      btnOpen.style.display = 'none';
    }
  } else {
    if (selectedBox) selectedBox.style.display = 'none';
    if (searchBox) searchBox.style.display = 'block';
    if (searchInput) searchInput.value = '';
    if (dropdown) dropdown.style.display = 'none';
    if (statusEl) statusEl.style.display = 'none';
    if (btnApprove) btnApprove.style.display = 'none';
  }
}

function renderNewTicketLayoutField(layoutId, layoutCode, layoutName) {
  const hiddenId = document.getElementById('newTicketLayoutId');
  const selectedBox = document.getElementById('newTicketSelectedLayoutBox');
  const searchBox = document.getElementById('newTicketLayoutSearchBox');
  const labelEl = document.getElementById('newTicketSelectedLayoutLabel');
  const subEl = document.getElementById('newTicketSelectedLayoutSub');
  const searchInput = document.getElementById('newTicketLayoutSearch');
  const dropdown = document.getElementById('layoutSearchResults');

  if (hiddenId) hiddenId.value = layoutId || '';

  const cleanName = layoutName ? String(layoutName).replace(/^[\s\-_:]+/, '').trim() : '';

  if (layoutCode) {
    if (labelEl) labelEl.textContent = String(layoutCode);
    if (subEl) {
      subEl.textContent = cleanName ? `• ${cleanName}` : '';
      subEl.title = cleanName ? `${layoutCode} • ${cleanName}` : String(layoutCode);
    }
    if (selectedBox) selectedBox.style.display = 'flex';
    if (searchBox) searchBox.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';
  } else {
    if (selectedBox) selectedBox.style.display = 'none';
    if (searchBox) searchBox.style.display = 'block';
    if (searchInput) searchInput.value = '';
    if (dropdown) dropdown.style.display = 'none';
  }
}

// Abre a página do Chamado no Importer Ultra (https://importer.conciliadorcontabil.com.br/support/tickets/:id)
function openTicketInImporter(ticketOrId) {
  const target = ticketOrId || selectedTicket;
  const targetId = (typeof target === 'object' && target !== null) ? target.id : target;
  if (targetId) {
    const url = `https://importer.conciliadorcontabil.com.br/support/tickets/${targetId}`;
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  } else {
    showAppAlert('Identificador do chamado não encontrado.', 'Chamado no Importer', 'warning');
  }
}
window.openTicketInImporter = openTicketInImporter;

function renderDrawerHeaderMetaAndTitle(ticket, customLayoutStatus = null) {
  if (!ticket) return;

  if (window.appTabs && ticket.id) {
    window.appTabs.updateTab(ticket.id, {
      title: ticket.title,
      status: ticket.status,
      number: ticket.number
    });
  }

  const layoutInfo = getTicketLayoutInfo(ticket);
  const layoutCode = layoutInfo.code;
  const currentLayoutStatus = customLayoutStatus || layoutInfo.status || (layoutCode ? layoutCodeToIdCache.get(String(layoutCode).trim())?.status : null);

  const numEl = document.getElementById('drawerDemandNumber');
  if (numEl) {
    numEl.textContent = `#${ticket.number || '---'}`;
  }

  // Badges no topo (Status do Layout, Tipo, Situação, Prioridade, Etiquetas, Ignorado)
  const isDrawerIgnored = window.appStore.isIgnored(ticket.id);
  const badgesBox = document.getElementById('drawerBadges');
  if (badgesBox) {
    const statusBadge = formatLayoutStatusBadge(currentLayoutStatus);
    const layoutStatusBadgeHtml = statusBadge
      ? `<span class="badge-layout-status ${statusBadge.className}" style="font-size: 10px; padding: 2px 7px;" title="Status do Layout no Importer Ultra: ${statusBadge.label}">${statusBadge.icon} ${statusBadge.label}</span>`
      : '';
    const ignoredBadge = isDrawerIgnored
      ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 Ignorado</span>'
      : '';
    badgesBox.innerHTML = `${layoutStatusBadgeHtml} ${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml(ticket.status)} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)} ${ignoredBadge}`;
  }

  // Título Verde clicável: número do layout (se tiver) mais o título do chamado.
  // Ao clicar, deve levar para o chamado no Importer Ultra.
  const titleEl = document.getElementById('drawerDemandTitle');
  if (titleEl) {
    const rawTitle = (ticket.title || '').trim();
    let cleanTitle = rawTitle;
    if (layoutCode) {
      const escapedCode = String(layoutCode).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codeRegex = new RegExp(`^\\s*#?\\s*${escapedCode}\\s*[-–—:]?\\s*`, 'i');
      cleanTitle = cleanTitle.replace(codeRegex, '').trim();
    }
    const fullDisplayTitle = layoutCode
      ? (cleanTitle ? `${layoutCode} – ${cleanTitle}` : String(layoutCode))
      : (cleanTitle || 'Chamado sem título');

    const ticketNumberStr = ticket.number ? `#${ticket.number}` : '';
    titleEl.innerHTML = `
      <a href="#" class="drawer-header-layout-title" data-ticket-id="${ticket.id || ''}" title="Abrir chamado ${ticketNumberStr} no Importer Ultra ↗">
        <span>${escapeHtml(fullDisplayTitle)}</span>
        <span style="font-size: 13px; opacity: 0.85;">↗</span>
      </a>
    `;
    titleEl.querySelector('.drawer-header-layout-title')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTicketInImporter(ticket);
    });
  }

  // Oculta botões redundantes na barra superior
  const btnDrawerLayout = document.getElementById('btnDrawerOpenLayout');
  if (btnDrawerLayout) btnDrawerLayout.style.display = 'none';
  const btnDrawerConciliador = document.getElementById('btnDrawerOpenConciliador');
  if (btnDrawerConciliador) btnDrawerConciliador.style.display = 'none';
}

async function openDemandDrawer(ticket) {
  if (!ticket || !ticket.id) return;

  if (window.appTabs && !window.appTabs.isRestoringSession) {
    const activeTab = window.appTabs.tabs.find(t => t.id === window.appTabs.activeTabId);
    if (!activeTab || String(activeTab.ticketId) !== String(ticket.id)) {
      window.appTabs.openTicketTab(ticket, true);
      return;
    }
  }

  selectedTicket = ticket;
  window.selectedTicket = ticket;
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('demandDrawer');

  const layoutInfo = getTicketLayoutInfo(ticket);
  const layoutCode = layoutInfo.code;
  const layoutName = layoutInfo.name ? ` - ${layoutInfo.name}` : '';
  const currentLayoutId = resolveLayoutId(layoutInfo.id, layoutCode);
  const currentLayoutStatus = layoutInfo.status || (layoutCode ? layoutCodeToIdCache.get(String(layoutCode).trim())?.status : null);

  renderDrawerHeaderMetaAndTitle(ticket, currentLayoutStatus);

  // Action buttons
  const isDrawerIgnored = window.appStore.isIgnored(ticket.id);
  const btnDrawerIgnore = document.getElementById('btnToggleDrawerIgnore');
  if (btnDrawerIgnore) {
    btnDrawerIgnore.innerHTML = isDrawerIgnored ? '<span>↩️</span> Reativar Chamado' : '<span>🚫</span> Ignorar Chamado';
    btnDrawerIgnore.style.color = isDrawerIgnored ? '#10b981' : '';
  }

  // Populate editable fields in Ficha & Edição
  const titleInput = document.getElementById('drawerEditTitle');
  if (titleInput) titleInput.value = ticket.title || '';

  const statusSelect = document.getElementById('drawerEditStatus');
  if (statusSelect) {
    let stVal = (ticket.status || 'queued').toLowerCase().trim();
    if (stVal === 'open' || stVal === 'aberto' || stVal === 'fila') stVal = 'queued';
    if (stVal === 'closed' || stVal === 'completed' || stVal === 'finished') stVal = 'done';
    if (stVal === 'waiting' || stVal === 'waiting_creator') stVal = 'waiting_requester';
    statusSelect.value = stVal;
  }

  // Populate devs select
  const devSelect = document.getElementById('drawerEditAssignedTo');
  if (devSelect) {
    const devs = window.appStore.getKnownDevelopers();
    devSelect.innerHTML = '<option value="">Sem responsável definido (Fica na Triagem)</option>' +
      devs.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    devSelect.value = ticket.assignedTo?.id || '';
  }

  const prioritySelect = document.getElementById('drawerEditPriority');
  if (prioritySelect) {
    prioritySelect.value = normalizePriorityToApi(ticket.priority);
    updatePrioritySelectVisual(prioritySelect);
  }

  const reviewerSelect = document.getElementById('drawerEditReviewer');
  if (reviewerSelect) {
    const currentRevId = ticket.reviewer?.id || ticket.reviewerId || '';
    const currentUser = window.appStore?.currentUser;
    const allMembers = window.appStore.getKnownDevelopers();

    let optionsHtml = '<option value="">Sem validador (Não definido)</option>';
    allMembers.forEach(m => {
      const isMe = currentUser && m.id === currentUser.id;
      const prefix = isMe ? '👤' : '⚖️';
      const suffix = isMe ? ' (Você)' : '';
      optionsHtml += `<option value="${m.id}">${prefix} ${escapeHtml(m.name)}${suffix}</option>`;
    });

    if (currentRevId && !allMembers.some(m => m.id === currentRevId)) {
      const currentRevName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : 'Validador Atual');
      optionsHtml += `<option value="${currentRevId}">⚖️ ${escapeHtml(currentRevName)}</option>`;
    }

    reviewerSelect.innerHTML = optionsHtml;
    reviewerSelect.value = currentRevId;
  }

  // Delivery & Client dates
  const deliveryDateInput = document.getElementById('drawerEditDeliveryDueDate');
  if (deliveryDateInput) deliveryDateInput.value = formatDateToBrInput(ticket.deliveryDueDate);

  const clientDateInput = document.getElementById('drawerEditClientDueDate');
  if (clientDateInput) clientDateInput.value = formatDateToBrInput(ticket.clientDueDate);

  // Database & Movidesk
  const dbInput = document.getElementById('drawerEditDatabase');
  if (dbInput) dbInput.value = ticket.clientDatabase || '';

  const movideskInput = document.getElementById('drawerEditMovidesk');
  if (movideskInput) movideskInput.value = ticket.movideskTicketId || '';

  // Type & Product selects
  const typeSelect = document.getElementById('drawerEditType');
  if (typeSelect) {
    const types = window.appStore.getTicketTypes();
    typeSelect.innerHTML = '<option value="">Selecione o tipo...</option>' +
      types.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    typeSelect.value = ticket.ticketTypeId || ticket.ticketType?.id || '';
  }

  // Populate Product select
  const prodSelect = document.getElementById('drawerEditProduct');
  if (prodSelect) {
    populateAndSelectProduct(prodSelect, ticket);
  }

  // Layout field (único, selecionado DENTRO do campo com status e botão de aprovação se estiver em revisão)
  renderDrawerLayoutField(currentLayoutId, layoutCode, layoutName, currentLayoutStatus);

  // Labels picker
  selectedDrawerLabels = new Set((ticket.labels || []).map(l => (l.label ? l.label.id : l.id)).filter(Boolean));
  renderDrawerLabelsPicker();

  // Meta info
  const reqEl = document.getElementById('drawerMetaRequester');
  if (reqEl) reqEl.textContent = ticket.requestedBy?.name || '-';
  const createdEl = document.getElementById('drawerMetaCreatedAt');
  if (createdEl) createdEl.textContent = formatDisplayDate(ticket.createdAt);
  const idEl = document.getElementById('drawerMetaId');
  if (idEl) idEl.textContent = ticket.id || '-';

  // Local Notes
  const notesTextarea = document.getElementById('drawerLocalNotes');
  if (notesTextarea) notesTextarea.value = window.appStore.getNote(ticket.id) || '';

  // Description initial render
  toggleDrawerDescEdit(false);
  const descBox = document.getElementById('drawerDescription');
  if (ticket.description) {
    renderAuthenticatedDescription(ticket.description, ticket.id, descBox);
  } else {
    descBox.innerHTML = '<span style="color: var(--text-muted);">Carregando descrição completa...</span>';
  }

  // Stream & Attachments: se já possui comentários em cache/sessão, renderiza instantaneamente
  const streamList = document.getElementById('drawerStreamList');
  const attachList = document.getElementById('drawerAttachmentsList');
  const attachEmpty = document.getElementById('drawerAttachmentsEmpty');
  const inlineList = document.getElementById('drawerInlineAttachmentsList');
  const inlineEmpty = document.getElementById('drawerInlineAttachmentsEmpty');
  const inlineBadge = document.getElementById('drawerInlineAttachmentsBadge');
  const btnDownloadAll = document.getElementById('btnInlineDownloadAllAttachments');

  if (Array.isArray(ticket.comments)) {
    drawerCurrentComments = ticket.comments;
    drawerCurrentEvents = (ticket.events || []).filter(e => e.kind !== 'comment');
    renderDrawerActivityStream();
    renderDrawerAttachments(ticket.attachments || []);
  } else {
    if (streamList) {
      streamList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 30px;">Carregando diálogo e histórico...</div>';
    }
    if (attachList) attachList.innerHTML = '';
    if (attachEmpty) attachEmpty.style.display = 'block';
    if (inlineList) inlineList.innerHTML = '';
    if (inlineEmpty) inlineEmpty.style.display = 'block';
    if (inlineBadge) inlineBadge.textContent = '0';
    if (btnDownloadAll) btnDownloadAll.style.display = 'none';

    document.getElementById('drawerStreamCountBadge').textContent = '0';
    document.getElementById('streamCountAll').textContent = '0';
    document.getElementById('streamCountComments').textContent = '0';
    document.getElementById('streamCountEvents').textContent = '0';
    document.getElementById('drawerAttachmentsCountBadge').textContent = '0';
  }

  // Status text reset
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText) statusText.textContent = '';

  // Switch to Details tab by default
  switchDrawerTab('details');

  // Render dynamic workflow buttons and same layout open tickets
  renderDrawerWorkflowButtons(ticket);
  renderSameLayoutTickets(ticket);

  overlay?.classList.add('open');
  drawer?.classList.add('open');

  // Fetch full ticket details asynchronously
  try {
    const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);

    // Race condition guard: se o usuário já navegou para outra aba ou voltou para a lista enquanto a rede respondia,
    // apenas atualiza o cache da sessão desse chamado sem sobrescrever a tela do chamado visível.
    if (window.appTabs && String(window.appTabs.getActiveTicketId()) !== String(ticket.id)) {
      window.appTabs.cacheFetchedDetails(ticket.id, details);
      return;
    }

    selectedTicket = { ...ticket, ...details };
    window.selectedTicket = selectedTicket;

    // Refresh dynamic workflow buttons and same layout with fresh API details
    renderDrawerWorkflowButtons(selectedTicket);
    renderSameLayoutTickets(selectedTicket);

    // Update layout title, status and button if full details have layout info
    const freshLayoutInfo = getTicketLayoutInfo(details);
    const finalLayoutCode = freshLayoutInfo.code || layoutCode;
    const finalLayoutName = freshLayoutInfo.name ? ` - ${freshLayoutInfo.name}` : layoutName;
    const finalLayoutId = resolveLayoutId(freshLayoutInfo.id, finalLayoutCode) || currentLayoutId;
    let finalLayoutStatus = freshLayoutInfo.status || details.layout?.status || currentLayoutStatus || null;

    if (finalLayoutCode && !finalLayoutStatus) {
      const cached = layoutCodeToIdCache.get(String(finalLayoutCode).trim());
      if (cached && cached.status) finalLayoutStatus = cached.status;
    }

    if (finalLayoutId && finalLayoutCode) {
      registerLayoutInCache({ id: finalLayoutId, code: finalLayoutCode, name: freshLayoutInfo.name, status: finalLayoutStatus });
    }

    renderDrawerHeaderMetaAndTitle(selectedTicket, finalLayoutStatus);
    renderDrawerLayoutField(finalLayoutId, finalLayoutCode, finalLayoutName, finalLayoutStatus);

    // Se temos o ID do layout mas o status ainda não foi identificado, buscar diretamente no Importer Ultra
    if (finalLayoutId && !finalLayoutStatus && window.conciliadorAPI?.fetchLayoutDetails) {
      window.conciliadorAPI.fetchLayoutDetails(finalLayoutId).then(layoutDetail => {
        if (layoutDetail && layoutDetail.status) {
          finalLayoutStatus = layoutDetail.status;
          registerLayoutInCache({ id: finalLayoutId, code: finalLayoutCode, name: freshLayoutInfo.name, status: finalLayoutStatus });
          if (window.appTabs && String(window.appTabs.getActiveTicketId()) !== String(ticket.id)) {
            return;
          }
          if (selectedTicket) {
            if (selectedTicket.layout) selectedTicket.layout.status = finalLayoutStatus;
            selectedTicket.layoutStatus = finalLayoutStatus;
          }
          renderDrawerHeaderMetaAndTitle(selectedTicket, finalLayoutStatus);
          renderDrawerLayoutField(finalLayoutId, finalLayoutCode, finalLayoutName, finalLayoutStatus);
        }
      }).catch(e => console.warn('Erro ao carregar detalhes do layout do Importer:', e));
    }

    if (details.reviewer && reviewerSelect) {
      const currentRevId = details.reviewer.id || details.reviewerId || '';
      const currentRevName = details.reviewer.name || details.reviewerName || '';
      if (currentRevId && !Array.from(reviewerSelect.options).some(o => o.value === currentRevId)) {
        const opt = document.createElement('option');
        opt.value = currentRevId;
        opt.textContent = `⚖️ ${currentRevName || 'Validador'}`;
        reviewerSelect.appendChild(opt);
      }
      reviewerSelect.value = currentRevId;
    }
    if (details.deliveryDueDate && deliveryDateInput) {
      deliveryDateInput.value = formatDateToBrInput(details.deliveryDueDate);
    }
    if (details.clientDueDate && clientDateInput) {
      clientDateInput.value = formatDateToBrInput(details.clientDueDate);
    }
    if (details.clientDatabase && dbInput) dbInput.value = details.clientDatabase;
    if (details.movideskTicketId && movideskInput) movideskInput.value = details.movideskTicketId;

    // Refresh product if details has it
    if (prodSelect) {
      populateAndSelectProduct(prodSelect, details);
    }

    // Refresh priority if details has it
    if (details.priority && prioritySelect) {
      prioritySelect.value = normalizePriorityToApi(details.priority);
      updatePrioritySelectVisual(prioritySelect);
    }

    // Refresh description with authenticated images
    if (details.description) {
      try {
        renderAuthenticatedDescription(details.description, ticket.id, descBox);
      } catch (renderDescErr) {
        console.warn('Erro ao renderizar descrição autenticada:', renderDescErr);
        if (descBox) descBox.innerHTML = sanitizeHtml(details.description);
      }
      const editor = document.getElementById('drawerEditDescEditor');
      if (editor) editor.innerHTML = sanitizeHtml(details.description);
    } else {
      descBox.innerHTML = '<span style="color: var(--text-muted);">Nenhuma descrição detalhada informada.</span>';
    }

    // Refresh labels if available
    if (details.labels && details.labels.length > 0) {
      selectedDrawerLabels = new Set(details.labels.map(l => (l.label ? l.label.id : l.id)).filter(Boolean));
      renderDrawerLabelsPicker();
    }

    // Store & render unified activity stream
    drawerCurrentComments = details.comments || [];
    drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
    renderDrawerActivityStream();

    // Render attachments
    renderDrawerAttachments(details.attachments || []);

  } catch (err) {
    console.warn('Failed to load full demand details:', err);
    if (descBox && (!ticket.description || descBox.innerHTML.includes('Carregando'))) {
      descBox.innerHTML = `<span style="color: var(--status-error);">Não foi possível carregar a descrição completa (${escapeHtml(err.message || 'Erro de comunicação')}).</span>`;
    }
  }
}

function renderDrawerActivityStream() {
  const container = document.getElementById('drawerStreamList');
  if (!container) return;

  const countBadge = document.getElementById('drawerStreamCountBadge');
  const countAll = document.getElementById('streamCountAll');
  const countComments = document.getElementById('streamCountComments');
  const countEvents = document.getElementById('streamCountEvents');

  // Merge comments and timeline events
  const items = [];

  drawerCurrentComments.forEach(c => {
    items.push({
      itemType: 'comment',
      id: c.id,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(0),
      raw: c
    });
  });

  drawerCurrentEvents.forEach(ev => {
    items.push({
      itemType: 'event',
      id: ev.id,
      createdAt: ev.createdAt ? new Date(ev.createdAt) : new Date(0),
      raw: ev
    });
  });

  // Sort chronological ascending (oldest first to newest at bottom, just like chat & Importer Ultra)
  items.sort((a, b) => a.createdAt - b.createdAt);

  if (countBadge) countBadge.textContent = items.length;
  if (countAll) countAll.textContent = items.length;
  if (countComments) countComments.textContent = drawerCurrentComments.length;
  if (countEvents) countEvents.textContent = drawerCurrentEvents.length;

  // Filter based on active filter
  const filtered = items.filter(it => {
    if (drawerCurrentFilter === 'comments') return it.itemType === 'comment';
    if (drawerCurrentFilter === 'events') return it.itemType === 'event';
    return true;
  });

  if (filtered.length === 0) {
    let emptyMsg = 'Nenhum item registrado nesta demanda ainda.';
    if (drawerCurrentFilter === 'comments') emptyMsg = 'Nenhuma mensagem escrita ainda. Seja o primeiro a responder abaixo!';
    else if (drawerCurrentFilter === 'events') emptyMsg = 'Nenhum evento registrado no histórico da demanda.';

    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 30px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <span>💬</span> ${emptyMsg}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(it => {
    if (it.itemType === 'comment') {
      const c = it.raw;
      const userName = c.user?.name || 'Equipe';
      const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      const role = (c.user?.role || '').toLowerCase();
      const isDev = role.includes('dev');
      const isSupport = role.includes('support');

      let roleBadge = '';
      if (isDev) roleBadge = '<span class="comment-role-tag role-developer">Desenvolvedor</span>';
      else if (isSupport) roleBadge = '<span class="comment-role-tag role-support">Suporte</span>';
      else if (role) roleBadge = `<span class="comment-role-tag role-admin">${escapeHtml(role)}</span>`;

      const d = it.createdAt;
      const dateFormatted = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let contentHtml = c.contentHtml ? sanitizeHtml(c.contentHtml) : escapeHtml(c.content || '');
      contentHtml = contentHtml.replace(
        /src="\/api\/v1\//g,
        'src="https://api.importer.conciliadorcontabil.com.br/api/v1/'
      );

      // Render attachments associated with this comment if any
      const rawCommentAtts = c.attachments || [];
      const commentTime = it.createdAt ? it.createdAt.getTime() : 0;
      let commentAttachments = rawCommentAtts;
      if (rawCommentAtts.length > 0 && commentTime > 0) {
        const matchingAtts = rawCommentAtts.filter(att => {
          if (!att.createdAt) return true;
          const attTime = new Date(att.createdAt).getTime();
          // Tolerância de até 5 minutos entre a criação do anexo e o envio do comentário
          return Math.abs(commentTime - attTime) <= 5 * 60 * 1000;
        });
        if (matchingAtts.length > 0) {
          commentAttachments = matchingAtts;
        }
      }

      let attachmentsHtml = '';
      if (commentAttachments.length > 0) {
        attachmentsHtml = `
          <div class="comment-attachments-container">
            ${commentAttachments.map(att => {
              const fileName = att.fileName || att.filename || att.name || 'anexo';
              const ext = (fileName.split('.').pop() || '').toLowerCase();
              const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
              const rawSize = att.fileSize != null ? att.fileSize : (att.filesize != null ? att.filesize : (att.size != null ? att.size : att.bytes));
              const fileSizeStr = rawSize ? ` (${formatFileSize(rawSize)})` : '';

              if (isImage) {
                return `
                  <div class="comment-img-attachment-card" data-att-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Clique para ampliar imagem: ${escapeHtml(fileName)}">
                    <img id="comment_thumb_${att.id}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90'><rect width='120' height='90' fill='%231e293b'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-size='15'>🖼️ Carregando...</text></svg>" alt="${escapeHtml(fileName)}">
                    <div class="comment-img-footer"><span>🖼️</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(fileName)}${fileSizeStr}</span></div>
                  </div>
                `;
              } else {
                return `
                  <div class="comment-file-attachment-card" data-att-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Clique para abrir ou baixar: ${escapeHtml(fileName)}">
                    <span>📎</span> <span>${escapeHtml(fileName)}${fileSizeStr}</span>
                  </div>
                `;
              }
            }).join('')}
          </div>
        `;
      }

      return `
        <div class="comment-bubble ${isDev ? 'is-developer' : (isSupport ? 'is-support' : '')}">
          <div class="comment-header">
            <div class="comment-author-info">
              <div class="comment-avatar">${initials}</div>
              <span class="comment-author-name">${escapeHtml(userName)}</span>
              ${roleBadge}
            </div>
            <span class="comment-date">${dateFormatted}</span>
          </div>
          <div class="comment-content">${contentHtml}</div>
          ${attachmentsHtml}
        </div>
      `;
    } else {
      // Timeline Event
      const ev = it.raw;
      const d = it.createdAt;
      const dateFormatted = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const { title, dotIcon, dotColor, detail } = formatEventContent(ev);

      return `
        <div class="stream-event-item">
          <div class="stream-event-dot" style="background: ${dotColor}22; border-color: ${dotColor}; color: ${dotColor};">
            ${dotIcon}
          </div>
          <div class="stream-event-body">
            <div class="stream-event-header">
              <span class="stream-event-title">${title}</span>
              <span class="stream-event-time">${dateFormatted}</span>
            </div>
            ${detail}
          </div>
        </div>
      `;
    }
  }).join('');

  // Load blob thumbnails for comment images and attach event listeners
  const ticketId = selectedTicket?.id;
  if (ticketId) {
    filtered.forEach(it => {
      if (it.itemType === 'comment' && Array.isArray(it.raw.attachments)) {
        it.raw.attachments.forEach(att => {
          const fileName = att.fileName || att.filename || att.name || '';
          const ext = (fileName.split('.').pop() || '').toLowerCase();
          const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
          if (isImage) {
            getOrFetchAttachmentBlobUrl(ticketId, att.id).then(blobUrl => {
              if (blobUrl) {
                const imgEl = document.getElementById(`comment_thumb_${att.id}`);
                if (imgEl) imgEl.src = blobUrl;
              }
            });
          }
        });
      }
    });

    container.querySelectorAll('.comment-img-attachment-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        e.stopPropagation();
        const attId = card.dataset.attId;
        const fileName = card.dataset.filename || 'imagem';
        const blobUrl = await getOrFetchAttachmentBlobUrl(ticketId, attId);
        if (blobUrl) {
          openImageLightbox(blobUrl, fileName, ticketId, attId);
        }
      });
    });

    container.querySelectorAll('.comment-file-attachment-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const attId = card.dataset.attId;
        const fileName = card.dataset.filename || 'anexo';
        openAttachmentFile(ticketId, attId, fileName);
      });
    });
  }

  // Scroll to newest activity at bottom
  container.scrollTop = container.scrollHeight;
}

function setDrawerStreamFilter(filter) {
  drawerCurrentFilter = filter;
  const filterBtns = {
    all: document.getElementById('btnStreamFilterAll'),
    comments: document.getElementById('btnStreamFilterComments'),
    events: document.getElementById('btnStreamFilterEvents')
  };
  Object.entries(filterBtns).forEach(([f, btn]) => {
    if (btn) btn.classList.toggle('active', f === filter);
  });
  renderDrawerActivityStream();
}

function toggleDrawerDescEdit(forceState) {
  const viewEl = document.getElementById('drawerDescription');
  const editWrapper = document.getElementById('drawerDescEditWrapper');
  const btn = document.getElementById('btnToggleEditDesc');
  const icon = document.getElementById('btnToggleEditDescIcon');
  const text = document.getElementById('btnToggleEditDescText');
  const editor = document.getElementById('drawerEditDescEditor');

  if (!viewEl || !editWrapper) return;

  const shouldOpen = typeof forceState === 'boolean' ? forceState : editWrapper.style.display === 'none';
  isEditingDescription = shouldOpen;

  if (shouldOpen) {
    viewEl.style.display = 'none';
    editWrapper.style.display = 'block';
    if (editor) {
      editor.innerHTML = selectedTicket?.description || viewEl.innerHTML;
      editor.focus();
    }
    if (icon) icon.textContent = '✕';
    if (text) text.textContent = 'Fechar Editor';
  } else {
    viewEl.style.display = 'block';
    editWrapper.style.display = 'none';
    if (icon) icon.textContent = '✏️';
    if (text) text.textContent = 'Editar Descrição';
  }
}

function renderDrawerAttachments(attachments) {
  const list = document.getElementById('drawerAttachmentsList');
  const emptyBox = document.getElementById('drawerAttachmentsEmpty');
  const countBadge = document.getElementById('drawerAttachmentsCountBadge');

  const inlineList = document.getElementById('drawerInlineAttachmentsList');
  const inlineEmpty = document.getElementById('drawerInlineAttachmentsEmpty');
  const inlineBadge = document.getElementById('drawerInlineAttachmentsBadge');
  const btnDownloadAll = document.getElementById('btnInlineDownloadAllAttachments');

  const ticketId = selectedTicket?.id;
  const count = (attachments || []).length;

  if (countBadge) countBadge.textContent = count;
  if (inlineBadge) inlineBadge.textContent = count;

  // 1. Renderizar lista na aba "Anexos"
  if (list) {
    if (count === 0) {
      if (emptyBox) emptyBox.style.display = 'block';
      list.innerHTML = '';
    } else {
      if (emptyBox) emptyBox.style.display = 'none';

      list.innerHTML = attachments.map(att => {
        const fileName = att.fileName || att.filename || att.originalName || att.name || (att.filePath ? att.filePath.split(/[/\\]/).pop() : '') || 'Arquivo anexado';
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const rawSize = att.fileSize != null ? att.fileSize : (att.filesize != null ? att.filesize : (att.size != null ? att.size : att.bytes));
        const fileSizeStr = rawSize ? formatFileSize(rawSize) : '';
        const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || (att.mimetype && att.mimetype.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);

        let fileIcon = '📄';
        if (['pdf'].includes(ext)) fileIcon = '📕';
        else if (['xlsx', 'xls', 'csv'].includes(ext)) fileIcon = '📊';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) fileIcon = '🗜️';
        else if (['txt', 'log', 'cnab', 'ret', 'rem'].includes(ext)) fileIcon = '📝';

        if (isImage) {
          return `
            <div class="attachment-card" data-att-id="${att.id}">
              <div class="attachment-thumb-wrapper" data-att-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Clique para ampliar imagem">
                <img class="attachment-thumb-img" id="thumb_${att.id}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%231e293b'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-size='22'>🖼️</text></svg>" alt="${escapeHtml(fileName)}">
                <div class="thumb-zoom-overlay">🔍 Ampliar</div>
              </div>
              <div class="attachment-details">
                <div class="attachment-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
                <div class="attachment-meta">${fileSizeStr ? fileSizeStr + ' • Imagem' : 'Imagem'}</div>
                <div class="attachment-actions">
                  <button type="button" class="quick-action-btn btn-view-attachment" data-id="${att.id}" data-filename="${escapeHtml(fileName)}">
                    👁️ Ver
                  </button>
                  <button type="button" class="quick-action-btn btn-download-attachment" data-id="${att.id}" data-filename="${escapeHtml(fileName)}">
                    ⬇️ Baixar
                  </button>
                </div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="attachment-card" data-att-id="${att.id}">
              <div class="attachment-file-icon-box">
                <span class="attachment-large-icon">${fileIcon}</span>
                <span class="attachment-ext-tag">${escapeHtml(ext.toUpperCase() || 'FILE')}</span>
              </div>
              <div class="attachment-details">
                <div class="attachment-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
                <div class="attachment-meta">${fileSizeStr || 'Arquivo'}</div>
                <div class="attachment-actions">
                  <button type="button" class="quick-action-btn btn-open-attachment" data-id="${att.id}" data-filename="${escapeHtml(fileName)}">
                    👁️ Abrir
                  </button>
                  <button type="button" class="quick-action-btn btn-download-attachment" data-id="${att.id}" data-filename="${escapeHtml(fileName)}">
                    ⬇️ Baixar
                  </button>
                </div>
              </div>
            </div>
          `;
        }
      }).join('');

      // Wire thumbnails
      if (ticketId) {
        attachments.forEach(att => {
          const fileName = att.fileName || att.filename || att.originalName || att.name || (att.filePath ? att.filePath.split(/[/\\]/).pop() : '') || '';
          const ext = (fileName.split('.').pop() || '').toLowerCase();
          const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || (att.mimetype && att.mimetype.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);

          if (isImage) {
            getOrFetchAttachmentBlobUrl(ticketId, att.id).then(blobUrl => {
              if (blobUrl) {
                const imgEl = document.getElementById(`thumb_${att.id}`);
                if (imgEl) imgEl.src = blobUrl;
              }
            });
          }
        });
      }

      // Wire click events tab
      list.querySelectorAll('.attachment-thumb-wrapper, .btn-view-attachment').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const clickedAttId = el.dataset.attId || el.dataset.id;
          const clickedFileName = el.dataset.filename || 'imagem.png';
          if (ticketId && clickedAttId) {
            const clickedBlobUrl = await getOrFetchAttachmentBlobUrl(ticketId, clickedAttId);
            if (clickedBlobUrl) {
              const imgExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
              const imageAtts = (attachments || []).filter(a => {
                const ext = ((a.fileName || a.filename || a.name || '').split('.').pop() || '').toLowerCase();
                return imgExtensions.includes(ext);
              });
              const gallery = await Promise.all(imageAtts.map(async (a) => {
                const bUrl = await getOrFetchAttachmentBlobUrl(ticketId, a.id);
                return {
                  blobUrl: bUrl || '',
                  fileName: a.fileName || a.filename || a.name || 'imagem.png',
                  ticketId,
                  attId: a.id
                };
              }));
              const filteredGallery = gallery.filter(g => !!g.blobUrl);
              const initialIdx = filteredGallery.findIndex(g => String(g.attId) === String(clickedAttId));
              openImageLightbox(clickedBlobUrl, clickedFileName, ticketId, clickedAttId, filteredGallery, initialIdx !== -1 ? initialIdx : 0);
            }
          }
        });
      });

      list.querySelectorAll('.btn-open-attachment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const attId = btn.dataset.id;
          const fileName = btn.dataset.filename || 'anexo';
          if (ticketId && attId) {
            openAttachmentFile(ticketId, attId, fileName);
          }
        });
      });

      list.querySelectorAll('.btn-download-attachment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const attId = btn.dataset.id;
          const fileName = btn.dataset.filename || 'anexo';
          if (ticketId && attId) {
            downloadAttachmentFile(ticketId, attId, fileName);
          }
        });
      });
    }
  }

  // 2. Renderizar lista compacta de anexos PEQUENOS embaixo da descrição
  if (inlineList) {
    if (count === 0) {
      if (inlineEmpty) inlineEmpty.style.display = 'block';
      inlineList.innerHTML = '';
      if (btnDownloadAll) btnDownloadAll.style.display = 'none';
    } else {
      if (inlineEmpty) inlineEmpty.style.display = 'none';
      if (btnDownloadAll) btnDownloadAll.style.display = count >= 2 ? 'inline-flex' : 'none';

      inlineList.innerHTML = attachments.map(att => {
        const fileName = att.fileName || att.filename || att.originalName || att.name || (att.filePath ? att.filePath.split(/[/\\]/).pop() : '') || 'Arquivo anexado';
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const rawSize = att.fileSize != null ? att.fileSize : (att.filesize != null ? att.filesize : (att.size != null ? att.size : att.bytes));
        const fileSizeStr = rawSize ? formatFileSize(rawSize) : '';
        const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || (att.mimetype && att.mimetype.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);

        let fileIcon = '📄';
        if (['pdf'].includes(ext)) fileIcon = '📕';
        else if (['xlsx', 'xls', 'csv'].includes(ext)) fileIcon = '📊';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) fileIcon = '🗜️';
        else if (['txt', 'log', 'cnab', 'ret', 'rem'].includes(ext)) fileIcon = '📝';
        else if (isImage) fileIcon = '🖼️';

        return `
          <div class="inline-att-card" data-att-id="${att.id}">
            <div class="inline-att-icon-box" title="${escapeHtml(ext.toUpperCase() || 'ARQUIVO')}">
              <span>${fileIcon}</span>
            </div>
            <div class="inline-att-meta" title="${escapeHtml(fileName)} (${fileSizeStr || ext.toUpperCase()})">
              <span class="inline-att-filename">${escapeHtml(fileName)}</span>
              <span class="inline-att-sub">${fileSizeStr || ext.toUpperCase()}</span>
            </div>
            <div class="inline-att-actions">
              <button type="button" class="inline-att-btn-download" data-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Baixar ${escapeHtml(fileName)}">
                <span>⬇️</span> <span>Baixar</span>
              </button>
              <button type="button" class="inline-att-btn-view" data-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="${isImage ? 'Visualizar imagem' : 'Abrir arquivo'}">
                <span>👁️</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      inlineList.querySelectorAll('.inline-att-btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const attId = btn.dataset.id;
          const fileName = btn.dataset.filename || 'anexo';
          if (ticketId && attId) {
            downloadAttachmentFile(ticketId, attId, fileName);
          }
        });
      });

      inlineList.querySelectorAll('.inline-att-btn-view').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const attId = btn.dataset.id;
          const fileName = btn.dataset.filename || 'anexo';
          if (ticketId && attId) {
            openAttachmentFile(ticketId, attId, fileName);
          }
        });
      });

      if (btnDownloadAll) {
        btnDownloadAll.onclick = async (e) => {
          e.stopPropagation();
          if (!ticketId || attachments.length === 0) return;
          btnDownloadAll.disabled = true;
          const oldText = btnDownloadAll.innerHTML;
          btnDownloadAll.innerHTML = '<span>⏳</span> <span>Baixando...</span>';
          let countDownloaded = 0;
          for (const att of attachments) {
            const fName = att.fileName || att.filename || att.originalName || att.name || 'anexo';
            await downloadAttachmentFile(ticketId, att.id, fName, selectedTicket, attachments);
            countDownloaded++;
            await new Promise(r => setTimeout(r, 120));
          }
          btnDownloadAll.disabled = false;
          btnDownloadAll.innerHTML = oldText;
          if (window.electronAPI && window.electronAPI.showNotification) {
            window.electronAPI.showNotification('Downloads Concluídos', `${countDownloaded} arquivo(s) salvos na pasta Downloads.`);
          }
        };
      }
    }
  }
}

let timelinePendingAttachments = [];

function renderTimelinePendingAttachments() {
  const container = document.getElementById('drawerCommentPendingAttachments');
  if (!container) return;

  if (timelinePendingAttachments.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = timelinePendingAttachments.map((file, idx) => {
    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
    const thumbUrl = isImage ? URL.createObjectURL(file) : '';
    const sizeStr = formatFileSize(file.size);
    const fileName = file.name || `print_${idx + 1}.png`;

    return `
      <div class="comment-pending-chip" data-idx="${idx}">
        ${isImage ? `<img src="${thumbUrl}" class="comment-pending-thumb" alt="Preview">` : `<span style="font-size: 18px;">📎</span>`}
        <div class="comment-pending-info">
          <span class="comment-pending-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
          <span class="comment-pending-size">${sizeStr} • Pronto para enviar</span>
        </div>
        <button type="button" class="comment-pending-remove" data-idx="${idx}" title="Remover este anexo">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.comment-pending-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      if (!isNaN(idx) && idx >= 0 && idx < timelinePendingAttachments.length) {
        timelinePendingAttachments.splice(idx, 1);
        renderTimelinePendingAttachments();
      }
    });
  });
}

function handleCommentPaste(e) {
  if (!selectedTicket) return;
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const items = Array.from(clipboardData.items || []);
  const filesToAdd = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        let fileName = file.name || 'print.png';
        if (fileName === 'image.png' || !fileName) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          fileName = `print_${timeStr}.png`;
        }
        const namedFile = new File([file], fileName, { type: file.type || 'image/png' });
        filesToAdd.push(namedFile);
      }
    }
  }

  if (filesToAdd.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (const f of Array.from(clipboardData.files)) {
      filesToAdd.push(f);
    }
  }

  if (filesToAdd.length > 0) {
    e.preventDefault();
    filesToAdd.forEach(f => timelinePendingAttachments.push(f));
    renderTimelinePendingAttachments();
    showToast(`📸 ${filesToAdd.length} print/imagem colado! Clique em 'Salvar Interação' para publicar.`);
  }
}

async function submitComment() {
  if (!selectedTicket) return;
  const textarea = document.getElementById('drawerNewCommentText');
  const statusEl = document.getElementById('commentSendStatus');
  const btn = document.getElementById('btnSubmitComment');

  let content = textarea?.value?.trim() || '';
  const hasPendingFiles = timelinePendingAttachments.length > 0;

  if (!content && !hasPendingFiles) {
    showAppAlert('Por favor, digite uma mensagem ou cole uma imagem para enviar.', 'Mensagem Vazia', 'warning');
    textarea?.focus();
    return;
  }

  if (!content && hasPendingFiles) {
    content = timelinePendingAttachments.length === 1
      ? `📸 Print anexado: ${timelinePendingAttachments[0].name}`
      : `📸 ${timelinePendingAttachments.length} prints anexados`;
  }

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'inline';
    statusEl.style.color = '#38bdf8';
    statusEl.textContent = hasPendingFiles ? 'Enviando anexo(s)...' : 'Enviando resposta...';
  }

  try {
    let uploadedAttachmentIds = [];
    if (hasPendingFiles) {
      // Registrar os IDs dos anexos já existentes no chamado ANTES do upload
      const existingAttIds = new Set((selectedTicket.attachments || []).map(a => a.id));

      const filesToUpload = [...timelinePendingAttachments];
      const uploadedAttachments = await window.conciliadorAPI.uploadTicketAttachments(selectedTicket.id, filesToUpload);
      if (Array.isArray(uploadedAttachments)) {
        // O endpoint de upload da API retorna TODOS os anexos do chamado.
        // Devemos extrair APENAS os novos anexos deste envio específico:
        const newAttachments = uploadedAttachments.filter(a => a && a.id && !existingAttIds.has(a.id));
        if (newAttachments.length > 0) {
          uploadedAttachmentIds = newAttachments.map(a => a.id);
        } else {
          // Fallback pelos últimos N correspondentes à quantidade de arquivos recém-enviados
          uploadedAttachmentIds = uploadedAttachments.slice(-filesToUpload.length).map(a => a.id).filter(Boolean);
        }
      }
      timelinePendingAttachments = [];
      renderTimelinePendingAttachments();
    }

    if (statusEl) statusEl.textContent = 'Publicando na linha do tempo...';
    await window.conciliadorAPI.addComment(selectedTicket.id, content, uploadedAttachmentIds);

    if (textarea) textarea.value = '';
    if (statusEl) {
      statusEl.style.color = '#10b981';
      statusEl.textContent = '✅ Enviado!';
    }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);

    // Refresh ticket details
    const details = await window.conciliadorAPI.fetchDemandDetails(selectedTicket.id);
    selectedTicket = { ...selectedTicket, ...details };
    drawerCurrentComments = details.comments || [];
    drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
    renderDrawerActivityStream();
    renderDrawerAttachments(details.attachments || []);
  } catch (err) {
    console.error('Failed to post comment / attachments:', err);
    if (statusEl) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = '❌ Erro: ' + err.message;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function sanitizeMovideskId(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Se o usuário colou URL completa do Movidesk: https://.../Ticket/Edit/12345
  const urlMatch = str.match(/Ticket\/(?:Edit\/)?(\d+)/i);
  if (urlMatch && urlMatch[1]) {
    return String(urlMatch[1]).slice(0, 40);
  }

  // Se tiver prefixo de hashtag ou número puro: #12345 ou 12345
  const hashMatch = str.match(/^#?(\d+)$/);
  if (hashMatch && hashMatch[1]) {
    return String(hashMatch[1]).slice(0, 40);
  }

  return str.slice(0, 40);
}

async function refreshDrawerActivity(ticketId) {
  if (!ticketId) return;
  try {
    const details = await window.conciliadorAPI.fetchDemandDetails(ticketId);
    if (selectedTicket && selectedTicket.id === ticketId) {
      selectedTicket = { ...selectedTicket, ...details };
      drawerCurrentComments = details.comments || [];
      drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
      renderDrawerActivityStream();
    }
  } catch (e) {
    console.warn('Erro ao atualizar histórico da demanda:', e);
  }
}

function promptJustification({
  icon = '📝',
  title = 'Justificativa da Alteração',
  subtitle = '',
  bannerText = 'Informe a justificativa desta modificação:',
  suggestions = [],
  placeholder = 'Escreva detalhadamente a justificativa...',
  confirmText = 'Confirmar Alteração',
  confirmClass = 'btn-primary',
  defaultComment = true,
  requireReason = true
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalJustificationPrompt');
    if (!modal) {
      const reason = prompt(`${title}\n${bannerText}`);
      if (reason === null) return resolve({ confirmed: false });
      return resolve({ confirmed: true, reason: reason.trim(), addComment: defaultComment });
    }

    const iconEl = document.getElementById('justificationModalIcon');
    const titleEl = document.getElementById('justificationModalTitle');
    const subtitleEl = document.getElementById('justificationModalSubtitle');
    const bannerEl = document.getElementById('justificationModalBannerText');
    const suggestionsSection = document.getElementById('justificationSuggestionsSection');
    const chipsContainer = document.getElementById('justificationSuggestionsChips');
    const textarea = document.getElementById('justificationReasonInput');
    const checkbox = document.getElementById('justificationAddComment');
    const confirmBtn = document.getElementById('btnJustificationConfirm');
    const cancelBtn = document.getElementById('btnJustificationCancel');
    const closeBtn = document.getElementById('btnJustificationClose');
    const confirmTextEl = document.getElementById('justificationConfirmText');

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
      subtitleEl.textContent = subtitle || '';
      subtitleEl.style.display = subtitle ? 'block' : 'none';
    }
    if (bannerEl) bannerEl.textContent = bannerText;
    if (confirmTextEl) confirmTextEl.textContent = confirmText;
    if (confirmBtn) {
      confirmBtn.className = `btn-primary ${confirmClass}`;
    }
    if (textarea) {
      textarea.value = '';
      textarea.placeholder = placeholder;
    }
    if (checkbox) {
      checkbox.checked = defaultComment;
    }

    // Render suggestion chips
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      if (suggestions && suggestions.length > 0) {
        if (suggestionsSection) suggestionsSection.style.display = 'block';
        suggestions.forEach(s => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'justification-chip';
          chip.textContent = s;
          chip.addEventListener('click', () => {
            if (textarea) {
              textarea.value = s;
              textarea.focus();
            }
          });
          chipsContainer.appendChild(chip);
        });
      } else if (suggestionsSection) {
        suggestionsSection.style.display = 'none';
      }
    }

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      modal.style.display = 'none';
      modal.classList.remove('open');
      confirmBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      textarea?.removeEventListener('keydown', onTextareaKeyDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };

    const onConfirm = () => {
      const reasonVal = textarea ? textarea.value.trim() : '';
      if (requireReason && !reasonVal) {
        showAppAlert('Por favor, digite ou selecione uma sugestão de justificativa para prosseguir.', 'Justificativa Obrigatória', 'warning');
        textarea?.focus();
        return;
      }
      const shouldComment = checkbox ? checkbox.checked : false;
      cleanup();
      resolve({ confirmed: true, reason: reasonVal, addComment: shouldComment });
    };

    const onCancel = () => {
      cleanup();
      resolve({ confirmed: false });
    };

    const onTextareaKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    const onDocumentKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    confirmBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    textarea?.addEventListener('keydown', onTextareaKeyDown);
    document.addEventListener('keydown', onDocumentKeyDown);

    modal.style.display = 'flex';
    modal.classList.add('open');
    setTimeout(() => { textarea?.focus(); }, 100);
  });
}

// Ação de Fluxo: Finalizar Chamado (Status: closed - Sem exigir justificativa)
async function handleFinalizeTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const ok = await showAppConfirm(
    `Deseja realmente finalizar e concluir a demanda #${ticket.number || ticket.movideskTicketId || ticket.id.slice(0, 8)}? O status passará para "Concluído".`,
    'Finalizar Chamado',
    {
      confirmText: 'Finalizar Chamado',
      confirmClass: 'btn-confirm-finalize',
      icon: '✅',
      type: 'success',
      subtitle: 'Conclusão da Demanda'
    }
  );

  if (!ok) return;

  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Finalizando demanda...';
  }

  try {
    // 1. Alterar status na API para 'done' diretamente sem exigir justificativa
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'done');

    // 2. Atualizar localmente
    ticket.status = 'done';
    ticket.closedAt = new Date().toISOString();
    if (window.appStore?.currentUser) {
      if (!ticket.reviewerId && !ticket.reviewer) {
        ticket.reviewer = {
          id: window.appStore.currentUser.id,
          name: window.appStore.currentUser.name,
          avatarUrl: window.appStore.currentUser.avatarUrl || null
        };
        ticket.reviewerId = window.appStore.currentUser.id;
        ticket.reviewerName = window.appStore.currentUser.name;
      }
    }
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'done';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'done';
      window.appStore.demands[idx].closedAt = ticket.closedAt;
      if (ticket.reviewer) window.appStore.demands[idx].reviewer = ticket.reviewer;
      if (ticket.reviewerId) window.appStore.demands[idx].reviewerId = ticket.reviewerId;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '✅ Demanda finalizada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda finalizada com sucesso!', 'Concluído', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao finalizar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Devolver para o Desenvolvedor (Status: queued / Na Fila)
async function handleReturnTicketToDev(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const devName = ticket.assignedTo?.name || 'Desenvolvedor';
  const result = await promptJustification({
    icon: '↩️',
    title: 'Devolver para o Desenvolvedor',
    subtitle: `Responsável atual: ${devName} | #${ticket.number || ticket.movideskTicketId || ticket.id.slice(0, 8)}`,
    bannerText: 'O status do chamado voltará para "Na Fila" para que o desenvolvedor realize as correções necessárias.',
    suggestions: [
      'Inconsistência encontrada durante os testes de homologação',
      'Necessário ajustar regras de layout e campos obrigatórios',
      'Faltam arquivos de teste ou retorno do cliente',
      'Regra de negócio não atende à especificação',
      'Erro retornado durante a importação',
      'Ajustar mapeamento de colunas'
    ],
    placeholder: 'Descreva os erros encontrados ou o que precisa ser corrigido pelo desenvolvedor...',
    confirmText: 'Devolver para a Fila',
    confirmClass: 'btn-confirm-return',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Devolvendo demanda para a fila do desenvolvedor...';
  }

  try {
    // 1. Alterar status na API para queued (Na Fila)
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'queued', reason);

    // 2. Adicionar comentário na linha do tempo se marcado (apenas a mensagem direta)
    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de devolução:', cErr);
      }
    }

    // 3. Atualizar localmente
    ticket.status = 'queued';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'queued';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'queued';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '↩️ Demanda devolvida para a fila!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda devolvida para a fila com sucesso!', 'Na Fila', 'info');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao devolver chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Iniciar Demanda (Status: in_progress)
async function handleStartTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Iniciando demanda...';
  }

  try {
    // Se o chamado não tiver desenvolvedor atribuído e o usuário logado tiver ID, atribui automaticamente
    if (!ticket.assignedTo?.id && window.appStore.currentUser?.id) {
      try {
        await window.conciliadorAPI.assignTicket(ticket.id, window.appStore.currentUser.id);
        ticket.assignedTo = {
          id: window.appStore.currentUser.id,
          name: window.appStore.currentUser.name || window.appStore.currentUser.email
        };
      } catch (assignErr) {
        console.warn('Não foi possível auto-atribuir ao iniciar:', assignErr);
      }
    }

    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'in_progress');

    ticket.status = 'in_progress';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'in_progress';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'in_progress';
      if (ticket.assignedTo) window.appStore.demands[idx].assignedTo = ticket.assignedTo;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '🚀 Demanda iniciada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showToast('🚀 Demanda iniciada com sucesso!');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao iniciar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Pausar Chamado (Status: paused)
async function handlePauseTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const result = await promptJustification({
    icon: '⏸️',
    title: 'Pausar Chamado',
    subtitle: `Demanda #${ticket.number || ticket.id.slice(0, 8)} - ${ticket.title}`,
    bannerText: 'O chamado será pausado. O cronômetro de produção será congelado temporariamente.',
    suggestions: [
      'Pausa para intervalo / almoço',
      'Aguardando liberação de acesso ou arquivo adicional',
      'Priorização temporária de outro chamado urgente',
      'Pausa técnica no desenvolvimento'
    ],
    placeholder: 'Informe o motivo da pausa...',
    confirmText: 'Pausar Chamado',
    confirmClass: 'btn-confirm-pause',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Pausando demanda...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'paused', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de pausa:', cErr);
      }
    }

    ticket.status = 'paused';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'paused';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'paused';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#f59e0b';
        statusText.textContent = '⏸️ Demanda pausada!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda pausada com sucesso!', 'Pausado', 'warning');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao pausar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Aguardar Quem Abriu / N2 (Status: waiting_requester)
async function handleWaitRequesterTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const reqName = ticket.requestedBy?.name || 'Solicitante';
  const result = await promptJustification({
    icon: '⏳',
    title: 'Aguardar Quem Abriu (N2)',
    subtitle: `Solicitante: ${reqName} | #${ticket.number || ticket.id.slice(0, 8)}`,
    bannerText: 'O status passará para "Aguardando Resposta do N2". O SLA fica congelado até a resposta.',
    suggestions: [
      'Inconsistência nos dados fornecidos pelo cliente. Aguardando esclarecimento.',
      'Aguardando envio de arquivo de exemplo para teste',
      'Necessário alinhamento de regra de negócio com o cliente',
      'Dúvida de especificação aguardando resposta do solicitante'
    ],
    placeholder: 'Descreva a dúvida ou informação que você precisa de quem abriu o chamado...',
    confirmText: 'Aguardar Resposta',
    confirmClass: 'btn-confirm-waiting',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Alterando para aguardando quem abriu...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'waiting_requester', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de aguardo:', cErr);
      }
    }

    ticket.status = 'waiting_requester';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'waiting_requester';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'waiting_requester';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#38bdf8';
        statusText.textContent = '⏳ Demanda aguardando resposta de quem abriu!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda colocada em espera por resposta do solicitante!', 'Aguardando N2', 'info');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao alterar status: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Enviar para Revisão (Status: review)
async function handleSendToReviewTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Enviando para revisão...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'review');

    ticket.status = 'review';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'review';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'review';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#c084fc';
        statusText.textContent = '📤 Demanda enviada para revisão com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showToast('📤 Demanda enviada para revisão com sucesso!');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao enviar para revisão: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Retomar Desenvolvimento (Status: in_progress)
async function handleResumeTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const isClosed = ticket.status === 'closed' || ticket.status === 'done';
  const isPaused = ticket.status === 'paused';
  const result = await promptJustification({
    icon: isClosed ? '🔄' : '▶️',
    title: isClosed ? 'Reabrir Chamado' : 'Retomar Desenvolvimento',
    subtitle: `Demanda #${ticket.number || ticket.id.slice(0, 8)} - ${ticket.title}`,
    bannerText: isClosed
      ? 'O chamado será reaberto e voltará para o status "Em Desenvolvimento".'
      : (isPaused 
        ? 'O chamado sairá da pausa e voltará para "Em Desenvolvimento".' 
        : 'O chamado sairá de espera e voltará para desenvolvimento ativo ("Em Progresso").'),
    suggestions: isClosed ? [
      'Reabrindo para ajustes solicitados pelo cliente',
      'Correção necessária após homologação',
      'Novas alterações solicitadas no layout',
      'Dúvidas reabertas pelo solicitante'
    ] : (isPaused ? [
      'Retomando desenvolvimento após pausa',
      'Ambiente liberado, continuando implementação',
      'Retomando prioridade do chamado'
    ] : [
      'Retomando desenvolvimento após resposta do solicitante',
      'Informações recebidas, continuando ajustes',
      'Dúvidas esclarecidas, prosseguindo com a demanda'
    ]),
    placeholder: isClosed ? 'Motivo da reabertura do chamado (opcional)...' : 'Observações de retomada (opcional)...',
    confirmText: isClosed ? 'Reabrir Chamado' : 'Retomar Demanda',
    confirmClass: isClosed ? 'btn-confirm-review' : 'btn-confirm-start',
    defaultComment: isClosed,
    requireReason: false
  });

  if (!result.confirmed) return;

  const defaultReason = isClosed ? 'Chamado reaberto para novos ajustes' : 'Desenvolvimento retomado';
  const reason = result.reason || defaultReason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = isClosed ? 'Reabrindo chamado...' : 'Retomando demanda...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'in_progress', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de retomada/reabertura:', cErr);
      }
    }

    ticket.status = 'in_progress';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'in_progress';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'in_progress';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      renderDrawerHeaderMetaAndTitle(ticket);
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#2dd4bf';
        statusText.textContent = isClosed ? '🔄 Chamado reaberto com sucesso!' : '▶️ Demanda retomada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert(isClosed ? 'Chamado reaberto para desenvolvimento!' : 'Demanda retomada para desenvolvimento!', isClosed ? 'Chamado Reaberto' : 'Em Desenvolvimento', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao processar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Gera o HTML dos botões de fluxo de acordo com o status e o container
function getWorkflowButtonsHtml(status, isQuick = false) {
  status = (status || 'open').toLowerCase();

  if (isQuick) {
    if (status === 'review') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-finalize" data-action="finalize" title="Finalizar e concluir chamado">
          <span>✅</span> Finalizar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-return" data-action="return-dev" title="Devolver para a fila do desenvolvedor">
          <span>↩️</span> Devolver p/ Fila
        </button>
      `;
    }
    if (status === 'waiting_requester' || status === 'waiting' || status === 'waiting_creator' || status === 'paused') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-resume" data-action="resume" title="Retomar chamado">
          <span>▶️</span> Retomar
        </button>
      `;
    }
    if (status === 'queued' || status === 'open' || status === 'triage') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-start" data-action="start" title="Iniciar desenvolvimento">
          <span>🚀</span> Iniciar
        </button>
      `;
    }
    if (status === 'in_progress' || status === 'progress') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-pause" data-action="pause" title="Pausar">
          <span>⏸️</span> Pausar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-waiting" data-action="waiting" title="Aguardar Quem Abriu">
          <span>⏳</span> Aguardar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-review" data-action="review" title="Enviar para Revisão">
          <span>📤</span> Revisão
        </button>
      `;
    }
    if (status === 'closed' || status === 'done') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-resume" data-action="reopen" title="Reabrir chamado">
          <span>🔄</span> Reabrir
        </button>
      `;
    }
    return '';
  }

  // Ações no Fim do Chamado (junto do botão Salvar Alterações / Salvar Interação)
  if (status === 'review') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-finalize" data-action="finalize" title="Finalizar e homologar chamado">
        <span>✅</span> <span>Finalizar Chamado</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-return" data-action="return-dev" title="Devolver chamado para a fila do desenvolvedor com justificativa">
        <span>↩️</span> <span>Devolver para a Fila</span>
      </button>
    `;
  }
  if (status === 'waiting_requester' || status === 'waiting' || status === 'waiting_creator') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-resume" data-action="resume" title="Retomar desenvolvimento ativo do chamado">
        <span>▶️</span> <span>Retomar Desenvolvimento</span>
      </button>
    `;
  }
  if (status === 'queued' || status === 'open' || status === 'triage') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-start" data-action="start" title="Iniciar desenvolvimento desta demanda">
        <span>🚀</span> <span>Iniciar Demanda</span>
      </button>
    `;
  }
  if (status === 'in_progress' || status === 'progress') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-pause" data-action="pause" title="Pausar desenvolvimento temporariamente">
        <span>⏸️</span> <span>Pausar</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-waiting" data-action="waiting" title="Colocar chamado em espera por resposta de quem abriu (N2)">
        <span>⏳</span> <span>Aguardar Quem Abriu</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-review" data-action="review" title="Enviar chamado concluído para revisão e homologação">
        <span>📤</span> <span>Enviar para Revisão</span>
      </button>
    `;
  }
  if (status === 'paused') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-resume" data-action="resume" title="Retomar desenvolvimento da demanda">
        <span>▶️</span> <span>Retomar Desenvolvimento</span>
      </button>
    `;
  }
  if (status === 'closed' || status === 'done') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-reopen" data-action="reopen" title="Reabrir demanda concluída para novos ajustes e correções">
        <span>🔄</span> <span>Reabrir Chamado</span>
      </button>
    `;
  }
  return '';
}

// Renderiza os botões dinâmicos de fluxo no final do chamado (junto de salvar alterações e interações) e no card
function renderDrawerWorkflowButtons(ticket) {
  const bottomContainer = document.getElementById('drawerBottomWorkflowActionsContainer');
  const commentContainer = document.getElementById('drawerCommentWorkflowActionsContainer');
  const quickContainer = document.getElementById('drawerQuickWorkflowActionsContainer');

  const targets = [
    { el: bottomContainer, isQuick: false },
    { el: commentContainer, isQuick: false },
    { el: quickContainer, isQuick: true }
  ];

  if (!ticket) {
    targets.forEach(t => { if (t.el) t.el.innerHTML = ''; });
    return;
  }

  const status = ticket.status || 'open';
  const bottomHtml = getWorkflowButtonsHtml(status, false);
  const quickHtml = getWorkflowButtonsHtml(status, true);

  targets.forEach(({ el, isQuick }) => {
    if (!el) return;
    el.innerHTML = isQuick ? quickHtml : bottomHtml;

    el.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (action === 'finalize') handleFinalizeTicket(ticket);
        else if (action === 'return-dev') handleReturnTicketToDev(ticket);
        else if (action === 'start') handleStartTicket(ticket);
        else if (action === 'pause') handlePauseTicket(ticket);
        else if (action === 'waiting') handleWaitRequesterTicket(ticket);
        else if (action === 'review') handleSendToReviewTicket(ticket);
        else if (action === 'resume' || action === 'reopen') handleResumeTicket(ticket);
      });
    });
  });
}


// Ação de Fluxo: Alterar Validador - Direto sem modal e sem mensagem no chat
async function changeReviewerWorkflow(targetReviewerId, targetReviewerName) {
  if (!selectedTicket) return;

  const currentReviewerId = selectedTicket.reviewer?.id || selectedTicket.reviewerId || '';
  const currentReviewerName = selectedTicket.reviewer?.name || selectedTicket.reviewerName || 'Nenhum';

  // Se o validador for o mesmo que já está salvo, não precisa fazer nada
  if ((targetReviewerId || '') === (currentReviewerId || '')) return;

  const isLeavingBlank = !targetReviewerId;
  const reviewerSelect = document.getElementById('drawerEditReviewer');

  // A API do Importer Ultra exige um UUID e não aceita remover validador para em branco após ter sido atribuído
  if (isLeavingBlank && currentReviewerId) {
    if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    showAppAlert(
      'A API do Importer Ultra não permite deixar o chamado sem validador após ele já ter sido atribuído.\n\nPara transferir a validação, selecione outro membro da equipe no campo Validador.',
      'Validador Obrigatório na API',
      'warning'
    );
    return;
  }

  const cleanName = (targetReviewerName || 'Novo Validador').replace(/^[👤⚖️]\s*/, '').replace(/\s*\(Você\)$/, '').trim();
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Atribuindo validador...';
  }

  try {
    // 1. Chamar assignReviewer na API diretamente (sem modal e sem postar mensagem de chat)
    await window.conciliadorAPI.assignReviewer(selectedTicket.id, targetReviewerId, 'Alteração de validador pelo Organizador de Chamados');

    // 2. Atualizar estado local
    selectedTicket.reviewer = { id: targetReviewerId, name: cleanName };
    selectedTicket.reviewerId = targetReviewerId;
    selectedTicket.reviewerName = cleanName;

    if (reviewerSelect) {
      reviewerSelect.value = targetReviewerId;
    }

    const idx = window.appStore.demands.findIndex(d => d.id === selectedTicket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].reviewer = selectedTicket.reviewer;
      window.appStore.demands[idx].reviewerId = selectedTicket.reviewerId;
      window.appStore.demands[idx].reviewerName = selectedTicket.reviewerName;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (statusText) {
      statusText.style.color = '#10b981';
      statusText.textContent = `⚖️ Validador definido: ${cleanName}`;
      setTimeout(() => { if (statusText) statusText.textContent = ''; }, 3000);
    }

    renderDemands();
    await refreshDrawerActivity(selectedTicket.id);
  } catch (err) {
    if (statusText) statusText.textContent = '';
    if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    showAppAlert('Erro ao alterar validador: ' + err.message, 'Erro', 'error');
  }
}

async function saveDrawerTicketChanges() {
  if (!selectedTicket) return;

  const btnTop = document.getElementById('btnDrawerSaveTicket');
  const btnBottom = document.getElementById('btnDrawerSaveTicketBottom');
  const statusText = document.getElementById('drawerSaveStatusText');

  const title = document.getElementById('drawerEditTitle')?.value.trim();
  if (!title) {
    showAppAlert('O título da demanda não pode ficar vazio.', 'Aviso', 'warning');
    document.getElementById('drawerEditTitle')?.focus();
    return;
  }

  const newStatus = document.getElementById('drawerEditStatus')?.value;
  const assignedToId = document.getElementById('drawerEditAssignedTo')?.value || null;
  const priority = normalizePriorityToApi(document.getElementById('drawerEditPriority')?.value);
  const clientDatabase = document.getElementById('drawerEditDatabase')?.value.trim() || null;
  const movideskRaw = document.getElementById('drawerEditMovidesk')?.value;
  const movideskTicketId = sanitizeMovideskId(movideskRaw);
  const newLayoutId = document.getElementById('drawerEditLayoutId')?.value || null;
  const ticketTypeId = document.getElementById('drawerEditType')?.value || null;
  const productId = document.getElementById('drawerEditProduct')?.value || null;

  // Se o status foi alterado manualmente pelo select
  let statusJustification = 'Alteração de status pelo Organizador de Chamados';
  let statusAddComment = false;
  if (newStatus && newStatus !== selectedTicket.status) {
    if (newStatus === 'in_progress' || newStatus === 'review') {
      statusJustification = newStatus === 'in_progress' ? 'Desenvolvimento iniciado' : 'Enviado para revisão';
      statusAddComment = false;
    } else {
      const fromLabel = formatStatusLabel(selectedTicket.status);
      const toLabel = formatStatusLabel(newStatus);
      const isClosing = newStatus === 'closed' || newStatus === 'done';

      const justResult = await promptJustification({
        icon: isClosing ? '✅' : '🔄',
        title: isClosing ? 'Finalizar Demanda' : 'Alterar Situação do Chamado',
        subtitle: `De: ${fromLabel} ➔ Para: ${toLabel}`,
        bannerText: `Você está alterando a situação desta demanda para "${toLabel}".`,
        suggestions: isClosing ? [
          'Homologado e validado em produção com sucesso',
          'Demanda aprovada sem pendências',
          'Ajustes validados e conferidos com o cliente',
          'Finalizado conforme solicitado'
        ] : (isReturning ? [
          'Inconsistência encontrada durante testes de homologação',
          'Necessário ajustar regras de layout e campos',
          'Faltam arquivos de teste ou retorno do cliente',
          'Ajustar mapeamento de colunas'
        ] : [
          `Situação alterada de ${fromLabel} para ${toLabel}`,
          'Atualização de status do chamado',
          'Ajuste de fila e situação'
        ]),
        placeholder: 'Descreva a justificativa desta alteração de situação...',
        confirmText: 'Confirmar e Salvar',
        confirmClass: isClosing ? 'btn-confirm-finalize' : (isReturning ? 'btn-confirm-return' : 'btn-primary'),
        defaultComment: false,
        requireReason: false
      });

      if (!justResult.confirmed) {
        const stSelect = document.getElementById('drawerEditStatus');
        if (stSelect) stSelect.value = selectedTicket.status;
        return;
      }

      statusJustification = justResult.reason || `Situação alterada de ${fromLabel} para ${toLabel}`;
      statusAddComment = justResult.addComment;
    }
  }

  const deliveryDueInput = document.getElementById('drawerEditDeliveryDueDate')?.value.trim();
  const clientDueInput = document.getElementById('drawerEditClientDueDate')?.value.trim();

  const deliveryDueDate = parseBrDateToIso(deliveryDueInput);
  const clientDueDate = parseBrDateToIso(clientDueInput);

  // Payload exclusivo para campos descritivos no PATCH /support/tickets/:id
  // Proibido no PATCH: status, layoutId, assignedToId, deliveryDueDate, clientDueDate
  const payload = {
    title,
    priority,
    clientDatabase,
    typeId: ticketTypeId,
    productId,
    labelIds: Array.from(selectedDrawerLabels)
  };

  if (movideskTicketId) {
    payload.movideskTicketId = movideskTicketId;
  } else if (selectedTicket.movideskTicketId) {
    payload.movideskTicketId = null;
  }

  // Se o usuário abriu e editou a descrição
  const editWrapper = document.getElementById('drawerDescEditWrapper');
  if (editWrapper && editWrapper.style.display !== 'none') {
    const editor = document.getElementById('drawerEditDescEditor');
    if (editor) {
      payload.description = editor.innerHTML;
    }
  }

  // Visual loading feedback
  if (btnTop) {
    btnTop.disabled = true;
    btnTop.innerHTML = '<span>⏳</span> Salvando...';
  }
  if (btnBottom) {
    btnBottom.disabled = true;
    btnBottom.innerHTML = '<span>⏳</span> Salvando...';
  }
  if (statusText) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Salvando alterações no Importer Ultra...';
  }

  try {
    // 1. Se o status foi alterado, chamar o endpoint de status dedicado
    if (newStatus && newStatus !== selectedTicket.status) {
      try {
        await window.conciliadorAPI.changeTicketStatus(selectedTicket.id, newStatus, statusJustification);
        if (statusAddComment && statusJustification) {
          try {
            await window.conciliadorAPI.addComment(selectedTicket.id, statusJustification.trim());
          } catch (cErr) {}
        }
      } catch (statusErr) {
        console.warn('Erro ao alterar status:', statusErr);
        throw new Error('Falha ao alterar status da demanda: ' + statusErr.message);
      }
    }

    // 2. Se o layout foi alterado, vincular layout pelo endpoint dedicado
    const currentLayoutId = selectedTicket.layoutId || selectedTicket.layout?.id || null;
    if (newLayoutId && newLayoutId !== currentLayoutId) {
      try {
        await window.conciliadorAPI.linkTicketLayout(selectedTicket.id, newLayoutId);
      } catch (layoutErr) {
        console.warn('Erro ao vincular layout:', layoutErr);
        throw new Error('Falha ao vincular layout à demanda: ' + layoutErr.message);
      }
    }

    // 3. Se o responsável foi alterado, usar a rota de atribuição dedicada
    const currentAssignedToId = selectedTicket.assignedTo?.id || selectedTicket.assignedToId || null;
    const newAssignedToId = assignedToId || null;
    if (newAssignedToId !== currentAssignedToId) {
      try {
        await window.conciliadorAPI.assignTicket(selectedTicket.id, newAssignedToId, 'Alteração de responsável pelo Organizador de Chamados');
      } catch (assignErr) {
        console.warn('Erro ao atribuir responsável:', assignErr);
        throw new Error('Falha ao definir responsável da demanda: ' + assignErr.message);
      }
    }

    // 4. Se os prazos foram alterados, usar a rota de datas dedicada
    const currentDeliveryIso = selectedTicket.deliveryDueDate ? new Date(selectedTicket.deliveryDueDate).toISOString().slice(0, 10) : null;
    const currentClientIso = selectedTicket.clientDueDate ? new Date(selectedTicket.clientDueDate).toISOString().slice(0, 10) : null;
    const newDeliveryIso = deliveryDueDate ? new Date(deliveryDueDate).toISOString().slice(0, 10) : null;
    const newClientIso = clientDueDate ? new Date(clientDueDate).toISOString().slice(0, 10) : null;

    if (newDeliveryIso !== currentDeliveryIso || newClientIso !== currentClientIso) {
      try {
        await window.conciliadorAPI.setTicketDates(selectedTicket.id, deliveryDueDate, clientDueDate, 'Atualização de prazos pelo Organizador de Chamados');
      } catch (dateErr) {
        console.warn('Erro ao atualizar prazos:', dateErr);
        throw new Error('Falha ao atualizar prazos da demanda: ' + dateErr.message);
      }
    }

    // 5. Se o validador foi alterado no select do drawer
    const reviewerSelect = document.getElementById('drawerEditReviewer');
    const newReviewerId = reviewerSelect ? (reviewerSelect.value || null) : (selectedTicket.reviewerId || null);
    const currentReviewerId = selectedTicket.reviewer?.id || selectedTicket.reviewerId || null;
    let newReviewerObj = selectedTicket.reviewer || null;

    if (newReviewerId && newReviewerId !== currentReviewerId) {
      try {
        await window.conciliadorAPI.assignReviewer(selectedTicket.id, newReviewerId, 'Alteração de validador pelo Organizador de Chamados');
        const opt = reviewerSelect ? reviewerSelect.selectedOptions[0] : null;
        const revName = opt ? opt.text.replace(/^[👤⚖️]\s*/, '').replace(/\s*\(Você\)$/, '').trim() : 'Validador';
        newReviewerObj = { id: newReviewerId, name: revName };
      } catch (revErr) {
        console.warn('Erro ao atualizar validador:', revErr);
        throw new Error('Falha ao atualizar validador: ' + revErr.message);
      }
    } else if (!newReviewerId && currentReviewerId) {
      if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    }

    // 5. Atualizar dados gerais e descritivos no PATCH do ticket
    const updated = await window.conciliadorAPI.updateTicket(selectedTicket.id, payload);

    // Atualizar no cache local de demandas
    const idx = window.appStore.demands.findIndex(d => d.id === selectedTicket.id);
    if (idx !== -1) {
      const existing = window.appStore.demands[idx];
      const merged = {
        ...existing,
        ...updated,
        ...payload,
        status: newStatus || existing.status,
        closedAt: (newStatus === 'done' || newStatus === 'closed') ? (existing.closedAt || new Date().toISOString()) : existing.closedAt,
        layoutId: newLayoutId || existing.layoutId,
        deliveryDueDate: deliveryDueDate !== undefined ? deliveryDueDate : existing.deliveryDueDate,
        clientDueDate: clientDueDate !== undefined ? clientDueDate : existing.clientDueDate
      };
      if (assignedToId) {
        const devObj = window.appStore.getKnownDevelopers().find(d => d.id === assignedToId);
        merged.assignedTo = devObj || { id: assignedToId };
      } else {
        merged.assignedTo = null;
      }
      if (ticketTypeId) {
        const typeObj = window.appStore.getTicketTypes().find(t => t.id === ticketTypeId);
        if (typeObj) merged.ticketType = typeObj;
      }
      if (productId) {
        const prodObj = (window.appStore.products || []).find(p => p.id === productId);
        if (prodObj) merged.product = prodObj;
      }
      merged.reviewer = newReviewerObj;
      merged.reviewerId = newReviewerId;
      merged.reviewerName = newReviewerObj ? newReviewerObj.name : null;
      window.appStore.demands[idx] = merged;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      } else if (window.electronAPI) {
        await window.electronAPI.saveStorage('cachedDemands', window.appStore.demands);
      }
    }

    selectedTicket = {
      ...selectedTicket,
      ...updated,
      ...payload,
      status: newStatus || selectedTicket.status,
      closedAt: (newStatus === 'done' || newStatus === 'closed') ? (selectedTicket.closedAt || new Date().toISOString()) : selectedTicket.closedAt,
      layoutId: newLayoutId || selectedTicket.layoutId,
      deliveryDueDate: deliveryDueDate !== undefined ? deliveryDueDate : selectedTicket.deliveryDueDate,
      clientDueDate: clientDueDate !== undefined ? clientDueDate : selectedTicket.clientDueDate
    };
    if (assignedToId) {
      const devObj = window.appStore.getKnownDevelopers().find(d => d.id === assignedToId);
      selectedTicket.assignedTo = devObj || { id: assignedToId };
    } else {
      selectedTicket.assignedTo = null;
    }
    selectedTicket.reviewer = newReviewerObj;
    selectedTicket.reviewerId = newReviewerId;
    selectedTicket.reviewerName = newReviewerObj ? newReviewerObj.name : null;

    // Atualizar cabeçalho, título clicável e badges do painel lateral
    renderDrawerHeaderMetaAndTitle(selectedTicket);

    // Se a descrição foi salva, atualizar visualização com sanitização e imagens autenticadas
    if (payload.description) {
      const descBox = document.getElementById('drawerDescription');
      if (descBox) renderAuthenticatedDescription(payload.description, selectedTicket.id, descBox);
      toggleDrawerDescEdit(false);
    }

    // Feedback de sucesso
    if (statusText) {
      statusText.style.color = '#10b981';
      statusText.textContent = '✅ Alterações salvas com sucesso!';
      setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
    }

    // Atualizar tab se estiver em sistema multi-abas
    if (window.appTabs && selectedTicket) {
      window.appTabs.updateTab(selectedTicket.id, {
        title: selectedTicket.title,
        status: selectedTicket.status
      });
      window.appTabs.markDirty(selectedTicket.id, false);
    }

    // Atualizar tabela/kanban para refletir alterações
    renderDemands();

    // Recarregar detalhes frescos do backend
    try {
      const refreshed = await window.conciliadorAPI.fetchDemandDetails(selectedTicket.id);
      selectedTicket = { ...selectedTicket, ...refreshed };
      drawerCurrentComments = refreshed.comments || [];
      drawerCurrentEvents = (refreshed.events || []).filter(e => e.kind !== 'comment');
      renderDrawerActivityStream();
    } catch (e) {
      console.warn('Could not refresh timeline events after save:', e);
    }

  } catch (err) {
    console.error('Failed to update ticket:', err);
    if (statusText) {
      statusText.style.color = '#ef4444';
      statusText.textContent = '❌ Erro ao salvar: ' + translateErrorMessage(err);
    }
    showAppError('Erro ao Salvar Demanda', err);
  } finally {
    if (btnTop) {
      btnTop.disabled = false;
      btnTop.innerHTML = '<span>💾</span> Salvar Alterações';
    }
    if (btnBottom) {
      btnBottom.disabled = false;
      btnBottom.innerHTML = '<span>💾</span> Salvar Alterações da Demanda';
    }
  }
}

async function archiveCurrentTicket() {
  if (!selectedTicket) return;
  const ok = await showAppConfirm(`Deseja realmente arquivar a demanda #${selectedTicket.number}?`, 'Arquivar Demanda', { isDanger: true, confirmText: 'Arquivar Demanda' });
  if (ok) {
    try {
      const ticketToArchive = selectedTicket;
      await window.conciliadorAPI.archiveTicket(ticketToArchive.id);
      if (window.appTabs && ticketToArchive.id) {
        await window.appTabs.closeTab(ticketToArchive.id, true);
      } else {
        closeDemandDrawer();
      }
      await syncDemands();
      showAppAlert(`A demanda #${ticketToArchive.number} foi arquivada com sucesso.`, 'Demanda Arquivada', 'success');
    } catch (err) {
      showAppError('Erro ao Arquivar Demanda', err);
    }
  }
}

function closeDemandDrawer() {
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('demandDrawer');
  overlay?.classList.remove('open');
  drawer?.classList.remove('open');
  document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
  document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
  timelinePendingAttachments = [];
  renderTimelinePendingAttachments();
  selectedTicket = null;
  window.selectedTicket = null;
}

// Expor funções e acessores de estado do Drawer para o TabManager e aplicação geral
window.openDemandDrawer = openDemandDrawer;
window.closeDemandDrawer = closeDemandDrawer;
window.getSelectedTicket = () => {
  if (window.appTabs && window.appTabs.getActiveTicketId()) {
    const activeTab = window.appTabs.tabs.find(t => String(t.ticketId) === String(window.appTabs.getActiveTicketId()));
    if (activeTab && activeTab.ticket) return activeTab.ticket;
  }
  return selectedTicket || window.selectedTicket || null;
};
window.getTimelinePendingAttachments = () => timelinePendingAttachments;
window.setTimelinePendingAttachments = (arr) => {
  timelinePendingAttachments = arr || [];
  renderTimelinePendingAttachments();
};
window.getDrawerSelectedLabels = () => new Set(selectedDrawerLabels);
window.setDrawerSelectedLabels = (s) => {
  selectedDrawerLabels = new Set(s);
  renderDrawerLabelsPicker();
};
window.getDrawerActiveTab = () => drawerActiveTab;
window.isDrawerEditingDesc = () => isEditingDescription;
window.toggleDrawerDescEdit = toggleDrawerDescEdit;
window.switchDrawerTab = switchDrawerTab;
window.renderDrawerActivityStream = renderDrawerActivityStream;
window.renderDrawerAttachments = renderDrawerAttachments;
window.renderDrawerHeaderMetaAndTitle = renderDrawerHeaderMetaAndTitle;


