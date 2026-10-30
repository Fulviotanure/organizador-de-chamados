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

  // Retorna ID do ticket ativo no workspace, ou null se estiver na lista geral
  getActiveTicketId() {
    if (this.activeTabId === 'demands-list') return null;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab?.ticketId || null;
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
      }
    }

    this.activeTabId = tabId;
    this.render();
    this.syncWorkspaceVisibility();

    if (targetTab.type === 'list') {
      this.restoreListScrollSnapshot();
    } else if (targetTab.type === 'ticket') {
      await this.restoreTicketSession(targetTab.ticketId);
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

    // Se estiver ativa agora, faz check de dirty fresco
    if (tab.id === this.activeTabId) {
      this.checkDirty(tab.ticketId);
    }

    // Verificação de segurança: confirmar descarte se houver alterações não salvas
    if (!force && (tab.isDirty || this.isTicketDirty(tab.ticketId))) {
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
    }

    // Se a aba a fechar for a ativa, seleciona a aba anterior ou a lista
    if (this.activeTabId === tab.id) {
      let nextTabId = 'demands-list';
      if (tabIndex > 1) {
        nextTabId = this.tabs[tabIndex - 1].id;
      } else if (this.tabs.length > tabIndex + 1) {
        nextTabId = this.tabs[tabIndex + 1].id;
      }
      await this.switchToTab(nextTabId);
    }

    // Remove sessão e aba
    this.ticketSessions.delete(tab.ticketId);
    this.tabs.splice(tabIndex, 1);

    this.render();
    this.persistOpenTabs();

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
    const drawer = document.getElementById('demandDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (isList) {
      document.body.classList.remove('ticket-workspace-active');
      drawer?.classList.remove('open');
      overlay?.classList.remove('open');

      // Fecha popovers flutuantes
      document.getElementById('calDrawerDeliveryPopover')?.style.setProperty('display', 'none');
      document.getElementById('calDrawerClientPopover')?.style.setProperty('display', 'none');
      window.selectedTicket = null;
    } else {
      document.body.classList.add('ticket-workspace-active');
      drawer?.classList.add('open');
      overlay?.classList.remove('open'); // Sem overlay bloqueador em modo tela cheia
    }
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
        // Se houver modal flutuante aberto (imagem, perfil, etc), não fecha a aba
        if (this.isAnyModalOpen()) return;
        if (this.activeTabId !== 'demands-list') {
          e.preventDefault();
          e.stopPropagation();
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
  }

  // Salva lista de abas abertas no localStorage
  persistOpenTabs() {
    try {
      const ticketIds = this.tabs.filter(t => t.type === 'ticket').map(t => t.ticketId);
      const data = {
        activeTabId: this.activeTabId,
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
      if (!data || !Array.isArray(data.ticketIds) || data.ticketIds.length === 0) return;

      const demands = window.appStore?.demands || [];
      if (demands.length === 0) return;

      this.hasRestoredPersistedTabs = true;

      data.ticketIds.forEach(id => {
        const ticket = demands.find(d => String(d.id) === String(id));
        if (ticket) {
          this.openTicketTab(ticket, false);
        }
      });

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
