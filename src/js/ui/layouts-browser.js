// UI Module: Importer Ultra Layouts Cache, Status Resolution & Conflict Detection
// Cache em memória de mapeamento código de layout -> { id, name, status }
const layoutCodeToIdCache = new Map();

function restoreLayoutCacheFromStore() {
  if (window.appStore?.layoutCache && typeof window.appStore.layoutCache === 'object') {
    Object.entries(window.appStore.layoutCache).forEach(([code, val]) => {
      if (val && (val.status || val.id)) {
        layoutCodeToIdCache.set(String(code).trim(), val);
      }
    });
  }
}
window.restoreLayoutCacheFromStore = restoreLayoutCacheFromStore;

let persistLayoutCacheDebounce = null;
function persistLayoutCache() {
  clearTimeout(persistLayoutCacheDebounce);
  persistLayoutCacheDebounce = setTimeout(() => {
    if (window.electronAPI?.saveStorage) {
      const obj = {};
      layoutCodeToIdCache.forEach((val, key) => {
        if (val && (val.status || val.id)) {
          obj[key] = val;
        }
      });
      window.electronAPI.saveStorage('layoutCache', obj);
      if (window.appStore) {
        window.appStore.layoutCache = obj;
      }
    }
  }, 400);
}

function registerLayoutInCache(layout, autoPersist = true) {
  if (!layout) return;
  const id = layout.id || layout.layoutId;
  const code = layout.code != null ? layout.code : (typeof layout === 'number' || typeof layout === 'string' ? layout : null);
  if (code) {
    const codeStr = String(code).trim();
    const existing = layoutCodeToIdCache.get(codeStr) || {};
    const newObj = {
      id: id ? String(id) : (existing.id || null),
      code: codeStr,
      name: layout.name || existing.name || '',
      status: layout.status || existing.status || null
    };
    layoutCodeToIdCache.set(codeStr, newObj);
    if (autoPersist) {
      persistLayoutCache();
    }
  }
}

// Helper: Extrair código, ID e status de layout de um chamado
function getTicketLayoutInfo(ticket) {
  if (!ticket) return { code: null, name: null, id: null, status: null };
  let id = ticket.layoutId || ticket.layout?.id || null;
  let code = ticket.layout?.code != null ? ticket.layout.code : (typeof ticket.layout === 'number' || typeof ticket.layout === 'string' ? ticket.layout : null);
  let name = ticket.layout?.name || '';
  let status = ticket.layout?.status || ticket.layoutStatus || null;
  
  if (!code) {
    code = ticket.layoutCode || ticket.layout_code || null;
  }

  // Fallback: se não tiver no objeto, tentar extrair do título caso seja "14 - ERRO..." ou "3024 - NOVO LAYOUT..."
  if (!code && ticket.title) {
    // 1. Caso o título comece com o número do chamado seguido do código do layout, ex: "18 5706 - ERRO..." ou "18 - 5706 - ..."
    if (ticket.number) {
      const numMatch = ticket.title.match(new RegExp(`^\\s*#?${ticket.number}\\s*[-–—:]?\\s*(\\d{2,5})\\s*[-–—:]`, 'i'));
      if (numMatch) {
        code = parseInt(numMatch[1], 10);
      }
    }
    // 2. Título iniciando com número: "3024 - NOVO...", "#3024 - ...", "[3024] - ...", "3024: NOVO..."
    if (!code) {
      const match = ticket.title.match(/^\s*#?\[?(\d{2,5})\]?\s*[-–—:]/);
      if (match) {
        code = parseInt(match[1], 10);
      }
    }
    // 3. Título contendo a palavra layout seguida do número: "NOVO LAYOUT 3024", "LAYOUT: 3024", "LAYOUT - 3024", "LAYOUT #3024"
    if (!code) {
      const matchLayout = ticket.title.match(/layout\s*[-–—:#]?\s*(\d{2,5})/i);
      if (matchLayout) {
        code = parseInt(matchLayout[1], 10);
      }
    }
  }

  if (code) {
    const codeStr = String(code).trim();
    const cached = layoutCodeToIdCache.get(codeStr);
    if (cached) {
      if (!id && cached.id) id = cached.id;
      if (!name && cached.name) name = cached.name;
      if (!status && cached.status) status = cached.status;
    }
    registerLayoutInCache({ id, code, name, status }, false);
  }

  return { code, name, id, status };
}

// Pré-carrega todos os layouts do Importer Ultra para saber o status em tempo hábil
async function loadActiveLayoutsCache() {
  if (!window.conciliadorAPI?.fetchRecentLayouts) return;
  try {
    const layouts = await window.conciliadorAPI.fetchRecentLayouts(4000);
    if (Array.isArray(layouts) && layouts.length > 0) {
      let hasChanges = false;
      layouts.forEach(l => {
        if (!l) return;
        const code = l.code != null ? String(l.code).trim() : null;
        if (code) {
          const prev = layoutCodeToIdCache.get(code);
          if (!prev || prev.status !== l.status || !prev.id) {
            hasChanges = true;
          }
          registerLayoutInCache(l, false);
        }
      });
      persistLayoutCache();
      sweepAndInjectMissingLayoutBadges();
      if (hasChanges && !selectedTicket) {
        renderDemands();
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar catálogo completo de layouts:', err);
  } finally {
    sweepAndInjectMissingLayoutBadges();
    if (typeof resolveMissingLayoutStatuses === 'function') {
      resolveMissingLayoutStatuses().catch(() => {});
    }
  }
}
window.loadActiveLayoutsCache = loadActiveLayoutsCache;

const resolvingLayoutCodes = new Set();

// Varredor contínuo: injeta o badge de status em todo botão de layout que estiver sem na tela
function sweepAndInjectMissingLayoutBadges() {
  // 1. Varre a tabela
  document.querySelectorAll('.table-layout-cell-wrapper').forEach(wrapper => {
    const link = wrapper.querySelector('.table-layout-link');
    const existingBadge = wrapper.querySelector('.badge-layout-status');
    const code = link?.dataset?.layoutCode ? String(link.dataset.layoutCode).trim() : null;
    if (code) {
      const cached = layoutCodeToIdCache.get(code);
      const status = cached?.status || 'draft';
      const sBadge = formatLayoutStatusBadge(status);
      if (sBadge) {
        if (existingBadge) {
          existingBadge.className = `badge-layout-status ${sBadge.className}`;
          existingBadge.innerHTML = `${sBadge.icon} ${sBadge.label}`;
          existingBadge.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        } else {
          const span = document.createElement('span');
          span.className = `badge-layout-status ${sBadge.className}`;
          span.style.fontSize = '9.5px';
          span.style.padding = '1px 5px';
          span.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
          span.innerHTML = `${sBadge.icon} ${sBadge.label}`;
          wrapper.appendChild(span);
        }
      }
    }
  });

  // 2. Varre os cards de Kanban
  document.querySelectorAll('.kanban-layout-badge-container').forEach(wrapper => {
    const link = wrapper.querySelector('.kanban-layout-link');
    const existingBadge = wrapper.querySelector('.badge-layout-status');
    const code = link?.dataset?.layoutCode ? String(link.dataset.layoutCode).trim() : null;
    if (code) {
      const cached = layoutCodeToIdCache.get(code);
      const status = cached?.status || 'draft';
      const sBadge = formatLayoutStatusBadge(status);
      if (sBadge) {
        if (existingBadge) {
          existingBadge.className = `badge-layout-status ${sBadge.className}`;
          existingBadge.innerHTML = `${sBadge.icon} ${sBadge.label}`;
          existingBadge.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        } else {
          const span = document.createElement('span');
          span.className = `badge-layout-status ${sBadge.className}`;
          span.style.fontSize = '8.5px';
          span.style.padding = '1px 4px';
          span.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
          span.innerHTML = `${sBadge.icon} ${sBadge.label}`;
          wrapper.appendChild(span);
        }
      }
    }
  });
}
window.sweepAndInjectMissingLayoutBadges = sweepAndInjectMissingLayoutBadges;

function updateLayoutBadgeInDom(code, exact) {
  const sBadge = formatLayoutStatusBadge(exact.status);
  if (!sBadge) return;

  // Atualiza os badges na tabela (garantindo que fique sempre embaixo do número)
  document.querySelectorAll(`.btn-open-layout.table-layout-link[data-layout-code="${code}"]`).forEach(link => {
    link.dataset.layoutId = exact.id || '';
    const parentContainer = link.parentElement;
    if (parentContainer) {
      parentContainer.classList.add('table-layout-cell-wrapper');
      parentContainer.style.display = 'flex';
      parentContainer.style.flexDirection = 'column';
      parentContainer.style.alignItems = 'flex-start';
      parentContainer.style.gap = '3px';
      let existingBadge = parentContainer.querySelector('.badge-layout-status');
      if (existingBadge) {
        existingBadge.className = `badge-layout-status ${sBadge.className}`;
        existingBadge.style.fontSize = '9.5px';
        existingBadge.style.padding = '1px 5px';
        existingBadge.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        existingBadge.innerHTML = `${sBadge.icon} ${sBadge.label}`;
      } else {
        const span = document.createElement('span');
        span.className = `badge-layout-status ${sBadge.className}`;
        span.style.fontSize = '9.5px';
        span.style.padding = '1px 5px';
        span.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        span.innerHTML = `${sBadge.icon} ${sBadge.label}`;
        parentContainer.appendChild(span);
      }
    }
  });

  // Atualiza também nos cards de Kanban
  document.querySelectorAll(`.kanban-layout-link[data-layout-code="${code}"]`).forEach(link => {
    link.dataset.layoutId = exact.id || '';
    const parentContainer = link.parentElement;
    if (parentContainer) {
      let existingBadge = parentContainer.querySelector('.badge-layout-status');
      if (existingBadge) {
        existingBadge.className = `badge-layout-status ${sBadge.className}`;
        existingBadge.style.fontSize = '8.5px';
        existingBadge.style.padding = '1px 4px';
        existingBadge.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        existingBadge.innerHTML = `${sBadge.icon} ${sBadge.label}`;
      } else {
        const span = document.createElement('span');
        span.className = `badge-layout-status ${sBadge.className}`;
        span.style.fontSize = '8.5px';
        span.style.padding = '1px 4px';
        span.title = `Status do Layout no Importer Ultra: ${sBadge.label}`;
        span.innerHTML = `${sBadge.icon} ${sBadge.label}`;
        parentContainer.appendChild(span);
      }
    }
  });

  // Se o drawer estiver aberto com este chamado/layout, atualiza o campo e o header meta
  if (selectedTicket) {
    const curInfo = getTicketLayoutInfo(selectedTicket);
    if (curInfo && String(curInfo.code).trim() === String(code).trim()) {
      renderDrawerLayoutField(exact.id, exact.code, exact.name, exact.status);
      renderDrawerHeaderMetaAndTitle(selectedTicket, exact.status);
    }
  }
}

async function resolveMissingLayoutStatuses() {
  if (!window.conciliadorAPI?.searchLayouts) return;
  const demands = window.appStore?.demands || [];
  const missingItems = new Map();

  // Prioriza chamados na ordem inversa (mais recentes primeiro)
  demands.slice().reverse().forEach(d => {
    const info = getTicketLayoutInfo(d);
    if (info && info.code) {
      const codeStr = String(info.code).trim();
      const cached = layoutCodeToIdCache.get(codeStr);
      if (!cached || !cached.status) {
        if (!resolvingLayoutCodes.has(codeStr)) {
          missingItems.set(codeStr, { code: codeStr, name: info.name || d.title || '' });
        }
      }
    }
  });

  if (missingItems.size === 0) {
    sweepAndInjectMissingLayoutBadges();
    return;
  }

  const itemsToFetch = Array.from(missingItems.values());
  for (const item of itemsToFetch) {
    resolvingLayoutCodes.add(item.code);
  }

  // Resolve um a um com pequeno intervalo seguro para nunca tomar 429
  for (const item of itemsToFetch) {
    const code = item.code;
    const name = item.name;
    try {
      let res = await window.conciliadorAPI.searchLayouts(code, 5);
      let items = res?.data || (Array.isArray(res) ? res : []);
      let exact = items.find(l => String(l.code != null ? l.code : '').trim() === String(code).trim());

      if (!exact && name) {
        const cleanNameSearch = name.replace(/^[\s\-_:\d]+/, '').split(/[-–—/]/)[0].trim();
        if (cleanNameSearch.length >= 3) {
          const resByName = await window.conciliadorAPI.searchLayouts(cleanNameSearch, 10);
          const itemsByName = resByName?.data || (Array.isArray(resByName) ? resByName : []);
          exact = itemsByName.find(l => String(l.code != null ? l.code : '').trim() === String(code).trim());
        }
      }

      if (exact) {
        const resolvedStatus = exact.status || 'published';
        const resolvedObj = { ...exact, status: resolvedStatus };
        registerLayoutInCache(resolvedObj);
        updateLayoutBadgeInDom(code, resolvedObj);
      } else {
        const draftObj = { code, name, status: 'draft' };
        registerLayoutInCache(draftObj);
        updateLayoutBadgeInDom(code, draftObj);
      }
    } catch (e) {
      const draftObj = { code, name, status: 'draft' };
      registerLayoutInCache(draftObj);
      updateLayoutBadgeInDom(code, draftObj);
    } finally {
      resolvingLayoutCodes.delete(code);
    }

    // Pequena pausa (120ms) anti-throttler para proteção
    await new Promise(r => setTimeout(r, 120));
  }

  persistLayoutCache();
  sweepAndInjectMissingLayoutBadges();
}
window.resolveMissingLayoutStatuses = resolveMissingLayoutStatuses;

function resolveLayoutId(layoutId, layoutCode) {
  if (layoutId) {
    if (layoutCode) {
      registerLayoutInCache({ id: layoutId, code: layoutCode });
    }
    return String(layoutId);
  }
  if (!layoutCode) return null;
  const codeStr = String(layoutCode).trim();
  
  if (layoutCodeToIdCache.has(codeStr)) {
    return layoutCodeToIdCache.get(codeStr).id;
  }
  
  const allDemands = window.appStore?.demands || [];
  for (const d of allDemands) {
    const info = getTicketLayoutInfo(d);
    if (info.id && info.code && String(info.code).trim() === codeStr) {
      registerLayoutInCache({ id: info.id, code: info.code, name: info.name, status: info.status });
      return String(info.id);
    }
  }
  return null;
}

// Abre a página do Layout no Importer Ultra (https://importer.conciliadorcontabil.com.br/support/layouts/:id)
async function openLayoutInImporter(layoutId, layoutCode) {
  let targetId = resolveLayoutId(layoutId, layoutCode);

  // Se não temos o ID e temos o código numérico/alfanumérico, buscar via API de suporte
  if (!targetId && layoutCode && window.conciliadorAPI?.searchLayouts) {
    try {
      if (typeof showToast === 'function') {
        showToast(`Localizando link do Layout ${layoutCode}...`, 'info');
      }
      const res = await window.conciliadorAPI.searchLayouts(String(layoutCode), 15);
      const items = res?.data || [];
      const codeStr = String(layoutCode).trim();
      const exact = items.find(l => String(l.code != null ? l.code : '').trim() === codeStr) || items[0];
      if (exact && exact.id) {
        targetId = String(exact.id);
        registerLayoutInCache(exact);
      }
    } catch (e) {
      console.warn('Erro ao buscar ID do layout via API:', e);
    }
  }

  if (targetId) {
    const url = `https://importer.conciliadorcontabil.com.br/support/layouts/${targetId}`;
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  } else {
    showAppAlert(`Não foi possível localizar o link do Layout ${layoutCode ? '#' + layoutCode : ''} no Importer Ultra. Verifique se o layout está cadastrado no sistema.`, 'Layout no Importer', 'warning');
  }
}
window.openLayoutInImporter = openLayoutInImporter;

// Helper: Buscar chamados abertos que compartilham o mesmo layout
function getOpenTicketsWithSameLayout(targetLayoutCode, targetLayoutId, excludeTicketId = null) {
  if (!targetLayoutCode && !targetLayoutId) return [];
  const allDemands = window.appStore?.demands || [];
  const closedStatuses = ['closed', 'done', 'finished', 'completed', 'concluido', 'finalizado'];

  return allDemands.filter(t => {
    if (excludeTicketId && t.id === excludeTicketId) return false;
    const s = (t.status || '').toLowerCase();
    if (closedStatuses.includes(s)) return false; // Apenas chamados ABERTOS!

    const info = getTicketLayoutInfo(t);
    if (targetLayoutId && info.id && info.id === targetLayoutId) return true;
    if (targetLayoutCode && info.code && String(info.code).trim() === String(targetLayoutCode).trim()) return true;
    return false;
  });
}

// Renderiza a seção de chamados com o mesmo layout no Drawer
function renderSameLayoutTickets(ticket) {
  const card = document.getElementById('drawerSameLayoutCard');
  const content = document.getElementById('drawerSameLayoutContent');
  const countBadge = document.getElementById('drawerSameLayoutCountBadge');
  const titleEl = document.getElementById('drawerSameLayoutCardTitle');
  if (!card || !content) return;

  const layoutInfo = getTicketLayoutInfo(ticket);
  if (!layoutInfo.code && !layoutInfo.id) {
    card.style.display = 'none';
    return;
  }

  const openTickets = getOpenTicketsWithSameLayout(layoutInfo.code, layoutInfo.id, ticket.id);
  card.style.display = 'block';

  if (titleEl) {
    const lId = resolveLayoutId(layoutInfo.id, layoutInfo.code);
    titleEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; width: 100%;">
        <span>📐 Chamados Abertos com o Layout ${layoutInfo.code || ''} ${layoutInfo.name ? '(' + escapeHtml(layoutInfo.name) + ')' : ''}</span>
        <a href="#" class="btn-open-layout btn-same-layout-open" data-layout-id="${lId || ''}" data-layout-code="${layoutInfo.code || ''}" title="Abrir Layout ${layoutInfo.code || ''} no Importer Ultra" style="color: #34d399; font-size: 11px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); cursor: pointer;">
          <span>Abrir Layout no Importer</span> ↗
        </a>
      </div>
    `;
    titleEl.querySelector('.btn-same-layout-open')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLayoutInImporter(lId, layoutInfo.code);
    });
  }

  if (openTickets.length === 0) {
    card.classList.remove('has-conflicts');
    if (countBadge) {
      countBadge.textContent = 'Exclusivo';
      countBadge.className = 'badge';
      countBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      countBadge.style.color = '#34d399';
    }
    content.innerHTML = `
      <div class="same-layout-empty">
        <span>✅</span>
        <span>Nenhum outro chamado aberto para este layout. O responsável atual tem exclusividade.</span>
      </div>
    `;
    return;
  }

  // Se houver chamados abertos: ALERTA DE CONFLITO / TRABALHO SIMULTÂNEO
  card.classList.add('has-conflicts');
  if (countBadge) {
    countBadge.textContent = `${openTickets.length} em aberto`;
    countBadge.className = 'badge';
    countBadge.style.background = 'rgba(245, 158, 11, 0.25)';
    countBadge.style.color = '#fbbf24';
  }

  content.innerHTML = `
    <div style="font-size: 11.5px; color: #fbbf24; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
      <span>⚠️</span>
      <span><strong>Atenção:</strong> Existem <strong>${openTickets.length}</strong> outro(s) chamado(s) em aberto para o mesmo layout! Verifique quem está atuando:</span>
    </div>
    <div class="same-layout-list">
      ${openTickets.map(ot => {
        const devName = ot.assignedTo?.name || 'Não atribuído';
        const initials = devName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const reqName = ot.requestedBy?.name || 'Solicitante não informado';
        return `
          <div class="same-layout-item" data-ticket-id="${ot.id}" title="Clique para abrir e ver este chamado">
            <div class="same-layout-main">
              <span class="same-layout-num">#${ot.number}</span>
              <span class="same-layout-title">${escapeHtml(ot.title)}</span>
            </div>
            <div class="same-layout-meta">
              <span class="same-layout-dev" title="Desenvolvedor responsável">
                <span class="same-layout-dev-avatar">${initials}</span>
                <span>${escapeHtml(devName)}</span>
              </span>
              ${getStatusBadgeHtml(ot.status)}
              <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap;" title="Solicitante">👤 ${escapeHtml(reqName)}</span>
              <button type="button" class="icon-btn-ghost btn-open-same-layout" data-id="${ot.id}" style="padding: 2px 6px; font-size: 11px;" title="Abrir Demanda">
                ➔
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach click listeners to open that ticket
  content.querySelectorAll('.same-layout-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const tId = item.dataset.ticketId;
      const target = window.appStore.demands.find(d => d.id === tId);
      if (target) {
        openDemandDrawer(target);
      }
    });
  });
}

// Verifica e alerta chamados abertos no Modal de Novo Chamado
function checkNewTicketLayoutConflicts(targetLayoutCode, targetLayoutId) {
  const alertBox = document.getElementById('newTicketSameLayoutAlert');
  if (!alertBox) return;

  if (!targetLayoutCode && !targetLayoutId) {
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';
    return;
  }

  const openTickets = getOpenTicketsWithSameLayout(targetLayoutCode, targetLayoutId, null);
  if (openTickets.length === 0) {
    alertBox.style.display = 'block';
    alertBox.style.background = 'rgba(16, 185, 129, 0.08)';
    alertBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    alertBox.innerHTML = `
      <div style="font-size: 12px; color: #34d399; display: flex; align-items: center; gap: 6px;">
        <span>✓</span> <span>Nenhum chamado em aberto para o Layout ${escapeHtml(String(targetLayoutCode || ''))}.</span>
      </div>
    `;
    return;
  }

  alertBox.style.display = 'block';
  alertBox.style.background = 'rgba(245, 158, 11, 0.12)';
  alertBox.style.borderColor = 'rgba(245, 158, 11, 0.45)';
  alertBox.innerHTML = `
    <div class="new-ticket-alert-header">
      <span>⚠️</span>
      <span>Atenção: Já existe(m) ${openTickets.length} chamado(s) aberto(s) com este Layout!</span>
    </div>
    <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px;">
      Quem está com chamado aberto deste layout:
    </div>
    <div style="display: flex; flex-direction: column; gap: 5px;">
      ${openTickets.map(ot => {
        const devName = ot.assignedTo?.name || 'Não atribuído';
        return `
          <div class="new-ticket-alert-item">
            <div>
              <strong style="color: #38bdf8;">#${ot.number}</strong>
              <span style="margin-left: 6px; color: #f3f4f6;">${escapeHtml(ot.title)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #a5b4fc; font-weight: 600;">Dev: ${escapeHtml(devName)}</span>
              ${getStatusBadgeHtml(ot.status)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

