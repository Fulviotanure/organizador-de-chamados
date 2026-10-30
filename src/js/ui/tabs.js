// UI Module: Multi-Tab Workspace Manager (TabManager)
// Permite navegação fluida em abas entre a Lista Geral (fixa) e múltiplos chamados simultâneos.

class TabManager {
  constructor() {
    this.STORAGE_KEY = 'cc_open_tabs_v1';
    this.tabs = [
      {
        id: 'demands-list',
        type: 'list',
        title: 'Demandas',
        icon: '📋',
        isPinned: true,
        isDirty: false
      }
    ];
    this.activeTabId = 'demands-list';
    this.ticketSessions = new Map(); // ticketId -> SessionData
    this.listScrollSnapshot = {
      tableTop: 0,
      tableLeft: 0,
      kanbanTop: 0,
      kanbanLeft: 0,
      bodyTop: 0
    };
    this.isRestoringSession = false;
    this.createTicketSession = null;
    this.dirtyDebounceTimer = null;
    this.initialized = false;
    this.hasRestoredPersistedTabs = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.tabBarEl = document.getElementById('appTabBar');
    this.tabsContainerEl = document.getElementById('tabsScrollContainer');

    // Horizontal Scroll Buttons
    document.getElementById('btnScrollTabsLeft')?.addEventListener('click', () => {
      this.tabsContainerEl?.scrollBy({ left: -220, behavior: 'smooth' });
    });
    document.getElementById('btnScrollTabsRight')?.addEventListener('click', () => {
      this.tabsContainerEl?.scrollBy({ left: 220, behavior: 'smooth' });
    });

    // New Tab Button (+)
    document.getElementById('btnNewTab')?.addEventListener('click', () => {
      this.openCreateTicketTab(true);
    });

    // Mouse wheel horizontal scrolling over tab bar
    this.tabsContainerEl?.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.tabsContainerEl.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Drawer Header Back to List Button
    const btnBackToList = document.getElementById('btnDrawerBackToList');
    if (btnBackToList && !btnBackToList.dataset?.tabBound) {
      if (btnBackToList.dataset) btnBackToList.dataset.tabBound = 'true';
      btnBackToList.addEventListener('click', () => {
        this.switchToTab('demands-list');
      });
    }

    // Create Ticket Header Back to List Button
    const btnCreateTicketBackToList = document.getElementById('btnCreateTicketBackToList');
    if (btnCreateTicketBackToList && !btnCreateTicketBackToList.dataset?.tabBound) {
      if (btnCreateTicketBackToList.dataset) btnCreateTicketBackToList.dataset.tabBound = 'true';
      btnCreateTicketBackToList.addEventListener('click', () => {
        this.switchToTab('demands-list');
      });
    }

    // Drawer Close Button (✕) routes to closing active tab
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    if (btnCloseDrawer && !btnCloseDrawer.dataset?.tabBound) {
      if (btnCloseDrawer.dataset) btnCloseDrawer.dataset.tabBound = 'true';
      btnCloseDrawer.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeTab(this.activeTabId);
      });
    }

    // Dirty state tracking on input / change
    this.attachDirtyListeners();

    // Global keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Initial render
    this.render();
  }

  // Retorna ID do ticket ativo no workspace, ou null se estiver na lista geral ou em novo chamado
  getActiveTicketId() {
    if (this.activeTabId === 'demands-list' || this.activeTabId === 'new-ticket') return null;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab?.ticketId || null;
  }

  // Abre ou foca na aba de Abertura de Novo Chamado
  openCreateTicketTab(switchToTab = true) {
    let tab = this.tabs.find(t => t.id === 'new-ticket');
    if (tab) {
      if (switchToTab) {
        this.switchToTab('new-ticket');
      }
      return tab;
    }

    tab = {
      id: 'new-ticket',
      type: 'create-ticket',
      title: 'Novo Chamado',
      icon: '➕',
      isPinned: false,
      isDirty: false
    };

    this.tabs.push(tab);

    // Se ainda não existia sessão em andamento, garante formulário resetado e pronto
    if (!this.createTicketSession) {
      if (typeof resetCreateTicketForm === 'function') {
        resetCreateTicketForm();
      }
    }

    this.render();

    if (switchToTab) {
      this.switchToTab('new-ticket');
    }

    this.persistOpenTabs();
    return tab;
  }

  // Abre uma aba para um chamado (ou foca na existente)
  openTicketTab(ticket, switchToTab = true) {
    if (!ticket || !ticket.id) return null;
    const ticketId = ticket.id;
    const tabId = `ticket-${ticketId}`;

    let tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
    if (tab) {
      // Aba já aberta: atualiza dados do ticket
      tab.ticket = { ...tab.ticket, ...ticket };
      if (switchToTab) {
        this.switchToTab(tab.id);
      }
      return tab;
    }

    // Nova aba
    const rawNumber = String(ticket.number || ticketId || '').replace(/^#+/, '').trim();
    const ticketNumber = rawNumber ? `#${rawNumber}` : `#${ticketId}`;
    const layoutInfo = typeof getTicketLayoutInfo === 'function' ? getTicketLayoutInfo(ticket) : (ticket.layout || {});
    const layoutCode = layoutInfo?.code || ticket.layoutCode || '';
    const cleanTitle = this.formatTabTitle(ticket.title, layoutCode);

    tab = {
      id: tabId,
      ticketId: ticketId,
      type: 'ticket',
      number: ticketNumber,
      title: cleanTitle,
      status: ticket.status || 'queued',
      isPinned: false,
      isDirty: false,
      ticket: { ...ticket }
    };

    this.tabs.push(tab);

    // Inicializa a sessão se ainda não existir
    if (!this.ticketSessions.has(ticketId)) {
      this.ticketSessions.set(ticketId, this.createInitialSession(ticket));
    }

    this.render();

    if (switchToTab) {
      this.switchToTab(tab.id);
    }

    this.persistOpenTabs();
    return tab;
  }

  // Alterna para uma aba específica
  async switchToTab(tabId) {
    const targetTab = this.tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    if (this.activeTabId === tabId) {
      this.syncWorkspaceVisibility();
      return;
    }

    // Salvar estado da aba que estamos deixando
    const prevTab = this.tabs.find(t => t.id === this.activeTabId);
    if (prevTab) {
      if (prevTab.type === 'list') {
        this.saveListScrollSnapshot();
      } else if (prevTab.type === 'ticket') {
        this.saveTicketSession(prevTab.ticketId);
      } else if (prevTab.type === 'create-ticket' || prevTab.id === 'new-ticket') {
        this.saveCreateTicketSession();
      }
    }

    this.activeTabId = tabId;
    this.render();
    this.syncWorkspaceVisibility();

    if (targetTab.type === 'list') {
      this.restoreListScrollSnapshot();
    } else if (targetTab.type === 'ticket') {
      await this.restoreTicketSession(targetTab.ticketId);
    } else if (targetTab.type === 'create-ticket' || targetTab.id === 'new-ticket') {
      this.restoreCreateTicketSession();
    }

    // Rola a aba para a área visível do container
    requestAnimationFrame(() => {
      const tabEl = this.tabsContainerEl?.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
      tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });

    this.persistOpenTabs();
  }

  // Fecha uma aba com verificação de rascunhos / dados não salvos
  async closeTab(tabIdOrTicketId, force = false) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabIdOrTicketId || String(t.ticketId) === String(tabIdOrTicketId));
    if (tabIndex === -1) return false;

    const tab = this.tabs[tabIndex];
    if (tab.isPinned) {
      // Aba fixa da lista geral não fecha
      return false;
    }

    // Fechamento específico da aba de Novo Chamado
    if (tab.type === 'create-ticket' || tab.id === 'new-ticket') {
      if (tab.isClosing) return false;
      const isDirty = this.checkCreateTicketDirty();
      if (!force && isDirty) {
        tab.isClosing = true;
        try {
          let confirmFn = window.showAppConfirm;
          if (typeof confirmFn !== 'function') {
            confirmFn = typeof window.confirm === 'function' ? (msg) => Promise.resolve(window.confirm(msg)) : () => Promise.resolve(true);
          }

          const ok = await confirmFn(
            'O formulário de abertura de chamado possui dados preenchidos que serão descartados.\n\nDeseja fechar esta aba e descartar o novo chamado?',
            'Descartar Novo Chamado?',
            {
              isDanger: true,
              confirmText: 'Fechar e Descartar',
              cancelText: 'Continuar Preenchendo'
            }
          );

          if (!ok) return false;
        } finally {
          tab.isClosing = false;
        }
      }

      const currentIndex = this.tabs.findIndex(t => t.id === tab.id);
      if (currentIndex === -1) return false;

      const wasActive = this.activeTabId === tab.id;
      let nextTabId = 'demands-list';
      if (wasActive) {
        if (currentIndex > 1) {
          nextTabId = this.tabs[currentIndex - 1].id;
        } else if (this.tabs.length > currentIndex + 1) {
          nextTabId = this.tabs[currentIndex + 1].id;
        }
      }

      this.createTicketSession = null;
      if (typeof resetCreateTicketForm === 'function') {
        resetCreateTicketForm();
      }
      this.tabs.splice(currentIndex, 1);

      if (wasActive) {
        await this.switchToTab(nextTabId);
      } else {
        this.render();
        this.persistOpenTabs();
      }

      if (this.activeTabId === 'demands-list') {
        this.syncWorkspaceVisibility();
      }
      return true;
    }

    if (tab.isClosing) {
      return false;
    }

    // Se estiver ativa agora, faz check de dirty fresco
    if (tab.id === this.activeTabId) {
      this.checkDirty(tab.ticketId);
    }

    // Verificação de segurança: confirmar descarte se houver alterações não salvas
    if (!force && (tab.isDirty || this.isTicketDirty(tab.ticketId))) {
      tab.isClosing = true;
      try {
        let confirmFn = window.showAppConfirm;
        if (typeof confirmFn !== 'function') {
          confirmFn = typeof window.confirm === 'function' ? (msg) => Promise.resolve(window.confirm(msg)) : () => Promise.resolve(true);
        }

        const ok = await confirmFn(
          `O chamado ${tab.number || '#' + tab.ticketId} possui alterações ou rascunho de comentário não salvos.\n\nDeseja fechar esta aba e descartar as alterações pendentes?`,
          'Descartar Alterações?',
          {
            isDanger: true,
            confirmText: 'Fechar e Descartar',
            cancelText: 'Continuar no Chamado'
          }
        );

        if (!ok) return false;
      } finally {
        tab.isClosing = false;
      }
    }

    // Re-checar índice caso a lista de abas tenha mudado durante a confirmação assíncrona
    const currentIndex = this.tabs.findIndex(t => t.id === tab.id);
    if (currentIndex === -1) return false;

    const wasActive = this.activeTabId === tab.id;
    let nextTabId = 'demands-list';
    if (wasActive) {
      if (currentIndex > 1) {
        nextTabId = this.tabs[currentIndex - 1].id;
      } else if (this.tabs.length > currentIndex + 1) {
        nextTabId = this.tabs[currentIndex + 1].id;
      }
    }

    // Remove sessão e aba do estado antes de chavear ou renderizar
    this.ticketSessions.delete(tab.ticketId);
    this.tabs.splice(currentIndex, 1);

    if (wasActive) {
      await this.switchToTab(nextTabId);
    } else {
      this.render();
      this.persistOpenTabs();
    }

    // Se nenhuma aba de chamado restar e estivermos na lista, fecha gaveta
    if (this.activeTabId === 'demands-list') {
      this.syncWorkspaceVisibility();
    }

    return true;
  }

  // Atualiza título, status ou metadados de uma aba existente
  updateTab(ticketId, partialData = {}) {
    const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
    if (!tab) return;

    if (partialData.ticket) {
      tab.ticket = { ...tab.ticket, ...partialData.ticket };
    }
    if (partialData.title) {
      const mergedTicket = { ...tab.ticket, ...partialData };
      const layoutInfo = typeof getTicketLayoutInfo === 'function' ? getTicketLayoutInfo(mergedTicket) : null;
      const layoutCode = layoutInfo?.code || partialData.layoutCode || tab.ticket?.layoutCode || '';
      tab.title = this.formatTabTitle(partialData.title, layoutCode);
    }
    if (partialData.status) {
      tab.status = partialData.status;
    }
    if (partialData.number) {
      const rawNum = String(partialData.number).replace(/^#+/, '').trim();
      tab.number = rawNum ? `#${rawNum}` : tab.number;
    }

    this.render();
    this.persistOpenTabs();
  }

  // Marca/desmarca indicador de pendência (dirty dot) da aba
  markDirty(ticketId, isDirty) {
    const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
    if (!tab) return;
    tab.isDirty = !!isDirty;
    const tabEl = this.tabsContainerEl?.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
    if (tabEl) {
      tabEl.classList.toggle('is-dirty', tab.isDirty);
    }
  }

  // Verifica se um ticket específico possui dados dirty em sua sessão ou tela atual
  isTicketDirty(ticketId) {
    if (!ticketId) return false;
    const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
    if (!tab) return false;

    // Se está no workspace ativo agora, inspeciona os campos do DOM
    if (String(this.getActiveTicketId()) === String(ticketId)) {
      return this.checkDirty(ticketId);
    }

    if (tab.isDirty) return true;

    const session = this.ticketSessions.get(ticketId);
    if (!session) return false;

    // 1. Rascunho de comentário ou anexos pendentes
    if (session.commentDraft && session.commentDraft.trim().length > 0) return true;
    if (session.pendingAttachments && session.pendingAttachments.length > 0) return true;

    // 2. Descrição em edição não salva
    if (session.isEditingDesc && session.descEditorContent) {
      const origDesc = String(session.ticket?.description || '').trim();
      if (session.descEditorContent.trim() !== origDesc) return true;
    }

    // 3. Modificações em campos de ficha técnica (formOverrides)
    if (session.formOverrides) {
      const fo = session.formOverrides;
      const t = session.ticket || tab.ticket || {};
      if (fo.title !== undefined && fo.title.trim() !== (t.title || '').trim()) return true;
      if (fo.status !== undefined && fo.status !== (t.status || 'queued')) return true;
      if (fo.assignedTo !== undefined && String(fo.assignedTo) !== String(t.assignedTo?.id || '')) return true;
      if (fo.reviewer !== undefined && String(fo.reviewer) !== String(t.reviewer?.id || t.reviewerId || '')) return true;
      const origDeliv = typeof formatDateToBrInput === 'function' ? formatDateToBrInput(t.deliveryDueDate) : '';
      if (fo.deliveryDueDate !== undefined && fo.deliveryDueDate !== origDeliv) return true;
      const origClient = typeof formatDateToBrInput === 'function' ? formatDateToBrInput(t.clientDueDate) : '';
      if (fo.clientDueDate !== undefined && fo.clientDueDate !== origClient) return true;
      if (fo.database !== undefined && fo.database !== (t.clientDatabase || '')) return true;
      if (fo.movidesk !== undefined && fo.movidesk !== (t.movideskTicketId || '')) return true;
    }

    // 4. Notas locais modificadas
    if (session.notes !== undefined) {
      const origNotes = window.appStore?.getNote ? (window.appStore.getNote(ticketId) || '') : '';
      if (session.notes !== origNotes) return true;
    }

    return false;
  }

  // Inspeciona os elementos de entrada do drawer para determinar se há alterações
  checkDirty(ticketId = null) {
    if (this.isRestoringSession) return false;
    const currentTicketId = ticketId || this.getActiveTicketId();
    if (!currentTicketId) return false;

    const tab = this.tabs.find(t => String(t.ticketId) === String(currentTicketId));
    if (!tab) return false;

    const ticket = tab.ticket || {};
    let isDirty = false;

    // 1. Rascunho de comentário
    const commentVal = document.getElementById('drawerNewCommentText')?.value || '';
    if (commentVal.trim().length > 0) isDirty = true;

    // 2. Anexos temporários pendentes
    const pendingFiles = window.getTimelinePendingAttachments ? window.getTimelinePendingAttachments() : [];
    if (pendingFiles && pendingFiles.length > 0) isDirty = true;

    // 3. Título alterado
    const titleVal = document.getElementById('drawerEditTitle')?.value;
    if (titleVal !== undefined && titleVal !== null && ticket.title !== undefined) {
      if (titleVal.trim() !== (ticket.title || '').trim()) isDirty = true;
    }

    // 4. Status alterado
    const statusVal = document.getElementById('drawerEditStatus')?.value;
    if (statusVal && ticket.status) {
      let stNorm = (ticket.status || 'queued').toLowerCase().trim();
      if (stNorm === 'open' || stNorm === 'aberto' || stNorm === 'fila') stNorm = 'queued';
      if (stNorm === 'closed' || stNorm === 'completed' || stNorm === 'finished') stNorm = 'done';
      if (stNorm === 'waiting' || stNorm === 'waiting_creator') stNorm = 'waiting_requester';
      if (statusVal !== stNorm) isDirty = true;
    }

    // 5. Responsável alterado
    const devVal = document.getElementById('drawerEditAssignedTo')?.value;
    const currentDevId = ticket.assignedTo?.id || '';
    if (devVal !== undefined && String(devVal) !== String(currentDevId)) isDirty = true;

    // 6. Validador alterado
    const revVal = document.getElementById('drawerEditReviewer')?.value;
    const currentRevId = ticket.reviewer?.id || ticket.reviewerId || '';
    if (revVal !== undefined && String(revVal) !== String(currentRevId)) isDirty = true;

    // 7. Prazos alterados
    const delivVal = document.getElementById('drawerEditDeliveryDueDate')?.value;
    const origDeliv = typeof formatDateToBrInput === 'function' ? formatDateToBrInput(ticket.deliveryDueDate) : '';
    if (delivVal !== undefined && delivVal !== origDeliv) isDirty = true;

    const clientVal = document.getElementById('drawerEditClientDueDate')?.value;
    const origClient = typeof formatDateToBrInput === 'function' ? formatDateToBrInput(ticket.clientDueDate) : '';
    if (clientVal !== undefined && clientVal !== origClient) isDirty = true;

    // 8. Banco e Movidesk
    const dbVal = document.getElementById('drawerEditDatabase')?.value;
    if (dbVal !== undefined && dbVal !== (ticket.clientDatabase || '')) isDirty = true;

    const movVal = document.getElementById('drawerEditMovidesk')?.value;
    if (movVal !== undefined && movVal !== (ticket.movideskTicketId || '')) isDirty = true;

    // 9. Notas locais
    const notesVal = document.getElementById('drawerLocalNotes')?.value;
    const origNotes = window.appStore?.getNote ? (window.appStore.getNote(currentTicketId) || '') : '';
    if (notesVal !== undefined && notesVal !== origNotes) isDirty = true;

    // 10. Descrição em modo de edição ou com conteúdo alterado
    const isEditingDesc = window.isDrawerEditingDesc ? window.isDrawerEditingDesc() : false;
    if (isEditingDesc) {
      const descEd = document.getElementById('drawerEditDescEditor');
      const currentDescHtml = descEd ? descEd.innerHTML.trim() : '';
      const origDesc = String(ticket.description || '').trim();
      if (currentDescHtml.length > 0 && currentDescHtml !== origDesc) {
        isDirty = true;
      }
    }

    this.markDirty(currentTicketId, isDirty);
    return isDirty;
  }

  // Sincroniza a visibilidade do container principal e do drawer de acordo com a aba ativa
  syncWorkspaceVisibility() {
    const isList = this.activeTabId === 'demands-list';
    const isCreateTicket = this.activeTabId === 'new-ticket';
    const drawer = document.getElementById('demandDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const createOverlay = document.getElementById('createTicketModalOverlay');

    if (isList) {
      document.body.classList.remove('ticket-workspace-active');
      document.body.classList.remove('create-ticket-workspace-active');
      drawer?.classList.remove('open');
      createOverlay?.classList.remove('open');
      overlay?.classList.remove('open');

      // Fecha popovers flutuantes
      document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
      document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
      document.getElementById('calFloatingPopover')?.style.setProperty('display', 'none');
      document.getElementById('calClientPopover')?.style.setProperty('display', 'none');
      window.selectedTicket = null;
    } else if (isCreateTicket) {
      document.body.classList.remove('ticket-workspace-active');
      document.body.classList.add('create-ticket-workspace-active');
      drawer?.classList.remove('open');
      createOverlay?.classList.add('open');
      overlay?.classList.remove('open');

      // Fecha popovers flutuantes do drawer
      document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
      document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
      window.selectedTicket = null;
    } else {
      document.body.classList.remove('create-ticket-workspace-active');
      document.body.classList.add('ticket-workspace-active');
      createOverlay?.classList.remove('open');
      drawer?.classList.add('open');
      overlay?.classList.remove('open'); // Sem overlay bloqueador em modo tela cheia
    }
  }

  // Snapshot em memória dos campos da tela de Abertura de Novo Chamado
  saveCreateTicketSession() {
    this.createTicketSession = {
      title: document.getElementById('newTicketTitle')?.value || '',
      layoutId: document.getElementById('newTicketLayoutId')?.value || '',
      layoutSearch: document.getElementById('newTicketLayoutSearch')?.value || '',
      selectedLayoutBoxDisplay: document.getElementById('newTicketSelectedLayoutBox')?.style.display || 'none',
      selectedLayoutLabel: document.getElementById('newTicketSelectedLayoutLabel')?.textContent || '',
      selectedLayoutSub: document.getElementById('newTicketSelectedLayoutSub')?.textContent || '',
      movidesk: document.getElementById('newTicketMovidesk')?.value || '',
      database: document.getElementById('newTicketDatabase')?.value || '',
      type: document.getElementById('newTicketType')?.value || '',
      product: document.getElementById('newTicketProduct')?.value || '',
      assignedTo: document.getElementById('newTicketAssignedTo')?.value || '',
      priority: document.getElementById('newTicketPriority')?.value || 'medium',
      deliveryDateInput: document.getElementById('newTicketDeliveryDateInput')?.value || '',
      dueDate: document.getElementById('newTicketDueDate')?.value || '',
      clientDueDate: document.getElementById('newTicketClientDueDate')?.value || '',
      description: document.getElementById('newTicketDescription')?.value || '',
      descriptionEditorHtml: document.getElementById('newTicketDescriptionEditor')?.innerHTML || '',
      selectedLabels: typeof newTicketSelectedLabels !== 'undefined' ? Array.from(newTicketSelectedLabels) : [],
      selectedFiles: typeof newTicketSelectedFiles !== 'undefined' ? [...newTicketSelectedFiles] : []
    };
    this.checkCreateTicketDirty();
  }

  // Restaura os campos da tela de Abertura de Novo Chamado
  restoreCreateTicketSession() {
    if (!this.createTicketSession) return;
    const s = this.createTicketSession;

    const titleEl = document.getElementById('newTicketTitle');
    if (titleEl) titleEl.value = s.title || '';

    const layoutIdEl = document.getElementById('newTicketLayoutId');
    if (layoutIdEl) layoutIdEl.value = s.layoutId || '';

    const layoutSearchEl = document.getElementById('newTicketLayoutSearch');
    if (layoutSearchEl) layoutSearchEl.value = s.layoutSearch || '';

    const selectedLayoutBox = document.getElementById('newTicketSelectedLayoutBox');
    const layoutSearchBox = document.getElementById('newTicketLayoutSearchBox');
    if (selectedLayoutBox && layoutSearchBox) {
      if (s.selectedLayoutBoxDisplay === 'flex' || s.layoutId) {
        selectedLayoutBox.style.display = 'flex';
        layoutSearchBox.style.display = 'none';
        const lbl = document.getElementById('newTicketSelectedLayoutLabel');
        const sub = document.getElementById('newTicketSelectedLayoutSub');
        if (lbl) lbl.textContent = s.selectedLayoutLabel || '';
        if (sub) sub.textContent = s.selectedLayoutSub || '';
      } else {
        selectedLayoutBox.style.display = 'none';
        layoutSearchBox.style.display = 'block';
      }
    }

    const moviEl = document.getElementById('newTicketMovidesk');
    if (moviEl) moviEl.value = s.movidesk || '';

    const dbEl = document.getElementById('newTicketDatabase');
    if (dbEl) dbEl.value = s.database || '';

    const typeEl = document.getElementById('newTicketType');
    if (typeEl && s.type) typeEl.value = s.type;

    const prodEl = document.getElementById('newTicketProduct');
    if (prodEl && s.product) prodEl.value = s.product;

    if (typeof updateDevSelectForCurrentType === 'function') {
      updateDevSelectForCurrentType();
    }

    const devEl = document.getElementById('newTicketAssignedTo');
    if (devEl && s.assignedTo) devEl.value = s.assignedTo;

    const priorityEl = document.getElementById('newTicketPriority');
    if (priorityEl) {
      priorityEl.value = s.priority || 'medium';
      if (typeof updatePrioritySelectVisual === 'function') updatePrioritySelectVisual(priorityEl);
    }

    const delivInput = document.getElementById('newTicketDeliveryDateInput');
    if (delivInput) delivInput.value = s.deliveryDateInput || '';

    const dueEl = document.getElementById('newTicketDueDate');
    if (dueEl) dueEl.value = s.dueDate || '';

    const clientDueEl = document.getElementById('newTicketClientDueDate');
    if (clientDueEl) clientDueEl.value = s.clientDueDate || '';

    const descEl = document.getElementById('newTicketDescription');
    if (descEl) descEl.value = s.description || '';

    const descEditor = document.getElementById('newTicketDescriptionEditor');
    if (descEditor) descEditor.innerHTML = s.descriptionEditorHtml || '';

    if (typeof newTicketSelectedLabels !== 'undefined' && Array.isArray(s.selectedLabels)) {
      newTicketSelectedLabels.clear();
      s.selectedLabels.forEach(id => newTicketSelectedLabels.add(id));
      if (typeof renderLabelsPicker === 'function') renderLabelsPicker();
    }

    if (typeof newTicketSelectedFiles !== 'undefined' && Array.isArray(s.selectedFiles)) {
      newTicketSelectedFiles.length = 0;
      s.selectedFiles.forEach(f => newTicketSelectedFiles.push(f));
      if (typeof renderSelectedFilesList === 'function') renderSelectedFilesList();
    }

    this.checkCreateTicketDirty();
  }

  // Verifica se o formulário de novo chamado tem dados preenchidos (dirty)
  checkCreateTicketDirty() {
    const title = document.getElementById('newTicketTitle')?.value || this.createTicketSession?.title || '';
    const descEditor = document.getElementById('newTicketDescriptionEditor')?.innerHTML || this.createTicketSession?.descriptionEditorHtml || '';
    const descText = (document.getElementById('newTicketDescription')?.value || this.createTicketSession?.description || '').trim();
    const layoutId = document.getElementById('newTicketLayoutId')?.value || this.createTicketSession?.layoutId || '';
    const movidesk = document.getElementById('newTicketMovidesk')?.value || this.createTicketSession?.movidesk || '';
    const db = document.getElementById('newTicketDatabase')?.value || this.createTicketSession?.database || '';
    const due = document.getElementById('newTicketDueDate')?.value || this.createTicketSession?.dueDate || '';
    const clientDue = document.getElementById('newTicketClientDueDate')?.value || this.createTicketSession?.clientDueDate || '';
    
    let labelsCount = 0;
    if (typeof newTicketSelectedLabels !== 'undefined' && newTicketSelectedLabels) {
      labelsCount = newTicketSelectedLabels.size;
    } else if (this.createTicketSession?.selectedLabels) {
      labelsCount = this.createTicketSession.selectedLabels.length;
    }

    let filesCount = 0;
    if (typeof newTicketSelectedFiles !== 'undefined' && newTicketSelectedFiles) {
      filesCount = newTicketSelectedFiles.length;
    } else if (this.createTicketSession?.selectedFiles) {
      filesCount = this.createTicketSession.selectedFiles.length;
    }

    const cleanEditor = descEditor.replace(/<p><br><\/p>/gi, '').replace(/<[^>]*>/g, '').trim();

    const isDirty = (
      title.trim().length > 0 ||
      cleanEditor.length > 0 ||
      descText.length > 0 ||
      Boolean(layoutId) ||
      movidesk.trim().length > 0 ||
      db.trim().length > 0 ||
      Boolean(due) ||
      Boolean(clientDue) ||
      labelsCount > 0 ||
      filesCount > 0
    );

    const tab = this.tabs.find(t => t.id === 'new-ticket');
    if (tab) {
      tab.isDirty = isDirty;
      const tabEl = this.tabsContainerEl?.querySelector(`.tab-item[data-tab-id="new-ticket"]`);
      if (tabEl) tabEl.classList.toggle('is-dirty', isDirty);
    }

    return isDirty;
  }

  // Snapshot de rolagem da Lista Geral
  saveListScrollSnapshot() {
    const tv = document.getElementById('tableViewContainer');
    const kv = document.getElementById('kanbanViewContainer');
    const cb = document.getElementById('contentBody');
    this.listScrollSnapshot = {
      tableTop: tv ? tv.scrollTop : 0,
      tableLeft: tv ? tv.scrollLeft : 0,
      kanbanTop: kv ? kv.scrollTop : 0,
      kanbanLeft: kv ? kv.scrollLeft : 0,
      bodyTop: cb ? cb.scrollTop : 0
    };
  }

  // Restauração de rolagem da Lista Geral
  restoreListScrollSnapshot() {
    requestAnimationFrame(() => {
      const snap = this.listScrollSnapshot;
      if (!snap) return;
      const tv = document.getElementById('tableViewContainer');
      if (tv) {
        tv.scrollTop = snap.tableTop;
        tv.scrollLeft = snap.tableLeft;
      }
      const kv = document.getElementById('kanbanViewContainer');
      if (kv) {
        kv.scrollTop = snap.kanbanTop;
        kv.scrollLeft = snap.kanbanLeft;
      }
      const cb = document.getElementById('contentBody');
      if (cb) {
        cb.scrollTop = snap.bodyTop;
      }
    });
  }

  // Cria estrutura de sessão em branco para um chamado
  createInitialSession(ticket) {
    return {
      ticket: { ...ticket },
      commentDraft: '',
      pendingAttachments: [],
      activeSubTab: 'details',
      drawerBodyScroll: 0,
      streamScroll: 0,
      formOverrides: null,
      labels: null,
      notes: window.appStore?.getNote ? (window.appStore.getNote(ticket.id) || '') : '',
      isEditingDesc: false,
      descEditorContent: null,
      fetchedDetails: null
    };
  }

  // Salva o snapshot da sessão do chamado atualmente aberto no drawer
  saveTicketSession(ticketId) {
    if (!ticketId) return;
    let session = this.ticketSessions.get(ticketId);
    const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
    if (!session) {
      session = this.createInitialSession(tab?.ticket || { id: ticketId });
    }

    // 1. Rascunho de texto e anexos
    const commentInput = document.getElementById('drawerNewCommentText');
    if (commentInput) session.commentDraft = commentInput.value;
    session.pendingAttachments = [...(window.getTimelinePendingAttachments?.() || [])];

    // 2. Sub-aba ativa (Ficha, Diálogo, Anexos, Notas)
    session.activeSubTab = window.getDrawerActiveTab?.() || 'details';

    // 3. Rolagem interna
    const drawerBody = document.querySelector('.drawer-body');
    if (drawerBody) session.drawerBodyScroll = drawerBody.scrollTop;
    const streamList = document.getElementById('drawerStreamList');
    if (streamList) session.streamScroll = streamList.scrollTop;

    // 4. Campos do formulário
    session.formOverrides = {
      title: document.getElementById('drawerEditTitle')?.value,
      status: document.getElementById('drawerEditStatus')?.value,
      assignedTo: document.getElementById('drawerEditAssignedTo')?.value,
      priority: document.getElementById('drawerEditPriority')?.value,
      reviewer: document.getElementById('drawerEditReviewer')?.value,
      deliveryDueDate: document.getElementById('drawerEditDeliveryDueDate')?.value,
      clientDueDate: document.getElementById('drawerEditClientDueDate')?.value,
      database: document.getElementById('drawerEditDatabase')?.value,
      movidesk: document.getElementById('drawerEditMovidesk')?.value,
      type: document.getElementById('drawerEditType')?.value,
      product: document.getElementById('drawerEditProduct')?.value
    };

    // 5. Etiquetas
    if (window.getDrawerSelectedLabels) {
      session.labels = Array.from(window.getDrawerSelectedLabels());
    }

    // 6. Notas locais
    const notesEl = document.getElementById('drawerLocalNotes');
    if (notesEl) session.notes = notesEl.value;

    // 7. Descrição em edição
    session.isEditingDesc = window.isDrawerEditingDesc?.() || false;
    const descEd = document.getElementById('drawerEditDescEditor');
    if (descEd) session.descEditorContent = descEd.innerHTML;

    // 8. Atualiza cópia de ticket
    if (window.selectedTicket && String(window.selectedTicket.id) === String(ticketId)) {
      session.ticket = { ...session.ticket, ...window.selectedTicket };
      if (tab) tab.ticket = session.ticket;
    }

    this.ticketSessions.set(ticketId, session);
  }

  // Restaura o estado da sessão de um chamado no drawer
  async restoreTicketSession(ticketId) {
    if (!ticketId) return;
    this.isRestoringSession = true;

    try {
      let session = this.ticketSessions.get(ticketId);
      const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));
      let ticket = session?.ticket || tab?.ticket;

      if (!ticket && window.appStore?.demands) {
        ticket = window.appStore.demands.find(d => String(d.id) === String(ticketId));
      }

      if (!ticket) return;

      // Executa abertura do drawer de forma assíncrona sem travar a restauração
      if (typeof window.openDemandDrawer === 'function') {
        const p = window.openDemandDrawer(ticket);
        if (p && typeof p.catch === 'function') {
          p.catch(e => console.warn('Erro ao abrir drawer:', e));
        }
      }

      // Restaura dados rascunhados / sobrescritos da sessão
      if (session) {
        // Rascunho de comentário
        const txt = document.getElementById('drawerNewCommentText');
        if (txt && session.commentDraft !== undefined) {
          txt.value = session.commentDraft;
        }

        // Anexos temporários
        if (session.pendingAttachments && window.setTimelinePendingAttachments) {
          window.setTimelinePendingAttachments(session.pendingAttachments);
        }

        // Campos do formulário
        if (session.formOverrides) {
          const fo = session.formOverrides;
          const apply = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
          };
          apply('drawerEditTitle', fo.title);
          apply('drawerEditStatus', fo.status);
          apply('drawerEditAssignedTo', fo.assignedTo);
          apply('drawerEditPriority', fo.priority);
          apply('drawerEditReviewer', fo.reviewer);
          apply('drawerEditDeliveryDueDate', fo.deliveryDueDate);
          apply('drawerEditClientDueDate', fo.clientDueDate);
          apply('drawerEditDatabase', fo.database);
          apply('drawerEditMovidesk', fo.movidesk);
          apply('drawerEditType', fo.type);
          apply('drawerEditProduct', fo.product);
        }

        // Etiquetas
        if (session.labels && window.setDrawerSelectedLabels) {
          window.setDrawerSelectedLabels(session.labels);
        }

        // Notas
        if (session.notes !== undefined) {
          const ne = document.getElementById('drawerLocalNotes');
          if (ne) ne.value = session.notes;
        }

        // Edição de descrição
        if (session.isEditingDesc && window.toggleDrawerDescEdit) {
          window.toggleDrawerDescEdit(true);
          if (session.descEditorContent) {
            const ed = document.getElementById('drawerEditDescEditor');
            if (ed) ed.innerHTML = session.descEditorContent;
          }
        }

        // Sub-aba ativa
        if (session.activeSubTab && window.switchDrawerTab) {
          window.switchDrawerTab(session.activeSubTab);
        }

        // Posição de rolagem interna
        requestAnimationFrame(() => {
          if (session.drawerBodyScroll) {
            const db = document.querySelector('.drawer-body');
            if (db) db.scrollTop = session.drawerBodyScroll;
          }
          if (session.streamScroll) {
            const sl = document.getElementById('drawerStreamList');
            if (sl) sl.scrollTop = session.streamScroll;
          }
        });
      }

      // Atualiza indicador de dirty
      this.checkDirty(ticketId);

    } finally {
      this.isRestoringSession = false;
    }
  }

  // Cacheia detalhes vindos de requisições assíncronas concorrentes sem corromper a tela ativa
  cacheFetchedDetails(ticketId, details) {
    if (!ticketId || !details) return;
    let session = this.ticketSessions.get(ticketId);
    const tab = this.tabs.find(t => String(t.ticketId) === String(ticketId));

    if (!session) {
      session = this.createInitialSession(tab?.ticket || { id: ticketId });
    }

    session.ticket = { ...session.ticket, ...details };
    session.fetchedDetails = details;
    this.ticketSessions.set(ticketId, session);

    // Atualiza metadados visuais da aba
    this.updateTab(ticketId, {
      title: details.title || session.ticket.title,
      status: details.status || session.ticket.status,
      number: details.number || session.ticket.number
    });
  }

  // Alterna abas sequencialmente (Ctrl+Tab e Ctrl+Shift+Tab)
  cycleTab(direction = 1) {
    if (this.tabs.length <= 1) return;
    const curIdx = this.tabs.findIndex(t => t.id === this.activeTabId);
    if (curIdx === -1) return;
    const nextIdx = (curIdx + direction + this.tabs.length) % this.tabs.length;
    this.switchToTab(this.tabs[nextIdx].id);
  }

  // Renderiza o DOM da barra de abas
  render() {
    if (!this.tabsContainerEl) return;

    this.tabsContainerEl.innerHTML = this.tabs.map(tab => {
      const isActive = tab.id === this.activeTabId;

      if (tab.type === 'list') {
        return `
          <div class="tab-item tab-item-pinned ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" title="Lista Geral de Demandas (Tabela / Kanban / Filtros)">
            <span class="tab-icon">📋</span>
            <span class="tab-title">Demandas</span>
          </div>
        `;
      }

      if (tab.type === 'create-ticket' || tab.id === 'new-ticket') {
        const isDirtyClass = tab.isDirty ? 'is-dirty' : '';
        return `
          <div class="tab-item tab-item-create-ticket ${isActive ? 'active' : ''} ${isDirtyClass}" data-tab-id="${tab.id}" title="Abertura de Novo Chamado">
            <span class="tab-icon">➕</span>
            <span class="tab-title">Novo Chamado</span>
            <span class="tab-dirty-dot" title="Formulário preenchido com dados não salvos"></span>
            <button type="button" class="tab-close-btn" data-close-tab="${tab.id}" title="Fechar esta aba (Ctrl+W)">✕</button>
          </div>
        `;
      }

      const dotColor = this.getStatusColor(tab.status);
      const isDirtyClass = tab.isDirty ? 'is-dirty' : '';

      return `
        <div class="tab-item ${isActive ? 'active' : ''} ${isDirtyClass}" data-tab-id="${tab.id}" data-ticket-id="${tab.ticketId}" title="${this.escape(tab.title)}">
          <span class="tab-status-dot" style="background-color: ${dotColor}; box-shadow: 0 0 6px ${dotColor};"></span>
          <span class="tab-number">${this.escape(tab.number)}</span>
          <span class="tab-title">${this.escape(tab.title)}</span>
          <span class="tab-dirty-dot" title="Alterações ou rascunho de resposta não salvos"></span>
          <button type="button" class="tab-close-btn" data-close-tab="${tab.id}" title="Fechar esta aba (Ctrl+W)">✕</button>
        </div>
      `;
    }).join('');

    // Eventos de clique nas abas
    this.tabsContainerEl.querySelectorAll('.tab-item').forEach(el => {
      const tabId = el.dataset.tabId;

      // Clique normal (botão esquerdo)
      el.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        this.switchToTab(tabId);
      });

      // Previne o cursor de auto-scroll do Chromium ao clicar com botão do meio
      el.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
          e.preventDefault();
        }
      });

      // Clique com botão do meio (scroll click fecha aba)
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(tabId);
        }
      });
    });

    // Botão fechar (✕) individual de cada aba
    this.tabsContainerEl.querySelectorAll('.tab-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = btn.dataset.closeTab;
        this.closeTab(tabId);
      });
    });
  }

  // Atalhos de teclado globais do sistema multi-abas
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // 1. Ctrl + W: Fecha a aba ativa (exceto a aba de lista)
      if (isCtrlOrCmd && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
        // Previne sempre o fechamento acidental da janela nativa do Electron
        e.preventDefault();
        e.stopPropagation();
        // Se houver modal flutuante aberto (imagem, perfil, etc), não fecha a aba
        if (this.isAnyModalOpen()) return;
        if (this.activeTabId !== 'demands-list') {
          this.closeTab(this.activeTabId);
        }
        return;
      }

      // 2. Ctrl + Tab: Alterna abas para a frente | Ctrl + Shift + Tab: para trás
      if (isCtrlOrCmd && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.cycleTab(e.shiftKey ? -1 : 1);
        return;
      }

      // 3. Ctrl + 1 a 9: Acesso direto por número de aba
      if (isCtrlOrCmd && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        const targetIndex = num - 1;
        if (targetIndex >= 0 && targetIndex < this.tabs.length) {
          e.preventDefault();
          e.stopPropagation();
          this.switchToTab(this.tabs[targetIndex].id);
        }
        return;
      }
    });
  }

  // Verifica se há modais sobrepostos abertos (lightbox, configurações, etc)
  isAnyModalOpen() {
    const checks = [
      () => {
        const el = document.getElementById('imageLightboxOverlay');
        return !!(el && el.style.display !== 'none' && el.style.display !== '');
      },
      () => {
        const el = document.getElementById('modalUserSettings');
        return !!(el && el.style.display !== 'none' && el.style.display !== '');
      },
      () => {
        const el = document.getElementById('modalAutoDrive');
        return !!(el && (el.classList.contains('open') || (el.style.display !== 'none' && el.style.display !== '')));
      },
      () => {
        if (document.body.classList.contains('create-ticket-workspace-active')) return false;
        const el = document.getElementById('createTicketModalOverlay');
        return !!(el && el.classList.contains('open'));
      },
      () => {
        const el = document.getElementById('filterModalOverlay');
        return !!(el && el.classList.contains('open'));
      },
      () => {
        const el = document.getElementById('appSystemDialogModal');
        return !!(el && el.style.display !== 'none' && el.style.display !== '');
      }
    ];
    return checks.some(fn => fn());
  }

  // Monitora alterações nos campos para dirty state em tempo real
  attachDirtyListeners() {
    const onDirtyTrigger = () => {
      if (this.dirtyDebounceTimer) clearTimeout(this.dirtyDebounceTimer);
      this.dirtyDebounceTimer = setTimeout(() => {
        this.checkDirty();
      }, 150);
    };

    // Rascunho de comentário
    document.getElementById('drawerNewCommentText')?.addEventListener('input', onDirtyTrigger);

    // Campos de ficha
    const fieldIds = [
      'drawerEditTitle',
      'drawerEditStatus',
      'drawerEditAssignedTo',
      'drawerEditPriority',
      'drawerEditReviewer',
      'drawerEditDeliveryDueDate',
      'drawerEditClientDueDate',
      'drawerEditDatabase',
      'drawerEditMovidesk',
      'drawerEditType',
      'drawerEditProduct',
      'drawerLocalNotes',
      'drawerEditDescEditor'
    ];

    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', onDirtyTrigger);
      el?.addEventListener('change', onDirtyTrigger);
    });

    // Campos do formulário de abertura de chamado
    const createTicketFieldIds = [
      'newTicketTitle',
      'newTicketLayoutSearch',
      'newTicketMovidesk',
      'newTicketDatabase',
      'newTicketType',
      'newTicketProduct',
      'newTicketAssignedTo',
      'newTicketPriority',
      'newTicketDeliveryDateInput',
      'newTicketClientDueDate',
      'newTicketDescriptionEditor'
    ];

    const onCreateTicketDirtyTrigger = () => {
      if (this.dirtyDebounceTimer) clearTimeout(this.dirtyDebounceTimer);
      this.dirtyDebounceTimer = setTimeout(() => {
        if (this.activeTabId === 'new-ticket') {
          this.checkCreateTicketDirty();
        }
      }, 150);
    };

    createTicketFieldIds.forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', onCreateTicketDirtyTrigger);
      el?.addEventListener('change', onCreateTicketDirtyTrigger);
    });
  }

  // Salva lista de abas abertas no localStorage
  persistOpenTabs() {
    try {
      const ticketIds = this.tabs.filter(t => t.type === 'ticket').map(t => t.ticketId);
      const hasCreateTicketTab = this.tabs.some(t => t.id === 'new-ticket' || t.type === 'create-ticket');
      const data = {
        activeTabId: this.activeTabId,
        hasCreateTicketTab: hasCreateTicketTab,
        ticketIds: ticketIds
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Ignora falhas de quota ou storage indisponível
    }
  }

  // Restaura as abas persistidas após o carregamento inicial das demandas
  restorePersistedTabs() {
    if (this.hasRestoredPersistedTabs) return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;

      const demands = window.appStore?.demands || [];

      this.hasRestoredPersistedTabs = true;

      // Restaura aba de Novo Chamado se estava aberta
      if (data.hasCreateTicketTab && !this.tabs.some(t => t.id === 'new-ticket')) {
        this.tabs.push({
          id: 'new-ticket',
          type: 'create-ticket',
          title: 'Novo Chamado',
          icon: '➕',
          isPinned: false,
          isDirty: false
        });
      }

      if (Array.isArray(data.ticketIds) && demands.length > 0) {
        data.ticketIds.forEach(id => {
          const ticket = demands.find(d => String(d.id) === String(id));
          if (ticket) {
            this.openTicketTab(ticket, false);
          }
        });
      }

      this.render();

      if (data.activeTabId && this.tabs.some(t => t.id === data.activeTabId)) {
        this.switchToTab(data.activeTabId);
      }
    } catch (e) {
      console.warn('Falha ao restaurar abas persistidas:', e);
    }
  }

  // Sincroniza metadados das abas abertas com as demandas atualizadas da store (sem recriar ou alterar foco)
  syncWithStoreDemands() {
    const demands = window.appStore?.demands || [];
    if (!demands || demands.length === 0) return;

    let hasChanges = false;
    this.tabs.forEach(tab => {
      if (tab.type !== 'ticket') return;
      const fresh = demands.find(d => String(d.id) === String(tab.ticketId));
      if (fresh) {
        tab.ticket = { ...tab.ticket, ...fresh };
        const layoutInfo = typeof getTicketLayoutInfo === 'function' ? getTicketLayoutInfo(tab.ticket) : null;
        const layoutCode = layoutInfo?.code || fresh.layoutCode || tab.ticket?.layoutCode || '';
        const newTitle = this.formatTabTitle(fresh.title, layoutCode);
        if (tab.title !== newTitle || tab.status !== fresh.status) {
          tab.title = newTitle;
          tab.status = fresh.status || tab.status;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      this.render();
    }
  }

  // Utilitários de formatação e cor
  formatTabTitle(title, layoutCode) {
    let t = String(title || '').trim();
    if (layoutCode) {
      const escaped = String(layoutCode).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(`^\\s*#?\\s*${escaped}\\s*[-–—:]?\\s*`, 'i'), '').trim();
      return t ? `${layoutCode} – ${t}` : String(layoutCode);
    }
    return t || 'Chamado sem título';
  }

  getStatusColor(status) {
    const s = String(status || '').toLowerCase().trim();
    switch (s) {
      case 'in_progress':
      case 'progress':
        return '#10b981'; // Verde esmeralda
      case 'queued':
      case 'open':
      case 'aberto':
      case 'fila':
        return '#f59e0b'; // Âmbar
      case 'review':
        return '#f59e0b'; // Âmbar
      case 'waiting':
      case 'waiting_creator':
      case 'waiting_requester':
        return '#38bdf8'; // Azul claro
      case 'closed':
      case 'done':
      case 'completed':
      case 'finished':
        return '#64748b'; // Cinza ardósia
      case 'triage':
        return '#94a3b8'; // Cinza claro
      default:
        return '#38bdf8';
    }
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Instância singleton global do gerenciador de abas
window.appTabs = new TabManager();

// Acessor global unificado para o ticket atualmente focado
window.getSelectedTicket = () => {
  if (window.appTabs && window.appTabs.getActiveTicketId()) {
    const activeTab = window.appTabs.tabs.find(t => String(t.ticketId) === String(window.appTabs.getActiveTicketId()));
    if (activeTab && activeTab.ticket) return activeTab.ticket;
  }
  return window.selectedTicket || null;
};

// Inicialização automática ao carregar o DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.appTabs.init());
} else {
  window.appTabs.init();
}
