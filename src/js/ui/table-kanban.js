// UI Module: Table View (Incremental Pagination & Resizable Columns), Kanban Board & Quick/Fixed Filters
// Populate developer dropdowns dynamically from ticket data
function populateDeveloperSelects() {
  const devs = new Set();
  window.appStore.getKnownDevelopers().forEach(d => {
    if (d && d.name && d.name !== 'Não atribuído') devs.add(d.name);
  });
  window.appStore.demands.forEach(t => {
    if (t.assignedTo && t.assignedTo.name && t.assignedTo.name !== 'Não atribuído') {
      devs.add(t.assignedTo.name);
    }
  });

  const modalDevSelect = document.getElementById('modalFilterDev');
  const modalRevSelect = document.getElementById('modalFilterReviewer');
  const sortedDevs = Array.from(devs).sort((a, b) => a.localeCompare(b));

  if (modalDevSelect) {
    const currentVal = modalDevSelect.value;
    modalDevSelect.innerHTML = `
      <option value="">Qualquer Desenvolvedor</option>
      <option value="CURRENT_USER">👤 Eu mesmo (Usuário Conectado)</option>
      <option value="__NONE__">👤 Nenhum responsável (Não atribuído)</option>
    `;
    sortedDevs.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev;
      opt.textContent = dev;
      modalDevSelect.appendChild(opt);
    });
    modalDevSelect.value = currentVal || '';
  }

  if (modalRevSelect) {
    const currentVal = modalRevSelect.value;
    const currentUser = window.appStore?.currentUser;
    modalRevSelect.innerHTML = `
      <option value="">Qualquer Validador</option>
      <option value="__NONE__">👤 Sem validador (Em branco)</option>
      ${currentUser && currentUser.name ? `<option value="${escapeHtml(currentUser.name)}">⭐ ${escapeHtml(currentUser.name)} (Você - Usuário Conectado)</option>` : ''}
    `;
    modalRevSelect.value = currentVal || '';
  }

  renderFilterDropdownOptions('assignedTo');
  renderFilterDropdownOptions('reviewer');
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

  const modalLabelSelect = document.getElementById('modalFilterLabel');

  if (modalLabelSelect) {
    const currentVal = modalLabelSelect.value;
    modalLabelSelect.innerHTML = `
      <option value="">Qualquer Etiqueta</option>
      <option value="__NONE__">🏷️ Sem etiquetas</option>
    `;
    Array.from(labelsMap.values()).forEach(lbl => {
      const opt = document.createElement('option');
      opt.value = lbl.name;
      opt.textContent = lbl.name;
      modalLabelSelect.appendChild(opt);
    });
    modalLabelSelect.value = currentVal || '';
  }

  renderFilterDropdownOptions('label');
}

// Render fixed filter tabs in the left sidebar
function renderFixedFiltersList() {
  const container = document.getElementById('fixedFiltersList');
  if (!container) return;

  container.innerHTML = '';
  const filters = window.appStore.fixedFilters;
  const activeId = window.appStore.activeFilterId;

  // Update total stat and closed today stat
  const statTotal = document.getElementById('statTotalCount');
  if (statTotal) statTotal.textContent = window.appStore.demands.length;

  const statDoneToday = document.getElementById('statDoneTodayCount');
  if (statDoneToday) statDoneToday.textContent = window.appStore.getClosedTodayCount();

  // Show/hide restore default filters button if any default is missing
  const btnRestore = document.getElementById('btnRestoreDefaultFilters');
  if (btnRestore) {
    btnRestore.style.display = window.appStore.hasMissingDefaultFilters() ? 'inline-flex' : 'none';
  }

  filters.forEach(f => {
    const count = window.appStore.countForFilter(f);
    const item = document.createElement('div');
    const isDangerFilter = (f.id === 'errors_urgent');
    item.className = `filter-item ${f.id === activeId ? 'active' : ''}${isDangerFilter ? ' filter-item-danger' : ''}`;
    item.dataset.id = f.id;

    const canDeleteOrEdit = (f.id !== 'all');
    const iconHtml = window.getFilterIconHtml ? window.getFilterIconHtml(f) : (f.icon || '🎯');
    const editIconHtml = window.renderIcon ? window.renderIcon('edit') : '✏️';
    const trashIconHtml = window.renderIcon ? window.renderIcon('trash') : '🗑️';

    item.innerHTML = `
      <div class="filter-item-left">
        <span class="filter-icon">${iconHtml}</span>
        <span class="filter-name" title="${f.name}">${f.name}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="filter-badge">${count}</span>
        ${canDeleteOrEdit ? `
          <div class="filter-actions">
            <button class="filter-action-btn btn-edit-filter" title="Editar Filtro">${editIconHtml}</button>
            <button class="filter-action-btn btn-delete-filter" title="Apagar Filtro">${trashIconHtml}</button>
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
        const ok = await showAppConfirm(`Deseja realmente apagar o filtro "${f.name}"?`, 'Excluir Filtro', { isDanger: true, confirmText: 'Apagar Filtro' });
        if (ok) {
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
  if (iconEl) iconEl.innerHTML = window.getFilterIconHtml ? window.getFilterIconHtml(activePreset) : (activePreset.icon || '⚡');
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

// Incremental Table Pagination & Rendering State
const TABLE_PAGE_SIZE = 120;
let currentTableDemands = [];
let currentTableRenderedCount = 0;
let tableScrollListenerInitialized = false;

function buildTableRowHtml(t) {
  const isFav = window.appStore.isFavorite(t.id);
  const isIgnored = window.appStore.isIgnored(t.id);
  const typeBadge = getTypeBadgeHtml(t.ticketType?.name);
  const statusBadge = getStatusBadgeHtml(t.status);
  const layoutInfo = getTicketLayoutInfo(t);
  const layoutCode = layoutInfo.code;
  const layoutId = resolveLayoutId(layoutInfo.id, layoutCode);
  const dateBadge = renderDateBadge(t.deliveryDueDate || t.clientDueDate);

  return `
    <tr data-id="${t.id}" class="${isIgnored ? 'row-ignored' : ''}">
      <td style="text-align: center;">
        <span class="favorite-star ${isFav ? 'active' : ''}" data-fav-id="${t.id}">${isFav ? '★' : '☆'}</span>
      </td>
      <td style="font-weight: 700; color: var(--accent-primary);">#${t.number || '-'}</td>
      <td style="font-weight: 600; font-size: 13px;">
        ${layoutCode ? `
          <div class="table-layout-cell-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; gap: 3px;">
            <a href="#" class="btn-open-layout table-layout-link" data-ticket-id="${t.id}" data-layout-id="${layoutId || ''}" data-layout-code="${layoutCode}" title="Abrir Layout ${layoutCode} no Importer Ultra">
              <span>${layoutCode}</span> <span class="layout-link-icon" style="font-size: 10px; opacity: 0.85;">↗</span>
            </a>
            ${(() => {
              const lStatus = layoutInfo.status || (layoutCode ? layoutCodeToIdCache.get(String(layoutCode).trim())?.status : null) || 'draft';
              const sBadge = formatLayoutStatusBadge(lStatus);
              return sBadge ? `<span class="badge-layout-status ${sBadge.className}" style="font-size: 9.5px; padding: 1px 5px;" title="Status do Layout no Importer Ultra: ${sBadge.label}">${sBadge.icon} ${sBadge.label}</span>` : '';
            })()}
          </div>
        ` : '<span style="color: var(--text-muted);">-</span>'}
      </td>
      <td>
        <div class="table-cell-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
        ${getLabelsBadgesHtml(t.labels) ? `<div class="table-cell-labels">${getLabelsBadgesHtml(t.labels)}</div>` : ''}
      </td>
      <td>
        ${t.movideskTicketId ? `
          <a href="#" class="btn-open-movi" data-movi="${t.movideskTicketId}" title="Abrir ticket ${t.movideskTicketId} no Movidesk" style="color: #60A5FA; text-decoration: none; font-weight: 600; font-variant-numeric: tabular-nums;">
            ${t.movideskTicketId} ↗
          </a>
        ` : '<span style="color: var(--text-muted);">-</span>'}
      </td>
      <td class="table-cell-client">
        <code style="background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #a5b4fc; max-width: 100%; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${escapeHtml(t.clientDatabase || '-')}">
          ${escapeHtml(t.clientDatabase || '-')}
        </code>
      </td>
      <td>${typeBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(t.assignedTo?.name || 'Não atribuído')}</span>
      </td>
      <td>
        ${t.reviewer?.name || t.reviewerName || (typeof t.reviewer === 'string' && t.reviewer ? t.reviewer : '') ? `
          <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(t.reviewer?.name || t.reviewerName || t.reviewer)}</span>
        ` : '<span style="color: var(--text-muted);">-</span>'}
      </td>
      <td>${dateBadge}</td>
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
}

function bindTableRowElements(rows) {
  rows.forEach(row => {
    if (row.dataset.bound === '1') return;
    row.dataset.bound = '1';

    row.addEventListener('click', (e) => {
      if (e.target.closest('.favorite-star') || e.target.closest('.btn-open-movi') || e.target.closest('.btn-open-layout') || e.target.closest('.btn-toggle-ignore') || e.target.closest('.btn-quick-autodrive')) return;
      const ticketId = row.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) {
        if (window.appTabs) window.appTabs.openTicketTab(ticket);
        else openDemandDrawer(ticket);
      }
    });

    row.querySelectorAll('.btn-quick-autodrive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticketId = btn.dataset.id;
        const ticket = window.appStore.demands.find(d => d.id === ticketId);
        if (ticket) openAutoDriveModal(ticket);
      });
    });

    row.querySelectorAll('.favorite-star').forEach(star => {
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = star.dataset.favId;
        const newStatus = await window.appStore.toggleFavorite(id);
        star.className = `favorite-star ${newStatus ? 'active' : ''}`;
        star.innerHTML = window.renderIcon ? window.renderIcon(newStatus ? 'star' : 'star-outline') : (newStatus ? '★' : '☆');
        renderFixedFiltersList();
      });
    });

    row.querySelectorAll('.btn-toggle-ignore').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await window.appStore.toggleIgnore(id);
        renderFixedFiltersList();
        renderDemands();
      });
    });

    row.querySelectorAll('.btn-open-movi').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const moviId = link.dataset.movi;
        if (window.electronAPI) {
          window.electronAPI.openExternal(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${moviId}`);
        }
      });
    });

    row.querySelectorAll('.btn-open-layout').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = link.dataset.layoutId;
        const code = link.dataset.layoutCode;
        openLayoutInImporter(id, code);
      });
    });
  });
}

function updateTableLoadMoreFooter(tbody) {
  const existingFooter = document.getElementById('tableLoadMoreRow');
  if (existingFooter) existingFooter.remove();

  const total = currentTableDemands.length;
  if (currentTableRenderedCount >= total) return;

  const remaining = total - currentTableRenderedCount;
  const nextCount = Math.min(TABLE_PAGE_SIZE, remaining);
  const tr = document.createElement('tr');
  tr.id = 'tableLoadMoreRow';
  tr.innerHTML = `
    <td colspan="12" style="text-align: center; padding: 14px; background: rgba(16, 185, 129, 0.04); border-top: 1px dashed var(--border-color); cursor: pointer;">
      <button type="button" class="btn-secondary" id="btnLoadMoreTableRows" style="margin: 0 auto; height: 32px; font-size: 12px;">
        <span>⬇️</span> Mostrando ${currentTableRenderedCount} de ${total} demandas — Carregar mais (+${nextCount})
      </button>
    </td>
  `;
  tr.addEventListener('click', () => appendNextTableBatch());
  tbody.appendChild(tr);
}

function appendNextTableBatch() {
  const tbody = document.getElementById('demandsTableBody');
  if (!tbody || currentTableRenderedCount >= currentTableDemands.length) return;

  const existingFooter = document.getElementById('tableLoadMoreRow');
  if (existingFooter) existingFooter.remove();

  const nextBatch = currentTableDemands.slice(currentTableRenderedCount, currentTableRenderedCount + TABLE_PAGE_SIZE);
  currentTableRenderedCount += nextBatch.length;

  const temp = document.createElement('tbody');
  temp.innerHTML = nextBatch.map(buildTableRowHtml).join('');
  const newRows = Array.from(temp.querySelectorAll('tr'));
  newRows.forEach(r => tbody.appendChild(r));

  bindTableRowElements(newRows);
  updateTableLoadMoreFooter(tbody);
  applySavedColumnWidths();
  sweepAndInjectMissingLayoutBadges();
}

function initTableInfiniteScroll() {
  if (tableScrollListenerInitialized) return;
  tableScrollListenerInitialized = true;

  const scrollContainers = [
    document.querySelector('.content-workspace'),
    document.getElementById('tableViewContainer')
  ].filter(Boolean);

  const onScroll = (e) => {
    if (window.appStore?.activeView !== 'table') return;
    if (currentTableRenderedCount >= currentTableDemands.length) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 280) {
      appendNextTableBatch();
    }
  };

  scrollContainers.forEach(el => el.addEventListener('scroll', onScroll, { passive: true }));
}

// Render Table View (with incremental pagination for large lists)
function renderTableView(demands) {
  const tbody = document.getElementById('demandsTableBody');
  if (!tbody) return;

  initTableInfiniteScroll();
  updateSortIndicators();

  currentTableDemands = demands;
  currentTableRenderedCount = 0;

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

  const firstBatch = demands.slice(0, TABLE_PAGE_SIZE);
  currentTableRenderedCount = firstBatch.length;

  tbody.innerHTML = firstBatch.map(buildTableRowHtml).join('');
  bindTableRowElements(Array.from(tbody.querySelectorAll('tr')));
  updateTableLoadMoreFooter(tbody);

  applySavedColumnWidths();
  sweepAndInjectMissingLayoutBadges();
}

const tableColumnMinLimits = {
  star: 36,
  number: 55,
  layout: 70,
  title: 120,
  movidesk: 70,
  client: 80,
  type: 70,
  status: 80,
  assignedTo: 80,
  reviewer: 80,
  deliveryDueDate: 90,
  actions: 50
};

const tableColumnDefaultWidths = {
  star: 42,
  number: 75,
  layout: 105,
  title: 380,
  movidesk: 95,
  client: 130,
  type: 105,
  status: 130,
  assignedTo: 130,
  reviewer: 130,
  deliveryDueDate: 145,
  actions: 65
};

function applySavedColumnWidths() {
  const table = document.getElementById('demandsTable');
  if (!table) return;

  const colgroup = document.getElementById('demandsTableColgroup');
  const ths = table.querySelectorAll('thead th');
  const savedWidths = window.appStore?.tableColumnWidths || {};

  let totalWidth = 0;

  ths.forEach(th => {
    const colName = th.dataset.col;
    const colElem = colgroup ? colgroup.querySelector(`col[data-col="${colName}"]`) : null;
    const minLimit = (colName && tableColumnMinLimits[colName]) ? tableColumnMinLimits[colName] : 45;

    let w = null;
    if (colName && savedWidths[colName] != null) {
      const parsed = parseInt(savedWidths[colName], 10);
      if (!isNaN(parsed) && parsed >= minLimit) {
        w = parsed;
      }
    }

    if (w === null) {
      if (colName && tableColumnDefaultWidths[colName]) {
        w = tableColumnDefaultWidths[colName];
      } else {
        w = parseInt(th.style.width, 10) || th.offsetWidth || 100;
      }
      if (w < minLimit) w = minLimit;
    }

    const wPx = w + 'px';
    th.style.width = wPx;
    th.style.minWidth = wPx;
    th.style.maxWidth = wPx;

    if (colElem) {
      colElem.style.width = wPx;
      colElem.style.minWidth = wPx;
      colElem.style.maxWidth = wPx;
    }

    totalWidth += w;
  });

  table.style.width = totalWidth + 'px';
}

let tableColResizingInitialized = false;
function initTableColumnResizing() {
  applySavedColumnWidths();
  if (tableColResizingInitialized) return;

  const table = document.getElementById('demandsTable');
  if (!table) return;

  const resizers = table.querySelectorAll('thead .col-resizer');
  if (resizers.length === 0) return;
  tableColResizingInitialized = true;

  resizers.forEach(resizer => {
    const th = resizer.parentElement;
    if (!th) return;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const currentTable = document.getElementById('demandsTable');
      if (!currentTable) return;
      const colgroup = document.getElementById('demandsTableColgroup');

      const colName = th.dataset.col;
      const colElem = colgroup ? colgroup.querySelector(`col[data-col="${colName}"]`) : null;
      const minW = (colName && tableColumnMinLimits[colName]) ? tableColumnMinLimits[colName] : 45;

      const allThs = Array.from(currentTable.querySelectorAll('thead th'));
      const startWidths = new Map();
      let startTotalWidth = 0;

      // Trava cada coluna individualmente com minWidth e maxWidth para que NENHUMA outra coluna se mova ou distorça
      allThs.forEach(h => {
        const cName = h.dataset.col;
        const cEl = colgroup ? colgroup.querySelector(`col[data-col="${cName}"]`) : null;
        const cw = parseInt(h.style.width, 10) || h.offsetWidth || 100;
        startWidths.set(h, cw);

        const cwPx = cw + 'px';
        h.style.width = cwPx;
        h.style.minWidth = cwPx;
        h.style.maxWidth = cwPx;
        if (cEl) {
          cEl.style.width = cwPx;
          cEl.style.minWidth = cwPx;
          cEl.style.maxWidth = cwPx;
        }
        startTotalWidth += cw;
      });

      currentTable.style.width = startTotalWidth + 'px';

      const startX = e.pageX;
      const startColWidth = startWidths.get(th) || parseInt(th.style.width, 10) || th.offsetWidth;

      document.body.classList.add('table-col-resizing');
      resizer.classList.add('resizing');

      let currentNewWidth = startColWidth;

      const onMouseMove = (moveEvt) => {
        const deltaX = moveEvt.pageX - startX;
        currentNewWidth = Math.max(minW, startColWidth + deltaX);
        const diff = currentNewWidth - startColWidth;

        const newColWidthPx = currentNewWidth + 'px';
        th.style.width = newColWidthPx;
        th.style.minWidth = newColWidthPx;
        th.style.maxWidth = newColWidthPx;

        if (colElem) {
          colElem.style.width = newColWidthPx;
          colElem.style.minWidth = newColWidthPx;
          colElem.style.maxWidth = newColWidthPx;
        }

        currentTable.style.width = (startTotalWidth + diff) + 'px';
      };

      const onMouseUp = () => {
        document.body.classList.remove('table-col-resizing');
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Previne clique acidental de ordenação logo após arrasto
        th._justResized = true;
        setTimeout(() => { th._justResized = false; }, 200);

        // Recalcula soma exata da tabela
        let finalTableWidth = 0;
        allThs.forEach(h => {
          finalTableWidth += parseInt(h.style.width, 10) || h.offsetWidth;
        });
        currentTable.style.width = finalTableWidth + 'px';

        // Salva largura no appStore e storage.json
        if (window.appStore) {
          if (!window.appStore.tableColumnWidths) {
            window.appStore.tableColumnWidths = {};
          }
          if (colName) {
            window.appStore.tableColumnWidths[colName] = currentNewWidth;
          }
          if (window.electronAPI?.saveStorage) {
            window.electronAPI.saveStorage('tableColumnWidths', window.appStore.tableColumnWidths);
          }
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Duplo clique na alça reseta a coluna para a largura padrão
    resizer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colName = th.dataset.col;
      if (colName && tableColumnDefaultWidths[colName]) {
        if (window.appStore?.tableColumnWidths) {
          delete window.appStore.tableColumnWidths[colName];
          if (window.electronAPI?.saveStorage) {
            window.electronAPI.saveStorage('tableColumnWidths', window.appStore.tableColumnWidths);
          }
        }
        applySavedColumnWidths();
      }
    });

    resizer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
}


// Render Kanban View
function renderKanbanView(demands) {
  const container = document.getElementById('kanbanViewContainer');
  if (!container) return;

  const columns = [
    { id: 'queued', title: 'Na Fila', color: 'var(--status-queue)', statusMatch: ['queued', 'open', 'triage'] },
    { id: 'in_progress', title: 'Em Desenvolvimento', color: 'var(--status-progress)', statusMatch: ['in_progress', 'progress'] },
    { id: 'waiting', title: 'Aguardando N2', color: 'var(--status-waiting)', statusMatch: ['waiting', 'waiting_creator', 'waiting_requester'] },
    { id: 'paused', title: 'Pausado', color: '#f59e0b', statusMatch: ['paused'] },
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
      const layoutInfo = getTicketLayoutInfo(t);
      const layoutCode = layoutInfo.code;
      const layoutId = resolveLayoutId(layoutInfo.id, layoutCode);
      const dateBadge = renderDateBadge(t.deliveryDueDate || t.clientDueDate);
      const initials = t.assignedTo?.name ? t.assignedTo.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';

      const s = (t.status || '').toLowerCase();
      let quickActionsHtml = '';
      if (s === 'review') {
        quickActionsHtml = `
          <div class="kanban-card-quick-actions">
            <button type="button" class="btn-card-workflow btn-quick-finalize btn-kanban-action" data-action="finalize" data-id="${t.id}" title="Finalizar chamado">✅ Finalizar</button>
            <button type="button" class="btn-card-workflow btn-quick-return btn-kanban-action" data-action="return" data-id="${t.id}" title="Devolver para o desenvolvedor">↩️ Devolver</button>
          </div>
        `;
      } else if (s === 'waiting_requester' || s === 'waiting' || s === 'waiting_creator' || s === 'paused') {
        quickActionsHtml = `
          <div class="kanban-card-quick-actions">
            <button type="button" class="btn-card-workflow btn-quick-resume btn-kanban-action" data-action="resume" data-id="${t.id}" title="Retomar desenvolvimento">▶️ Retomar</button>
          </div>
        `;
      } else if (s === 'queued' || s === 'open' || s === 'triage') {
        quickActionsHtml = `
          <div class="kanban-card-quick-actions">
            <button type="button" class="btn-card-workflow btn-quick-start btn-kanban-action" data-action="start" data-id="${t.id}" title="Iniciar desenvolvimento">🚀 Iniciar</button>
          </div>
        `;
      } else if (s === 'in_progress' || s === 'progress') {
        quickActionsHtml = `
          <div class="kanban-card-quick-actions">
            <button type="button" class="btn-card-workflow btn-quick-pause btn-kanban-action" data-action="pause" data-id="${t.id}" title="Pausar desenvolvimento">⏸️ Pausar</button>
            <button type="button" class="btn-card-workflow btn-quick-waiting btn-kanban-action" data-action="wait" data-id="${t.id}" title="Aguardar resposta de quem abriu">⏳ Aguardar</button>
            <button type="button" class="btn-card-workflow btn-quick-review btn-kanban-action" data-action="review" data-id="${t.id}" title="Enviar para revisão">📤 Revisão</button>
          </div>
        `;
      }

      return `
        <div class="kanban-card" data-id="${t.id}">
          <div class="kanban-card-header">
            <span class="kanban-card-number">#${t.number}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${layoutCode ? `
                <div class="kanban-layout-badge-container" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                  <a href="#" class="btn-open-layout kanban-layout-link" data-ticket-id="${t.id}" data-layout-id="${layoutId || ''}" data-layout-code="${layoutCode}" title="Abrir Layout ${layoutCode} no Importer Ultra">
                    <span>${layoutCode}</span> <span style="font-size: 10px; opacity: 0.85;">↗</span>
                  </a>
                  ${(() => {
                    const lStatus = layoutInfo.status || (layoutCode ? layoutCodeToIdCache.get(String(layoutCode).trim())?.status : null) || 'draft';
                    const sBadge = formatLayoutStatusBadge(lStatus);
                    return sBadge ? `<span class="badge-layout-status ${sBadge.className}" style="font-size: 8.5px; padding: 1px 4px;" title="Status do Layout no Importer Ultra: ${sBadge.label}">${sBadge.icon} ${sBadge.label}</span>` : '';
                  })()}
                </div>
              ` : ''}
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
          ${quickActionsHtml}
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
      if (e.target.closest('.btn-kanban-ignore') || e.target.closest('.btn-kanban-autodrive') || e.target.closest('.btn-kanban-action') || e.target.closest('.btn-open-layout')) return;
      const ticketId = card.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (ticket) {
        if (window.appTabs) window.appTabs.openTicketTab(ticket);
        else openDemandDrawer(ticket);
      }
    });
  });

  // Kanban workflow action buttons
  container.querySelectorAll('.btn-kanban-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const ticketId = btn.dataset.id;
      const ticket = window.appStore.demands.find(d => d.id === ticketId);
      if (!ticket) return;

      if (action === 'start') await handleStartTicket(ticket);
      else if (action === 'pause') await handlePauseTicket(ticket);
      else if (action === 'wait') await handleWaitRequesterTicket(ticket);
      else if (action === 'review') await handleSendToReviewTicket(ticket);
      else if (action === 'resume') await handleResumeTicket(ticket);
      else if (action === 'finalize') await handleFinalizeTicket(ticket);
      else if (action === 'return') await handleReturnTicketToDev(ticket);
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

  // Kanban open layout link
  container.querySelectorAll('.btn-open-layout').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = link.dataset.layoutId;
      const code = link.dataset.layoutCode;
      openLayoutInImporter(id, code);
    });
  });

  sweepAndInjectMissingLayoutBadges();

  // Resolve status de layouts que ainda não estão no cache
  if (typeof resolveMissingLayoutStatuses === 'function') {
    resolveMissingLayoutStatuses().catch(() => {});
  }
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
    return `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.25);"><span class="badge-dot" style="background: #10B981;"></span>Concluído</span>`;
  }
  if (s.includes('triage')) {
    return `<span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.2);"><span class="badge-dot" style="background: #3B82F6;"></span>Triagem</span>`;
  }
  if (s.includes('pause')) {
    return `<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.25);"><span class="badge-dot" style="background: #F59E0B;"></span>Pausado</span>`;
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

// Sanitizes rich HTML content from external tickets/comments against XSS while preserving formatting and images
function sanitizeHtml(dirtyHtml) {
  if (!dirtyHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(dirtyHtml), 'text/html');
    const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'base', 'form', 'link', 'style'];
    forbiddenTags.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = (attr.value || '').trim().toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
        } else if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') &&
                   (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html'))) {
          el.removeAttribute(attr.name);
        }
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    return escapeHtml(dirtyHtml);
  }
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
  document.getElementById('modalFilterReviewer').value = '';
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
  if (c.noLabelsOnly || c.label === '__NONE__') {
    document.getElementById('modalFilterLabel').value = '__NONE__';
  } else {
    document.getElementById('modalFilterLabel').value = c.label || (c.labels && c.labels[0]) || '';
  }
  document.getElementById('modalFilterType').value = c.type && c.type[0] ? c.type[0] : '';
  if (c.unassignedOnly || c.developerName === '__NONE__' || c.developerId === '__NONE__') {
    document.getElementById('modalFilterDev').value = '__NONE__';
  } else {
    document.getElementById('modalFilterDev').value = c.isMyDemands ? 'CURRENT_USER' : (c.developerName || '');
  }
  if (c.unassignedReviewerOnly || c.reviewerName === '__NONE__' || c.reviewerId === '__NONE__') {
    document.getElementById('modalFilterReviewer').value = '__NONE__';
  } else {
    document.getElementById('modalFilterReviewer').value = c.isMyReview ? 'CURRENT_USER' : (c.reviewerName || '');
  }
  document.getElementById('modalFilterDatabase').value = c.database || '';
  document.getElementById('modalFilterDeadline').value = c.deadline || '';

  const btnDelModal = document.getElementById('btnDeleteFilterModal');
  if (btnDelModal) {
    btnDelModal.style.display = filter.id !== 'all' ? 'inline-flex' : 'none';
    btnDelModal.onclick = async () => {
      const ok = await showAppConfirm(`Deseja realmente apagar o filtro "${filter.name}"?`, 'Excluir Filtro', { isDanger: true, confirmText: 'Apagar Filtro' });
      if (ok) {
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
    showAppAlert('Por favor, informe o nome do filtro fixo.', 'Nome Obrigatório', 'warning');
    return;
  }

  const statusVal = document.getElementById('modalFilterStatus').value;
  const labelVal = document.getElementById('modalFilterLabel')?.value;
  const typeVal = document.getElementById('modalFilterType').value;
  const devVal = document.getElementById('modalFilterDev').value;
  const revVal = document.getElementById('modalFilterReviewer')?.value;
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

  if (labelVal === '__NONE__') {
    criteria.label = '__NONE__';
    criteria.noLabelsOnly = true;
  } else if (labelVal) {
    criteria.label = labelVal;
  }

  if (typeVal) criteria.type = [typeVal];
  if (devVal === 'CURRENT_USER') {
    criteria.isMyDemands = true;
  } else if (devVal === '__NONE__') {
    criteria.developerName = '__NONE__';
    criteria.unassignedOnly = true;
  } else if (devVal) {
    criteria.developerName = devVal;
  }

  if (revVal === 'CURRENT_USER') {
    criteria.isMyReview = true;
  } else if (revVal === '__NONE__') {
    criteria.reviewerName = '__NONE__';
    criteria.unassignedReviewerOnly = true;
  } else if (revVal) {
    criteria.reviewerName = revVal;
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

// ==========================================================================
// Interactive Multi-Select Quick Filters Controller
// ==========================================================================
const filterConfigs = {
  status: {
    btnId: 'btnFilterStatus',
    textId: 'btnFilterStatusText',
    badgeId: 'btnFilterStatusBadge',
    clearId: 'btnFilterStatusClear',
    panelId: 'panelFilterStatus',
    listId: 'listFilterStatus',
    actionAllId: 'actionStatusAll',
    actionClearId: 'actionStatusClear',
    labelPrefix: 'Situação:',
    defaultText: 'Todas',
    pluralText: 'selecionadas',
    options: [
      { value: 'queued', label: 'Na Fila', icon: '📥' },
      { value: 'in_progress', label: 'Em Progresso', icon: '🚀' },
      { value: 'waiting_n2', label: 'Aguardando Resposta do N2', icon: '⏳' },
      { value: 'review', label: 'Em Revisão', icon: '🔍' },
      { value: 'done', label: 'Concluídos (Todos)', icon: '✅' },
      { value: 'done_documentar', label: 'Concluídos (Documentar)', icon: '📑' }
    ]
  },
  type: {
    btnId: 'btnFilterType',
    textId: 'btnFilterTypeText',
    badgeId: 'btnFilterTypeBadge',
    clearId: 'btnFilterTypeClear',
    panelId: 'panelFilterType',
    listId: 'listFilterType',
    actionAllId: 'actionTypeAll',
    actionClearId: 'actionTypeClear',
    labelPrefix: 'Tipo:',
    defaultText: 'Todos',
    pluralText: 'selecionados',
    getOptions: () => {
      const typeSet = new Set(['Novo Layout', 'Inclusao', 'Erro', 'Migração', 'Melhoria']);
      if (window.appStore && Array.isArray(window.appStore.demands)) {
        window.appStore.demands.forEach(t => {
          if (t.ticketType?.name) typeSet.add(t.ticketType.name);
        });
      }
      const iconMap = {
        'Novo Layout': '🎨',
        'Inclusao': '➕',
        'Erro': '⚠️',
        'Migração': '🔄',
        'Melhoria': '✨'
      };
      return Array.from(typeSet).map(name => ({
        value: name,
        label: name,
        icon: iconMap[name] || '📁'
      }));
    }
  },
  assignedTo: {
    btnId: 'btnFilterDev',
    textId: 'btnFilterDevText',
    badgeId: 'btnFilterDevBadge',
    clearId: 'btnFilterDevClear',
    panelId: 'panelFilterDev',
    listId: 'listFilterDev',
    searchId: 'searchFilterDev',
    actionAllId: 'actionDevAll',
    actionClearId: 'actionDevClear',
    labelPrefix: 'Responsável:',
    defaultText: 'Qualquer',
    pluralText: 'selecionados',
    getOptions: () => {
      const list = [
        { value: '__NONE__', label: 'Nenhum responsável', icon: '👤', isSpecial: true }
      ];
      const devs = new Set();
      if (window.appStore) {
        window.appStore.getKnownDevelopers().forEach(d => {
          if (d && d.name && d.name !== 'Não atribuído') devs.add(d.name);
        });
        if (Array.isArray(window.appStore.demands)) {
          window.appStore.demands.forEach(t => {
            if (t.assignedTo && t.assignedTo.name && t.assignedTo.name !== 'Não atribuído') {
              devs.add(t.assignedTo.name);
            }
          });
        }
      }
      Array.from(devs).sort((a, b) => a.localeCompare(b)).forEach(name => {
        list.push({ value: name, label: name, icon: '👤' });
      });
      return list;
    }
  },
  reviewer: {
    btnId: 'btnFilterReviewer',
    textId: 'btnFilterReviewerText',
    badgeId: 'btnFilterReviewerBadge',
    clearId: 'btnFilterReviewerClear',
    panelId: 'panelFilterReviewer',
    listId: 'listFilterReviewer',
    searchId: 'searchFilterReviewer',
    actionAllId: 'actionReviewerAll',
    actionClearId: 'actionReviewerClear',
    labelPrefix: 'Validador:',
    defaultText: 'Qualquer',
    pluralText: 'selecionados',
    getOptions: () => {
      const list = [
        { value: '__NONE__', label: 'Sem validador (Em branco)', icon: '👤', isSpecial: true }
      ];
      const currentUser = window.appStore?.currentUser;
      if (currentUser && currentUser.name) {
        list.push({
          value: currentUser.name,
          label: `${currentUser.name} (Você)`,
          icon: '⭐'
        });
      }
      return list;
    }
  },
  label: {
    btnId: 'btnFilterLabel',
    textId: 'btnFilterLabelText',
    badgeId: 'btnFilterLabelBadge',
    clearId: 'btnFilterLabelClear',
    panelId: 'panelFilterLabel',
    listId: 'listFilterLabel',
    searchId: 'searchFilterLabel',
    actionAllId: 'actionLabelAll',
    actionClearId: 'actionLabelClear',
    labelPrefix: 'Etiqueta:',
    defaultText: 'Todas',
    pluralText: 'selecionadas',
    getOptions: () => {
      const list = [
        { value: '__NONE__', label: 'Sem etiquetas', icon: '🏷️', isSpecial: true }
      ];
      const labelsMap = new Map();
      labelsMap.set('DOCUMENTAR', { name: 'DOCUMENTAR', color: '#0891b2' });
      if (window.appStore) {
        window.appStore.getAvailableLabels().forEach(l => {
          if (l && l.name) labelsMap.set(l.name.toUpperCase(), l);
        });
      }
      Array.from(labelsMap.values()).forEach(lbl => {
        list.push({ value: lbl.name, label: lbl.name, icon: '🏷️', color: lbl.color });
      });
      return list;
    }
  },
  date: {
    btnId: 'btnFilterDate',
    textId: 'btnFilterDateText',
    badgeId: 'btnFilterDateBadge',
    clearId: 'btnFilterDateClear',
    panelId: 'panelFilterDate',
    listId: 'listFilterDate',
    actionAllId: 'actionDateAll',
    actionClearId: 'actionDateClear',
    labelPrefix: 'Prazo:',
    defaultText: 'Todas',
    pluralText: 'selecionados',
    options: [
      { value: 'overdue', label: 'Atrasados (Vencidos)', icon: '🔴' },
      { value: 'today', label: 'Para Hoje', icon: '🟡' },
      { value: 'tomorrow', label: 'Para Amanhã', icon: '🟠' },
      { value: 'week', label: 'Esta Semana (7 dias)', icon: '📆' },
      { value: 'month', label: 'Este Mês', icon: '🗓️' },
      { value: 'none', label: 'Sem Prazo Definido', icon: '⚪' }
    ]
  }
};

function renderFilterDropdownOptions(key) {
  const config = filterConfigs[key];
  if (!config) return;
  const listEl = document.getElementById(config.listId);
  if (!listEl) return;

  const options = typeof config.getOptions === 'function' ? config.getOptions() : config.options;
  const selectedValues = window.appStore._normalizeFilterArray(window.appStore.quickFilters[key]);

  listEl.innerHTML = '';
  options.forEach(opt => {
    const isSelected = selectedValues.includes(opt.value);
    const row = document.createElement('label');
    row.className = `filter-option-row ${isSelected ? 'selected' : ''} ${opt.isSpecial ? 'special-option' : ''}`;
    row.innerHTML = `
      <input type="checkbox" value="${escapeHtml(opt.value)}" ${isSelected ? 'checked' : ''}>
      <span class="filter-option-icon">${opt.icon || ''}</span>
      <span class="filter-option-text">${escapeHtml(opt.label)}</span>
      ${opt.color ? `<span class="filter-option-color-dot" style="background-color: ${escapeHtml(opt.color)}"></span>` : ''}
    `;
    listEl.appendChild(row);
  });

  updateFilterDropdownButton(key);
}

function updateFilterDropdownButton(key) {
  const config = filterConfigs[key];
  if (!config) return;

  const btn = document.getElementById(config.btnId);
  const textEl = document.getElementById(config.textId);
  const badgeEl = document.getElementById(config.badgeId);
  const clearEl = document.getElementById(config.clearId);
  if (!btn || !textEl) return;

  const selectedValues = window.appStore._normalizeFilterArray(window.appStore.quickFilters[key]);
  const count = selectedValues.length;

  if (count === 0) {
    btn.classList.remove('active');
    textEl.textContent = config.defaultText;
    if (badgeEl) badgeEl.style.display = 'none';
    if (clearEl) clearEl.style.display = 'none';
    btn.removeAttribute('title');
  } else if (count === 1) {
    btn.classList.add('active');
    const val = selectedValues[0];
    let label = val;
    if (val === '__NONE__') {
      label = key === 'assignedTo' ? 'Nenhum' : (key === 'reviewer' ? 'Sem validador' : (key === 'label' ? 'Sem etiquetas' : 'Nenhum'));
    } else {
      const options = typeof config.getOptions === 'function' ? config.getOptions() : config.options;
      const found = options.find(o => o.value === val);
      if (found) label = found.label;
    }
    textEl.textContent = label;
    if (badgeEl) badgeEl.style.display = 'none';
    if (clearEl) clearEl.style.display = 'inline-flex';
    btn.setAttribute('title', `${config.labelPrefix} ${label}`);
  } else {
    btn.classList.add('active');
    textEl.textContent = `${count} ${config.pluralText}`;
    if (badgeEl) {
      badgeEl.textContent = count;
      badgeEl.style.display = 'inline-block';
    }
    if (clearEl) clearEl.style.display = 'inline-flex';

    const options = typeof config.getOptions === 'function' ? config.getOptions() : config.options;
    const names = selectedValues.map(v => {
      if (v === '__NONE__') return key === 'assignedTo' ? 'Nenhum responsável' : (key === 'reviewer' ? 'Sem validador' : 'Sem etiquetas');
      const f = options.find(o => o.value === v);
      return f ? f.label : v;
    });
    btn.setAttribute('title', `${config.labelPrefix} ${names.join(', ')}`);
  }

  updateClearFiltersButtonState();
}

function updateClearFiltersButtonState() {
  const clearBtn = document.getElementById('btnClearQuickFilters');
  if (!clearBtn || !window.appStore) return;

  const qf = window.appStore.quickFilters || {};
  let activeCount = 0;
  ['status', 'type', 'assignedTo', 'reviewer', 'date', 'label'].forEach(k => {
    const arr = window.appStore._normalizeFilterArray(qf[k]);
    if (arr.length > 0) activeCount += arr.length;
  });
  if (qf.database && String(qf.database).trim()) activeCount += 1;
  if (window.appStore.searchQuery && String(window.appStore.searchQuery).trim()) activeCount += 1;

  if (activeCount > 0) {
    clearBtn.classList.add('has-active-filters');
    clearBtn.textContent = `✖ Limpar Filtros (${activeCount})`;
  } else {
    clearBtn.classList.remove('has-active-filters');
    clearBtn.textContent = '✖ Limpar Filtros';
  }
}

function updateAllFilterDropdownsUI() {
  Object.keys(filterConfigs).forEach(key => {
    renderFilterDropdownOptions(key);
  });
  updateClearFiltersButtonState();
}

function closeAllFilterDropdowns() {
  document.querySelectorAll('.filter-dropdown-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
}

let quickFiltersInitialized = false;

function initQuickFilterDropdowns() {
  if (quickFiltersInitialized) {
    updateAllFilterDropdownsUI();
    return;
  }
  quickFiltersInitialized = true;

  Object.keys(filterConfigs).forEach(key => {
    const config = filterConfigs[key];
    const btn = document.getElementById(config.btnId);
    const panel = document.getElementById(config.panelId);
    const listEl = document.getElementById(config.listId);
    const clearEl = document.getElementById(config.clearId);
    const searchInput = config.searchId ? document.getElementById(config.searchId) : null;

    if (!btn || !panel || !listEl) return;

    renderFilterDropdownOptions(key);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = btn.closest('.filter-dropdown');
      const wasOpen = panel.style.display === 'flex';

      closeAllFilterDropdowns();

      if (!wasOpen) {
        panel.style.display = 'flex';
        dropdown.classList.add('open');
        if (searchInput) {
          searchInput.value = '';
          const rows = listEl.querySelectorAll('.filter-option-row');
          rows.forEach(r => r.style.display = 'flex');
          setTimeout(() => searchInput.focus(), 60);
        }
      }
    });

    listEl.addEventListener('change', (e) => {
      const checkbox = e.target;
      if (!checkbox || checkbox.type !== 'checkbox') return;
      const val = checkbox.value;
      let current = window.appStore._normalizeFilterArray(window.appStore.quickFilters[key]);

      if (checkbox.checked) {
        if (!current.includes(val)) current.push(val);
      } else {
        current = current.filter(v => v !== val);
      }

      window.appStore.quickFilters[key] = current;
      const row = checkbox.closest('.filter-option-row');
      if (row) row.classList.toggle('selected', checkbox.checked);

      updateFilterDropdownButton(key);
      renderDemands();
    });

    const clearFilter = (e) => {
      e?.stopPropagation();
      window.appStore.quickFilters[key] = [];
      listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.filter-option-row')?.classList.remove('selected');
      });
      updateFilterDropdownButton(key);
      renderDemands();
    };

    document.getElementById(config.actionAllId)?.addEventListener('click', clearFilter);
    document.getElementById(config.actionClearId)?.addEventListener('click', clearFilter);
    clearEl?.addEventListener('click', clearFilter);

    if (searchInput) {
      searchInput.addEventListener('click', (e) => e.stopPropagation());
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const rows = listEl.querySelectorAll('.filter-option-row');
        let visibleCount = 0;
        rows.forEach(r => {
          const text = (r.querySelector('.filter-option-text')?.textContent || '').toLowerCase();
          const matches = !q || text.includes(q);
          r.style.display = matches ? 'flex' : 'none';
          if (matches) visibleCount++;
        });

        let emptyMsg = listEl.querySelector('.filter-empty-search');
        if (visibleCount === 0) {
          if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'filter-empty-search';
            emptyMsg.textContent = 'Nenhuma opção encontrada';
            listEl.appendChild(emptyMsg);
          }
          emptyMsg.style.display = 'block';
        } else if (emptyMsg) {
          emptyMsg.style.display = 'none';
        }
      });
    }

    panel.addEventListener('click', (e) => e.stopPropagation());
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) {
      closeAllFilterDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllFilterDropdowns();
    }
  });
}

