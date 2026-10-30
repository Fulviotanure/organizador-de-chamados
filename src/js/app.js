// Main Application Controller
window.selectedTicket = null;
const getActiveTicket = () => (window.getSelectedTicket ? window.getSelectedTicket() : window.selectedTicket);
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
  setupAppDialogHandlers();
  setupWindowControls();
  setupAutoUpdaterRenderer();
  initQuickFilterDropdowns();
  await initApplication();
  setupEventListeners();
});


// App Initialization
async function initApplication() {
  await window.appStore.init();

  // Check login & persistent credentials
  if (!window.appStore.token) {
    // If we have saved credentials, try auto-login
    if (window.appStore.savedCredentials?.email && window.appStore.savedCredentials?.password) {
      try {
        console.log('[Auto-Login] Executando auto-login inicial com credenciais salvas...');
        await doLogin(window.appStore.savedCredentials.email, window.appStore.savedCredentials.password, true);
        return;
      } catch (e) {
        console.warn('Auto-login inicial falhou, exibindo tela de login:', e);
        showLoginOverlay();
        return;
      }
    }
    showLoginOverlay();
    return;
  } else {
    // Restaurar cache de layouts persistido e alças de redimensionamento
    restoreLayoutCacheFromStore();
    initTableColumnResizing();

    updateUserProfileUI();
    renderFixedFiltersList();
    populateDeveloperSelects();

    // Render cached demands immediately for instant UI
    if (window.appStore.demands && window.appStore.demands.length > 0) {
      renderDemands();
      // Resolver em background layouts sem status
      if (typeof resolveMissingLayoutStatuses === 'function') {
        resolveMissingLayoutStatuses().catch(() => {});
      }
      window.appTabs?.restorePersistedTabs();
    }

    // Now sync fresh data from API
    syncDemands();

    // Reconhecer perfil de usuário na API em background
    recognizeCurrentUser(false);

    // Verificar se o usuário tem senha salva. Se não tiver, pedir para inserir
    if (!window.appStore.hasSavedPassword()) {
      setTimeout(() => {
        openUserSettingsModal(true);
      }, 1200);
    }
  }

  setupAutoRefresh();

  // Varredor de segurança contínuo para garantir que todo layout na tela receba o badge de status
  setInterval(() => {
    if (typeof sweepAndInjectMissingLayoutBadges === 'function') {
      sweepAndInjectMissingLayoutBadges();
    }
  }, 10000);
}

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    const emailInput = document.getElementById('loginEmail');
    const pwdInput = document.getElementById('loginPassword');
    const remInput = document.getElementById('loginRemember');
    if (remInput) remInput.checked = true;

    if (window.appStore && window.appStore.savedCredentials) {
      if (emailInput) {
        emailInput.value = window.appStore.savedCredentials.email || '';
      }
      if (pwdInput && window.appStore.savedCredentials.password) {
        pwdInput.value = window.appStore.savedCredentials.password;
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
    restoreLayoutCacheFromStore();
    initTableColumnResizing();
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
    throw err;
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
  if (roleEl) roleEl.textContent = user.role === 'support' ? 'Suporte' : (user.role === 'developer' ? 'Desenvolvedor' : (user.role || 'Usuário'));

  if (avatarEl && (user.name || user.email)) {
    if (user.name) {
      const parts = user.name.split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    } else {
      avatarEl.textContent = (user.email.slice(0, 2) || '--').toUpperCase();
    }
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

    // Carregar cache de status dos layouts recentes em segundo plano
    loadActiveLayoutsCache().catch(e => console.warn('Falha ao pré-carregar cache de layouts:', e));

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
    if (window.appTabs?.hasRestoredPersistedTabs) {
      window.appTabs?.syncWithStoreDemands?.();
    } else {
      window.appTabs?.restorePersistedTabs();
    }
  } catch (err) {
    console.error('Error syncing demands:', err);
    if (err.message === 'UNAUTHORIZED') {
      if (window.appStore.savedCredentials?.email && window.appStore.savedCredentials?.password) {
        try {
          console.warn('[SyncDemands] UNAUTHORIZED detectado. Realizando auto-relogin com credenciais salvas...');
          await doLogin(window.appStore.savedCredentials.email, window.appStore.savedCredentials.password, true);
          return;
        } catch (reLoginErr) {
          console.error('[SyncDemands] Falha no auto-login ao sincronizar:', reLoginErr);
          showLoginOverlay();
        }
      } else {
        showLoginOverlay();
      }
    } else {
      if (syncDot) syncDot.style.backgroundColor = 'var(--status-error)';
      if (syncText) syncText.textContent = 'Erro ao sincronizar';
    }
  }
}

// Dispara sincronização imediata e uma segunda sincronização após 1.8s para confirmar atualizações do backend
function triggerActionResync(ticketId = null) {
  // 1. Sincronização imediata
  if (typeof syncDemands === 'function') {
    syncDemands();
  }
  if (ticketId && typeof refreshDrawerActivity === 'function') {
    refreshDrawerActivity(ticketId);
  }

  // 2. Segunda sincronização após 1.8 segundos para garantir atualização final da API
  setTimeout(async () => {
    if (typeof syncDemands === 'function') {
      await syncDemands();
    }
    if (ticketId && typeof refreshDrawerActivity === 'function') {
      await refreshDrawerActivity(ticketId);
    }
    // Se o chamado ainda estiver aberto, re-renderizar botões de fluxo e cabeçalho
    const active = typeof getActiveTicket === 'function' ? getActiveTicket() : (selectedTicket || window.selectedTicket);
    if (ticketId && active && String(active.id) === String(ticketId)) {
      if (typeof renderDrawerWorkflowButtons === 'function') renderDrawerWorkflowButtons(active);
      if (typeof renderDrawerHeaderMetaAndTitle === 'function') renderDrawerHeaderMetaAndTitle(active);
    }
  }, 1800);
}
window.triggerActionResync = triggerActionResync;


// Setup Event Listeners
function setupEventListeners() {
  // Search input & clear button UX
  const searchInput = document.getElementById('inputSearch');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const searchKbdHint = document.getElementById('searchKbdHint');

  const syncSearchAdornments = () => {
    const hasVal = !!(searchInput && searchInput.value.trim().length > 0);
    if (btnClearSearch) btnClearSearch.style.display = hasVal ? 'inline-flex' : 'none';
    if (searchKbdHint) searchKbdHint.style.display = hasVal ? 'none' : 'inline-block';
    if (typeof updateClearFiltersButtonState === 'function') {
      updateClearFiltersButtonState();
    }
  };

  searchInput?.addEventListener('input', (e) => {
    window.appStore.searchQuery = e.target.value;
    syncSearchAdornments();
    renderDemands();
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      searchInput.value = '';
      window.appStore.searchQuery = '';
      syncSearchAdornments();
      renderDemands();
    }
  });

  btnClearSearch?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    window.appStore.searchQuery = '';
    syncSearchAdornments();
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

  // Sort selector listener
  document.getElementById('quickSelectSort')?.addEventListener('change', (e) => {
    window.appStore.sortBy = e.target.value;
    renderDemands();
  });

  // Table header click sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      if (th._justResized) return;
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

  // Clear all filters button
  document.getElementById('btnClearQuickFilters')?.addEventListener('click', () => {
    window.appStore.quickFilters = {
      status: [],
      type: [],
      assignedTo: [],
      reviewer: [],
      database: '',
      date: [],
      label: []
    };
    window.appStore.searchQuery = '';
    window.appStore.activeFilterId = 'all';

    const searchInput = document.getElementById('inputSearch');
    if (searchInput) searchInput.value = '';
    const btnClearSearch = document.getElementById('btnClearSearch');
    if (btnClearSearch) btnClearSearch.style.display = 'none';
    const searchKbdHint = document.getElementById('searchKbdHint');
    if (searchKbdHint) searchKbdHint.style.display = 'inline-block';

    updateAllFilterDropdownsUI();
    renderFixedFiltersList();
    renderDemands();
  });

  // Save current quick filters as a new fixed filter
  document.getElementById('btnSaveCurrentAsFixed')?.addEventListener('click', () => {
    const defaultName = `Filtro Personalizado ${window.appStore.fixedFilters.length + 1}`;
    openNewFilterModal();
    document.getElementById('modalFilterName').value = defaultName;

    const sArr = window.appStore._normalizeFilterArray(window.appStore.quickFilters.status);
    const tArr = window.appStore._normalizeFilterArray(window.appStore.quickFilters.type);
    const dArr = window.appStore._normalizeFilterArray(window.appStore.quickFilters.assignedTo);
    const rArr = window.appStore._normalizeFilterArray(window.appStore.quickFilters.reviewer);
    const lArr = window.appStore._normalizeFilterArray(window.appStore.quickFilters.label);

    if (sArr.length > 0) document.getElementById('modalFilterStatus').value = sArr[0];
    if (tArr.length > 0) document.getElementById('modalFilterType').value = tArr[0];
    if (dArr.length > 0) document.getElementById('modalFilterDev').value = dArr[0];
    if (rArr.length > 0) document.getElementById('modalFilterReviewer').value = rArr[0];
    if (lArr.length > 0) document.getElementById('modalFilterLabel').value = lArr[0];
  });

  // Create Ticket Modal Buttons & Controls
  document.getElementById('btnOpenCreateTicketModal')?.addEventListener('click', () => {
    if (window.appTabs) {
      window.appTabs.openCreateTicketTab(true);
    } else {
      openCreateTicketModal();
    }
  });
  document.getElementById('btnCloseCreateTicketModal')?.addEventListener('click', () => {
    if (window.appTabs && window.appTabs.activeTabId === 'new-ticket') {
      window.appTabs.closeTab('new-ticket');
    } else {
      closeCreateTicketModal();
    }
  });
  document.getElementById('btnCancelCreateTicket')?.addEventListener('click', () => {
    if (window.appTabs && window.appTabs.activeTabId === 'new-ticket') {
      window.appTabs.closeTab('new-ticket');
    } else {
      closeCreateTicketModal();
    }
  });
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
  if (typeof setupDrawerDescriptionImagePaste === 'function') {
    setupDrawerDescriptionImagePaste();
  } else if (typeof window.setupDrawerDescriptionImagePaste === 'function') {
    window.setupDrawerDescriptionImagePaste();
  }

  // Drawer Copy Demand Link
  document.getElementById('btnDrawerCopyLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.copyDrawerTicketLink === 'function') {
      window.copyDrawerTicketLink();
    }
  });

  // Drawer Save / Edit Actions
  document.getElementById('btnDrawerSaveTicketBottom')?.addEventListener('click', () => {
    if (typeof window.handleDrawerSaveOrEditClick === 'function') {
      window.handleDrawerSaveOrEditClick();
    } else {
      saveDrawerTicketChanges();
    }
  });
  document.getElementById('btnDrawerCancelEdit')?.addEventListener('click', () => {
    if (typeof window.handleDrawerCancelEdit === 'function') {
      window.handleDrawerCancelEdit();
    }
  });

  // Reviewer / Validador Actions
  document.getElementById('btnAssignReviewerMe')?.addEventListener('click', () => {
    const user = window.appStore.currentUser;
    if (!user || !user.id) {
      showAppAlert('Você precisa estar autenticado no sistema para se atribuir como validador.', 'Autenticação Necessária', 'warning');
      return;
    }
    changeReviewerWorkflow(user.id, user.name);
  });

  document.getElementById('btnClearDrawerReviewer')?.addEventListener('click', () => {
    changeReviewerWorkflow('', '');
  });

  document.getElementById('drawerEditReviewer')?.addEventListener('change', (e) => {
    const selectedOpt = e.target.selectedOptions[0];
    const newName = selectedOpt ? selectedOpt.text : '';
    changeReviewerWorkflow(e.target.value, newName);
  });

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

  // Comment Editor Toolbar buttons (B, I, S, lists, quote, code)
  document.querySelectorAll('#commentEditorToolbar .comment-tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tag = btn.dataset.tag;
      const textarea = document.getElementById('drawerNewCommentText');
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      let replacement = '';
      switch (tag) {
        case 'b': replacement = `**${selected || 'texto em negrito'}**`; break;
        case 'i': replacement = `*${selected || 'texto em itálico'}*`; break;
        case 's': replacement = `~~${selected || 'texto tachado'}~~`; break;
        case 'ul': replacement = selected ? selected.split('\n').map(l => `• ${l}`).join('\n') : '• item'; break;
        case 'ol': replacement = selected ? selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') : '1. item'; break;
        case 'quote': replacement = selected ? selected.split('\n').map(l => `> ${l}`).join('\n') : '> citação'; break;
        case 'code': replacement = selected.includes('\n') ? `\`\`\`\n${selected}\n\`\`\`` : `\`${selected || 'código'}\``; break;
        default: replacement = selected; break;
      }
      textarea.setRangeText(replacement, start, end, 'select');
      textarea.focus();
    });
  });

  // Button to attach image/print to comment
  document.getElementById('btnCommentAttachImage')?.addEventListener('click', () => {
    document.getElementById('inputCommentAttachFile')?.click();
  });

  // Hidden file input for comment attachments
  document.getElementById('inputCommentAttachFile')?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(f => timelinePendingAttachments.push(f));
      renderTimelinePendingAttachments();
      e.target.value = '';
    }
  });

  // Drag and drop images on comment input box
  const commentInputBox = document.getElementById('drawerCommentInputBox');
  if (commentInputBox) {
    commentInputBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      commentInputBox.style.borderColor = 'var(--accent-primary)';
    });
    commentInputBox.addEventListener('dragleave', () => {
      commentInputBox.style.borderColor = '';
    });
    commentInputBox.addEventListener('drop', (e) => {
      e.preventDefault();
      commentInputBox.style.borderColor = '';
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach(f => timelinePendingAttachments.push(f));
        renderTimelinePendingAttachments();
      }
    });
  }

  // Global paste handler when comment box is focused or active
  window.addEventListener('paste', (e) => {
    const drawer = document.getElementById('demandDrawer');
    if (!drawer || !drawer.classList.contains('open') || !selectedTicket) return;
    
    // Se o evento foi disparado dentro do box de comentários ou do textarea
    const commentBox = document.getElementById('drawerCommentInputBox');
    const isInsideCommentBox = commentBox && commentBox.contains(e.target);
    if (!isInsideCommentBox && drawerActiveTab !== 'comments') return;

    // Check if an image or file is in clipboard
    const items = Array.from(e.clipboardData?.items || []);
    const hasImage = items.some(it => it.kind === 'file' && it.type.startsWith('image/'));
    const hasFiles = e.clipboardData?.files && e.clipboardData.files.length > 0;

    if (hasImage || hasFiles) {
      handleCommentPaste(e);
    }
  });

  // Archive Ticket
  document.getElementById('btnArchiveTicket')?.addEventListener('click', archiveCurrentTicket);

  // Drawer Close & Multi-Tab Routing
  const btnCloseDrawerEl = document.getElementById('btnCloseDrawer');
  if (btnCloseDrawerEl && !btnCloseDrawerEl.dataset?.tabBound) {
    if (btnCloseDrawerEl.dataset) btnCloseDrawerEl.dataset.tabBound = 'true';
    btnCloseDrawerEl.addEventListener('click', () => {
      if (window.appTabs) {
        window.appTabs.closeTab(window.appTabs.activeTabId);
      } else {
        closeDemandDrawer();
      }
    });
  }

  document.getElementById('drawerOverlay')?.addEventListener('click', () => {
    if (window.appTabs) {
      window.appTabs.switchToTab('demands-list');
    } else {
      closeDemandDrawer();
    }
  });

  const btnDrawerBackEl = document.getElementById('btnDrawerBackToList');
  if (btnDrawerBackEl && !btnDrawerBackEl.dataset?.tabBound) {
    if (btnDrawerBackEl.dataset) btnDrawerBackEl.dataset.tabBound = 'true';
    btnDrawerBackEl.addEventListener('click', () => {
      if (window.appTabs) {
        window.appTabs.switchToTab('demands-list');
      } else {
        closeDemandDrawer();
      }
    });
  }

  const openTicketInMovidesk = () => {
    const curTicket = getActiveTicket();
    const movId = document.getElementById('drawerEditMovidesk')?.value || curTicket?.movideskTicketId;
    if (movId && window.electronAPI) {
      window.electronAPI.openExternal(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${movId}`);
    } else if (movId) {
      window.open(`https://conciliador-contabil2.movidesk.com/Ticket/Edit/${movId}`, '_blank');
    } else {
      showAppAlert('Esta demanda não possui número do chamado Movidesk associado.', 'Movidesk', 'info');
    }
  };

  document.getElementById('btnDrawerOpenConciliador')?.addEventListener('click', () => {
    const curTicket = getActiveTicket();
    if (curTicket) openTicketInImporter(curTicket);
  });
  document.getElementById('btnDrawerOpenLayout')?.addEventListener('click', () => {
    const curTicket = getActiveTicket();
    if (!curTicket) return;
    const info = getTicketLayoutInfo(curTicket);
    const hiddenId = document.getElementById('drawerEditLayoutId')?.value;
    openLayoutInImporter(hiddenId || info.id, info.code);
  });
  document.getElementById('btnDrawerOpenMovidesk')?.addEventListener('click', openTicketInMovidesk);

  // AutoDrive Button in Drawer Header
  document.getElementById('btnDrawerAutoDrive')?.addEventListener('click', () => {
    const curTicket = getActiveTicket();
    if (curTicket) openAutoDriveModal(curTicket);
  });

  // Minimize Program Button when viewing Demand
  document.getElementById('btnDrawerMinimize')?.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.minimize) {
      window.electronAPI.minimize();
    }
  });

  document.getElementById('btnDrawerOpenMovideskAction')?.addEventListener('click', openTicketInMovidesk);

  document.getElementById('btnToggleDrawerFavorite')?.addEventListener('click', async () => {
    const curTicket = getActiveTicket();
    if (curTicket) {
      const isFav = await window.appStore.toggleFavorite(curTicket.id);
      renderFixedFiltersList();
      renderDemands();
      const btn = document.getElementById('btnToggleDrawerFavorite');
      if (btn) btn.innerHTML = `<span>⭐</span> ${isFav ? 'Remover Favorito' : 'Favoritar'}`;
    }
  });

  document.getElementById('btnToggleDrawerIgnore')?.addEventListener('click', async () => {
    const curTicket = getActiveTicket();
    if (curTicket) {
      const isNowIgnored = await window.appStore.toggleIgnore(curTicket.id);
      const btn = document.getElementById('btnToggleDrawerIgnore');
      if (btn) {
        btn.innerHTML = isNowIgnored ? '<span>↩️</span> Reativar Chamado' : '<span>🚫</span> Ignorar Chamado';
        btn.style.color = isNowIgnored ? '#10b981' : '';
      }
      renderDrawerHeaderMetaAndTitle(curTicket);
      renderFixedFiltersList();
      renderDemands();
      showAppAlert(
        isNowIgnored 
          ? 'Chamado marcado como ignorado e mantido no filtro "Chamados Ignorados".' 
          : 'Chamado reativado com sucesso e retornado para as listas principais!',
        isNowIgnored ? 'Chamado Ignorado' : 'Chamado Reativado',
        'info'
      );
    }
  });


  // Debounced auto-save for local notes
  let noteDebounceTimer;
  const notesTextarea = document.getElementById('drawerLocalNotes');
  notesTextarea?.addEventListener('input', () => {
    const curTicket = getActiveTicket();
    if (!curTicket) return;
    const statusEl = document.getElementById('noteSaveStatus');
    if (statusEl) statusEl.textContent = 'Salvando...';

    clearTimeout(noteDebounceTimer);
    noteDebounceTimer = setTimeout(async () => {
      await window.appStore.saveNote(curTicket.id, notesTextarea.value);
      if (statusEl) statusEl.textContent = 'Salvo automaticamente';
      if (window.appTabs) {
        const session = window.appTabs.ticketSessions.get(curTicket.id);
        if (session) session.notes = notesTextarea.value;
        window.appTabs.checkDirty(curTicket.id);
      }
    }, 600);
  });

  // Fixed Filter Modal
  document.getElementById('btnOpenNewFilterModal')?.addEventListener('click', openNewFilterModal);
  document.getElementById('btnCloseFilterModal')?.addEventListener('click', closeFilterModal);
  document.getElementById('btnCancelFilterModal')?.addEventListener('click', closeFilterModal);
  document.getElementById('btnSaveFilterModal')?.addEventListener('click', saveFilterModal);

  // Restore Default Filters button
  document.getElementById('btnRestoreDefaultFilters')?.addEventListener('click', async () => {
    const ok = await showAppConfirm('Deseja restaurar todos os filtros fixos padrão que foram apagados?', 'Restaurar Filtros', { confirmText: 'Restaurar' });
    if (ok) {
      await window.appStore.restoreDefaultFilters();
      renderFixedFiltersList();
      renderDemands();
      showAppAlert('Os filtros fixos padrão foram restaurados com sucesso.', 'Filtros Restaurados', 'success');
    }
  });

  // Auto-refresh interval change (suporta tempo real 15s e 30s)
  document.getElementById('selectAutoRefresh')?.addEventListener('change', async (e) => {
    const mins = parseFloat(e.target.value);
    window.appStore.autoRefreshMinutes = isNaN(mins) ? 3 : mins;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('autoRefreshMinutes', window.appStore.autoRefreshMinutes);
    }
    const settingsSelect = document.getElementById('settingsAutoRefreshSelect');
    if (settingsSelect) settingsSelect.value = String(window.appStore.autoRefreshMinutes);
    setupAutoRefresh();
  });

  // Sincronização inteligente em tempo real ao focar na janela
  let lastFocusSyncTime = Date.now();
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastFocusSyncTime > 10000 && window.appStore.token) {
      lastFocusSyncTime = now;
      syncDemands();
    }
  });

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    const ok = await showAppConfirm('Deseja realmente desconectar da sua conta do Importer Ultra?', 'Desconectar da Conta', { isDanger: true, confirmText: 'Desconectar' });
    if (ok) {
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
      showAppAlert('Por favor, preencha seu e-mail e senha para conectar.', 'Campos Obrigatórios', 'warning');
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

  // Image Lightbox Close and Navigation
  document.getElementById('btnCloseLightbox')?.addEventListener('click', closeImageLightbox);
  document.getElementById('btnLightboxPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateLightbox(-1);
  });
  document.getElementById('btnLightboxNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateLightbox(1);
  });
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
    const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
    const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();

    const parts = [];
    if (num) parts.push(num);
    if (ent) parts.push(ent);
    if (doc) parts.push(doc);

    const inputQuick = document.getElementById('autoDriveQuickText');
    if (inputQuick) inputQuick.value = parts.join(' - ');
  };

  ['autoDriveNumeroLayout', 'autoDriveEntidade', 'autoDriveDocumento', 'autoDriveCategoria'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncAutoDriveFormToQuick();
      const approvalBox = document.getElementById('autoDriveApprovalBox');
      if (approvalBox) approvalBox.style.display = 'none';
    });
  });

  document.getElementById('btnToggleAutoDrivePassword')?.addEventListener('click', () => {
    const input = document.getElementById('autoDriveSenha');
    const toggleBtn = document.getElementById('btnToggleAutoDrivePassword');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (toggleBtn) toggleBtn.textContent = '🙈 Ocultar';
    } else {
      input.type = 'password';
      if (toggleBtn) toggleBtn.textContent = '👁️ Ver';
    }
  });

  document.getElementById('autoDriveSenha')?.addEventListener('input', (e) => {
    if (currentAutoDriveTicket?.id) {
      if (!window.appStore.localNotes) window.appStore.localNotes = {};
      window.appStore.localNotes[`autodrive_pwd_${currentAutoDriveTicket.id}`] = e.target.value;
      if (window.electronAPI) {
        window.electronAPI.saveStorage('localNotes', window.appStore.localNotes);
      }
    }
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  });

  document.getElementById('autoDriveEntidade')?.addEventListener('input', (e) => {
    const doc = document.getElementById('autoDriveDocumento')?.value || '';
    const guessed = guessAutoDriveCategory(e.target.value, doc);
    const selCat = document.getElementById('autoDriveCategoria');
    if (selCat && guessed) selCat.value = guessed;
  });

  // Category change listener: update entity label and placeholder for 1DESCONHECIDOS
  document.getElementById('autoDriveCategoria')?.addEventListener('change', (e) => {
    const cat = e.target.value;
    const entLabel = document.getElementById('labelAutoDriveEntidade');
    const entInput = document.getElementById('autoDriveEntidade');
    if (cat === 'DESCONHECIDOS') {
      if (entLabel) entLabel.innerHTML = 'BANCO OU SISTEMA <span style="font-size: 10px; color: #8b949e; font-weight: normal;">(Opcional em 1DESCONHECIDOS)</span>';
      if (entInput) entInput.placeholder = 'Opcional (criação direta na raiz)';
    } else {
      if (entLabel) entLabel.textContent = 'BANCO OU SISTEMA';
      if (entInput) entInput.placeholder = 'SICOOB';
    }
  });

  // Verification and Approval actions
  document.getElementById('btnLaunchAutoDriveNow')?.addEventListener('click', handlePreFlightCheck);
  document.getElementById('btnConfirmAndUploadNow')?.addEventListener('click', executeAutoDriveLaunch);
  document.getElementById('btnCancelApprovalStep')?.addEventListener('click', () => {
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  });
  document.getElementById('btnLaunchExternalPython')?.addEventListener('click', executeExternalPythonLaunch);

  // Success Box Direct Action Buttons
  document.getElementById('btnOpenDriveFolderLink')?.addEventListener('click', () => {
    const link = autoDriveLastResult?.layoutLink || (autoDriveLastResult?.layoutFolderId ? `https://drive.google.com/drive/folders/${autoDriveLastResult.layoutFolderId}` : null);
    if (link) {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(link);
      } else {
        window.open(link, '_blank');
      }
    } else {
      showAppAlert('O link da pasta no Google Drive ainda não está disponível.', 'Google Drive', 'info');
    }
  });

  document.getElementById('btnCopyDriveFolderLink')?.addEventListener('click', () => {
    const link = autoDriveLastResult?.layoutLink || (autoDriveLastResult?.layoutFolderId ? `https://drive.google.com/drive/folders/${autoDriveLastResult.layoutFolderId}` : null);
    if (link) {
      navigator.clipboard.writeText(link);
      showToast('Link do Google Drive copiado com sucesso!');
    }
  });

  document.getElementById('btnOpenLocalMirrorFolder')?.addEventListener('click', () => {
    const dir = autoDriveLastResult?.mirror?.targetDir;
    if (dir && window.electronAPI && window.electronAPI.openPath) {
      window.electronAPI.openPath(dir);
    } else {
      showAppAlert('Espelho local não configurado ou diretório local não encontrado no computador.', 'Pasta Local', 'warning');
    }
  });

  document.getElementById('btnResetAutoDriveForm')?.addEventListener('click', () => {
    closeAutoDriveModal();
  });

  // AutoDrive Image and PDF upload handlers
  document.getElementById('btnAddAutoDriveImageFile')?.addEventListener('click', () => {
    document.getElementById('inputAddAutoDriveImage')?.click();
  });

  document.getElementById('inputAddAutoDriveImage')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddAutoDriveImageFiles(e.target.files);
      e.target.value = '';
    }
  });

  document.getElementById('btnAddAutoDrivePdfFile')?.addEventListener('click', () => {
    document.getElementById('inputAddAutoDrivePdf')?.click();
  });

  document.getElementById('inputAddAutoDrivePdf')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddAutoDrivePdfFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  });

  // Drag and drop for images and PDFs in modal
  const dropzone = document.getElementById('autoDriveImageDropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const pdfFiles = files.filter(f => (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
        const imgFiles = files.filter(f => !pdfFiles.includes(f));
        if (imgFiles.length > 0) handleAddAutoDriveImageFiles(imgFiles);
        if (pdfFiles.length > 0) handleAddAutoDrivePdfFiles(pdfFiles);
      }
    });
    dropzone.addEventListener('click', () => {
      document.getElementById('inputAddAutoDriveImage')?.click();
    });
  }

  // Paste image directly with Ctrl+V when modal is open
  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('modalAutoDrive');
    if (!modal || modal.style.display === 'none') return;

    if (e.clipboardData && e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items);
      const imgItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          e.preventDefault();
          handleAddAutoDriveImageFiles([file]);
          showToast('Print colado no AutoDrive com sucesso!');
        }
      }
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+M -> minimize window
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.minimize) {
        window.electronAPI.minimize();
      }
    }
    // Ctrl+N -> new ticket tab / modal
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (window.appTabs) {
        window.appTabs.openCreateTicketTab(true);
      } else {
        openCreateTicketModal();
      }
    }
    // Ctrl+F or Ctrl+K -> focus search
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      document.getElementById('inputSearch')?.focus();
    }
    // Ctrl+R -> sync
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      syncDemands();
    }
    // Lightbox navigation with keyboard arrows
    const lightboxOverlay = document.getElementById('imageLightboxOverlay');
    if (lightboxOverlay && lightboxOverlay.style.display !== 'none') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox(1);
      }
    }

    // Esc -> fecha apenas modais flutuantes e popovers (fechar abas requer Ctrl+W ou clique explícito)
    if (e.key === 'Escape') {
      closeUserSettingsModal();
      closeImageLightbox();
      closeAutoDriveModal();
      if (!window.appTabs || window.appTabs.activeTabId !== 'new-ticket') {
        closeCreateTicketModal();
      } else {
        document.getElementById('calFloatingPopover')?.style.setProperty('display', 'none');
        document.getElementById('calClientPopover')?.style.setProperty('display', 'none');
        document.getElementById('panelNewTicketLabels')?.style.setProperty('display', 'none');
      }
      closeFilterModal();
      document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
      document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
    }
  });

  // Configurações do usuário & Engrenagem ⚙️
  setupUserSettingsHandlers();

  // Inicializar alças móveis para ajuste de largura das colunas da tabela
  initTableColumnResizing();
}

function setupAutoRefresh() {
  if (autoSyncTimerId) clearInterval(autoSyncTimerId);

  const mins = parseFloat(window.appStore.autoRefreshMinutes);
  const sidebarSelect = document.getElementById('selectAutoRefresh');
  if (sidebarSelect) sidebarSelect.value = String(window.appStore.autoRefreshMinutes ?? 3);
  const settingsSelect = document.getElementById('settingsAutoRefreshSelect');
  if (settingsSelect) settingsSelect.value = String(window.appStore.autoRefreshMinutes ?? 3);

  if (!isNaN(mins) && mins > 0) {
    const ms = Math.round(mins * 60 * 1000);
    autoSyncTimerId = setInterval(() => {
      if (window.appStore.token) {
        syncDemands();
      }
    }, ms);
  }
}

