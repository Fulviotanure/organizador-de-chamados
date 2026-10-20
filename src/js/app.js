// Main Application Controller
let selectedTicket = null;
let autoSyncTimerId = null;

// Create Ticket, Calendar & Attachment State
let newTicketSelectedFiles = [];
let newTicketSelectedLabels = new Set();
let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth();
let calSelectedDate = null;
let currentCalDevId = null;
let commonCalCurrentYear = new Date().getFullYear();
let commonCalCurrentMonth = new Date().getMonth();
let commonCalSelectedDate = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupWindowControls();
  setupAutoUpdaterRenderer();
  await initApplication();
  setupEventListeners();
});

// Setup custom frameless window titlebar controls
function setupWindowControls() {
  const btnMin = document.getElementById('btnMinimize');
  const btnMax = document.getElementById('btnMaximize');
  const btnClose = document.getElementById('btnClose');

  if (window.electronAPI) {
    btnMin?.addEventListener('click', () => window.electronAPI.minimize());
    btnMax?.addEventListener('click', () => window.electronAPI.maximize());
    btnClose?.addEventListener('click', () => window.electronAPI.close());
  }
}

// Auto-updater UI integration (GitHub Releases)
function setupAutoUpdaterRenderer() {
  if (!window.electronAPI) return;

  if (window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then(v => {
      const verEl = document.getElementById('appVersionLabel');
      if (verEl && v) verEl.textContent = `Versão v${v}`;
    });
  }

  if (window.electronAPI.onUpdaterStatus) {
    window.electronAPI.onUpdaterStatus(data => {
      const banner = document.getElementById('updateBanner');
      const text = document.getElementById('updateBannerText');
      const btnRestart = document.getElementById('btnRestartUpdate');
      if (!banner || !text) return;

      if (data.status === 'checking') {
        banner.style.display = 'inline-flex';
        text.textContent = 'Verificando atualizações...';
        if (btnRestart) btnRestart.style.display = 'none';
      } else if (data.status === 'available') {
        banner.style.display = 'inline-flex';
        text.textContent = `Nova versão ${data.version ? 'v' + data.version : ''} encontrada! Baixando...`;
        if (btnRestart) btnRestart.style.display = 'none';
      } else if (data.status === 'downloading') {
        banner.style.display = 'inline-flex';
        text.textContent = `Baixando atualização: ${data.percent}%`;
        if (btnRestart) btnRestart.style.display = 'none';
      } else if (data.status === 'downloaded') {
        banner.style.display = 'inline-flex';
        text.textContent = `Versão ${data.version ? 'v' + data.version : ''} pronta para instalar!`;
        if (btnRestart) {
          btnRestart.style.display = 'inline-block';
          btnRestart.onclick = () => window.electronAPI.restartAndInstallUpdate();
        }
      } else if (data.status === 'not-available') {
        banner.style.display = 'inline-flex';
        text.textContent = 'Organizador de Chamados já está na versão mais recente.';
        if (btnRestart) btnRestart.style.display = 'none';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
      } else if (data.status === 'error') {
        console.warn('Updater status:', data.message);
        banner.style.display = 'inline-flex';
        text.textContent = data.message || 'Erro ao verificar atualizações';
        if (btnRestart) btnRestart.style.display = 'none';
        setTimeout(() => { banner.style.display = 'none'; }, 6000);
      }
    });
  }

  document.getElementById('btnCheckUpdates')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnCheckUpdates');
    const banner = document.getElementById('updateBanner');
    const text = document.getElementById('updateBannerText');
    if (btn) btn.innerHTML = '<span>⏳</span> Checando...';
    if (banner && text) {
      banner.style.display = 'inline-flex';
      text.textContent = 'Buscando atualizações no GitHub...';
    }
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (btn) btn.innerHTML = '<span>🔄</span> Atualizar';
      if (res && !res.success) {
        if (banner && text) {
          text.textContent = res.error || 'Não foi possível verificar atualizações no momento.';
          setTimeout(() => { banner.style.display = 'none'; }, 6000);
        }
      }
    } catch (e) {
      if (btn) btn.innerHTML = '<span>🔄</span> Atualizar';
      if (banner && text) {
        text.textContent = e.message || 'Erro ao checar atualizações';
        setTimeout(() => { banner.style.display = 'none'; }, 6000);
      }
    }
  });
}

// App Initialization
async function initApplication() {
  await window.appStore.init();

  // Check login
  if (!window.appStore.token) {
    // If we have saved credentials, try auto-login
    if (window.appStore.savedCredentials) {
      try {
        await doLogin(window.appStore.savedCredentials.email, window.appStore.savedCredentials.password, true);
        return;
      } catch (e) {
        console.warn('Auto-login failed, showing login screen:', e);
      }
    }
    showLoginOverlay();
  } else {
    updateUserProfileUI();
    renderFixedFiltersList();
    populateDeveloperSelects();

    // Render cached demands immediately for instant UI
    if (window.appStore.demands && window.appStore.demands.length > 0) {
      renderDemands();
    }

    // Now sync fresh data from API
    syncDemands();
  }

  setupAutoRefresh();
}

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    const emailInput = document.getElementById('loginEmail');
    const pwdInput = document.getElementById('loginPassword');
    if (window.appStore && window.appStore.savedCredentials) {
      if (emailInput && !emailInput.value) {
        emailInput.value = window.appStore.savedCredentials.email || '';
      }
    }
    if (pwdInput && !pwdInput.value && emailInput?.value) {
      pwdInput.focus();
    } else if (emailInput && !emailInput.value) {
      emailInput.focus();
    }
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function doLogin(email, password, remember = true) {
  const errBox = document.getElementById('loginErrorMessage');
  const btnSubmit = document.getElementById('btnLoginSubmit');
  if (btnSubmit) btnSubmit.innerText = 'Autenticando...';
  if (errBox) errBox.style.display = 'none';

  try {
    const data = await window.conciliadorAPI.login(email, password);
    const creds = remember ? { email, password } : null;
    await window.appStore.saveAuth(data.accessToken, data.user, creds);

    hideLoginOverlay();
    updateUserProfileUI();
    renderFixedFiltersList();
    populateDeveloperSelects();
    await syncDemands();
  } catch (err) {
    if (errBox) {
      errBox.innerText = 'Falha ao autenticar: ' + err.message;
      errBox.style.display = 'block';
    }
    showLoginOverlay();
  } finally {
    if (btnSubmit) btnSubmit.innerText = 'Conectar e Carregar Demandas';
  }
}

function updateUserProfileUI() {
  const user = window.appStore.currentUser;
  if (!user) return;

  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl) nameEl.textContent = user.name || user.email;
  if (roleEl) roleEl.textContent = user.role === 'support' ? 'Suporte' : (user.role || 'Usuário');

  if (avatarEl && user.name) {
    const parts = user.name.split(' ');
    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    avatarEl.textContent = initials;
  }
}

// Fetch demands from API and update UI
async function syncDemands() {
  const syncDot = document.getElementById('syncDot');
  const syncText = document.getElementById('syncText');
  const syncIcon = document.getElementById('syncIcon');

  if (syncDot) syncDot.style.backgroundColor = '#f59e0b';
  if (syncText) syncText.textContent = 'Sincronizando...';
  if (syncIcon) syncIcon.style.display = 'inline-block';

  try {
    const res = await window.conciliadorAPI.fetchAllDemands(500);
    const previousCount = window.appStore.demands.length;
    await window.appStore.setDemands(res.demands);

    // Synchronize product list from server
    try {
      const apiProds = await window.conciliadorAPI.fetchProducts();
      if (Array.isArray(apiProds) && apiProds.length > 0) {
        window.appStore.setProducts(apiProds);
      }
    } catch (e) {
      // Non-fatal, store default products remain active
    }

    // Notify if new demands found
    if (previousCount > 0 && res.demands.length > previousCount && window.electronAPI) {
      const diff = res.demands.length - previousCount;
      window.electronAPI.showNotification(
        'Novas Demandas Recebidas',
        `${diff} nova(s) demanda(s) foram adicionadas ao Conciliador.`
      );
    }

    if (syncDot) syncDot.style.backgroundColor = 'var(--status-progress)';
    if (syncText) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      syncText.textContent = `Atualizado às ${timeStr}`;
    }

    populateDeveloperSelects();
    renderFixedFiltersList();
    renderDemands();
  } catch (err) {
    console.error('Error syncing demands:', err);
    if (err.message === 'UNAUTHORIZED') {
      showLoginOverlay();
    } else {
      if (syncDot) syncDot.style.backgroundColor = 'var(--status-error)';
      if (syncText) syncText.textContent = 'Erro ao sincronizar';
    }
  }
}

// Populate developer dropdowns dynamically from ticket data
function populateDeveloperSelects() {
  const devs = new Set();
  window.appStore.demands.forEach(t => {
    if (t.assignedTo && t.assignedTo.name) {
      devs.add(t.assignedTo.name);
    }
  });

  const quickDevSelect = document.getElementById('quickSelectDev');
  const modalDevSelect = document.getElementById('modalFilterDev');

  const sortedDevs = Array.from(devs).sort();

  if (quickDevSelect) {
    const currentVal = quickDevSelect.value;
    quickDevSelect.innerHTML = '<option value="all">Qualquer Responsável</option>';
    sortedDevs.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev;
      opt.textContent = dev;
      quickDevSelect.appendChild(opt);
    });
    quickDevSelect.value = currentVal || 'all';
  }

  if (modalDevSelect) {
    modalDevSelect.innerHTML = `
      <option value="">Qualquer Desenvolvedor</option>
      <option value="CURRENT_USER">👤 Eu mesmo (Usuário Conectado)</option>
    `;
    sortedDevs.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev;
      opt.textContent = dev;
      modalDevSelect.appendChild(opt);
    });
  }

  populateLabelSelects();
}

// Populate label dropdowns dynamically from ticket data & master definitions
function populateLabelSelects() {
  const labelsMap = new Map();
  // Ensure DOCUMENTAR is prominently available
  labelsMap.set('DOCUMENTAR', { name: 'DOCUMENTAR', color: '#0891b2' });

  // Add all labels known in store
  const available = window.appStore.getAvailableLabels();
  available.forEach(l => {
    if (l && l.name) {
      labelsMap.set(l.name.toUpperCase(), l);
    }
  });

  const quickLabelSelect = document.getElementById('quickSelectLabel');
  const modalLabelSelect = document.getElementById('modalFilterLabel');

  if (quickLabelSelect) {
    const currentVal = quickLabelSelect.value;
    quickLabelSelect.innerHTML = '<option value="all">🏷️ Todas as Etiquetas</option>';
    Array.from(labelsMap.values()).forEach(lbl => {
      const opt = document.createElement('option');
      opt.value = lbl.name;
      opt.textContent = lbl.name;
      quickLabelSelect.appendChild(opt);
    });
    quickLabelSelect.value = currentVal || 'all';
  }

  if (modalLabelSelect) {
    const currentVal = modalLabelSelect.value;
    modalLabelSelect.innerHTML = '<option value="">Qualquer Etiqueta</option>';
    Array.from(labelsMap.values()).forEach(lbl => {
      const opt = document.createElement('option');
      opt.value = lbl.name;
      opt.textContent = lbl.name;
      modalLabelSelect.appendChild(opt);
    });
    modalLabelSelect.value = currentVal || '';
  }
}

// Render fixed filter tabs in the left sidebar
function renderFixedFiltersList() {
  const container = document.getElementById('fixedFiltersList');
  if (!container) return;

  container.innerHTML = '';
  const filters = window.appStore.fixedFilters;
  const activeId = window.appStore.activeFilterId;

  // Update total stat
  const statTotal = document.getElementById('statTotalCount');
  if (statTotal) statTotal.textContent = window.appStore.demands.length;

  // Show/hide restore default filters button if any default is missing
  const btnRestore = document.getElementById('btnRestoreDefaultFilters');
  if (btnRestore) {
    btnRestore.style.display = window.appStore.hasMissingDefaultFilters() ? 'inline-flex' : 'none';
  }

  filters.forEach(f => {
    const count = window.appStore.countForFilter(f);
    const item = document.createElement('div');
    item.className = `filter-item ${f.id === activeId ? 'active' : ''}`;
    item.dataset.id = f.id;

    const canDeleteOrEdit = (f.id !== 'all');

    item.innerHTML = `
      <div class="filter-item-left">
        <span class="filter-icon">${f.icon || '🎯'}</span>
        <span class="filter-name" title="${f.name}">${f.name}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="filter-badge">${count}</span>
        ${canDeleteOrEdit ? `
          <div class="filter-actions">
            <button class="filter-action-btn btn-edit-filter" title="Editar Filtro">✏️</button>
            <button class="filter-action-btn btn-delete-filter" title="Apagar Filtro">🗑️</button>
          </div>
        ` : ''}
      </div>
    `;

    // Click to activate filter
    item.addEventListener('click', (e) => {
      if (e.target.closest('.filter-action-btn')) return;
      window.appStore.activeFilterId = f.id;
      renderFixedFiltersList();
      renderDemands();
    });

    // Delete filter
    const btnDel = item.querySelector('.btn-delete-filter');
    if (btnDel) {
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Deseja realmente apagar o filtro "${f.name}"?`)) {
          await window.appStore.deleteFixedFilter(f.id);
          renderFixedFiltersList();
          renderDemands();
        }
      });
    }

    // Edit filter
    const btnEdit = item.querySelector('.btn-edit-filter');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditFilterModal(f);
      });
    }

    container.appendChild(item);
  });
}

// Render active filter title, count, and demands list/kanban
function renderDemands() {
  const activePreset = window.appStore.fixedFilters.find(f => f.id === window.appStore.activeFilterId) || window.appStore.fixedFilters[0];
  const filteredDemands = window.appStore.getFilteredDemands();

  // Header update
  const titleEl = document.getElementById('activeFilterTitle');
  const iconEl = document.getElementById('activeFilterIcon');
  const countEl = document.getElementById('activeFilterCount');

  if (titleEl) titleEl.textContent = activePreset.name;
  if (iconEl) iconEl.textContent = activePreset.icon || '⚡';
  if (countEl) countEl.textContent = `${filteredDemands.length} de ${window.appStore.demands.length}`;

  if (window.appStore.activeView === 'table') {
    document.getElementById('tableViewContainer').style.display = 'block';
    document.getElementById('kanbanViewContainer').style.display = 'none';
    renderTableView(filteredDemands);
  } else {
    document.getElementById('tableViewContainer').style.display = 'none';
    document.getElementById('kanbanViewContainer').style.display = 'flex';
    renderKanbanView(filteredDemands);
  }
}

// Render Table View
function renderTableView(demands) {
  const tbody = document.getElementById('demandsTableBody');
  if (!tbody) return;

  updateSortIndicators();

  if (demands.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Nenhuma demanda encontrada com os critérios e filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = demands.map(t => {
    const isFav = window.appStore.isFavorite(t.id);
    const isIgnored = window.appStore.isIgnored(t.id);
    const typeBadge = getTypeBadgeHtml(t.ticketType?.name);
    const statusBadge = getStatusBadgeHtml(t.status);
    const layoutCode = t.layout?.code || (typeof t.layout === 'number' || typeof t.layout === 'string' ? t.layout : null);
    const dateBadge = renderDateBadge(t.deliveryDueDate || t.clientDueDate);
    const createdStr = formatCreatedAt(t.createdAt);

    return `
      <tr data-id="${t.id}" class="${isIgnored ? 'row-ignored' : ''}">
        <td style="text-align: center;">
          <span class="favorite-star ${isFav ? 'active' : ''}" data-fav-id="${t.id}">${isFav ? '★' : '☆'}</span>
        </td>
        <td style="font-weight: 700; color: var(--accent-primary);">#${t.number || '-'}</td>
        <td style="color: #c084fc; font-weight: 600; font-size: 13px;">
          ${layoutCode ? `<span title="Layout ${layoutCode}">${layoutCode}</span>` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          <div class="table-cell-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
          ${getLabelsBadgesHtml(t.labels) ? `<div class="table-cell-labels">${getLabelsBadgesHtml(t.labels)}</div>` : ''}
        </td>
        <td>
          ${t.movideskTicketId ? `
            <a href="#" class="btn-open-movi" data-movi="${t.movideskTicketId}" title="Abrir ticket ${t.movideskTicketId} no Movidesk" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
              ${t.movideskTicketId} ↗
            </a>
          ` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          <code style="background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #a5b4fc;">
            ${escapeHtml(t.clientDatabase || '-')}
          </code>
        </td>
        <td>${typeBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(t.assignedTo?.name || 'Não atribuído')}</span>
        </td>
        <td>${dateBadge}</td>
        <td style="font-size: 11px; color: var(--text-muted);">${createdStr}</td>
        <td style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
            <button class="icon-btn-ghost btn-toggle-ignore" data-id="${t.id}" title="${isIgnored ? 'Restaurar chamado (remover de ignorados)' : 'Ignorar chamado (ocultar das listas)'}" style="font-size: 12px;">
              ${isIgnored ? '↩️' : '🚫'}
            </button>
            <button class="icon-btn-ghost btn-quick-autodrive" data-id="${t.id}" title="Enviar dados para o AutoDrive (Layouts)" style="font-size: 12px; color: #58a6ff;">
              🚀
            </button>
            <button class="icon-btn-ghost btn-inspect-demand" data-id="${t.id}" title="Ver detalhes completos">
              👁️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach row click events
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't open if clicked favorite star, ignore button, autodrive button or movidesk link directly
      if (e.target.closest('.favorite-star') || e.target.closest('.btn-open-movi') || e.target.closest('.btn-toggle-ignore') || e.target.closest('.btn-quick-autodrive')) return;
      const ticketId = row.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) openDemandDrawer(ticket);
    });
  });

  // Attach quick AutoDrive button click
  tbody.querySelectorAll('.btn-quick-autodrive').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = btn.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) openAutoDriveModal(ticket);
    });
  });

  // Attach favorite star click
  tbody.querySelectorAll('.favorite-star').forEach(star => {
    star.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = star.dataset.favId;
      const newStatus = await window.appStore.toggleFavorite(id);
      star.className = `favorite-star ${newStatus ? 'active' : ''}`;
      star.textContent = newStatus ? '★' : '☆';
      renderFixedFiltersList(); // update favorite count badge
    });
  });

  // Attach ignore button click
  tbody.querySelectorAll('.btn-toggle-ignore').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await window.appStore.toggleIgnore(id);
      renderFixedFiltersList();
      renderDemands();
    });
  });

  // Attach movidesk link click (opens conciliador-contabil2 in external browser)
  tbody.querySelectorAll('.btn-open-movi').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const moviId = link.dataset.movi;
      if (window.electronAPI) {
        window.electronAPI.openExternal(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${moviId}`);
      }
    });
  });
}


// Render Kanban View
function renderKanbanView(demands) {
  const container = document.getElementById('kanbanViewContainer');
  if (!container) return;

  const columns = [
    { id: 'queued', title: 'Na Fila', color: 'var(--status-queue)', statusMatch: ['queued'] },
    { id: 'in_progress', title: 'Em Progresso', color: 'var(--status-progress)', statusMatch: ['in_progress', 'progress'] },
    { id: 'waiting', title: 'Aguardando N2', color: 'var(--status-waiting)', statusMatch: ['waiting', 'waiting_creator', 'waiting_requester'] },
    { id: 'review', title: 'Em Revisão', color: 'var(--status-review)', statusMatch: ['review'] },
    { id: 'closed', title: 'Concluído', color: 'var(--status-closed)', statusMatch: ['done', 'closed', 'completed', 'finished', 'concluido', 'finalizado'] }
  ];

  container.innerHTML = columns.map(col => {
    const colDemands = demands.filter(d => {
      const s = (d.status || '').toLowerCase();
      return col.statusMatch.some(sm => s.includes(sm));
    });

    const cardsHtml = colDemands.map(t => {
      const typeBadge = getTypeBadgeHtml(t.ticketType?.name);
      const isFav = window.appStore.isFavorite(t.id);
      const isIgnored = window.appStore.isIgnored(t.id);
      const layoutCode = t.layout?.code || (typeof t.layout === 'number' || typeof t.layout === 'string' ? t.layout : null);
      const dateBadge = renderDateBadge(t.deliveryDueDate || t.clientDueDate);
      const initials = t.assignedTo?.name ? t.assignedTo.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';

      return `
        <div class="kanban-card" data-id="${t.id}">
          <div class="kanban-card-header">
            <span class="kanban-card-number">#${t.number}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${layoutCode ? `<span style="font-size: 11px; color: #c084fc; font-weight: 600;">${layoutCode}</span>` : ''}
              ${typeBadge}
              ${isFav ? '<span style="color: #fbbf24; font-size: 11px;">★</span>' : ''}
            </div>
          </div>
          <div class="kanban-card-title">${escapeHtml(t.title)}</div>
          ${getLabelsBadgesHtml(t.labels) ? `<div class="kanban-card-labels">${getLabelsBadgesHtml(t.labels)}</div>` : ''}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-size: 11px; color: #a5b4fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              📦 ${escapeHtml(t.clientDatabase || 'Sem banco')}
            </div>
            <div>${dateBadge}</div>
          </div>
          <div class="kanban-card-footer">
            <div class="kanban-card-dev" title="${escapeHtml(t.assignedTo?.name || 'Não atribuído')}">
              <div class="kanban-dev-avatar">${initials}</div>
              <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(t.assignedTo?.name || 'Não atribuído')}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              ${t.movideskTicketId ? `<span style="color: #38bdf8; font-weight: 600;">#${t.movideskTicketId}</span>` : ''}
              <button class="icon-btn-ghost btn-kanban-autodrive" data-id="${t.id}" title="Enviar para o AutoDrive (Layouts)" style="font-size: 11px; padding: 2px; color: #58a6ff;">
                🚀
              </button>
              <button class="icon-btn-ghost btn-kanban-ignore" data-id="${t.id}" title="${isIgnored ? 'Restaurar' : 'Ignorar'}" style="font-size: 11px; padding: 2px;">
                ${isIgnored ? '↩️' : '🚫'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');


    return `
      <div class="kanban-column">
        <div class="kanban-column-header">
          <div class="kanban-col-title">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${col.color};"></span>
            <span>${col.title}</span>
          </div>
          <span class="kanban-col-count">${colDemands.length}</span>
        </div>
        <div class="kanban-cards-container">
          ${cardsHtml.length > 0 ? cardsHtml : '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Vazio</div>'}
        </div>
      </div>
    `;
  }).join('');

  // Click card to open drawer
  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-kanban-ignore') || e.target.closest('.btn-kanban-autodrive')) return;
      const ticketId = card.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) openDemandDrawer(ticket);
    });
  });

  // Kanban AutoDrive button
  container.querySelectorAll('.btn-kanban-autodrive').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = btn.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) openAutoDriveModal(ticket);
    });
  });

  // Kanban ignore button
  container.querySelectorAll('.btn-kanban-ignore').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await window.appStore.toggleIgnore(id);
      renderFixedFiltersList();
      renderDemands();
    });
  });
}


// Helpers for Badges & HTML
function getLabelsBadgesHtml(labels) {
  if (!labels || !Array.isArray(labels) || labels.length === 0) return '';
  return labels.map(item => {
    const l = item.label || item;
    if (!l || !l.name) return '';
    const color = l.color || '#8b5cf6';
    return `<span class="label-badge-pill" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}55;" title="Etiqueta: ${escapeHtml(l.name)}">
      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${color}; margin-right: 4px;"></span>
      ${escapeHtml(l.name)}
    </span>`;
  }).filter(Boolean).join('');
}

function getTypeBadgeHtml(typeName) {
  if (!typeName) return '<span class="badge" style="background: rgba(255,255,255,0.08);">Outro</span>';
  const lower = typeName.toLowerCase();
  if (lower.includes('layout')) return `<span class="badge badge-layout">${typeName}</span>`;
  if (lower.includes('inclus')) return `<span class="badge badge-inclusion">${typeName}</span>`;
  if (lower.includes('erro')) return `<span class="badge badge-error">⚠️ ${typeName}</span>`;
  if (lower.includes('migra')) return `<span class="badge badge-migration">${typeName}</span>`;
  return `<span class="badge badge-layout">${typeName}</span>`;
}

function getStatusBadgeHtml(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('queue')) {
    return `<span class="badge badge-status-queued"><span class="badge-dot" style="background: var(--status-queue);"></span>Na Fila</span>`;
  }
  if (s.includes('progress')) {
    return `<span class="badge badge-status-progress"><span class="badge-dot" style="background: var(--status-progress);"></span>Em Progresso</span>`;
  }
  if (s.includes('review')) {
    return `<span class="badge badge-status-review"><span class="badge-dot" style="background: var(--status-review);"></span>Em Revisão</span>`;
  }
  if (s.includes('waiting') || s.includes('requester')) {
    return `<span class="badge badge-status-waiting" title="Aguardando Resposta do N2"><span class="badge-dot" style="background: var(--status-waiting);"></span>Aguardando N2</span>`;
  }
  if (s.includes('done') || s.includes('close') || s.includes('finish') || s.includes('complet')) {
    return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);"><span class="badge-dot" style="background: #10b981;"></span>Concluído</span>`;
  }
  if (s.includes('triage')) {
    return `<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);"><span class="badge-dot" style="background: #a855f7;"></span>Triagem</span>`;
  }
  if (s.includes('pause')) {
    return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.35);"><span class="badge-dot" style="background: #64748b;"></span>Pausado</span>`;
  }
  return `<span class="badge" style="background: var(--bg-surface); color: var(--text-muted);">${status || 'Pendente'}</span>`;
}

// Date Badge with overdue, today, tomorrow detection
function renderDateBadge(dueStr) {
  if (!dueStr) return '<span class="date-badge none">-</span>';
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const dueDay = dueStr.slice(0, 10);
    const dueDate = new Date(dueStr);
    const dFormatted = dueDate.toLocaleDateString('pt-BR');

    if (dueDate < now && dueDay !== todayStr) {
      return `<span class="date-badge overdue" title="Prazo vencido em ${dFormatted}">⚠️ Atrasado (${dFormatted.slice(0, 5)})</span>`;
    }
    if (dueDay === todayStr) {
      return `<span class="date-badge today" title="Prazo para hoje!">🟡 Hoje (${dFormatted.slice(0, 5)})</span>`;
    }
    if (dueDay === tomorrowStr) {
      return `<span class="date-badge tomorrow" title="Prazo para amanhã">🟠 Amanhã (${dFormatted.slice(0, 5)})</span>`;
    }
    return `<span class="date-badge future" title="Prazo: ${dFormatted}">📅 ${dFormatted}</span>`;
  } catch (e) {
    return `<span class="date-badge future">${dueStr}</span>`;
  }
}

function formatCreatedAt(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('pt-BR');
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<span title="Criado em ${dateFormatted} às ${timeFormatted}">${dateFormatted}</span>`;
  } catch (e) {
    return '-';
  }
}

function updateSortIndicators() {
  const currentSort = window.appStore.sortBy;
  const sortMap = {
    'number_asc': { id: 'sortInd_number', icon: '▲' },
    'number_desc': { id: 'sortInd_number', icon: '▼' },
    'deliveryDueDate_asc': { id: 'sortInd_deliveryDueDate', icon: '▲' },
    'deliveryDueDate_desc': { id: 'sortInd_deliveryDueDate', icon: '▼' },
    'createdAt_asc': { id: 'sortInd_createdAt', icon: '▲' },
    'createdAt_desc': { id: 'sortInd_createdAt', icon: '▼' },
  };

  ['sortInd_number', 'sortInd_layout', 'sortInd_deliveryDueDate', 'sortInd_createdAt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  if (sortMap[currentSort]) {
    const item = sortMap[currentSort];
    const el = document.getElementById(item.id);
    if (el) el.textContent = item.icon;
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Priority Helper & Badges (low, medium, high, urgent matching API enum)
function normalizePriorityToApi(val) {
  if (!val) return 'medium';
  if (typeof val === 'object') {
    val = val.priority || val.name || val.title || val.value || '';
  }
  const s = String(val).toLowerCase().trim();
  if (s === 'urgente' || s === 'urgent') return 'urgent';
  if (s === 'alta' || s === 'high') return 'high';
  if (s === 'baixa' || s === 'low') return 'low';
  if (s === 'normal' || s === 'media' || s === 'média' || s === 'medium') return 'medium';
  return 'medium';
}

function normalizePriority(val) {
  return normalizePriorityToApi(val);
}

function formatPriorityLabel(val) {
  const norm = normalizePriorityToApi(val);
  switch (norm) {
    case 'urgent': return 'Urgente';
    case 'high': return 'Alta';
    case 'low': return 'Baixa';
    case 'medium':
    default: return 'Normal';
  }
}

function getPriorityBadgeHtml(priority) {
  const norm = normalizePriorityToApi(priority);
  switch (norm) {
    case 'urgent':
      return '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5);">🔴 Urgente</span>';
    case 'high':
      return '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">🟠 Alta</span>';
    case 'low':
      return '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.4);">⚪ Baixa</span>';
    case 'medium':
    default:
      return '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">🟢 Normal</span>';
  }
}

function updatePrioritySelectVisual(selectEl) {
  if (!selectEl) return;
  const val = normalizePriorityToApi(selectEl.value);
  selectEl.dataset.priority = val;
}

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

async function downloadAttachmentFile(ticketId, attId, fileName) {
  try {
    const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticketId, attId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'anexo';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    alert('Erro ao baixar anexo: ' + err.message);
  }
}

async function openAttachmentFile(ticketId, attId, fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
    const blobUrl = await getOrFetchAttachmentBlobUrl(ticketId, attId);
    if (blobUrl) {
      openImageLightbox(blobUrl, fileName, ticketId, attId);
      return;
    }
  }
  try {
    const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticketId, attId);
    // Use native desktop application if running in Electron
    if (window.electronAPI && window.electronAPI.openBufferTemp) {
      const buffer = await blob.arrayBuffer();
      const res = await window.electronAPI.openBufferTemp(fileName, buffer);
      if (res && res.success) return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'anexo';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    alert('Erro ao abrir anexo: ' + err.message);
  }
}

function openImageLightbox(blobUrl, fileName, ticketId, attId) {
  const overlay = document.getElementById('imageLightboxOverlay');
  const imgEl = document.getElementById('lightboxImage');
  const nameEl = document.getElementById('lightboxFileName');
  const btnDownload = document.getElementById('btnLightboxDownload');

  if (!overlay || !imgEl) return;

  currentLightboxAttachment = { blobUrl, fileName, ticketId, attId };
  imgEl.src = blobUrl;
  if (nameEl) nameEl.textContent = fileName || 'Visualização da imagem';

  if (btnDownload) {
    btnDownload.onclick = () => {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'imagem.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  }

  overlay.style.display = 'flex';
}

function closeImageLightbox() {
  const overlay = document.getElementById('imageLightboxOverlay');
  if (overlay) overlay.style.display = 'none';
  currentLightboxAttachment = null;
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
  containerEl.innerHTML = formatted;

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

function renderDrawerLabelsPicker() {
  const container = document.getElementById('drawerEditLabelsPicker');
  if (!container) return;

  const labels = window.appStore.getAvailableLabels();
  container.innerHTML = labels.map(l => {
    const isSelected = selectedDrawerLabels.has(l.id);
    const color = l.color || '#6366f1';
    const activeStyle = isSelected
      ? `background: ${color}28; border-color: ${color}; color: ${color}; font-weight: 600; box-shadow: 0 0 8px ${color}33;`
      : `border-color: rgba(255,255,255,0.12); opacity: 0.75;`;

    return `
      <div class="drawer-label-chip ${isSelected ? 'active' : ''}" data-label-id="${l.id}" style="${activeStyle}">
        <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${color}; margin-right: 5px;"></span>
        <span>${escapeHtml(l.name)}</span>
        ${isSelected ? '<span style="margin-left: 5px; font-weight: 800;">✓</span>' : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.drawer-label-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.labelId;
      if (selectedDrawerLabels.has(id)) {
        selectedDrawerLabels.delete(id);
      } else {
        selectedDrawerLabels.add(id);
      }
      renderDrawerLabelsPicker();
    });
  });
}

async function openDemandDrawer(ticket) {
  selectedTicket = ticket;
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('demandDrawer');

  const layoutCode = ticket.layout?.code || (typeof ticket.layout === 'number' || typeof ticket.layout === 'string' ? ticket.layout : null);
  const layoutName = ticket.layout?.name ? ` - ${ticket.layout.name}` : '';
  document.getElementById('drawerDemandNumber').textContent = `#${ticket.number} • ${layoutCode ? 'Layout ' + layoutCode + layoutName : 'Sem Layout'}`;
  document.getElementById('drawerDemandTitle').textContent = ticket.title || '';

  // Badges
  const badgesBox = document.getElementById('drawerBadges');
  if (badgesBox) {
    badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml(ticket.status)} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
  }

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
    let stVal = ticket.status || 'open';
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

  const reviewerEl = document.getElementById('drawerMetaReviewer');
  if (reviewerEl) reviewerEl.textContent = ticket.reviewer?.name || '-';

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

  // Layout fields
  const hiddenLayoutId = document.getElementById('drawerEditLayoutId');
  const layoutSearchInput = document.getElementById('drawerEditLayoutSearch');
  const layoutTagBox = document.getElementById('drawerSelectedLayoutTag');
  const currentLayoutId = ticket.layoutId || ticket.layout?.id || '';
  if (hiddenLayoutId) hiddenLayoutId.value = currentLayoutId;
  if (layoutSearchInput) {
    layoutSearchInput.value = layoutCode ? `${layoutCode}${layoutName}` : '';
  }
  if (layoutTagBox) {
    if (layoutCode) {
      layoutTagBox.innerHTML = `
        <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
          <span>📐 Layout ${layoutCode}${layoutName ? ': ' + escapeHtml(layoutName.replace(/^ - /, '')) : ''}</span>
          <button type="button" id="btnClearDrawerLayout" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 12px; padding: 0;">✕</button>
        </span>
      `;
      layoutTagBox.style.display = 'block';
      document.getElementById('btnClearDrawerLayout')?.addEventListener('click', () => {
        if (hiddenLayoutId) hiddenLayoutId.value = '';
        if (layoutSearchInput) layoutSearchInput.value = '';
        layoutTagBox.innerHTML = '';
        layoutTagBox.style.display = 'none';
      });
    } else {
      layoutTagBox.innerHTML = '';
      layoutTagBox.style.display = 'none';
    }
  }

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

  // Stream & Attachments placeholders
  const streamList = document.getElementById('drawerStreamList');
  if (streamList) {
    streamList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 30px;">Carregando diálogo e histórico...</div>';
  }
  const attachList = document.getElementById('drawerAttachmentsList');
  const attachEmpty = document.getElementById('drawerAttachmentsEmpty');
  if (attachList) attachList.innerHTML = '';
  if (attachEmpty) attachEmpty.style.display = 'block';

  document.getElementById('drawerStreamCountBadge').textContent = '0';
  document.getElementById('streamCountAll').textContent = '0';
  document.getElementById('streamCountComments').textContent = '0';
  document.getElementById('streamCountEvents').textContent = '0';
  document.getElementById('drawerAttachmentsCountBadge').textContent = '0';

  // Status text reset
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText) statusText.textContent = '';

  // Switch to Details tab by default
  switchDrawerTab('details');

  overlay?.classList.add('open');
  drawer?.classList.add('open');

  // Fetch full ticket details asynchronously
  try {
    const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);
    selectedTicket = { ...ticket, ...details };

    // Update layout title if full details have layout name
    const finalLayoutCode = details.layout?.code || layoutCode;
    const finalLayoutName = details.layout?.name ? ` - ${details.layout.name}` : layoutName;
    document.getElementById('drawerDemandNumber').textContent = `#${ticket.number} • ${finalLayoutCode ? 'Layout ' + finalLayoutCode + finalLayoutName : 'Sem Layout'}`;

    if (details.reviewer && reviewerEl) reviewerEl.textContent = details.reviewer.name || '-';
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
      renderAuthenticatedDescription(details.description, ticket.id, descBox);
      const editor = document.getElementById('drawerEditDescEditor');
      if (editor) editor.innerHTML = details.description;
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
    if (descBox) descBox.innerHTML = '<span style="color: var(--status-error);">Não foi possível carregar a descrição completa.</span>';
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

      let contentHtml = c.contentHtml || escapeHtml(c.content || '');
      contentHtml = contentHtml.replace(
        /src="\/api\/v1\//g,
        'src="https://api.importer.conciliadorcontabil.com.br/api/v1/'
      );

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

  if (countBadge) countBadge.textContent = attachments.length;
  if (!list) return;

  if (attachments.length === 0) {
    if (emptyBox) emptyBox.style.display = 'block';
    list.innerHTML = '';
    return;
  }

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

  // Asynchronously load image thumbnails with authentication
  const ticketId = selectedTicket?.id;
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

  // Wire click events
  list.querySelectorAll('.attachment-thumb-wrapper, .btn-view-attachment').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const attId = el.dataset.attId || el.dataset.id;
      const fileName = el.dataset.filename || 'imagem.png';
      if (ticketId && attId) {
        const blobUrl = await getOrFetchAttachmentBlobUrl(ticketId, attId);
        if (blobUrl) {
          openImageLightbox(blobUrl, fileName, ticketId, attId);
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

async function submitComment() {
  if (!selectedTicket) return;
  const textarea = document.getElementById('drawerNewCommentText');
  const statusEl = document.getElementById('commentSendStatus');
  const btn = document.getElementById('btnSubmitComment');

  const content = textarea?.value?.trim();
  if (!content) {
    alert('Por favor, digite uma mensagem para enviar.');
    textarea?.focus();
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = 'Enviando resposta...';

  try {
    await window.conciliadorAPI.addComment(selectedTicket.id, content);
    if (textarea) textarea.value = '';
    if (statusEl) statusEl.textContent = 'Enviado!';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);

    // Refresh ticket details
    const details = await window.conciliadorAPI.fetchDemandDetails(selectedTicket.id);
    selectedTicket = { ...selectedTicket, ...details };
    drawerCurrentComments = details.comments || [];
    drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
    renderDrawerActivityStream();
  } catch (err) {
    console.error('Failed to post comment:', err);
    if (statusEl) statusEl.textContent = 'Erro: ' + err.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveDrawerTicketChanges() {
  if (!selectedTicket) return;

  const btnTop = document.getElementById('btnDrawerSaveTicket');
  const btnBottom = document.getElementById('btnDrawerSaveTicketBottom');
  const statusText = document.getElementById('drawerSaveStatusText');

  const title = document.getElementById('drawerEditTitle')?.value.trim();
  if (!title) {
    alert('O título da demanda não pode ficar vazio.');
    document.getElementById('drawerEditTitle')?.focus();
    return;
  }

  const status = document.getElementById('drawerEditStatus')?.value;
  const assignedToId = document.getElementById('drawerEditAssignedTo')?.value || null;
  const priority = normalizePriorityToApi(document.getElementById('drawerEditPriority')?.value);
  const clientDatabase = document.getElementById('drawerEditDatabase')?.value.trim() || null;
  const movideskRaw = document.getElementById('drawerEditMovidesk')?.value.trim();
  const movideskTicketId = movideskRaw ? parseInt(movideskRaw, 10) : null;
  const layoutId = document.getElementById('drawerEditLayoutId')?.value || null;
  const ticketTypeId = document.getElementById('drawerEditType')?.value || null;
  const productId = document.getElementById('drawerEditProduct')?.value || null;

  const deliveryDueInput = document.getElementById('drawerEditDeliveryDueDate')?.value.trim();
  const clientDueInput = document.getElementById('drawerEditClientDueDate')?.value.trim();

  const deliveryDueDate = parseBrDateToIso(deliveryDueInput);
  const clientDueDate = parseBrDateToIso(clientDueInput);

  const payload = {
    title,
    status,
    priority,
    assignedToId,
    clientDatabase,
    movideskTicketId,
    layoutId,
    typeId: ticketTypeId,
    ticketTypeId,
    productId,
    deliveryDueDate,
    clientDueDate,
    labelIds: Array.from(selectedDrawerLabels)
  };

  // If user opened and edited description
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
    const updated = await window.conciliadorAPI.updateTicket(selectedTicket.id, payload);

    // Update in appStore demands list
    const idx = window.appStore.demands.findIndex(d => d.id === selectedTicket.id);
    if (idx !== -1) {
      const existing = window.appStore.demands[idx];
      const merged = { ...existing, ...updated, ...payload };
      if (assignedToId) {
        const devObj = window.appStore.getKnownDevelopers().find(d => d.id === assignedToId);
        if (devObj) merged.assignedTo = devObj;
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
      window.appStore.demands[idx] = merged;
      await window.appStore.saveDemandsCache();
    }

    selectedTicket = { ...selectedTicket, ...updated, ...payload };

    // Update drawer header and badges
    document.getElementById('drawerDemandTitle').textContent = title;
    const badgesBox = document.getElementById('drawerBadges');
    if (badgesBox) {
      badgesBox.innerHTML = `${getTypeBadgeHtml(selectedTicket.ticketType?.name)} ${getStatusBadgeHtml(selectedTicket.status)} ${getPriorityBadgeHtml(selectedTicket.priority)} ${getLabelsBadgesHtml(selectedTicket.labels)}`;
    }

    // If description was saved, update view box and close editor
    if (payload.description) {
      const descBox = document.getElementById('drawerDescription');
      if (descBox) descBox.innerHTML = payload.description;
      toggleDrawerDescEdit(false);
    }

    // Success feedback
    if (statusText) {
      statusText.style.color = '#10b981';
      statusText.textContent = '✅ Alterações salvas com sucesso!';
      setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
    }

    // Refresh demands board/table so changes reflect instantly
    renderDemands();

    // Fetch refreshed ticket details from backend to pull new events
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
      statusText.textContent = '❌ Erro ao salvar: ' + err.message;
    }
    alert('Erro ao salvar alterações da demanda: ' + err.message);
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
  if (confirm(`Deseja realmente arquivar a demanda #${selectedTicket.number}?`)) {
    try {
      await window.conciliadorAPI.archiveTicket(selectedTicket.id);
      closeDemandDrawer();
      await syncDemands();
    } catch (err) {
      alert('Erro ao arquivar demanda: ' + err.message);
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
  selectedTicket = null;
}

// Drawer Calendars & Pickers

function renderDrawerDeveloperCalendar() {
  const container = document.getElementById('calDrawerDualMonthsContainer');
  const headerNameEl = document.getElementById('calDrawerAgendaHeader');
  const devSelect = document.getElementById('drawerEditAssignedTo');
  const devId = devSelect ? devSelect.value : '';

  const devs = window.appStore.getKnownDevelopers();
  const dev = devs.find(d => d.id === devId);

  if (headerNameEl) {
    headerNameEl.innerHTML = dev ? `Agenda de <strong>${dev.name.split(' ')[0] || dev.name}</strong>` : 'Agenda Geral de Entregas';
  }

  if (!container) return;

  const workload = devId ? window.appStore.getDeveloperWorkloadByDate(devId) : {};
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const m1Year = drawerDeliveryCalYear;
  const m1Month = drawerDeliveryCalMonth;

  let m2Month = m1Month + 1;
  let m2Year = m1Year;
  if (m2Month > 11) {
    m2Month = 0;
    m2Year += 1;
  }

  function generateMonthHtml(year, month, isSecondMonth) {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    let daysHtml = '';

    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="cal-day-cell cal-day-empty"></div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dayStr = `${year}-${mStr}-${dStr}`;

      const dateObj = new Date(year, month, day);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      const isHol = isHoliday(year, month, day);
      const isPast = (dayStr < todayStr);
      const isToday = (dayStr === todayStr);

      if (isWeekend) {
        daysHtml += `<div class="cal-day-cell cal-day-weekend ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Fim de semana"><span>${day}</span></div>`;
        continue;
      }
      if (isHol) {
        daysHtml += `<div class="cal-day-cell cal-day-holiday ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Feriado"><span>${day}</span></div>`;
        continue;
      }
      if (isPast) {
        daysHtml += `<div class="cal-day-cell cal-day-past ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Data passada"><span>${day}</span></div>`;
        continue;
      }

      const count = workload[dayStr] || 0;
      let statusClass = 'cal-day-free';
      let titleText = `${day}/${mStr}/${year}: Livre (0 chamados)`;

      if (count >= 1 && count <= 5) {
        statusClass = 'cal-day-busy';
        titleText = `${day}/${mStr}/${year}: ${count} chamado(s) (${dev?.name || 'Dev'})`;
      } else if (count > 5) {
        statusClass = 'cal-day-full';
        titleText = `${day}/${mStr}/${year}: ${count} chamados (lotado)`;
      }

      daysHtml += `<div class="cal-day-cell ${statusClass}" data-day="${dayStr}" title="${titleText}"><span>${day}</span></div>`;
    }

    const navArrows = isSecondMonth ? `
      <div class="cal-month-nav">
        <button type="button" class="btn-cal-arrow" id="btnDrawerCalPrev" title="Mês anterior">‹</button>
        <button type="button" class="btn-cal-arrow" id="btnDrawerCalNext" title="Próximo mês">›</button>
      </div>
    ` : '';

    return `
      <div class="cal-month-block">
        <div class="cal-month-header">
          <span class="cal-month-title">${monthNames[month]} ${year}</span>
          ${navArrows}
        </div>
        <div class="cal-weekdays-row">
          <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
        </div>
        <div class="cal-days-grid">${daysHtml}</div>
      </div>
    `;
  }

  container.innerHTML = generateMonthHtml(m1Year, m1Month, false) + generateMonthHtml(m2Year, m2Month, true);

  container.querySelectorAll('.cal-day-free, .cal-day-busy, .cal-day-full').forEach(cell => {
    cell.addEventListener('click', () => {
      selectDrawerDeliveryCalendarDate(cell.dataset.day);
    });
  });

  document.getElementById('btnDrawerCalPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerDeliveryCalMonth--;
    if (drawerDeliveryCalMonth < 0) {
      drawerDeliveryCalMonth = 11;
      drawerDeliveryCalYear--;
    }
    renderDrawerDeveloperCalendar();
  });

  document.getElementById('btnDrawerCalNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerDeliveryCalMonth++;
    if (drawerDeliveryCalMonth > 11) {
      drawerDeliveryCalMonth = 0;
      drawerDeliveryCalYear++;
    }
    renderDrawerDeveloperCalendar();
  });
}

function selectDrawerDeliveryCalendarDate(dayStr) {
  const input = document.getElementById('drawerEditDeliveryDueDate');
  const clientInput = document.getElementById('drawerEditClientDueDate');
  const pillText = document.getElementById('calDrawerDeliverySelectedDateText');

  if (dayStr) {
    const [year, month, day] = dayStr.split('-').map(Number);
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    if (input) input.value = formatted;
    if (pillText) pillText.textContent = formatted;

    // Auto-fill client due date with the delivery due date
    if (clientInput) {
      clientInput.value = formatted;
    }
  } else {
    if (input) input.value = '';
    if (pillText) pillText.textContent = 'Nenhuma data';
  }

  const popover = document.getElementById('calDrawerDeliveryPopover');
  if (popover) popover.style.display = 'none';
}

function setupDrawerDeliveryCalendar() {
  const input = document.getElementById('drawerEditDeliveryDueDate');
  const btnToggle = document.getElementById('btnToggleDrawerDeliveryCal');
  const popover = document.getElementById('calDrawerDeliveryPopover');
  const btnClose = document.getElementById('btnCloseDrawerDeliveryCal');
  const btnClear = document.getElementById('btnClearDrawerDeliveryDate');
  const group = document.getElementById('drawerDeliveryDateGroup');

  if (!popover) return;

  function togglePopover(show) {
    const isVisible = popover.style.display !== 'none';
    const shouldShow = typeof show === 'boolean' ? show : !isVisible;
    if (shouldShow) {
      document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
      renderDrawerDeveloperCalendar();
      popover.style.display = 'flex';
    } else {
      popover.style.display = 'none';
    }
  }

  input?.addEventListener('click', () => togglePopover(true));
  btnToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });
  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(false);
  });
  btnClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectDrawerDeliveryCalendarDate(null);
  });

  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none') {
      if (!group?.contains(e.target)) {
        popover.style.display = 'none';
      }
    }
  });
}

function renderDrawerCommonCalendar() {
  const container = document.getElementById('calDrawerClientMonthContainer');
  if (!container) return;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const year = drawerClientCalYear;
  const month = drawerClientCalMonth;
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let daysHtml = '';
  for (let i = 0; i < firstDayIndex; i++) {
    daysHtml += `<div class="cal-day-cell cal-day-empty"></div>`;
  }

  for (let day = 1; day <= lastDate; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dayStr = `${year}-${mStr}-${dStr}`;
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isToday = (dayStr === todayStr);

    daysHtml += `
      <div class="cal-day-cell cal-common-day ${isWeekend ? 'cal-day-weekend' : ''} ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}">
        <span>${day}</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="cal-month-block" style="width: 100%;">
      <div class="cal-month-header">
        <span class="cal-month-title">${monthNames[month]} ${year}</span>
        <div class="cal-month-nav">
          <button type="button" class="btn-cal-arrow" id="btnDrawerClientCalPrev" title="Mês anterior">‹</button>
          <button type="button" class="btn-cal-arrow" id="btnDrawerClientCalNext" title="Próximo mês">›</button>
        </div>
      </div>
      <div class="cal-weekdays-row">
        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
      </div>
      <div class="cal-days-grid">${daysHtml}</div>
    </div>
  `;

  container.querySelectorAll('.cal-common-day').forEach(cell => {
    cell.addEventListener('click', () => {
      selectDrawerClientCalendarDate(cell.dataset.day);
    });
  });

  document.getElementById('btnDrawerClientCalPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerClientCalMonth--;
    if (drawerClientCalMonth < 0) {
      drawerClientCalMonth = 11;
      drawerClientCalYear--;
    }
    renderDrawerCommonCalendar();
  });

  document.getElementById('btnDrawerClientCalNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerClientCalMonth++;
    if (drawerClientCalMonth > 11) {
      drawerClientCalMonth = 0;
      drawerClientCalYear++;
    }
    renderDrawerCommonCalendar();
  });
}

function selectDrawerClientCalendarDate(dayStr) {
  const input = document.getElementById('drawerEditClientDueDate');
  if (dayStr) {
    const [year, month, day] = dayStr.split('-').map(Number);
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    if (input) input.value = formatted;
  } else {
    if (input) input.value = '';
  }
  const popover = document.getElementById('calDrawerClientPopover');
  if (popover) popover.style.display = 'none';
}

function setupDrawerClientCalendar() {
  const input = document.getElementById('drawerEditClientDueDate');
  const btnToggle = document.getElementById('btnToggleDrawerClientCal');
  const popover = document.getElementById('calDrawerClientPopover');
  const btnClose = document.getElementById('btnCloseDrawerClientCal');
  const btnClear = document.getElementById('btnClearDrawerClientDate');
  const btnToday = document.getElementById('btnDrawerClientCalToday');
  const group = document.getElementById('drawerClientDateGroup');

  if (!popover) return;

  function togglePopover(show) {
    const isVisible = popover.style.display !== 'none';
    const shouldShow = typeof show === 'boolean' ? show : !isVisible;
    if (shouldShow) {
      document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
      renderDrawerCommonCalendar();
      popover.style.display = 'flex';
    } else {
      popover.style.display = 'none';
    }
  }

  input?.addEventListener('click', () => togglePopover(true));
  btnToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });
  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(false);
  });
  btnToday?.addEventListener('click', (e) => {
    e.stopPropagation();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectDrawerClientCalendarDate(todayStr);
  });
  btnClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectDrawerClientCalendarDate(null);
  });

  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none') {
      if (!group?.contains(e.target)) {
        popover.style.display = 'none';
      }
    }
  });
}

function setupDrawerLayoutAutocomplete() {
  const input = document.getElementById('drawerEditLayoutSearch');
  const dropdown = document.getElementById('drawerLayoutSearchResults');
  const hiddenId = document.getElementById('drawerEditLayoutId');
  const tagBox = document.getElementById('drawerSelectedLayoutTag');

  if (!input || !dropdown) return;

  input.addEventListener('input', (e) => {
    const rawQuery = e.target.value.trim();
    clearTimeout(drawerLayoutSearchDebounce);

    if (!rawQuery) {
      dropdown.style.display = 'none';
      return;
    }

    drawerLayoutSearchDebounce = setTimeout(async () => {
      try {
        const res = await window.conciliadorAPI.searchLayouts(rawQuery, 40);
        let layouts = res.data || [];
        if (layouts.length === 0) {
          dropdown.innerHTML = '<div style="padding: 10px; font-size: 12px; color: var(--text-muted); text-align: center;">Nenhum layout encontrado.</div>';
          dropdown.style.display = 'block';
          return;
        }

        const cleanQ = rawQuery.toLowerCase();
        const targetNum = /^\d+$/.test(cleanQ) ? parseInt(cleanQ, 10) : null;

        function getLayoutScore(l) {
          const codeStr = String(l.code != null ? l.code : '').trim().toLowerCase();
          const nameStr = String(l.name || '').trim().toLowerCase();
          const codeNum = parseInt(codeStr, 10);

          if (codeStr === cleanQ || (targetNum !== null && !isNaN(codeNum) && codeNum === targetNum)) return 0;
          if (codeStr.startsWith(cleanQ)) return 10;
          if (codeStr.includes(cleanQ)) return 20;
          if (nameStr === cleanQ) return 30;
          const words = nameStr.split(/[\s\-_\/]+/);
          if (words.some(w => w === cleanQ)) return 35;
          if (nameStr.startsWith(cleanQ)) return 40;
          if (nameStr.includes(cleanQ)) return 50;
          return 100;
        }

        layouts.sort((a, b) => {
          const scoreA = getLayoutScore(a);
          const scoreB = getLayoutScore(b);
          if (scoreA !== scoreB) return scoreA - scoreB;
          const numA = parseInt(String(a.code != null ? a.code : ''), 10);
          const numB = parseInt(String(b.code != null ? b.code : ''), 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

        dropdown.innerHTML = layouts.map(l => {
          const code = l.code || '-';
          const name = l.name || 'Sem nome';
          return `
            <div class="layout-autocomplete-item" data-id="${l.id}" data-code="${code}" data-name="${escapeHtml(name)}">
              <span class="layout-item-code">Layout ${code}</span>
              <span class="layout-item-name">${escapeHtml(name)}</span>
            </div>
          `;
        }).join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.layout-autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id;
            const code = item.dataset.code;
            const name = item.dataset.name;
            if (hiddenId) hiddenId.value = id;
            input.value = `${code} - ${name}`;
            dropdown.style.display = 'none';

            if (tagBox) {
              tagBox.innerHTML = `
                <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
                  <span>📐 Layout ${code}: ${name}</span>
                  <button type="button" id="btnClearDrawerLayout" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 12px; padding: 0;">✕</button>
                </span>
              `;
              tagBox.style.display = 'block';
              document.getElementById('btnClearDrawerLayout')?.addEventListener('click', () => {
                if (hiddenId) hiddenId.value = '';
                input.value = '';
                tagBox.innerHTML = '';
                tagBox.style.display = 'none';
              });
            }
          });
        });
      } catch (e) {
        console.error('Layout search error:', e);
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function setupDrawerDropzone() {
  const dropzone = document.getElementById('drawerDropzone');
  const fileInput = document.getElementById('drawerFileInput');
  const uploadStatus = document.getElementById('drawerUploadStatus');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      await uploadDrawerFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', async () => {
    if (fileInput.files && fileInput.files.length > 0) {
      await uploadDrawerFiles(Array.from(fileInput.files));
      fileInput.value = '';
    }
  });

  async function uploadDrawerFiles(files) {
    if (!selectedTicket || files.length === 0) return;
    if (uploadStatus) {
      uploadStatus.style.display = 'block';
      uploadStatus.style.background = 'rgba(14, 165, 233, 0.15)';
      uploadStatus.style.color = '#38bdf8';
      uploadStatus.textContent = `Enviando ${files.length} anexo(s)...`;
    }

    try {
      await window.conciliadorAPI.uploadTicketAttachments(selectedTicket.id, files);
      if (uploadStatus) {
        uploadStatus.style.background = 'rgba(16, 185, 129, 0.15)';
        uploadStatus.style.color = '#10b981';
        uploadStatus.textContent = `✅ ${files.length} anexo(s) enviado(s) com sucesso!`;
        setTimeout(() => { if (uploadStatus) uploadStatus.style.display = 'none'; }, 4000);
      }
      // Refresh ticket details
      const refreshed = await window.conciliadorAPI.fetchDemandDetails(selectedTicket.id);
      selectedTicket = { ...selectedTicket, ...refreshed };
      renderDrawerAttachments(refreshed.attachments || []);
    } catch (err) {
      console.error('Drawer attachment upload error:', err);
      if (uploadStatus) {
        uploadStatus.style.background = 'rgba(239, 68, 68, 0.15)';
        uploadStatus.style.color = '#ef4444';
        uploadStatus.textContent = `❌ Falha ao enviar: ${err.message}`;
      }
    }
  }
}

// Modal: Create New Ticket & Developer Calendar

function isHoliday(year, monthIndex, day) {
  const mStr = String(monthIndex + 1).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const md = `${mStr}-${dStr}`;
  const ymd = `${year}-${mStr}-${dStr}`;

  // Fixed Brazilian National Holidays
  const fixed = [
    '01-01', // Confraternização Universal
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '09-07', // Independência do Brasil
    '10-12', // Nossa Senhora Aparecida
    '11-02', // Finados (matching user screenshot where Nov 2 is excluded!)
    '11-15', // Proclamação da República
    '11-20', // Consciência Negra
    '12-25'  // Natal
  ];
  if (fixed.includes(md)) return true;

  // Floating Holidays (2026 / 2027)
  const floating = [
    '2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04',
    '2027-02-08', '2027-02-09', '2027-03-26', '2027-05-27'
  ];
  return floating.includes(ymd);
}

function updateDevSelectForCurrentType() {
  const typeSelect = document.getElementById('newTicketType');
  const prodSelect = document.getElementById('newTicketProduct');
  const devSelect = document.getElementById('newTicketAssignedTo');
  const hintEl = document.getElementById('newTicketDevFilteredHint');
  if (!devSelect) return;

  const typeId = typeSelect ? typeSelect.value : '';
  const prodId = prodSelect ? prodSelect.value : '';
  const filteredDevs = window.appStore.getDevelopersForType(typeId, prodId);

  if (hintEl) {
    hintEl.textContent = `(${filteredDevs.length} dev(s) aptos)`;
  }

  const prevVal = devSelect.value;
  devSelect.innerHTML = '<option value="">Sem responsável definido (Fica na Triagem)</option>' + 
    filteredDevs.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');

  if (prevVal && filteredDevs.some(d => d.id === prevVal)) {
    devSelect.value = prevVal;
  } else if (filteredDevs.length > 0) {
    devSelect.value = filteredDevs[0].id;
  } else {
    devSelect.value = '';
  }

  renderDeveloperCalendar(devSelect.value);
}

function renderDeveloperCalendar(devId) {
  currentCalDevId = devId;
  const container = document.getElementById('calDualMonthsContainer');
  const headerNameEl = document.getElementById('calDevNameHeader');

  const devs = window.appStore.getKnownDevelopers();
  const dev = devs.find(d => d.id === devId);

  if (headerNameEl) {
    headerNameEl.innerHTML = dev ? `Agenda de <strong>${dev.name.split(' ')[0] || dev.name}</strong>: chamados em aberto com entrega em cada dia.` : 'Agenda Geral de Entregas (Selecione um desenvolvedor para ver carga de trabalho)';
  }

  if (!container) return;

  const workload = devId ? window.appStore.getDeveloperWorkloadByDate(devId) : {};

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Month 1 & Month 2 (Dual Month Display)
  const m1Year = calCurrentYear;
  const m1Month = calCurrentMonth;

  let m2Month = m1Month + 1;
  let m2Year = m1Year;
  if (m2Month > 11) {
    m2Month = 0;
    m2Year += 1;
  }

  function generateMonthHtml(year, month, isSecondMonth) {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom
    const lastDate = new Date(year, month + 1, 0).getDate();

    let daysHtml = '';

    // Empty padding for preceding days
    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="cal-day-cell cal-day-empty"></div>`;
    }

    // Days in current month
    for (let day = 1; day <= lastDate; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dayStr = `${year}-${mStr}-${dStr}`;

      const dateObj = new Date(year, month, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Dom, 6 = Sáb
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      const isHol = isHoliday(year, month, day);
      const isPast = (dayStr < todayStr);
      const isToday = (dayStr === todayStr);
      const isSelected = (calSelectedDate === dayStr);

      // FINAIS DE SEMANA RETIRADOS (sem expediente / sem bloco colorido de disponibilidade)
      if (isWeekend) {
        daysHtml += `
          <div class="cal-day-cell cal-day-weekend ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Fim de semana (sem expediente)">
            <span>${day}</span>
          </div>
        `;
        continue;
      }

      // Feriado nacional retirado
      if (isHol) {
        daysHtml += `
          <div class="cal-day-cell cal-day-holiday ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Feriado nacional ou ausência">
            <span>${day}</span>
          </div>
        `;
        continue;
      }

      // Dias passados desabilitados (sem bloco colorido)
      if (isPast) {
        daysHtml += `
          <div class="cal-day-cell cal-day-past ${isToday ? 'cal-day-today-highlight' : ''}" data-day="${dayStr}" title="${day}/${mStr}/${year}: Data passada">
            <span>${day}</span>
          </div>
        `;
        continue;
      }

      // Dias úteis futuros (Segunda a Sexta):
      const count = workload[dayStr] || 0;
      let statusClass = 'cal-day-free';
      let titleText = `${day}/${mStr}/${year}: Livre (0 chamados ativos)`;

      if (count === 0) {
        statusClass = 'cal-day-free';
        titleText = `${day}/${mStr}/${year}: Livre (0 chamados com entrega neste dia)`;
      } else if (count >= 1 && count <= 5) {
        statusClass = 'cal-day-busy';
        titleText = `${day}/${mStr}/${year}: ${count} chamado(s) em aberto (${dev.name})`;
      } else {
        statusClass = 'cal-day-full';
        titleText = `${day}/${mStr}/${year}: ${count} chamados (Mais de 5 - lotado)`;
      }

      daysHtml += `
        <div class="cal-day-cell ${statusClass} ${isSelected ? 'cal-day-selected' : ''}" data-day="${dayStr}" title="${titleText}">
          <span>${day}</span>
        </div>
      `;
    }

    const navArrows = isSecondMonth ? `
      <div class="cal-month-nav">
        <button type="button" class="btn-cal-arrow" id="btnCalPrev" title="Mês anterior">‹</button>
        <button type="button" class="btn-cal-arrow" id="btnCalNext" title="Próximo mês">›</button>
      </div>
    ` : '';

    return `
      <div class="cal-month-block">
        <div class="cal-month-header">
          <span class="cal-month-title">${monthNames[month]} ${year}</span>
          ${navArrows}
        </div>
        <div class="cal-weekdays-row">
          <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
        </div>
        <div class="cal-days-grid">
          ${daysHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = generateMonthHtml(m1Year, m1Month, false) + generateMonthHtml(m2Year, m2Month, true);

  // Wire click events for active business days
  container.querySelectorAll('.cal-day-free, .cal-day-busy, .cal-day-full').forEach(cell => {
    cell.addEventListener('click', () => {
      selectCalendarDate(cell.dataset.day);
    });
  });

  // Wire navigation buttons
  const btnPrev = document.getElementById('btnCalPrev');
  const btnNext = document.getElementById('btnCalNext');

  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth--;
      if (calCurrentMonth < 0) {
        calCurrentMonth = 11;
        calCurrentYear--;
      }
      renderDeveloperCalendar(currentCalDevId);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth++;
      if (calCurrentMonth > 11) {
        calCurrentMonth = 0;
        calCurrentYear++;
      }
      renderDeveloperCalendar(currentCalDevId);
    });
  }
}

function selectCalendarDate(dayStr) {
  calSelectedDate = dayStr;
  const hiddenInput = document.getElementById('newTicketDueDate');
  const visibleInput = document.getElementById('newTicketDeliveryDateInput');
  const pillText = document.getElementById('calSelectedDateText');
  const btnClear = document.getElementById('btnClearSelectedDate');

  if (hiddenInput) hiddenInput.value = dayStr || '';

  if (dayStr) {
    const [year, month, day] = dayStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const weekdayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const weekday = weekdayNames[dateObj.getDay()];
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    if (visibleInput) visibleInput.value = formatted;
    if (pillText) {
      pillText.innerHTML = `📅 <strong>${formatted}</strong> (${weekday})`;
    }
    if (btnClear) btnClear.style.display = 'inline-block';

    // Auto-preencher prazo do cliente com a mesma data que o prazo de entrega
    const clientDueInput = document.getElementById('newTicketClientDueDate');
    if (clientDueInput) {
      clientDueInput.value = formatted;
      selectClientCalendarDate(dayStr, false);
    }

    // Auto-close floating popover upon choosing a date
    setTimeout(() => {
      const popover = document.getElementById('calFloatingPopover');
      if (popover) popover.style.display = 'none';
    }, 180);
  } else {
    if (visibleInput) visibleInput.value = '';
    if (pillText) {
      pillText.textContent = 'Nenhuma data selecionada';
    }
    if (btnClear) btnClear.style.display = 'none';

    // Se limpar prazo de entrega, limpa prazo do cliente também
    const clientDueInput = document.getElementById('newTicketClientDueDate');
    if (clientDueInput) {
      clientDueInput.value = '';
      selectClientCalendarDate(null, false);
    }
  }

  // Update selection highlight on cells
  const container = document.getElementById('calDualMonthsContainer');
  if (container) {
    container.querySelectorAll('.cal-day-cell').forEach(cell => {
      cell.classList.toggle('cal-day-selected', cell.dataset.day === dayStr);
    });
  }
}

function renderLabelsPicker() {
  const container = document.getElementById('ticketLabelsPicker');
  if (!container) return;

  const labels = window.appStore.getAvailableLabels();
  if (!labels || labels.length === 0) {
    container.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">Nenhuma etiqueta encontrada</span>';
    return;
  }

  container.innerHTML = labels.map(l => {
    const isSelected = newTicketSelectedLabels.has(l.id);
    const color = l.color || '#6366f1';
    const activeStyle = isSelected
      ? `background: ${color}28; border-color: ${color}; color: ${color};`
      : `border-color: rgba(255,255,255,0.1);`;

    return `
      <div class="label-picker-pill ${isSelected ? 'active' : ''}" data-label-id="${l.id}" style="${activeStyle}">
        <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${color}; margin-right: 5px;"></span>
        <span>${escapeHtml(l.name)}</span>
        ${isSelected ? '<span style="margin-left: 5px; font-weight: 800;">✓</span>' : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.label-picker-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.labelId;
      if (newTicketSelectedLabels.has(id)) {
        newTicketSelectedLabels.delete(id);
      } else {
        newTicketSelectedLabels.add(id);
      }
      renderLabelsPicker();
    });
  });
}

function setupDropzone() {
  const dropzone = document.getElementById('ticketDropzone');
  const fileInput = document.getElementById('ticketFileInput');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-file')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      addFilesToTicket(Array.from(fileInput.files));
      fileInput.value = '';
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToTicket(Array.from(e.dataTransfer.files));
    }
  });

  // Global paste handler when create ticket modal is open
  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('createTicketModalOverlay');
    if (!modal || !modal.classList.contains('open')) return;

    const clipboardItems = e.clipboardData ? e.clipboardData.items : [];
    const pastedFiles = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
            const timeTag = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
            const newFile = new File([file], `screenshot-${timeTag}.png`, { type: file.type });
            pastedFiles.push(newFile);
          } else {
            pastedFiles.push(file);
          }
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFilesToTicket(pastedFiles);
    }
  });
}

function setupRichTextEditor() {
  const editor = document.getElementById('newTicketDescriptionEditor');
  const toolbar = document.getElementById('ticketDescToolbar');
  const hiddenTextarea = document.getElementById('newTicketDescription');

  if (!editor || !toolbar) return;

  toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;

      if (!cmd) return;

      editor.focus();
      if (cmd === 'formatBlock') {
        document.execCommand(cmd, false, `<${val}>`);
      } else {
        document.execCommand(cmd, false, val);
      }

      if (hiddenTextarea) {
        hiddenTextarea.value = editor.innerHTML;
      }
    });
  });

  editor.addEventListener('input', () => {
    if (hiddenTextarea) {
      hiddenTextarea.value = editor.innerHTML;
    }
  });

  // Keyboard shortcuts inside editor
  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
      } else if (k === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
      } else if (k === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
      }
    }
  });
}

function setupFloatingCalendar() {
  const input = document.getElementById('newTicketDeliveryDateInput');
  const btnToggle = document.getElementById('btnToggleFloatingCalendar');
  const popover = document.getElementById('calFloatingPopover');
  const btnClose = document.getElementById('btnCloseFloatingCalendar');
  const group = document.getElementById('deliveryDateGroup');
  const clientPopover = document.getElementById('calClientPopover');

  if (!popover) return;

  function togglePopover(show) {
    const isVisible = popover.style.display !== 'none';
    const shouldShow = typeof show === 'boolean' ? show : !isVisible;

    if (shouldShow) {
      if (clientPopover) clientPopover.style.display = 'none';
      const devId = document.getElementById('newTicketAssignedTo')?.value;
      renderDeveloperCalendar(devId);
      popover.style.display = 'flex';
    } else {
      popover.style.display = 'none';
    }
  }

  input?.addEventListener('click', () => togglePopover(true));
  input?.addEventListener('input', (e) => {
    const clientDueInput = document.getElementById('newTicketClientDueDate');
    if (clientDueInput) {
      clientDueInput.value = e.target.value;
    }
  });

  btnToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(false);
  });

  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none') {
      if (!group?.contains(e.target)) {
        popover.style.display = 'none';
      }
    }
  });
}

// ------------------- Calendário Comum Integrado (Prazo do Cliente) -------------------
function renderCommonCalendar() {
  const container = document.getElementById('calClientMonthContainer');
  if (!container) return;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const year = commonCalCurrentYear;
  const month = commonCalCurrentMonth;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom
  const lastDate = new Date(year, month + 1, 0).getDate();

  let daysHtml = '';

  for (let i = 0; i < firstDayIndex; i++) {
    daysHtml += `<div class="cal-day-cell cal-day-empty"></div>`;
  }

  for (let day = 1; day <= lastDate; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dayStr = `${year}-${mStr}-${dStr}`;

    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isToday = (dayStr === todayStr);
    const isSelected = (commonCalSelectedDate === dayStr);

    let cellClasses = ['cal-common-day-cell'];
    if (isWeekend) cellClasses.push('cal-common-day-weekend');
    if (isToday) cellClasses.push('cal-common-day-today');
    if (isSelected) cellClasses.push('cal-common-day-selected');

    daysHtml += `
      <div class="${cellClasses.join(' ')}" data-day="${dayStr}" title="${day}/${mStr}/${year}">
        <span>${day}</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="cal-month-header">
      <span class="cal-month-title">${monthNames[month]} ${year}</span>
      <div class="cal-month-nav">
        <button type="button" class="btn-cal-arrow" id="btnClientCalPrev" title="Mês anterior">‹</button>
        <button type="button" class="btn-cal-arrow" id="btnClientCalNext" title="Próximo mês">›</button>
      </div>
    </div>
    <div class="cal-weekdays-row">
      <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
    </div>
    <div class="cal-days-grid">
      ${daysHtml}
    </div>
  `;

  // Attach day click listeners
  container.querySelectorAll('.cal-common-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      selectClientCalendarDate(cell.dataset.day, true);
    });
  });

  // Attach nav buttons
  const btnPrev = document.getElementById('btnClientCalPrev');
  const btnNext = document.getElementById('btnClientCalNext');

  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      commonCalCurrentMonth--;
      if (commonCalCurrentMonth < 0) {
        commonCalCurrentMonth = 11;
        commonCalCurrentYear--;
      }
      renderCommonCalendar();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      commonCalCurrentMonth++;
      if (commonCalCurrentMonth > 11) {
        commonCalCurrentMonth = 0;
        commonCalCurrentYear++;
      }
      renderCommonCalendar();
    });
  }
}

function selectClientCalendarDate(dayStr, closePopover = true) {
  commonCalSelectedDate = dayStr;
  const input = document.getElementById('newTicketClientDueDate');
  const label = document.getElementById('calClientSelectedDateLabel');

  if (dayStr) {
    const [year, month, day] = dayStr.split('-').map(Number);
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    if (input) input.value = formatted;
    if (label) label.textContent = formatted;

    if (closePopover) {
      setTimeout(() => {
        const pop = document.getElementById('calClientPopover');
        if (pop) pop.style.display = 'none';
      }, 180);
    }
  } else {
    if (input) input.value = '';
    if (label) label.textContent = 'Nenhuma data';
  }

  // Update selection highlight on cells
  const container = document.getElementById('calClientMonthContainer');
  if (container) {
    container.querySelectorAll('.cal-common-day-cell').forEach(cell => {
      cell.classList.toggle('cal-common-day-selected', cell.dataset.day === dayStr);
    });
  }
}

function setupClientCalendar() {
  const input = document.getElementById('newTicketClientDueDate');
  const btnToggle = document.getElementById('btnToggleClientCalendar');
  const popover = document.getElementById('calClientPopover');
  const btnClose = document.getElementById('btnCloseClientCalendar');
  const btnToday = document.getElementById('btnClientCalToday');
  const btnClear = document.getElementById('btnClearClientCalendarDate');
  const group = document.getElementById('clientDateGroup');
  const deliveryPopover = document.getElementById('calFloatingPopover');

  if (!popover) return;

  function togglePopover(show) {
    const isVisible = popover.style.display !== 'none';
    const shouldShow = typeof show === 'boolean' ? show : !isVisible;

    if (shouldShow) {
      if (deliveryPopover) deliveryPopover.style.display = 'none';
      renderCommonCalendar();
      popover.style.display = 'flex';
    } else {
      popover.style.display = 'none';
    }
  }

  input?.addEventListener('click', () => togglePopover(true));
  btnToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(false);
  });

  btnToday?.addEventListener('click', (e) => {
    e.stopPropagation();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    commonCalCurrentYear = today.getFullYear();
    commonCalCurrentMonth = today.getMonth();
    selectClientCalendarDate(todayStr, true);
  });

  btnClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectClientCalendarDate(null, true);
  });

  input?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)) {
      const [d, m, y] = val.split('/').map(Number);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        commonCalSelectedDate = iso;
        commonCalCurrentYear = y;
        commonCalCurrentMonth = m - 1;
        const label = document.getElementById('calClientSelectedDateLabel');
        if (label) label.textContent = val;
        renderCommonCalendar();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none') {
      if (!group?.contains(e.target)) {
        popover.style.display = 'none';
      }
    }
  });
}

function addFilesToTicket(files) {
  for (const file of files) {
    const exists = newTicketSelectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!exists) {
      newTicketSelectedFiles.push(file);
    }
  }
  renderSelectedFilesList();
}

function removeSelectedFile(index) {
  newTicketSelectedFiles.splice(index, 1);
  renderSelectedFilesList();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📕';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
  if (['txt', 'log', 'cnab', 'ret', 'rem'].includes(ext)) return '📄';
  return '📎';
}

function renderSelectedFilesList() {
  const container = document.getElementById('ticketSelectedFilesList');
  if (!container) return;

  if (newTicketSelectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = newTicketSelectedFiles.map((file, idx) => {
    const icon = getFileIcon(file.name);
    const sizeStr = formatFileSize(file.size);

    return `
      <div class="selected-file-item" data-idx="${idx}">
        <div style="font-size: 16px; flex-shrink: 0;">${icon}</div>
        <div class="selected-file-info">
          <div class="selected-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="selected-file-size">${sizeStr}</div>
        </div>
        <button type="button" class="btn-remove-file" data-idx="${idx}" title="Remover anexo">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-remove-file').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      removeSelectedFile(idx);
    });
  });
}

function openCreateTicketModal() {
  const modal = document.getElementById('createTicketModalOverlay');
  if (!modal) return;

  // Reset fields
  document.getElementById('newTicketTitle').value = '';
  document.getElementById('newTicketDatabase').value = '';
  document.getElementById('newTicketMovidesk').value = '';
  document.getElementById('newTicketDueDate').value = '';
  if (document.getElementById('newTicketPriority')) {
    const pEl = document.getElementById('newTicketPriority');
    pEl.value = 'medium';
    updatePrioritySelectVisual(pEl);
  }
  document.getElementById('newTicketDescription').value = '';
  const descEditor = document.getElementById('newTicketDescriptionEditor');
  if (descEditor) descEditor.innerHTML = '';
  const popover = document.getElementById('calFloatingPopover');
  if (popover) popover.style.display = 'none';
  document.getElementById('newTicketLayoutSearch').value = '';
  document.getElementById('newTicketLayoutId').value = '';

  newTicketSelectedFiles = [];
  newTicketSelectedLabels = new Set();
  renderSelectedFilesList();
  renderLabelsPicker();

  const errBox = document.getElementById('createTicketError');
  if (errBox) errBox.style.display = 'none';

  const layoutTag = document.getElementById('selectedLayoutTag');
  if (layoutTag) {
    layoutTag.innerHTML = '';
    layoutTag.style.display = 'none';
  }

  // Populate Types
  const typeSelect = document.getElementById('newTicketType');
  if (typeSelect) {
    const types = window.appStore.getTicketTypes();
    typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  // Populate Products
  const prodSelect = document.getElementById('newTicketProduct');
  if (prodSelect) {
    const prods = window.appStore.getProducts();
    prodSelect.innerHTML = prods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  // Filter developers based on initially selected type/subject
  updateDevSelectForCurrentType();

  // Reset calendar month and date selection
  const now = new Date();
  calCurrentYear = now.getFullYear();
  calCurrentMonth = now.getMonth();
  commonCalCurrentYear = now.getFullYear();
  commonCalCurrentMonth = now.getMonth();
  selectCalendarDate(null);
  selectClientCalendarDate(null, false);

  const btnClear = document.getElementById('btnClearSelectedDate');
  if (btnClear) {
    btnClear.onclick = () => selectCalendarDate(null);
  }

  modal.classList.add('open');
  setTimeout(() => document.getElementById('newTicketTitle')?.focus(), 100);
}

function closeCreateTicketModal() {
  const modal = document.getElementById('createTicketModalOverlay');
  if (modal) modal.classList.remove('open');
  const popover = document.getElementById('calFloatingPopover');
  if (popover) popover.style.display = 'none';
  const clientPopover = document.getElementById('calClientPopover');
  if (clientPopover) clientPopover.style.display = 'none';
}

let layoutSearchDebounce = null;
function setupLayoutAutocomplete() {
  const input = document.getElementById('newTicketLayoutSearch');
  const dropdown = document.getElementById('layoutSearchResults');
  const hiddenId = document.getElementById('newTicketLayoutId');
  const tagBox = document.getElementById('selectedLayoutTag');

  if (!input || !dropdown) return;

  input.addEventListener('input', (e) => {
    const rawQuery = e.target.value.trim();
    clearTimeout(layoutSearchDebounce);

    if (!rawQuery) {
      dropdown.style.display = 'none';
      return;
    }

    layoutSearchDebounce = setTimeout(async () => {
      try {
        const res = await window.conciliadorAPI.searchLayouts(rawQuery, 40);
        let layouts = res.data || [];
        if (layouts.length === 0) {
          dropdown.innerHTML = '<div style="padding: 10px; font-size: 12px; color: var(--text-muted); text-align: center;">Nenhum layout encontrado.</div>';
          dropdown.style.display = 'block';
          return;
        }

        // Sorting giving priority to the layout code (number) matching query:
        // "organizar layout dado prioridade para o numero do layout se digito 13 o layout 13 deve ser o primeiro"
        const cleanQ = rawQuery.toLowerCase();
        const targetNum = /^\d+$/.test(cleanQ) ? parseInt(cleanQ, 10) : null;

        function getLayoutScore(l) {
          const codeStr = String(l.code != null ? l.code : '').trim().toLowerCase();
          const nameStr = String(l.name || '').trim().toLowerCase();
          const codeNum = parseInt(codeStr, 10);

          // 1. EXACT CODE MATCH (e.g. user typed "13" and layout code is 13 or "13") -> #1 FIRST!
          if (codeStr === cleanQ || (targetNum !== null && !isNaN(codeNum) && codeNum === targetNum)) {
            return 0;
          }
          // 2. CODE STARTS WITH QUERY (e.g. 130, 131)
          if (codeStr.startsWith(cleanQ)) {
            return 10;
          }
          // 3. CODE CONTAINS QUERY (e.g. 513)
          if (codeStr.includes(cleanQ)) {
            return 20;
          }
          // 4. NAME EXACT MATCH
          if (nameStr === cleanQ) {
            return 30;
          }
          // 5. WORD IN NAME EXACT MATCH (e.g. "Layout 13")
          const words = nameStr.split(/[\s\-_\/]+/);
          if (words.some(w => w === cleanQ)) {
            return 35;
          }
          // 6. NAME STARTS WITH QUERY
          if (nameStr.startsWith(cleanQ)) {
            return 40;
          }
          // 7. NAME CONTAINS QUERY
          if (nameStr.includes(cleanQ)) {
            return 50;
          }
          return 100;
        }

        layouts.sort((a, b) => {
          const scoreA = getLayoutScore(a);
          const scoreB = getLayoutScore(b);
          if (scoreA !== scoreB) {
            return scoreA - scoreB;
          }

          const codeStrA = String(a.code != null ? a.code : '').trim();
          const codeStrB = String(b.code != null ? b.code : '').trim();
          const numA = parseInt(codeStrA, 10);
          const numB = parseInt(codeStrB, 10);

          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          if (codeStrA.length !== codeStrB.length) {
            return codeStrA.length - codeStrB.length;
          }

          return String(a.name || '').localeCompare(String(b.name || ''));
        });

        dropdown.innerHTML = layouts.map(l => `
          <div class="autocomplete-item" data-id="${l.id}" data-code="${l.code}" data-name="${escapeHtml(l.name)}">
            <div>
              <strong style="color: #a5b4fc;">Layout ${l.code}</strong> - ${escapeHtml(l.name)}
            </div>
            <span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(l.type || '')}</span>
          </div>
        `).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id;
            const code = item.dataset.code;
            const name = item.dataset.name;
            hiddenId.value = id;
            input.value = '';
            dropdown.style.display = 'none';

            if (tagBox) {
              tagBox.innerHTML = `
                <span class="selected-layout-pill">
                  📐 Layout ${code} - ${name}
                  <span class="btn-remove-layout" title="Remover layout">&times;</span>
                </span>
              `;
              tagBox.style.display = 'block';

              tagBox.querySelector('.btn-remove-layout').addEventListener('click', () => {
                hiddenId.value = '';
                tagBox.innerHTML = '';
                tagBox.style.display = 'none';
              });
            }
          });
        });
      } catch (err) {
        console.warn('Layout search error:', err);
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#newTicketLayoutSearch') && !e.target.closest('#layoutSearchResults')) {
      dropdown.style.display = 'none';
    }
  });
}

async function submitCreateTicket() {
  const title = document.getElementById('newTicketTitle')?.value.trim();
  const typeId = document.getElementById('newTicketType')?.value;
  const productId = document.getElementById('newTicketProduct')?.value;
  const assignedToId = document.getElementById('newTicketAssignedTo')?.value;
  const priority = normalizePriorityToApi(document.getElementById('newTicketPriority')?.value);
  const database = document.getElementById('newTicketDatabase')?.value.trim();
  const movidesk = document.getElementById('newTicketMovidesk')?.value.trim();
  const layoutId = document.getElementById('newTicketLayoutId')?.value;
  const dueDate = document.getElementById('newTicketDueDate')?.value;

  const descEditor = document.getElementById('newTicketDescriptionEditor');
  const descriptionHtml = descEditor ? descEditor.innerHTML.trim() : '';
  const descriptionText = descEditor ? descEditor.innerText.trim() : '';
  const fallbackDesc = document.getElementById('newTicketDescription')?.value.trim() || '';
  const description = descriptionText ? descriptionHtml : fallbackDesc;

  const errBox = document.getElementById('createTicketError');
  const btnSubmit = document.getElementById('btnSubmitCreateTicket');

  if (!title) {
    if (errBox) {
      errBox.textContent = 'Por favor, informe o título da demanda.';
      errBox.style.display = 'block';
    }
    document.getElementById('newTicketTitle')?.focus();
    return;
  }

  if (!description) {
    if (errBox) {
      errBox.textContent = 'Por favor, informe a descrição detalhada do chamado.';
      errBox.style.display = 'block';
    }
    if (descEditor) {
      descEditor.focus();
    } else {
      document.getElementById('newTicketDescription')?.focus();
    }
    return;
  }

  if (errBox) errBox.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>⏳</span> Criando Chamado...';
  }

  try {
    const payload = {
      title,
      description,
      typeId: typeId || undefined,
      productId: productId || undefined,
      priority
    };

    if (assignedToId) payload.assignedToId = assignedToId;

    if (layoutId) payload.layoutId = layoutId;
    if (database) payload.clientDatabase = database;
    if (movidesk) payload.movideskTicketId = parseInt(movidesk, 10);
    if (dueDate) {
      payload.deliveryDueDate = new Date(dueDate + 'T23:59:59.000Z').toISOString();
    }
    const clientDueVal = document.getElementById('newTicketClientDueDate')?.value.trim();
    if (clientDueVal) {
      if (clientDueVal.includes('/')) {
        const [d, m, y] = clientDueVal.split('/').map(Number);
        if (d && m && y) {
          payload.clientDueDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59.000Z`).toISOString();
        }
      } else {
        payload.clientDueDate = new Date(clientDueVal).toISOString();
      }
    }
    if (newTicketSelectedLabels.size > 0) {
      payload.labelIds = Array.from(newTicketSelectedLabels);
    }

    const createdTicket = await window.conciliadorAPI.createTicket(payload);

    // If attachments were added, upload them now
    if (newTicketSelectedFiles.length > 0) {
      btnSubmit.innerHTML = `<span>📎</span> Enviando ${newTicketSelectedFiles.length} anexo(s)...`;
      try {
        await window.conciliadorAPI.uploadTicketAttachments(createdTicket.id, newTicketSelectedFiles);
      } catch (attErr) {
        console.warn('Erro ao enviar anexos:', attErr);
        if (window.electronAPI) {
          window.electronAPI.showNotification(
            'Aviso de Anexos',
            `O chamado #${createdTicket.number} foi criado, mas houve falha no envio de anexos: ${attErr.message}`
          );
        }
      }
    }

    closeCreateTicketModal();

    if (window.electronAPI) {
      window.electronAPI.showNotification(
        'Chamado Aberto com Sucesso',
        `A demanda #${createdTicket.number} foi cadastrada e atribuída com sucesso.`
      );
    }

    // Refresh list and open new ticket
    await syncDemands();
    openDemandDrawer(createdTicket);

  } catch (err) {
    console.error('Error creating ticket:', err);
    if (errBox) {
      errBox.textContent = 'Falha ao abrir chamado: ' + err.message;
      errBox.style.display = 'block';
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>🚀</span> Criar Demanda';
    }
  }
}


// Modal: Create or Edit Fixed Filter
function openNewFilterModal() {
  document.getElementById('filterModalTitle').textContent = 'Novo Filtro Fixo';
  document.getElementById('modalFilterId').value = '';
  document.getElementById('modalFilterName').value = '';
  document.getElementById('modalFilterIcon').value = '🎯';
  document.getElementById('modalFilterColor').value = '#6366f1';
  document.getElementById('modalFilterStatus').value = '';
  document.getElementById('modalFilterLabel').value = '';
  document.getElementById('modalFilterType').value = '';
  document.getElementById('modalFilterDev').value = '';
  document.getElementById('modalFilterDatabase').value = '';
  document.getElementById('modalFilterDeadline').value = '';

  const btnDelModal = document.getElementById('btnDeleteFilterModal');
  if (btnDelModal) btnDelModal.style.display = 'none';

  document.getElementById('filterModalOverlay').classList.add('open');
}

function openEditFilterModal(filter) {
  document.getElementById('filterModalTitle').textContent = 'Editar Filtro Fixo';
  document.getElementById('modalFilterId').value = filter.id;
  document.getElementById('modalFilterName').value = filter.name || '';
  document.getElementById('modalFilterIcon').value = filter.icon || '🎯';
  document.getElementById('modalFilterColor').value = filter.color || '#6366f1';
  
  const c = filter.criteria || {};
  if (c.status && c.status.length > 0) {
    const isWaitingN2 = c.status.some(s => s.includes('waiting') || s.includes('requester'));
    const isDone = c.status.some(s => s === 'done' || s === 'closed' || s === 'completed' || s === 'concluido');
    if (isWaitingN2) {
      document.getElementById('modalFilterStatus').value = 'waiting_n2';
    } else if (isDone && (c.label === 'DOCUMENTAR' || (c.labels && c.labels.includes('DOCUMENTAR')))) {
      document.getElementById('modalFilterStatus').value = 'done_documentar';
    } else {
      document.getElementById('modalFilterStatus').value = c.status[0];
    }
  } else {
    document.getElementById('modalFilterStatus').value = '';
  }
  document.getElementById('modalFilterLabel').value = c.label || (c.labels && c.labels[0]) || '';
  document.getElementById('modalFilterType').value = c.type && c.type[0] ? c.type[0] : '';
  document.getElementById('modalFilterDev').value = c.isMyDemands ? 'CURRENT_USER' : (c.developerName || '');
  document.getElementById('modalFilterDatabase').value = c.database || '';
  document.getElementById('modalFilterDeadline').value = c.deadline || '';

  const btnDelModal = document.getElementById('btnDeleteFilterModal');
  if (btnDelModal) {
    btnDelModal.style.display = filter.id !== 'all' ? 'inline-flex' : 'none';
    btnDelModal.onclick = async () => {
      if (confirm(`Deseja realmente apagar o filtro "${filter.name}"?`)) {
        await window.appStore.deleteFixedFilter(filter.id);
        closeFilterModal();
        renderFixedFiltersList();
        renderDemands();
      }
    };
  }

  document.getElementById('filterModalOverlay').classList.add('open');
}

function closeFilterModal() {
  document.getElementById('filterModalOverlay').classList.remove('open');
}

async function saveFilterModal() {
  const id = document.getElementById('modalFilterId').value;
  const name = document.getElementById('modalFilterName').value.trim();
  const icon = document.getElementById('modalFilterIcon').value.trim() || '🎯';
  const color = document.getElementById('modalFilterColor').value || '#6366f1';

  if (!name) {
    alert('Por favor, informe o nome do filtro fixo.');
    return;
  }

  const statusVal = document.getElementById('modalFilterStatus').value;
  const labelVal = document.getElementById('modalFilterLabel')?.value;
  const typeVal = document.getElementById('modalFilterType').value;
  const devVal = document.getElementById('modalFilterDev').value;
  const dbVal = document.getElementById('modalFilterDatabase').value.trim();
  const deadlineVal = document.getElementById('modalFilterDeadline').value;

  const criteria = {};
  if (statusVal === 'waiting_n2' || statusVal === 'waiting') {
    criteria.status = ['waiting', 'waiting_requester', 'waiting_creator'];
  } else if (statusVal === 'done_documentar') {
    criteria.status = ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'];
    criteria.label = 'DOCUMENTAR';
  } else if (statusVal === 'done') {
    criteria.status = ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'];
  } else if (statusVal) {
    criteria.status = [statusVal];
  }

  if (labelVal) {
    criteria.label = labelVal;
  }

  if (typeVal) criteria.type = [typeVal];
  if (devVal === 'CURRENT_USER') {
    criteria.isMyDemands = true;
  } else if (devVal) {
    criteria.developerName = devVal;
  }
  if (dbVal) criteria.database = dbVal;
  if (deadlineVal) criteria.deadline = deadlineVal;

  if (id) {
    await window.appStore.updateFixedFilter(id, { name, icon, color, criteria });
  } else {
    await window.appStore.addFixedFilter({ name, icon, color, criteria });
  }

  closeFilterModal();
  renderFixedFiltersList();
  renderDemands();
}

// Setup Event Listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('inputSearch');
  searchInput?.addEventListener('input', (e) => {
    window.appStore.searchQuery = e.target.value;
    renderDemands();
  });

  // View Switcher (Table vs Kanban)
  const btnTable = document.getElementById('btnViewTable');
  const btnKanban = document.getElementById('btnViewKanban');

  btnTable?.addEventListener('click', () => {
    btnTable.classList.add('active');
    btnKanban?.classList.remove('active');
    window.appStore.activeView = 'table';
    renderDemands();
  });

  btnKanban?.addEventListener('click', () => {
    btnKanban.classList.add('active');
    btnTable?.classList.remove('active');
    window.appStore.activeView = 'kanban';
    renderDemands();
  });

  // Sync button
  document.getElementById('btnSyncNow')?.addEventListener('click', () => syncDemands());

  // Quick Filter Dropdowns
  document.getElementById('quickSelectStatus')?.addEventListener('change', (e) => {
    window.appStore.quickFilters.status = e.target.value;
    renderDemands();
  });

  document.getElementById('quickSelectType')?.addEventListener('change', (e) => {
    window.appStore.quickFilters.type = e.target.value;
    renderDemands();
  });

  document.getElementById('quickSelectDev')?.addEventListener('change', (e) => {
    window.appStore.quickFilters.assignedTo = e.target.value;
    renderDemands();
  });

  // Label filter listener
  document.getElementById('quickSelectLabel')?.addEventListener('change', (e) => {
    window.appStore.quickFilters.label = e.target.value;
    renderDemands();
  });

  // Date filter listener
  document.getElementById('quickSelectDate')?.addEventListener('change', (e) => {
    window.appStore.quickFilters.date = e.target.value;
    renderDemands();
  });

  // Sort selector listener
  document.getElementById('quickSelectSort')?.addEventListener('change', (e) => {
    window.appStore.sortBy = e.target.value;
    renderDemands();
  });

  // Table header click sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (field === 'number') {
        window.appStore.sortBy = window.appStore.sortBy === 'number_desc' ? 'number_asc' : 'number_desc';
      } else if (field === 'deliveryDueDate') {
        window.appStore.sortBy = window.appStore.sortBy === 'deliveryDueDate_asc' ? 'deliveryDueDate_desc' : 'deliveryDueDate_asc';
      } else if (field === 'createdAt') {
        window.appStore.sortBy = window.appStore.sortBy === 'createdAt_desc' ? 'createdAt_asc' : 'createdAt_desc';
      }
      const sortSelect = document.getElementById('quickSelectSort');
      if (sortSelect) sortSelect.value = window.appStore.sortBy;
      renderDemands();
    });
  });

  document.getElementById('btnClearQuickFilters')?.addEventListener('click', () => {
    document.getElementById('quickSelectStatus').value = 'all';
    document.getElementById('quickSelectType').value = 'all';
    document.getElementById('quickSelectDev').value = 'all';
    const labelSel = document.getElementById('quickSelectLabel');
    if (labelSel) labelSel.value = 'all';
    const dateSel = document.getElementById('quickSelectDate');
    if (dateSel) dateSel.value = 'all';
    const searchInput = document.getElementById('inputSearch');
    if (searchInput) searchInput.value = '';
    window.appStore.quickFilters = { status: 'all', type: 'all', assignedTo: 'all', database: '', date: 'all', label: 'all' };
    window.appStore.searchQuery = '';
    window.appStore.activeFilterId = 'all';
    renderFixedFiltersList();
    renderDemands();
  });

  // Save current quick filters as a new fixed filter
  document.getElementById('btnSaveCurrentAsFixed')?.addEventListener('click', () => {
    const defaultName = `Filtro Personalizado ${window.appStore.fixedFilters.length + 1}`;
    openNewFilterModal();
    document.getElementById('modalFilterName').value = defaultName;
    const s = window.appStore.quickFilters.status;
    const t = window.appStore.quickFilters.type;
    const d = window.appStore.quickFilters.assignedTo;
    const l = window.appStore.quickFilters.label;

    if (s && s !== 'all') document.getElementById('modalFilterStatus').value = s;
    if (t && t !== 'all') document.getElementById('modalFilterType').value = t;
    if (d && d !== 'all') document.getElementById('modalFilterDev').value = d;
    if (l && l !== 'all') document.getElementById('modalFilterLabel').value = l;
  });

  // Create Ticket Modal Buttons & Controls
  document.getElementById('btnOpenCreateTicketModal')?.addEventListener('click', openCreateTicketModal);
  document.getElementById('btnCloseCreateTicketModal')?.addEventListener('click', closeCreateTicketModal);
  document.getElementById('btnCancelCreateTicket')?.addEventListener('click', closeCreateTicketModal);
  document.getElementById('btnSubmitCreateTicket')?.addEventListener('click', submitCreateTicket);
  setupLayoutAutocomplete();

  // Dynamic dev filtering when subject or product changes
  document.getElementById('newTicketType')?.addEventListener('change', () => {
    updateDevSelectForCurrentType();
  });
  document.getElementById('newTicketProduct')?.addEventListener('change', () => {
    updateDevSelectForCurrentType();
  });

  // Calendar update when dev changes
  document.getElementById('newTicketAssignedTo')?.addEventListener('change', (e) => {
    renderDeveloperCalendar(e.target.value);
  });

  // Calendar month navigation buttons
  document.getElementById('btnCalPrev')?.addEventListener('click', () => {
    calCurrentMonth--;
    if (calCurrentMonth < 0) {
      calCurrentMonth = 11;
      calCurrentYear--;
    }
    renderDeveloperCalendar(currentCalDevId);
  });

  document.getElementById('btnCalNext')?.addEventListener('click', () => {
    calCurrentMonth++;
    if (calCurrentMonth > 11) {
      calCurrentMonth = 0;
      calCurrentYear++;
    }
    renderDeveloperCalendar(currentCalDevId);
  });

  // Setup file & image dropzone + paste handler
  setupDropzone();
  setupRichTextEditor();
  setupFloatingCalendar();
  setupClientCalendar();

  // Priority Select styling updates
  document.querySelectorAll('.priority-select').forEach(sel => {
    updatePrioritySelectVisual(sel);
    sel.addEventListener('change', () => updatePrioritySelectVisual(sel));
  });

  // Drawer Subsystems
  setupDrawerDeliveryCalendar();
  setupDrawerClientCalendar();
  setupDrawerLayoutAutocomplete();
  setupDrawerDropzone();

  // Drawer Save Actions
  document.getElementById('btnDrawerSaveTicket')?.addEventListener('click', saveDrawerTicketChanges);
  document.getElementById('btnDrawerSaveTicketBottom')?.addEventListener('click', saveDrawerTicketChanges);

  // Drawer Size Toggle
  document.getElementById('btnToggleDrawerExpand')?.addEventListener('click', toggleDrawerExpand);

  // Drawer Tabs
  document.getElementById('drawerTabBtnDetails')?.addEventListener('click', () => switchDrawerTab('details'));
  document.getElementById('drawerTabBtnComments')?.addEventListener('click', () => switchDrawerTab('comments'));
  document.getElementById('drawerTabBtnAttachments')?.addEventListener('click', () => switchDrawerTab('attachments'));
  document.getElementById('drawerTabBtnNotes')?.addEventListener('click', () => switchDrawerTab('notes'));

  // Activity Stream Filters
  document.getElementById('btnStreamFilterAll')?.addEventListener('click', () => setDrawerStreamFilter('all'));
  document.getElementById('btnStreamFilterComments')?.addEventListener('click', () => setDrawerStreamFilter('comments'));
  document.getElementById('btnStreamFilterEvents')?.addEventListener('click', () => setDrawerStreamFilter('events'));

  // Description Edit Toggle & Toolbar
  document.getElementById('btnToggleEditDesc')?.addEventListener('click', () => toggleDrawerDescEdit());
  document.getElementById('btnSaveDescOnly')?.addEventListener('click', saveDrawerTicketChanges);
  document.getElementById('btnCancelEditDesc')?.addEventListener('click', () => toggleDrawerDescEdit(false));

  document.querySelectorAll('#drawerDescToolbar .toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      document.execCommand(cmd, false, val);
      document.getElementById('drawerEditDescEditor')?.focus();
    });
  });

  // Submit Comment & Keyboard Shortcut (Ctrl+Enter)
  document.getElementById('btnSubmitComment')?.addEventListener('click', submitComment);
  const commentTextarea = document.getElementById('drawerNewCommentText');
  commentTextarea?.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitComment();
    }
  });

  // Archive Ticket
  document.getElementById('btnArchiveTicket')?.addEventListener('click', archiveCurrentTicket);

  // Drawer Close
  document.getElementById('btnCloseDrawer')?.addEventListener('click', closeDemandDrawer);
  document.getElementById('drawerOverlay')?.addEventListener('click', closeDemandDrawer);

  const openTicketInImporter = () => {
    if (selectedTicket && window.electronAPI) {
      window.electronAPI.openExternal(`https://importer.conciliadorcontabil.com.br/support/tickets/${selectedTicket.id}`);
    } else if (selectedTicket) {
      window.open(`https://importer.conciliadorcontabil.com.br/support/tickets/${selectedTicket.id}`, '_blank');
    }
  };

  const openTicketInMovidesk = () => {
    const movId = document.getElementById('drawerEditMovidesk')?.value || selectedTicket?.movideskTicketId;
    if (movId && window.electronAPI) {
      window.electronAPI.openExternal(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${movId}`);
    } else if (movId) {
      window.open(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${movId}`, '_blank');
    } else {
      alert('Esta demanda não possui número do Movidesk associado.');
    }
  };

  document.getElementById('btnOpenWeb')?.addEventListener('click', openTicketInImporter);
  document.getElementById('btnDrawerOpenConciliador')?.addEventListener('click', openTicketInImporter);
  document.getElementById('btnOpenMovidesk')?.addEventListener('click', openTicketInMovidesk);
  document.getElementById('btnDrawerOpenMovidesk')?.addEventListener('click', openTicketInMovidesk);

  // AutoDrive Button in Drawer Header
  document.getElementById('btnDrawerAutoDrive')?.addEventListener('click', () => {
    if (selectedTicket) openAutoDriveModal(selectedTicket);
  });

  // Minimize Program Buttons when viewing Demand
  document.getElementById('btnDrawerMinimize')?.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.minimize) {
      window.electronAPI.minimize();
    }
  });

  document.getElementById('btnDrawerWindowMinimize')?.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.minimize) {
      window.electronAPI.minimize();
    }
  });

  // Quick Copy Database & Movidesk
  document.getElementById('btnCopyDatabase')?.addEventListener('click', () => {
    const db = document.getElementById('drawerEditDatabase')?.value || selectedTicket?.clientDatabase;
    if (db) {
      navigator.clipboard.writeText(db);
      const btn = document.getElementById('btnCopyDatabase');
      if (btn) btn.innerHTML = '<span>✔</span> Copiado!';
      setTimeout(() => {
        if (btn) btn.innerHTML = '<span>📋</span> Copiar Banco';
      }, 2000);
    }
  });

  document.getElementById('btnDrawerCopyDbAction')?.addEventListener('click', () => {
    const db = document.getElementById('drawerEditDatabase')?.value || selectedTicket?.clientDatabase;
    if (db) {
      navigator.clipboard.writeText(db);
      const btn = document.getElementById('btnDrawerCopyDbAction');
      if (btn) {
        btn.textContent = '✔';
        setTimeout(() => { if (btn) btn.textContent = '📋'; }, 2000);
      }
    }
  });

  document.getElementById('btnDrawerOpenMovideskAction')?.addEventListener('click', openTicketInMovidesk);

  document.getElementById('btnToggleDrawerFavorite')?.addEventListener('click', async () => {
    if (selectedTicket) {
      const isFav = await window.appStore.toggleFavorite(selectedTicket.id);
      renderFixedFiltersList();
      renderDemands();
      const btn = document.getElementById('btnToggleDrawerFavorite');
      btn.innerHTML = `<span>⭐</span> ${isFav ? 'Remover Favorito' : 'Favoritar'}`;
    }
  });

  document.getElementById('btnToggleDrawerIgnore')?.addEventListener('click', async () => {
    if (selectedTicket) {
      const isNowIgnored = await window.appStore.toggleIgnore(selectedTicket.id);
      const btn = document.getElementById('btnToggleDrawerIgnore');
      if (btn) {
        btn.innerHTML = isNowIgnored ? '<span>↩️</span> Reativar Chamado' : '<span>🚫</span> Ignorar Chamado';
        btn.style.color = isNowIgnored ? '#10b981' : '';
      }
      renderFixedFiltersList();
      renderDemands();
    }
  });


  // Debounced auto-save for local notes
  let noteDebounceTimer;
  const notesTextarea = document.getElementById('drawerLocalNotes');
  notesTextarea?.addEventListener('input', () => {
    if (!selectedTicket) return;
    const statusEl = document.getElementById('noteSaveStatus');
    if (statusEl) statusEl.textContent = 'Salvando...';

    clearTimeout(noteDebounceTimer);
    noteDebounceTimer = setTimeout(async () => {
      await window.appStore.saveNote(selectedTicket.id, notesTextarea.value);
      if (statusEl) statusEl.textContent = 'Salvo automaticamente';
    }, 600);
  });

  // Fixed Filter Modal
  document.getElementById('btnOpenNewFilterModal')?.addEventListener('click', openNewFilterModal);
  document.getElementById('btnCloseFilterModal')?.addEventListener('click', closeFilterModal);
  document.getElementById('btnCancelFilterModal')?.addEventListener('click', closeFilterModal);
  document.getElementById('btnSaveFilterModal')?.addEventListener('click', saveFilterModal);

  // Restore Default Filters button
  document.getElementById('btnRestoreDefaultFilters')?.addEventListener('click', async () => {
    if (confirm('Deseja restaurar todos os filtros fixos padrão que foram apagados?')) {
      await window.appStore.restoreDefaultFilters();
      renderFixedFiltersList();
      renderDemands();
    }
  });

  // Auto-refresh interval change
  document.getElementById('selectAutoRefresh')?.addEventListener('change', async (e) => {
    const mins = parseInt(e.target.value, 10);
    window.appStore.autoRefreshMinutes = mins;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('autoRefreshMinutes', mins);
    }
    setupAutoRefresh();
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    if (confirm('Deseja realmente desconectar da sua conta?')) {
      await window.appStore.logout();

      // Reset user profile in sidebar to neutral state
      const nameEl = document.getElementById('userName');
      const roleEl = document.getElementById('userRole');
      const avatarEl = document.getElementById('userAvatar');
      if (nameEl) nameEl.textContent = 'Não conectado';
      if (roleEl) roleEl.textContent = 'Desconectado';
      if (avatarEl) avatarEl.textContent = '--';

      // Clear password field
      const pwdInput = document.getElementById('loginPassword');
      if (pwdInput) pwdInput.value = '';

      showLoginOverlay();
    }
  });

  // Login form submit
  document.getElementById('btnLoginSubmit')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const remember = document.getElementById('loginRemember').checked;
    if (!email || !password) {
      alert('Preencha e-mail e senha.');
      return;
    }
    doLogin(email, password, remember);
  });

  // Support pressing Enter inside login inputs
  ['loginEmail', 'loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btnLoginSubmit')?.click();
      }
    });
  });

  // Image Lightbox Close
  document.getElementById('btnCloseLightbox')?.addEventListener('click', closeImageLightbox);
  document.getElementById('imageLightboxOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'imageLightboxOverlay' || e.target.id === 'lightboxBody') {
      closeImageLightbox();
    }
  });

  // AutoDrive Modal Event Listeners
  document.getElementById('btnCloseAutoDriveModal')?.addEventListener('click', closeAutoDriveModal);
  document.getElementById('btnCancelAutoDriveModal')?.addEventListener('click', closeAutoDriveModal);
  document.getElementById('modalAutoDrive')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalAutoDrive') closeAutoDriveModal();
  });

  document.getElementById('btnCopyAutoDriveQuick')?.addEventListener('click', () => {
    const txt = document.getElementById('autoDriveQuickText')?.value;
    if (txt) {
      navigator.clipboard.writeText(txt);
      const spanText = document.getElementById('copyQuickBtnText');
      if (spanText) {
        spanText.textContent = 'Copiado!';
        setTimeout(() => { if (spanText) spanText.textContent = 'Copiar'; }, 2000);
      }
    }
  });

  // Interactive quick text updating when form fields change
  const syncAutoDriveFormToQuick = () => {
    const num = (document.getElementById('autoDriveNumeroLayout')?.value || '').trim();
    const tipo = (document.getElementById('autoDriveTipo')?.value || '').trim();
    const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
    const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();
    const db = (document.getElementById('autoDriveDatabase')?.value || '').trim();

    const parts = [];
    if (num) parts.push(num);
    if (tipo) parts.push(tipo);
    if (ent) parts.push(ent);
    if (doc) parts.push(doc);
    if (db) parts.push(db);

    const inputQuick = document.getElementById('autoDriveQuickText');
    if (inputQuick) inputQuick.value = parts.join(' - ');
  };

  ['autoDriveNumeroLayout', 'autoDriveTipo', 'autoDriveEntidade', 'autoDriveDocumento', 'autoDriveDatabase'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', syncAutoDriveFormToQuick);
  });

  document.getElementById('autoDriveEntidade')?.addEventListener('input', (e) => {
    const doc = document.getElementById('autoDriveDocumento')?.value || '';
    const guessed = guessAutoDriveCategory(e.target.value, doc);
    const selCat = document.getElementById('autoDriveCategoria');
    if (selCat && guessed) selCat.value = guessed;
  });

  document.getElementById('btnLaunchAutoDriveNow')?.addEventListener('click', executeAutoDriveLaunch);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+M -> minimize window
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.minimize) {
        window.electronAPI.minimize();
      }
    }
    // Ctrl+N -> new ticket modal
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openCreateTicketModal();
    }
    // Ctrl+F -> focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('inputSearch')?.focus();
    }
    // Ctrl+R -> sync
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      syncDemands();
    }
    // Esc -> close drawer / modals / lightbox
    if (e.key === 'Escape') {
      closeImageLightbox();
      closeAutoDriveModal();
      closeDemandDrawer();
      closeCreateTicketModal();
      closeFilterModal();
    }
  });
}

function setupAutoRefresh() {
  if (autoSyncTimerId) clearInterval(autoSyncTimerId);

  const mins = window.appStore.autoRefreshMinutes;
  if (mins && mins > 0) {
    autoSyncTimerId = setInterval(() => {
      if (window.appStore.token) {
        syncDemands();
      }
    }, mins * 60 * 1000);
  }
}

// ------------------- AutoDrive Integration Module -------------------
let currentAutoDriveTicket = null;

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
  const db = (ticket.clientDatabase || '').trim();
  const ticketNumber = ticket.number != null ? String(ticket.number) : '';
  const layoutCode = ticket.layout?.code != null ? String(ticket.layout.code) : '';
  const layoutName = (ticket.layout?.name || '').trim();
  const typeName = (ticket.ticketType?.name || 'NOVO LAYOUT').toUpperCase();

  const numeroLayout = layoutCode || ticketNumber || '';

  let cleanTitle = rawTitle;
  const numMatch = cleanTitle.match(/^\s*#?(\d+)\s*[-–—:]\s*(.*)$/i);
  if (numMatch) {
    cleanTitle = numMatch[2].trim();
  }

  const knownTipos = ["NOVO LAYOUT", "NOVO", "ALTERACAO", "ALTERAÇÃO", "AJUSTE", "ATUALIZACAO", "ATUALIZAÇÃO", "CORRECAO", "CORREÇÃO", "LAYOUT", "MELHORIA", "ERRO"];
  let detectedType = typeName;
  let remainingTitle = cleanTitle;

  for (const t of knownTipos) {
    const reg = new RegExp(`^${t}\\s*[-–—:]\\s*(.*)$`, 'i');
    const m = remainingTitle.match(reg);
    if (m) {
      detectedType = t;
      remainingTitle = m[1].trim();
      break;
    }
  }

  const parts = remainingTitle.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);

  let entidade = '';
  let nomeDocumento = '';

  if (parts.length >= 2) {
    entidade = parts[0];
    nomeDocumento = parts.slice(1).join(' - ');
  } else if (parts.length === 1) {
    if (layoutName) {
      entidade = parts[0];
      nomeDocumento = layoutName;
    } else {
      entidade = parts[0];
      nomeDocumento = parts[0];
    }
  } else if (layoutName) {
    nomeDocumento = layoutName;
  }

  if (db && nomeDocumento.toLowerCase().endsWith(db.toLowerCase())) {
    nomeDocumento = nomeDocumento.substring(0, nomeDocumento.length - db.length).replace(/\s*[-–—]\s*$/, '').trim();
  }

  const categoria = guessAutoDriveCategory(entidade, nomeDocumento);

  const quickParts = [];
  if (numeroLayout) quickParts.push(numeroLayout);
  if (detectedType) quickParts.push(detectedType);
  if (entidade) quickParts.push(entidade.toUpperCase());
  if (nomeDocumento && nomeDocumento !== entidade) quickParts.push(nomeDocumento.toUpperCase());
  if (db) quickParts.push(db);

  const quickText = quickParts.join(' - ');

  return {
    numero_layout: numeroLayout,
    tipo: detectedType,
    entidade: sanitizeAutoDriveText(entidade),
    nome_documento: sanitizeAutoDriveText(nomeDocumento),
    database: db,
    categoria: categoria || 'BANCOS',
    quick: quickText
  };
}

async function openAutoDriveModal(ticket) {
  if (!ticket) return;
  currentAutoDriveTicket = ticket;

  const modal = document.getElementById('modalAutoDrive');
  if (!modal) return;

  const parsed = parseDemandForAutoDrive(ticket);

  const inputQuick = document.getElementById('autoDriveQuickText');
  const inputNum = document.getElementById('autoDriveNumeroLayout');
  const selCat = document.getElementById('autoDriveCategoria');
  const inputEnt = document.getElementById('autoDriveEntidade');
  const inputTipo = document.getElementById('autoDriveTipo');
  const inputDoc = document.getElementById('autoDriveDocumento');
  const inputDb = document.getElementById('autoDriveDatabase');

  if (inputQuick) inputQuick.value = parsed.quick;
  if (inputNum) inputNum.value = parsed.numero_layout;
  if (selCat) selCat.value = parsed.categoria;
  if (inputEnt) inputEnt.value = parsed.entidade;
  if (inputTipo) inputTipo.value = parsed.tipo;
  if (inputDoc) inputDoc.value = parsed.nome_documento;
  if (inputDb) inputDb.value = parsed.database;

  // Render attachments list
  renderAutoDriveModalAttachments(ticket);

  // If attachments are not loaded yet on this ticket, fetch details
  if (!ticket.attachments || ticket.attachments.length === 0) {
    try {
      const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);
      if (details && details.attachments) {
        ticket.attachments = details.attachments;
        renderAutoDriveModalAttachments(ticket);
      }
    } catch (err) {
      console.warn('Erro ao carregar anexos para o AutoDrive:', err);
    }
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function renderAutoDriveModalAttachments(ticket) {
  const listEl = document.getElementById('autoDriveAttachmentsList');
  const countEl = document.getElementById('autoDriveAttachmentsCount');
  if (!listEl) return;

  const attachments = ticket?.attachments || [];
  if (countEl) countEl.textContent = `${attachments.length} arquivo${attachments.length === 1 ? '' : 's'}`;

  if (attachments.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">Nenhum artefato anexado a esta demanda.</div>';
    return;
  }

  listEl.innerHTML = attachments.map(att => {
    const fName = att.fileName || att.filename || att.originalName || att.name || 'Arquivo';
    const ext = (fName.split('.').pop() || '').toLowerCase();
    const isPdf = ext === 'pdf';
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext);

    let roleBadge = '';
    if (isPdf) {
      roleBadge = '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 700;">📕 Manual PDF</span>';
    } else if (isImg) {
      roleBadge = '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 700;">🖼️ Imagem Mapeamento</span>';
    } else {
      roleBadge = `<span style="background: rgba(100, 116, 139, 0.2); color: #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 10px;">${ext.toUpperCase()}</span>`;
    }

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(13, 17, 23, 0.7); border: 1px solid var(--border-color); border-radius: 6px;">
        <span style="font-family: Consolas, monospace; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 380px;" title="${escapeHtml(fName)}">${escapeHtml(fName)}</span>
        <div>${roleBadge}</div>
      </div>
    `;
  }).join('');
}

function closeAutoDriveModal() {
  const modal = document.getElementById('modalAutoDrive');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  currentAutoDriveTicket = null;
}

async function executeAutoDriveLaunch() {
  if (!currentAutoDriveTicket) return;

  const btn = document.getElementById('btnLaunchAutoDriveNow');
  const btnIcon = document.getElementById('autoDriveBtnIcon');
  const btnText = document.getElementById('autoDriveBtnText');

  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Iniciando AutoDrive...';

  try {
    const ticket = currentAutoDriveTicket;
    const quick = document.getElementById('autoDriveQuickText')?.value || '';
    const num = document.getElementById('autoDriveNumeroLayout')?.value || '';
    const ent = document.getElementById('autoDriveEntidade')?.value || '';
    const doc = document.getElementById('autoDriveDocumento')?.value || '';
    const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';

    // Find PDF and Image attachments if available
    let pdfBuffer = null;
    let pdfName = null;
    let imageBuffer = null;
    let imageName = null;

    const attachments = ticket.attachments || [];
    const pdfAtt = attachments.find(a => {
      const n = (a.fileName || a.filename || a.originalName || a.name || '').toLowerCase();
      return n.endsWith('.pdf');
    });

    const imgAtt = attachments.find(a => {
      const n = (a.fileName || a.filename || a.originalName || a.name || '').toLowerCase();
      return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp') || n.endsWith('.bmp');
    });

    if (pdfAtt) {
      try {
        if (btnText) btnText.textContent = 'Baixando manual PDF...';
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, pdfAtt.id);
        pdfBuffer = await blob.arrayBuffer();
        pdfName = pdfAtt.fileName || pdfAtt.filename || pdfAtt.originalName || pdfAtt.name || 'manual.pdf';
      } catch (e) {
        console.warn('Erro ao carregar PDF:', e);
      }
    }

    if (imgAtt) {
      try {
        if (btnText) btnText.textContent = 'Baixando imagem...';
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, imgAtt.id);
        imageBuffer = await blob.arrayBuffer();
        imageName = imgAtt.fileName || imgAtt.filename || imgAtt.originalName || imgAtt.name || 'mapeamento.png';
      } catch (e) {
        console.warn('Erro ao carregar imagem:', e);
      }
    }

    if (btnText) btnText.textContent = 'Executando AutoDrive...';

    const launchData = {
      quick,
      numero_layout: num,
      entidade: ent,
      nome_documento: doc,
      categoria: cat,
      pdfBuffer,
      pdfName,
      imageBuffer,
      imageName
    };

    if (window.electronAPI && window.electronAPI.launchAutoDrive) {
      const res = await window.electronAPI.launchAutoDrive(launchData);
      if (!res.success) {
        alert('Erro ao iniciar o AutoDrive: ' + res.error);
        return;
      }
    } else {
      alert('Integração com AutoDrive requer execução no aplicativo Desktop Electron.');
      return;
    }

    closeAutoDriveModal();

    // Check if user wants to minimize app
    const shouldMinimize = document.getElementById('chkAutoDriveMinimizeApp')?.checked;
    if (shouldMinimize && window.electronAPI && window.electronAPI.minimize) {
      window.electronAPI.minimize();
    }

  } catch (err) {
    alert('Erro ao executar integração do AutoDrive: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = '🚀';
    if (btnText) btnText.textContent = 'Abrir no AutoDrive';
  }
}
