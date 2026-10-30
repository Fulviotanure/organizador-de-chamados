// Store: Handles local storage, state management, fixed filters, and notes
class AppStore {
  constructor() {
    this.demands = [];
    this.lastSync = null;
    this.activeFilterId = 'all';
    this.activeView = 'table'; // 'table' | 'kanban'
    this.kanbanGroupBy = 'status'; // 'status' | 'developer'
    this.searchQuery = '';
    
    // Quick filter dropdown states (temporary on top of fixed filter)
    this.quickFilters = {
      status: [],
      type: [],
      assignedTo: [],
      reviewer: [],
      database: '',
      date: [],
      label: []
    };

    // Sorting state: 'deliveryDueDate_asc' | 'deliveryDueDate_desc' | 'createdAt_desc' | 'createdAt_asc' | 'number_desc' | 'number_asc'
    this.sortBy = 'deliveryDueDate_asc';


    // User session
    this.token = null;
    this.currentUser = null;
    this.savedCredentials = null;

    // Fixed filters definition
    this.fixedFilters = [];

    // Local enhancements (favorites, notes, ignored tickets)
    this.localNotes = {};
    this.favorites = {};
    this.ignoredTickets = {};
    this.ignoredTicketsCache = {};

    // Auto-refresh interval (in minutes, 0 = disabled)
    this.autoRefreshMinutes = 3;

    // Resizable table columns widths & persistent layout cache
    this.tableColumnWidths = {};
    this.layoutCache = {};

    // Static master definitions
    this.products = this.getProducts();
    this.ticketTypes = this.getTicketTypes();
  }

  async init() {
    // Load persisted data from Electron disk storage
    if (window.electronAPI) {
      try {
        const storedToken = await window.electronAPI.loadStorage('token', null);
        const storedUser = await window.electronAPI.loadStorage('currentUser', null);
        const storedCreds = await window.electronAPI.loadStorage('savedCredentials', null);
        const storedFilters = await window.electronAPI.loadStorage('fixedFilters', null);
        const storedNotes = await window.electronAPI.loadStorage('localNotes', {});
        const storedFavorites = await window.electronAPI.loadStorage('favorites', {});
        const storedIgnored = await window.electronAPI.loadStorage('ignoredTickets', {});
        const storedIgnoredCache = await window.electronAPI.loadStorage('ignoredTicketsCache', {});
        const storedDemands = await window.electronAPI.loadStorage('cachedDemands', []);
        const storedLastSync = await window.electronAPI.loadStorage('lastSync', null);
        const storedAutoRefresh = await window.electronAPI.loadStorage('autoRefreshMinutes', 3);
        const storedColWidths = await window.electronAPI.loadStorage('tableColumnWidths', {});
        const storedLayoutCache = await window.electronAPI.loadStorage('layoutCache', {});
        const storedActiveFilter = await window.electronAPI.loadStorage('activeFilterId', null);

        // Fallback redundante com localStorage para máxima resiliência entre reinicializações
        let localIgnored = {};
        let localIgnoredCache = {};
        let localActiveFilter = null;
        try {
          const rawIgnored = localStorage.getItem('cc_ignoredTickets');
          if (rawIgnored) localIgnored = JSON.parse(rawIgnored);
          const rawCache = localStorage.getItem('cc_ignoredTicketsCache');
          if (rawCache) localIgnoredCache = JSON.parse(rawCache);
          localActiveFilter = localStorage.getItem('cc_activeFilterId');
        } catch (e) {}

        this.token = storedToken;
        this.currentUser = storedUser;
        this.savedCredentials = storedCreds;
        this.localNotes = storedNotes || {};
        this.favorites = storedFavorites || {};
        this.ignoredTickets = { ...(localIgnored || {}), ...(storedIgnored || {}) };
        this.ignoredTicketsCache = { ...(localIgnoredCache || {}), ...(storedIgnoredCache || {}) };
        this.demands = storedDemands || [];
        this.tableColumnWidths = storedColWidths || {};
        this.layoutCache = storedLayoutCache || {};

        // Re-injetar qualquer chamado ignorado salvo no cache que não esteja em this.demands
        if (this.ignoredTicketsCache && typeof this.ignoredTicketsCache === 'object') {
          const demandIds = new Set(this.demands.map(d => d.id));
          Object.keys(this.ignoredTicketsCache).forEach(ticketId => {
            if (this.ignoredTickets[ticketId] && !demandIds.has(ticketId)) {
              this.demands.push(this.ignoredTicketsCache[ticketId]);
              demandIds.add(ticketId);
            }
          });
        }

        this.lastSync = storedLastSync;
        this.autoRefreshMinutes = storedAutoRefresh ?? 3;

        if (storedFilters && Array.isArray(storedFilters) && storedFilters.length > 0) {
          this.fixedFilters = storedFilters;

          // Check if migration V2 was already processed; if not, add completed and ignored
          const migrationDone = await window.electronAPI.loadStorage('fixedFiltersMigrationV2', false);
          if (!migrationDone) {
            if (!this.fixedFilters.some(f => f.id === 'completed')) {
              const reviewIdx = this.fixedFilters.findIndex(f => f.id === 'review');
              const completedFilter = {
                id: 'completed',
                name: 'Chamados Concluídos',
                icon: '✅',
                color: '#10b981',
                isSystem: true,
                criteria: {
                  status: ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado']
                }
              };
              if (reviewIdx !== -1) {
                this.fixedFilters.splice(reviewIdx + 1, 0, completedFilter);
              } else {
                this.fixedFilters.push(completedFilter);
              }
            }

            if (!this.fixedFilters.some(f => f.id === 'ignored')) {
              this.fixedFilters.push({
                id: 'ignored',
                name: 'Chamados Ignorados',
                icon: '🚫',
                color: '#64748b',
                isSystem: true,
                criteria: { ignoredOnly: true }
              });
            }

            await window.electronAPI.saveStorage('fixedFiltersMigrationV2', true);
            await this.saveFixedFilters();
          }

          // Check if migration V3 was already processed; if not, add waiting_n2 and completed_documentar
          const migrationDoneV3 = await window.electronAPI.loadStorage('fixedFiltersMigrationV3', false);
          if (!migrationDoneV3) {
            if (!this.fixedFilters.some(f => f.id === 'waiting_n2')) {
              const reviewIdx = this.fixedFilters.findIndex(f => f.id === 'review');
              const waitingN2Filter = {
                id: 'waiting_n2',
                name: 'Aguardando Resposta do N2',
                icon: '⏳',
                color: '#f97316',
                isSystem: true,
                criteria: {
                  status: ['waiting', 'waiting_requester', 'waiting_creator']
                }
              };
              if (reviewIdx !== -1) {
                this.fixedFilters.splice(reviewIdx, 0, waitingN2Filter);
              } else {
                this.fixedFilters.push(waitingN2Filter);
              }
            }

            if (!this.fixedFilters.some(f => f.id === 'completed_documentar')) {
              const completedIdx = this.fixedFilters.findIndex(f => f.id === 'completed');
              const completedDocFilter = {
                id: 'completed_documentar',
                name: 'Concluídos (Documentar)',
                icon: '📑',
                color: '#0891b2',
                isSystem: true,
                criteria: {
                  status: ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'],
                  label: 'DOCUMENTAR'
                }
              };
              if (completedIdx !== -1) {
                this.fixedFilters.splice(completedIdx + 1, 0, completedDocFilter);
              } else {
                this.fixedFilters.push(completedDocFilter);
              }
            }

            await window.electronAPI.saveStorage('fixedFiltersMigrationV3', true);
            await this.saveFixedFilters();
          }

          // Check if migration V4 was already processed; if not, add completed_today
          const migrationDoneV4 = await window.electronAPI.loadStorage('fixedFiltersMigrationV4', false);
          if (!migrationDoneV4) {
            if (!this.fixedFilters.some(f => f.id === 'completed_today')) {
              const completedIdx = this.fixedFilters.findIndex(f => f.id === 'completed');
              const completedTodayFilter = {
                id: 'completed_today',
                name: 'Concluídos Hoje',
                icon: '🏁',
                color: '#34d399',
                isSystem: true,
                criteria: { closedToday: true }
              };
              if (completedIdx !== -1) {
                this.fixedFilters.splice(completedIdx + 1, 0, completedTodayFilter);
              } else {
                this.fixedFilters.push(completedTodayFilter);
              }
            }
            await window.electronAPI.saveStorage('fixedFiltersMigrationV4', true);
            await this.saveFixedFilters();
          }
        } else {
          this.fixedFilters = this.getDefaultFixedFilters();
          await window.electronAPI.saveStorage('fixedFiltersMigrationV2', true);
          await window.electronAPI.saveStorage('fixedFiltersMigrationV3', true);
          await window.electronAPI.saveStorage('fixedFiltersMigrationV4', true);
          await this.saveFixedFilters();
        }

        // Garantir que o filtro Concluídos Hoje sempre exista em fixedFilters
        if (!this.fixedFilters.some(f => f.id === 'completed_today')) {
          const completedIdx = this.fixedFilters.findIndex(f => f.id === 'completed');
          const completedTodayFilter = {
            id: 'completed_today',
            name: 'Concluídos Hoje',
            icon: '🏁',
            color: '#34d399',
            isSystem: true,
            criteria: { closedToday: true }
          };
          if (completedIdx !== -1) {
            this.fixedFilters.splice(completedIdx + 1, 0, completedTodayFilter);
          } else {
            this.fixedFilters.push(completedTodayFilter);
          }
          await this.saveFixedFilters();
        }

        // Garantir que o filtro Chamados Ignorados sempre exista em fixedFilters
        if (!this.fixedFilters.some(f => f.id === 'ignored')) {
          this.fixedFilters.push({
            id: 'ignored',
            name: 'Chamados Ignorados',
            icon: '🚫',
            color: '#64748b',
            isSystem: true,
            criteria: { ignoredOnly: true }
          });
          await this.saveFixedFilters();
        }

        if (this.token) {
          window.conciliadorAPI.setToken(this.token);
          window.conciliadorAPI.setUser(this.currentUser);
        }

        // Restaurar fila/filtro ativo persistido (mantendo a última fila selecionada)
        const targetActiveFilter = storedActiveFilter || localActiveFilter;
        if (targetActiveFilter && this.fixedFilters.some(f => f.id === targetActiveFilter)) {
          this.activeFilterId = targetActiveFilter;
        } else {
          this.activeFilterId = 'all';
        }
      } catch (err) {
        console.warn('Storage init fallback to defaults:', err);
        this.fixedFilters = this.getDefaultFixedFilters();
        this.activeFilterId = 'all';
      }
    } else {
      this.fixedFilters = this.getDefaultFixedFilters();
      let localActiveFilter = null;
      try {
        if (typeof localStorage !== 'undefined') {
          localActiveFilter = localStorage.getItem('cc_activeFilterId');
        }
      } catch (e) {}
      if (localActiveFilter && this.fixedFilters.some(f => f.id === localActiveFilter)) {
        this.activeFilterId = localActiveFilter;
      } else {
        this.activeFilterId = 'all';
      }
    }
  }

  // Define e persiste a fila/filtro selecionado por último
  async setActiveFilterId(filterId) {
    if (!filterId) return;
    this.activeFilterId = filterId;
    if (window.electronAPI && typeof window.electronAPI.saveStorage === 'function') {
      try {
        await window.electronAPI.saveStorage('activeFilterId', filterId);
      } catch (e) {
        console.warn('Erro ao salvar activeFilterId no electronAPI:', e);
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cc_activeFilterId', filterId);
      }
    } catch (e) {}
  }

  getDefaultFixedFilters() {
    return [
      {
        id: 'all',
        name: 'Todas as Demandas',
        icon: '⚡',
        color: '#6366f1',
        isSystem: true,
        criteria: {}
      },
      {
        id: 'my_demands',
        name: 'Minhas Demandas',
        icon: '👤',
        color: '#3b82f6',
        isSystem: true,
        criteria: {
          isMyDemands: true
        }
      },
      {
        id: 'queued',
        name: 'Na Fila',
        icon: '📥',
        color: '#eab308',
        isSystem: true,
        criteria: {
          status: ['queued']
        }
      },
      {
        id: 'in_progress',
        name: 'Em Progresso',
        icon: '🚀',
        color: '#10b981',
        isSystem: true,
        criteria: {
          status: ['in_progress', 'progress']
        }
      },
      {
        id: 'waiting_n2',
        name: 'Aguardando Resposta do N2',
        icon: '⏳',
        color: '#f97316',
        isSystem: true,
        criteria: {
          status: ['waiting', 'waiting_requester', 'waiting_creator']
        }
      },
      {
        id: 'review',
        name: 'Em Revisão',
        icon: '🔍',
        color: '#f59e0b',
        isSystem: true,
        criteria: {
          status: ['review', 'waiting_review']
        }
      },
      {
        id: 'completed',
        name: 'Chamados Concluídos',
        icon: '✅',
        color: '#10b981',
        isSystem: true,
        criteria: {
          status: ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado']
        }
      },
      {
        id: 'completed_today',
        name: 'Concluídos Hoje',
        icon: '🏁',
        color: '#34d399',
        isSystem: true,
        criteria: {
          closedToday: true
        }
      },
      {
        id: 'completed_documentar',
        name: 'Concluídos (Documentar)',
        icon: '📑',
        color: '#0891b2',
        isSystem: true,
        criteria: {
          status: ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'],
          label: 'DOCUMENTAR'
        }
      },
      {
        id: 'errors_urgent',
        name: 'Erros & Urgências',
        icon: '⚠️',
        color: '#ef4444',
        isSystem: true,
        criteria: {
          type: ['Erro'],
          isUrgent: true
        }
      },
      {
        id: 'due_critical',
        name: 'Prazos Críticos',
        icon: '🔥',
        color: '#fb923c',
        isSystem: true,
        criteria: {
          deadline: 'urgent' // overdue or today
        }
      },
      {
        id: 'favorites',
        name: 'Favoritos & Marcados',
        icon: '⭐',
        color: '#fbbf24',
        isSystem: true,
        criteria: {
          favoritesOnly: true
        }
      },
      {
        id: 'ignored',
        name: 'Chamados Ignorados',
        icon: '🚫',
        color: '#64748b',
        isSystem: true,
        criteria: {
          ignoredOnly: true
        }
      }
    ];
  }


  async saveFixedFilters() {
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('fixedFilters', this.fixedFilters);
    }
  }

  async addFixedFilter(filterData) {
    const newFilter = {
      id: 'custom_' + Date.now(),
      name: filterData.name || 'Novo Filtro',
      icon: filterData.icon || '🎯',
      color: filterData.color || '#8b5cf6',
      isSystem: false,
      criteria: filterData.criteria || {}
    };
    this.fixedFilters.push(newFilter);
    await this.saveFixedFilters();
    return newFilter;
  }

  async updateFixedFilter(id, updatedFields) {
    const idx = this.fixedFilters.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.fixedFilters[idx] = { ...this.fixedFilters[idx], ...updatedFields };
      await this.saveFixedFilters();
    }
  }

  async deleteFixedFilter(id) {
    this.fixedFilters = this.fixedFilters.filter(f => f.id !== id);
    if (this.activeFilterId === id) {
      await this.setActiveFilterId('all');
    }
    await this.saveFixedFilters();
  }

  async restoreDefaultFilters() {
    const defaults = this.getDefaultFixedFilters();
    // Keep custom filters and restore missing default filters in original order
    const custom = this.fixedFilters.filter(f => !defaults.some(d => d.id === f.id));
    this.fixedFilters = [...defaults, ...custom];
    await this.saveFixedFilters();
  }

  hasMissingDefaultFilters() {
    const defaults = this.getDefaultFixedFilters();
    return defaults.some(d => !this.fixedFilters.some(f => f.id === d.id));
  }

  // Local Notes
  async saveNote(ticketId, text) {
    this.localNotes[ticketId] = text;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('localNotes', this.localNotes);
    }
  }

  getNote(ticketId) {
    return this.localNotes[ticketId] || '';
  }

  // Favorites
  async toggleFavorite(ticketId) {
    this.favorites[ticketId] = !this.favorites[ticketId];
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('favorites', this.favorites);
    }
    return this.favorites[ticketId];
  }

  isFavorite(ticketId) {
    return !!this.favorites[ticketId];
  }

  // Ignored Tickets (com persistência do objeto completo)
  async toggleIgnore(ticketId) {
    this.ignoredTickets[ticketId] = !this.ignoredTickets[ticketId];
    if (!this.ignoredTickets[ticketId]) {
      delete this.ignoredTickets[ticketId];
      if (this.ignoredTicketsCache) {
        delete this.ignoredTicketsCache[ticketId];
      }
    } else {
      const ticket = (this.demands || []).find(d => d.id === ticketId);
      if (ticket) {
        if (!this.ignoredTicketsCache) this.ignoredTicketsCache = {};
        this.ignoredTicketsCache[ticketId] = { ...ticket };
      }
    }

    if (window.electronAPI) {
      await window.electronAPI.saveStorage('ignoredTickets', this.ignoredTickets);
      await window.electronAPI.saveStorage('ignoredTicketsCache', this.ignoredTicketsCache || {});
    }
    try {
      localStorage.setItem('cc_ignoredTickets', JSON.stringify(this.ignoredTickets));
      if (this.ignoredTicketsCache) {
        localStorage.setItem('cc_ignoredTicketsCache', JSON.stringify(this.ignoredTicketsCache));
      }
    } catch (e) {}

    return !!this.ignoredTickets[ticketId];
  }

  isIgnored(ticketId) {
    return !!(this.ignoredTickets && this.ignoredTickets[ticketId]);
  }

  hasLocalNote(ticketId) {
    return !!(this.localNotes && this.localNotes[ticketId] && String(this.localNotes[ticketId]).trim().length > 0);
  }

  // Cache Demands (Mantém preservados chamados ignorados, favoritos ou com notas locais)
  async setDemands(demandsList) {
    const existingMap = new Map((this.demands || []).map(d => [d.id, d]));
    const incomingMap = new Map((demandsList || []).map(d => [d.id, d]));

    // Se uma demanda da API já estiver em ignorados, sincronizar os dados mais recentes no cache
    (demandsList || []).forEach(d => {
      const existing = existingMap.get(d.id);

      // 1. Preservar closedAt existente na store local para não ser apagado pela API
      if (existing && existing.closedAt && !d.closedAt) {
        d.closedAt = existing.closedAt;
      }

      // 2. Detecção inteligente de transição para Concluído (fechado no app ou externamente no site):
      const wasDone = existing && ['done', 'closed', 'completed', 'finished', 'concluido', 'finalizado'].includes(String(existing.status || '').toLowerCase());
      const isNowDone = ['done', 'closed', 'completed', 'finished', 'concluido', 'finalizado'].includes(String(d.status || '').toLowerCase());
      if (isNowDone) {
        if (!wasDone) {
          // Transição acabou de ocorrer na API
          d.closedAt = d.closedAt || d.completedAt || d.finishedAt || d.resolvedAt || d.updatedAt || new Date().toISOString();
        } else if (!d.closedAt && (d.completedAt || d.finishedAt || d.resolvedAt)) {
          d.closedAt = d.completedAt || d.finishedAt || d.resolvedAt;
        }
      }

      if (this.isIgnored(d.id)) {
        if (!this.ignoredTicketsCache) this.ignoredTicketsCache = {};
        this.ignoredTicketsCache[d.id] = { ...(this.ignoredTicketsCache[d.id] || {}), ...d };
      }
    });

    // Preservar demandas locais existentes que estão ignoradas, favoritadas ou com notas
    // para que NUNCA sejam apagadas caso saiam da lista/limite retornado pela API
    const preserved = (this.demands || []).filter(d => 
      !incomingMap.has(d.id) && (this.isIgnored(d.id) || this.isFavorite(d.id) || this.hasLocalNote(d.id))
    );

    // Também garantir a injeção a partir de ignoredTicketsCache caso algum chamado ignorado tenha sido salvo
    if (this.ignoredTicketsCache) {
      Object.keys(this.ignoredTicketsCache).forEach(id => {
        if (this.ignoredTickets[id] && !incomingMap.has(id) && !preserved.some(p => p.id === id)) {
          preserved.push(this.ignoredTicketsCache[id]);
        }
      });
    }

    this.demands = [...(demandsList || []), ...preserved];
    this.lastSync = new Date().toISOString();
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('cachedDemands', this.demands);
      await window.electronAPI.saveStorage('lastSync', this.lastSync);
      await window.electronAPI.saveStorage('ignoredTicketsCache', this.ignoredTicketsCache || {});
    }
    try {
      if (this.ignoredTicketsCache) {
        localStorage.setItem('cc_ignoredTicketsCache', JSON.stringify(this.ignoredTicketsCache));
      }
    } catch (e) {}

    // Resolução assíncrona em background de chamados concluídos hoje que ainda não tenham closedAt explícito
    this.resolveClosedTodayDemands().catch(e => console.warn('[Store] Falha em resolveClosedTodayDemands:', e));
  }

  async upsertDemand(demand) {
    const idx = this.demands.findIndex(d => d.id === demand.id);
    if (idx !== -1) {
      this.demands[idx] = { ...this.demands[idx], ...demand };
    } else {
      this.demands.unshift(demand);
    }
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('cachedDemands', this.demands);
    }
  }

  async saveDemandsCache() {
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('cachedDemands', this.demands);
    }
  }

  getKnownDevelopers() {
    const devsMap = new Map();
    // Default known team members
    const fallbackDevs = [
      { id: 'a96b76de-88a3-4cb2-a7f8-e9fe6095f9f7', name: 'Cairo Felipe' },
      { id: 'd7fa1524-9188-42fb-8b9d-7143f8507479', name: 'Igor Maduro' },
      { id: '8de70592-b88b-4466-95d0-3d4e8e0cbfc5', name: 'Helter Simões' },
      { id: 'd56608a7-1558-4bd1-9ade-e1447910377e', name: 'Guilherme' },
      { id: '6ae515a3-b5f7-47c5-976f-cc578aa46c7f', name: 'Fulvio Tanure' },
      { id: '56e3e7a4-6167-4ee6-8c2c-0055147fdd14', name: 'Lucas' },
      { id: 'c4b342d1-959c-4842-9435-fb197cb8179b', name: 'Rafael' },
      { id: '3da6dbd7-17ed-41a0-a896-3cb97dfd0df5', name: 'Matheus' },
      { id: '3dbafe6c-ef69-444c-8a93-d747d4a5a1a5', name: 'Hugo' },
      { id: '628d9d24-db32-4233-9b32-834e22f471a4', name: 'Rodrigo Moro (dev)' },
      { id: '7ecba183-cd20-41ed-b09c-bd48665e5be9', name: 'Rodrigo Lopes' },
      { id: 'ecfbd7dd-a639-43ff-9222-5b750a752bfe', name: 'Rodrigo Moro' },
      { id: '571f33e0-2247-4529-91e3-950c61b9846e', name: 'Administrador' }
    ];
    fallbackDevs.forEach(d => devsMap.set(d.id, d));

    // Also collect from cached demands
    this.demands.forEach(d => {
      if (d.assignedTo && d.assignedTo.id && d.assignedTo.name) {
        devsMap.set(d.assignedTo.id, { id: d.assignedTo.id, name: d.assignedTo.name });
      }
      if (d.requestedBy && d.requestedBy.id && d.requestedBy.name) {
        devsMap.set(d.requestedBy.id, { id: d.requestedBy.id, name: d.requestedBy.name });
      }
      if (d.reviewer && d.reviewer.id && d.reviewer.name) {
        devsMap.set(d.reviewer.id, { id: d.reviewer.id, name: d.reviewer.name });
      }
    });

    if (this.currentUser && this.currentUser.id && this.currentUser.name) {
      devsMap.set(this.currentUser.id, { id: this.currentUser.id, name: this.currentUser.name });
    }

    return Array.from(devsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getTicketTypes() {
    return [
      { id: 'ea8614f8-a1cd-4d38-9c57-8b3c8cf72988', name: 'Novo Layout', color: '#a855f7' },
      { id: '7d938908-d073-417a-9a8f-f011c259a790', name: 'Inclusao', color: '#22c55e' },
      { id: 'fb164cb1-aaca-479e-a6b4-501cb97beb7c', name: 'Erro', color: '#ef4444' },
      { id: '62b9fa89-690e-4c70-b48b-df9d3227803d', name: 'Migração', color: '#eab308' },
      { id: 'de8f2861-9aaa-497b-ab50-1020c8654415', name: 'Melhoria', color: '#0ea5e9' }
    ];
  }

  getProducts() {
    if (this.products && Array.isArray(this.products) && this.products.length > 0) {
      return this.products;
    }
    return [
      { id: 'd92c628c-c68f-48f5-8998-bf2c872a4cc8', name: 'Conciliador' },
      { id: 'ca2c4211-9998-4017-9680-bba2d9c776af', name: 'Conciliador Web' },
      { id: 'cea868f6-7f09-4505-a7c8-ff4ff579fb09', name: 'Importer' },
      { id: '9ecebc45-9987-4cee-a93e-9d263d23b1b0', name: 'Reconcilia' }
    ];
  }

  setProducts(prods) {
    if (Array.isArray(prods) && prods.length > 0) {
      this.products = prods;
    }
  }

  getDevelopersForType(typeIdOrName, productIdOrName) {
    const allDevs = this.getKnownDevelopers();

    const types = this.getTicketTypes();
    const typeObj = types.find(t => t.id === typeIdOrName || t.name.toLowerCase() === String(typeIdOrName).toLowerCase());
    const typeName = typeObj ? typeObj.name : String(typeIdOrName || '');

    const products = this.getProducts();
    const prodObj = products.find(p => p.id === productIdOrName || p.name.toLowerCase() === String(productIdOrName).toLowerCase());
    const prodName = prodObj ? prodObj.name : String(productIdOrName || '');

    // Product specific developer assignments matching original web application:
    if (prodName === 'Importer' || prodName === 'Reconcilia') {
      const allowed = ['Rodrigo Lopes', 'Rodrigo Moro (dev)'];
      return allDevs.filter(d => allowed.some(a => d.name.toLowerCase().includes(a.toLowerCase())));
    }

    if (prodName === 'Conciliador Web') {
      const allowed = ['Cairo Felipe', 'Guilherme', 'Helter Simões', 'Rodrigo Lopes', 'Rodrigo Moro (dev)'];
      return allDevs.filter(d => allowed.some(a => d.name.toLowerCase().includes(a.toLowerCase())));
    }

    // Conciliador product matrix by subject/type:
    const roleMapping = {
      'Migração': ['Cairo Felipe', 'Helter Simões', 'Guilherme'],
      'Inclusao': ['Lucas', 'Matheus', 'Rodrigo Lopes', 'Hugo'],
      'Novo Layout': ['Cairo Felipe', 'Guilherme', 'Helter Simões', 'Matheus', 'Hugo', 'Lucas', 'Rodrigo Moro (dev)'],
      'Erro': ['Cairo Felipe', 'Guilherme', 'Helter Simões', 'Hugo', 'Lucas', 'Matheus', 'Rodrigo Lopes', 'Rodrigo Moro (dev)'],
      'Melhoria': ['Cairo Felipe', 'Guilherme', 'Helter Simões', 'Hugo', 'Lucas', 'Matheus', 'Rodrigo Lopes', 'Rodrigo Moro (dev)']
    };

    if (roleMapping[typeName]) {
      const allowed = roleMapping[typeName];
      return allDevs.filter(d => allowed.some(a => d.name.toLowerCase().includes(a.toLowerCase())));
    }

    return allDevs;
  }

  getDeveloperWorkloadByDate(developerIdOrName) {
    if (!developerIdOrName) return {};
    const workload = {};

    this.demands.forEach(d => {
      const s = (d.status || '').toLowerCase();
      // Concluídos saem do calendário
      if (s === 'done' || s === 'closed' || s === 'finished' || s === 'completed' || s === 'concluido' || s === 'finalizado') {
        return;
      }

      // Só conta chamados na fila ("queued") ou em curso ("in_progress" / "progress")
      const isQueueOrInProgress = s === 'queued' || s === 'in_progress' || s === 'progress';
      if (!isQueueOrInProgress) {
        return;
      }

      const matchesDev = (d.assignedToId && d.assignedToId === developerIdOrName) ||
                         (d.assignedTo?.id && d.assignedTo.id === developerIdOrName) ||
                         (d.assignedTo?.name && d.assignedTo.name.toLowerCase() === String(developerIdOrName).toLowerCase());

      if (matchesDev && d.deliveryDueDate) {
        const dayStr = d.deliveryDueDate.slice(0, 10);
        workload[dayStr] = (workload[dayStr] || 0) + 1;
      }
    });

    return workload;
  }

  _normalizeFilterArray(val) {
    if (!val || val === 'all') return [];
    if (Array.isArray(val)) {
      return val.filter(v => v !== undefined && v !== null && v !== '' && v !== 'all');
    }
    return [val];
  }

  getAvailableLabels() {
    const labelsMap = new Map();
    const fallbackLabels = [
      { id: '32da2b0a-e7d4-4874-938a-25fc36b20f0a', name: 'Urgente', color: '#dc2626', kind: 'urgency' },
      { id: '9e1085ba-df68-4342-838e-ab0e9b9296f3', name: 'Alta', color: '#f97316', kind: 'urgency' },
      { id: 'd9ba6be5-98ee-481e-b853-1ae656398ed9', name: 'DOCUMENTAR', color: '#0891b2', kind: 'generic' },
      { id: '8f977d4d-bd27-4e18-834e-6f24ff2f73f9', name: 'DRIVE', color: '#ca8a04', kind: 'generic' },
      { id: '20a3e9b5-8d3b-45ba-b639-c5f2826f24f4', name: 'FAZER CAPA', color: '#16a34a', kind: 'generic' },
      { id: '46b51e69-cae4-48bc-b248-587915872438', name: 'IMPORTER', color: '#7c3aed', kind: 'generic' },
      { id: 'dfb9ea1f-818d-4447-9bff-ccdc7dbd88a5', name: 'AJUSTAR', color: '#c2410c', kind: 'generic' },
      { id: '1bd94d6e-4329-41dc-af6f-5a32b73a2b34', name: 'Inviável Tecnicamente', color: '#64748b', kind: 'generic' }
    ];
    fallbackLabels.forEach(l => labelsMap.set(l.id, l));

    this.demands.forEach(d => {
      if (Array.isArray(d.labels)) {
        d.labels.forEach(item => {
          const l = item.label || item;
          if (l && l.id && l.name) {
            labelsMap.set(l.id, l);
          }
        });
      }
    });

    return Array.from(labelsMap.values());
  }

  ticketHasLabel(ticket, labelQuery) {
    if (!ticket || !Array.isArray(ticket.labels) || !labelQuery) return false;
    const q = String(labelQuery).toLowerCase().trim();
    return ticket.labels.some(item => {
      const l = item.label || item;
      const name = typeof l === 'object' ? (l.name || '') : String(l);
      return name.toLowerCase().includes(q);
    });
  }

  isTicketForCurrentUser(ticket) {
    if (!ticket) return false;
    if (!this.currentUser) return true;
    const userId = this.currentUser.id;
    const userName = (this.currentUser.name || '').toLowerCase().trim();

    // 1. Check assigned developer (assignedTo)
    const asg = ticket.assignedTo;
    const asgId = ticket.assignedToId || (asg && typeof asg === 'object' ? asg.id : null);
    const asgName = String((asg && typeof asg === 'object' ? (asg.name || '') : (typeof asg === 'string' ? asg : '')) || '').toLowerCase().trim();
    if (userId && asgId === userId) return true;
    if (userName && asgName && (asgName.includes(userName) || userName.includes(asgName))) return true;

    // 2. Check reviewer / validador
    const rev = ticket.reviewer;
    const revId = ticket.reviewerId || (rev && typeof rev === 'object' ? rev.id : null);
    const revName = String((ticket.reviewerName || (rev && typeof rev === 'object' ? (rev.name || '') : (typeof rev === 'string' ? rev : ''))) || '').toLowerCase().trim();
    if (userId && revId === userId) return true;
    if (userName && revName && (revName.includes(userName) || userName.includes(revName))) return true;

    return false;
  }

  extractClosedAtFromEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev) continue;
      const k = String(ev.kind || ev.type || '').toLowerCase();
      if (k === 'status_change' || k === 'status_changed' || k === 'status') {
        const toVal = ev.toValue !== undefined ? ev.toValue : ev.to;
        let st = '';
        if (typeof toVal === 'object' && toVal !== null) {
          st = toVal.status || toVal.name || toVal.value || '';
        } else {
          st = String(toVal || '');
        }
        st = String(st).toLowerCase().trim();
        if (['done', 'closed', 'completed', 'finished', 'concluido', 'finalizado'].includes(st)) {
          return ev.createdAt ? new Date(ev.createdAt).toISOString() : null;
        }
      }
    }
    return null;
  }

  isTicketClosedToday(ticket) {
    if (!ticket) return false;
    const status = (ticket.status || '').toLowerCase();
    const isDone = ['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'].includes(status);
    if (!isDone) return false;

    // Somente no nome do colaborador logado
    if (!this.isTicketForCurrentUser(ticket)) return false;

    // 1. Usar a data em que foi alterado para concluído (seja pelo app, timeline ou API)
    const closeDateStr = ticket.closedAt || ticket.completedAt || ticket.finishedAt || ticket.resolvedAt;
    if (closeDateStr) {
      const d = new Date(closeDateStr);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
      }
    }

    // 2. Se o ticket tiver eventos incorporados, extrair o evento de fechamento
    if (Array.isArray(ticket.events)) {
      const eventClosedAt = this.extractClosedAtFromEvents(ticket.events);
      if (eventClosedAt) {
        ticket.closedAt = eventClosedAt;
        const d = new Date(eventClosedAt);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          return d.getFullYear() === now.getFullYear() &&
                 d.getMonth() === now.getMonth() &&
                 d.getDate() === now.getDate();
        }
      }
    }

    return false;
  }

  async resolveClosedTodayDemands() {
    if (!window.conciliadorAPI || !this.token) return;
    const now = new Date();

    // Candidatos: chamados 'done' do usuário atual, com updatedAt de hoje, que ainda não têm closedAt verificado
    const candidates = (this.demands || []).filter(t => {
      const st = String(t.status || '').toLowerCase();
      const isDone = ['done', 'closed', 'completed', 'finished', 'concluido', 'finalizado'].includes(st);
      if (!isDone) return false;
      if (!this.isTicketForCurrentUser(t)) return false;
      if (t.closedAt) return false;

      if (!t.updatedAt) return false;
      const upd = new Date(t.updatedAt);
      if (isNaN(upd.getTime())) return false;
      return upd.getFullYear() === now.getFullYear() &&
             upd.getMonth() === now.getMonth() &&
             upd.getDate() === now.getDate();
    });

    if (candidates.length === 0) return;

    let updatedAny = false;
    for (const cand of candidates.slice(0, 10)) {
      try {
        const details = await window.conciliadorAPI.fetchDemandDetails(cand.id);
        if (details && Array.isArray(details.events)) {
          const closedAtFromEvent = this.extractClosedAtFromEvents(details.events);
          if (closedAtFromEvent) {
            cand.closedAt = closedAtFromEvent;
            updatedAny = true;
          } else if (cand.updatedAt) {
            cand.closedAt = cand.updatedAt;
            updatedAny = true;
          }
        } else if (cand.updatedAt) {
          cand.closedAt = cand.updatedAt;
          updatedAny = true;
        }
      } catch (e) {
        console.warn(`[Store] Falha ao verificar eventos para ${cand.id}:`, e);
      }
    }

    if (updatedAny) {
      await this.saveDemandsCache();
      if (typeof window.renderFixedFiltersList === 'function') {
        window.renderFixedFiltersList();
      }
      if (typeof window.renderDemands === 'function') {
        window.renderDemands();
      }
    }
  }

  getClosedTodayCount() {
    return this.demands.filter(ticket => !this.isIgnored(ticket.id) && this.isTicketClosedToday(ticket)).length;
  }

  // Credentials & Session
  async saveAuth(token, user, credentials = null) {
    this.token = token;
    if (user) this.currentUser = user;
    if (credentials) this.savedCredentials = credentials;
    if (window.conciliadorAPI) {
      window.conciliadorAPI.setToken(token);
      if (user) window.conciliadorAPI.setUser(user);
    }
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('token', token);
      if (user) await window.electronAPI.saveStorage('currentUser', user);
      if (credentials) {
        await window.electronAPI.saveStorage('savedCredentials', credentials);
      }
    }
  }

  async saveCredentials(credentials) {
    this.savedCredentials = credentials;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('savedCredentials', credentials);
    }
  }

  async saveCurrentUser(user) {
    this.currentUser = user;
    if (window.conciliadorAPI) {
      window.conciliadorAPI.setUser(user);
    }
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('currentUser', user);
    }
  }

  hasSavedPassword() {
    return !!(this.savedCredentials && typeof this.savedCredentials.password === 'string' && this.savedCredentials.password.length > 0);
  }

  async logout() {
    this.token = null;
    this.currentUser = null;
    this.savedCredentials = null;
    window.conciliadorAPI.setToken(null);
    window.conciliadorAPI.setUser(null);
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('token', null);
      await window.electronAPI.saveStorage('currentUser', null);
      await window.electronAPI.saveStorage('savedCredentials', null);
    }
  }

  // Shared Fixed Filter Criteria evaluation (used by both getFilteredDemands and countForFilter)
  matchesFixedCriteria(ticket, criteria = {}, now = new Date(), todayStr = now.toISOString().slice(0, 10)) {
    // 1. Check Ignored logic:
    const isTicketIgnored = this.isIgnored(ticket.id);
    if (criteria.ignoredOnly) {
      if (!isTicketIgnored) return false;
    } else {
      // By default, ignore list hides tickets from all standard filters!
      if (isTicketIgnored) return false;
    }

    // 2. Fixed Filter: Favorites only
    if (criteria.favoritesOnly && !this.isFavorite(ticket.id)) {
      return false;
    }

    // 2b. Fixed Filter: Closed Today only
    if (criteria.closedToday && !this.isTicketClosedToday(ticket)) {
      return false;
    }

    // 3. Fixed Filter: My Demands
    if (criteria.isMyDemands && this.currentUser) {
      const isAssigned = ticket.assignedToId === this.currentUser.id ||
                         ticket.assignedTo?.id === this.currentUser.id ||
                         ticket.assignedTo?.name?.toLowerCase().includes(this.currentUser.name?.toLowerCase());
      const isRequested = ticket.requestedById === this.currentUser.id ||
                          ticket.requestedBy?.id === this.currentUser.id;
      if (!isAssigned && !isRequested) return false;
    }

    // 4. Fixed Filter: Status criteria
    if (criteria.status && criteria.status.length > 0) {
      const ticketStatus = (ticket.status || '').toLowerCase();
      const matchesStatus = criteria.status.some(s => ticketStatus.includes(s.toLowerCase()));
      if (!matchesStatus) return false;
    }

    // 5. Fixed Filter: Type criteria
    if (criteria.type && criteria.type.length > 0) {
      const typeName = (ticket.ticketType?.name || '').toLowerCase();
      const isUrgentTitle = (ticket.title || '').toLowerCase().includes('urgente');
      const matchesType = criteria.type.some(t => typeName.includes(t.toLowerCase())) ||
                          (criteria.isUrgent && isUrgentTitle);
      if (!matchesType) return false;
    }

    // 6. Fixed Filter: Developer criteria
    if (criteria.developerId) {
      if (criteria.developerId === '__NONE__' || criteria.developerId === 'none') {
        const devName = ticket.assignedTo?.name ? ticket.assignedTo.name.trim() : '';
        const isUnassigned = !devName || devName === 'Não atribuído';
        if (!isUnassigned) return false;
      } else if (ticket.assignedToId !== criteria.developerId && ticket.assignedTo?.id !== criteria.developerId) {
        return false;
      }
    }
    if (criteria.developerName) {
      const devName = ticket.assignedTo?.name ? ticket.assignedTo.name.trim() : '';
      const isUnassigned = !devName || devName === 'Não atribuído';
      if (criteria.developerName === '__NONE__' || criteria.developerName === 'none') {
        if (!isUnassigned) return false;
      } else {
        if (isUnassigned || devName.toLowerCase() !== criteria.developerName.toLowerCase()) return false;
      }
    }
    if (criteria.unassignedOnly) {
      const devName = ticket.assignedTo?.name ? ticket.assignedTo.name.trim() : '';
      const isUnassigned = !devName || devName === 'Não atribuído';
      if (!isUnassigned) return false;
    }
    if (criteria.developers && Array.isArray(criteria.developers) && criteria.developers.length > 0) {
      const devName = ticket.assignedTo?.name ? ticket.assignedTo.name.trim() : '';
      const isUnassigned = !devName || devName === 'Não atribuído';
      const matchesDev = criteria.developers.some(dev => {
        if (dev === '__NONE__' || dev === 'none' || dev === 'unassigned') return isUnassigned;
        if (isUnassigned) return false;
        return devName.toLowerCase() === dev.toLowerCase();
      });
      if (!matchesDev) return false;
    }

    // 6b. Fixed Filter: Reviewer criteria
    if (criteria.reviewerId) {
      if (criteria.reviewerId === '__NONE__' || criteria.reviewerId === 'none') {
        const revName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : '');
        const hasNoRev = !revName || revName === '-' || revName === 'Não atribuído';
        if (!hasNoRev) return false;
      } else if (ticket.reviewerId !== criteria.reviewerId && ticket.reviewer?.id !== criteria.reviewerId) {
        return false;
      }
    }
    if (criteria.reviewerName) {
      const revName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : '');
      const hasNoRev = !revName || revName === '-' || revName === 'Não atribuído';
      if (criteria.reviewerName === '__NONE__' || criteria.reviewerName === 'none') {
        if (!hasNoRev) return false;
      } else {
        if (hasNoRev || revName.toLowerCase() !== criteria.reviewerName.toLowerCase()) return false;
      }
    }
    if (criteria.unassignedReviewerOnly) {
      const revName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : '');
      const hasNoRev = !revName || revName === '-' || revName === 'Não atribuído';
      if (!hasNoRev) return false;
    }
    if (criteria.isMyReview && this.currentUser) {
      const revName = ticket.reviewer?.name || ticket.reviewerName || '';
      const isMyReview = ticket.reviewerId === this.currentUser.id ||
                         ticket.reviewer?.id === this.currentUser.id ||
                         revName.toLowerCase().includes(this.currentUser.name?.toLowerCase());
      if (!isMyReview) return false;
    }

    // 7. Fixed Filter: Database / Client criteria
    if (criteria.database) {
      const db = (ticket.clientDatabase || '').toLowerCase();
      if (!db.includes(criteria.database.toLowerCase())) return false;
    }

    // 8. Fixed Filter: Deadline / Prazos
    if (criteria.deadline) {
      const dueStr = ticket.deliveryDueDate || ticket.clientDueDate;

      if (criteria.deadline === 'urgent') {
        // overdue or today
        if (!dueStr) return false;
        const dueDate = new Date(dueStr);
        const isOverdue = dueDate < now && dueStr.slice(0, 10) !== todayStr;
        const isToday = dueStr.slice(0, 10) === todayStr;
        if (!isOverdue && !isToday) return false;
      } else if (criteria.deadline === 'today') {
        if (!dueStr || dueStr.slice(0, 10) !== todayStr) return false;
      } else if (criteria.deadline === 'none') {
        if (dueStr) return false;
      }
    }

    // 8b. Fixed Filter: Label criteria
    if (criteria.noLabelsOnly) {
      const hasNoLabels = !ticket.labels || !Array.isArray(ticket.labels) || ticket.labels.length === 0;
      if (!hasNoLabels) return false;
    }
    if (criteria.label) {
      if (criteria.label === '__NONE__' || criteria.label === 'none' || criteria.label === 'no_labels') {
        const hasNoLabels = !ticket.labels || !Array.isArray(ticket.labels) || ticket.labels.length === 0;
        if (!hasNoLabels) return false;
      } else {
        if (!this.ticketHasLabel(ticket, criteria.label)) return false;
      }
    }
    if (criteria.labels && Array.isArray(criteria.labels) && criteria.labels.length > 0) {
      const matchesAny = criteria.labels.some(l => {
        if (l === '__NONE__' || l === 'none' || l === 'no_labels') {
          return !ticket.labels || !Array.isArray(ticket.labels) || ticket.labels.length === 0;
        }
        return this.ticketHasLabel(ticket, l);
      });
      if (!matchesAny) return false;
    }

    return true;
  }

  // Filtering Engine
  getFilteredDemands() {
    const activePreset = this.fixedFilters.find(f => f.id === this.activeFilterId) || this.fixedFilters[0];
    const criteria = activePreset ? activePreset.criteria : {};
    const query = this.searchQuery.trim().toLowerCase();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);

    // 1. Filter
    const filtered = this.demands.filter(ticket => {
      // Fixed Filter Criteria (including Ignored, Favorites, ClosedToday, MyDemands, Status, Type, Dev, Reviewer, DB, Deadline, Label)
      if (!this.matchesFixedCriteria(ticket, criteria, now, todayStr)) {
        return false;
      }

      // Text search across number, title, movidesk, database, developer, layout
      if (query) {
        const numStr = String(ticket.number || '');
        const moviStr = String(ticket.movideskTicketId || '');
        const layoutCode = ticket.layout?.code || (typeof ticket.layout === 'number' || typeof ticket.layout === 'string' ? ticket.layout : '');
        const layoutStr = String(layoutCode || '');
        const titleStr = (ticket.title || '').toLowerCase();
        const dbStr = (ticket.clientDatabase || '').toLowerCase();
        const devStr = (ticket.assignedTo?.name || '').toLowerCase();
        const typeStr = (ticket.ticketType?.name || '').toLowerCase();

        const matches = numStr.includes(query) ||
                        moviStr.includes(query) ||
                        layoutStr.includes(query) ||
                        titleStr.includes(query) ||
                        dbStr.includes(query) ||
                        devStr.includes(query) ||
                        typeStr.includes(query);
        if (!matches) return false;
      }

      // 9. Quick Dropdown Filters (supports multi-selection arrays or legacy strings)
      const selStatuses = this._normalizeFilterArray(this.quickFilters.status);
      if (selStatuses.length > 0) {
        const s = (ticket.status || '').toLowerCase();
        const matchesStatus = selStatuses.some(st => {
          if (st === 'done' || st === 'closed' || st === 'completed') {
            return s === 'done' || s === 'closed' || s === 'finished' || s === 'completed' || s === 'concluido' || s === 'finalizado';
          }
          if (st === 'done_documentar') {
            const isDone = s === 'done' || s === 'closed' || s === 'finished' || s === 'completed' || s === 'concluido' || s === 'finalizado';
            return isDone && this.ticketHasLabel(ticket, 'documentar');
          }
          if (st === 'waiting' || st === 'waiting_n2') {
            return s.includes('waiting') || s.includes('requester') || s.includes('creator');
          }
          return s.includes(st.toLowerCase());
        });
        if (!matchesStatus) return false;
      }

      const selLabels = this._normalizeFilterArray(this.quickFilters.label);
      if (selLabels.length > 0) {
        const hasNoLabels = !ticket.labels || !Array.isArray(ticket.labels) || ticket.labels.length === 0;
        const matchesLabel = selLabels.some(lbl => {
          if (lbl === '__NONE__' || lbl === 'none' || lbl === 'no_labels') {
            return hasNoLabels;
          }
          return this.ticketHasLabel(ticket, lbl);
        });
        if (!matchesLabel) return false;
      }

      const selTypes = this._normalizeFilterArray(this.quickFilters.type);
      if (selTypes.length > 0) {
        const t = (ticket.ticketType?.name || '').toLowerCase();
        const matchesType = selTypes.some(tp => t.includes(tp.toLowerCase()));
        if (!matchesType) return false;
      }

      const selDevs = this._normalizeFilterArray(this.quickFilters.assignedTo);
      if (selDevs.length > 0) {
        const devName = ticket.assignedTo?.name ? ticket.assignedTo.name.trim() : '';
        const isUnassigned = !devName || devName === 'Não atribuído';
        const matchesDev = selDevs.some(dev => {
          if (dev === '__NONE__' || dev === 'none' || dev === 'unassigned') {
            return isUnassigned;
          }
          if (isUnassigned) return false;
          return devName.toLowerCase() === dev.toLowerCase();
        });
        if (!matchesDev) return false;
      }

      // Quick Reviewer Filter
      const selReviewers = this._normalizeFilterArray(this.quickFilters.reviewer);
      if (selReviewers.length > 0) {
        const revName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : '');
        const hasNoRev = !revName || revName === '-' || revName === 'Não atribuído';
        const matchesRev = selReviewers.some(rev => {
          if (rev === '__NONE__' || rev === 'none' || rev === 'unassigned') {
            return hasNoRev;
          }
          if (this.currentUser && (rev === '__ME__' || rev === 'CURRENT_USER' || (this.currentUser.name && rev.toLowerCase() === this.currentUser.name.toLowerCase()))) {
            return (this.currentUser.id && (ticket.reviewerId === this.currentUser.id || ticket.reviewer?.id === this.currentUser.id)) ||
                   (this.currentUser.name && revName.toLowerCase() === this.currentUser.name.toLowerCase());
          }
          if (hasNoRev) return false;
          return revName.toLowerCase() === rev.toLowerCase();
        });
        if (!matchesRev) return false;
      }

      if (this.quickFilters.database) {
        const db = (ticket.clientDatabase || '').toLowerCase();
        if (!db.includes(this.quickFilters.database.toLowerCase())) return false;
      }

      // 10. Quick Date Filter (supports multi-selection or legacy string)
      const selDates = this._normalizeFilterArray(this.quickFilters.date);
      if (selDates.length > 0) {
        const dueStr = ticket.deliveryDueDate || ticket.clientDueDate;
        const matchesDate = selDates.some(dKey => {
          if (dKey === 'none') {
            return !dueStr;
          }
          if (!dueStr) return false;
          const dueDate = new Date(dueStr);
          const dueDay = dueStr.slice(0, 10);

          if (dKey === 'overdue') {
            return dueDate < now && dueDay !== todayStr;
          }
          if (dKey === 'today') {
            return dueDay === todayStr;
          }
          if (dKey === 'tomorrow') {
            return dueDay === tomorrowStr;
          }
          if (dKey === 'week') {
            return (dueDate >= now || dueDay === todayStr) && dueDate <= weekAhead;
          }
          if (dKey === 'month') {
            const thisMonth = now.toISOString().slice(0, 7);
            return dueStr.slice(0, 7) === thisMonth;
          }
          return false;
        });
        if (!matchesDate) return false;
      }

      return true;
    });

    // 2. Sort by selected criteria
    return filtered.sort((a, b) => {
      if (this.sortBy === 'deliveryDueDate_asc') {
        const dueA = a.deliveryDueDate || a.clientDueDate;
        const dueB = b.deliveryDueDate || b.clientDueDate;
        if (!dueA && !dueB) return b.number - a.number;
        if (!dueA) return 1; // null due dates at the bottom
        if (!dueB) return -1;
        return new Date(dueA) - new Date(dueB);
      }
      if (this.sortBy === 'deliveryDueDate_desc') {
        const dueA = a.deliveryDueDate || a.clientDueDate;
        const dueB = b.deliveryDueDate || b.clientDueDate;
        if (!dueA && !dueB) return b.number - a.number;
        if (!dueA) return 1;
        if (!dueB) return -1;
        return new Date(dueB) - new Date(dueA);
      }
      if (this.sortBy === 'createdAt_desc') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (this.sortBy === 'createdAt_asc') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (this.sortBy === 'number_desc') {
        return (b.number || 0) - (a.number || 0);
      }
      if (this.sortBy === 'number_asc') {
        return (a.number || 0) - (b.number || 0);
      }
      return 0;
    });

  }

  // Count items for any given fixed filter
  countForFilter(filter) {
    const criteria = filter.criteria || {};
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let count = 0;
    for (let i = 0; i < this.demands.length; i++) {
      if (this.matchesFixedCriteria(this.demands[i], criteria, now, todayStr)) {
        count++;
      }
    }
    return count;
  }
}

window.appStore = new AppStore();
