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
      status: 'all',
      type: 'all',
      assignedTo: 'all',
      database: '',
      date: 'all' // 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month' | 'none'
    };

    // Sorting state: 'deliveryDueDate_asc' | 'deliveryDueDate_desc' | 'createdAt_desc' | 'createdAt_asc' | 'number_desc' | 'number_asc'
    this.sortBy = 'deliveryDueDate_asc';


    // User session
    this.token = null;
    this.currentUser = null;
    this.savedCredentials = null;

    // Fixed filters definition
    this.fixedFilters = [];

    // Local enhancements (favorites, notes, tags, ignored tickets)
    this.localNotes = {};
    this.favorites = {};
    this.localTags = {};
    this.ignoredTickets = {};

    // Auto-refresh interval (in minutes, 0 = disabled)
    this.autoRefreshMinutes = 3;

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
        const storedTags = await window.electronAPI.loadStorage('localTags', {});
        const storedIgnored = await window.electronAPI.loadStorage('ignoredTickets', {});
        const storedDemands = await window.electronAPI.loadStorage('cachedDemands', []);
        const storedLastSync = await window.electronAPI.loadStorage('lastSync', null);
        const storedAutoRefresh = await window.electronAPI.loadStorage('autoRefreshMinutes', 3);

        this.token = storedToken;
        this.currentUser = storedUser;
        this.savedCredentials = storedCreds;
        this.localNotes = storedNotes || {};
        this.favorites = storedFavorites || {};
        this.localTags = storedTags || {};
        this.ignoredTickets = storedIgnored || {};
        this.demands = storedDemands || [];
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
        } else {
          this.fixedFilters = this.getDefaultFixedFilters();
          await window.electronAPI.saveStorage('fixedFiltersMigrationV2', true);
          await this.saveFixedFilters();
        }


        if (this.token) {
          window.conciliadorAPI.setToken(this.token);
          window.conciliadorAPI.setUser(this.currentUser);
        }
      } catch (err) {
        console.warn('Storage init fallback to defaults:', err);
        this.fixedFilters = this.getDefaultFixedFilters();
      }
    } else {
      this.fixedFilters = this.getDefaultFixedFilters();
    }
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
        icon: '📅',
        color: '#ec4899',
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
      this.activeFilterId = 'all';
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

  // Ignored Tickets
  async toggleIgnore(ticketId) {
    this.ignoredTickets[ticketId] = !this.ignoredTickets[ticketId];
    if (!this.ignoredTickets[ticketId]) {
      delete this.ignoredTickets[ticketId];
    }
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('ignoredTickets', this.ignoredTickets);
    }
    return !!this.ignoredTickets[ticketId];
  }

  isIgnored(ticketId) {
    return !!this.ignoredTickets[ticketId];
  }


  // Cache Demands
  async setDemands(demandsList) {
    this.demands = demandsList;
    this.lastSync = new Date().toISOString();
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('cachedDemands', demandsList);
      await window.electronAPI.saveStorage('lastSync', this.lastSync);
    }
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
    });

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



  // Credentials & Session
  async saveAuth(token, user, credentials = null) {
    this.token = token;
    this.currentUser = user;
    if (credentials) this.savedCredentials = credentials;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('token', token);
      await window.electronAPI.saveStorage('currentUser', user);
      if (credentials) {
        await window.electronAPI.saveStorage('savedCredentials', credentials);
      }
    }
  }

  async logout() {
    this.token = null;
    this.currentUser = null;
    window.conciliadorAPI.setToken(null);
    window.conciliadorAPI.setUser(null);
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('token', null);
      await window.electronAPI.saveStorage('currentUser', null);
    }
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
      // Check Ignored logic:
      const isTicketIgnored = this.isIgnored(ticket.id);
      if (criteria.ignoredOnly) {
        if (!isTicketIgnored) return false;
      } else {
        // By default, ignore list hides tickets from all standard filters!
        if (isTicketIgnored) return false;
      }

      // 1. Text search across number, title, movidesk, database, developer, layout

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

      // 2. Fixed Filter: Favorites only
      if (criteria.favoritesOnly && !this.isFavorite(ticket.id)) {
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
        if (ticket.assignedToId !== criteria.developerId && ticket.assignedTo?.id !== criteria.developerId) {
          return false;
        }
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

      // 9. Quick Dropdown Filters (applied on top of the fixed view)
      if (this.quickFilters.status !== 'all') {
        const s = (ticket.status || '').toLowerCase();
        if (this.quickFilters.status === 'done' || this.quickFilters.status === 'closed' || this.quickFilters.status === 'completed') {
          const isDone = s === 'done' || s === 'closed' || s === 'finished' || s === 'completed' || s === 'concluido' || s === 'finalizado';
          if (!isDone) return false;
        } else {
          if (!s.includes(this.quickFilters.status.toLowerCase())) return false;
        }
      }

      if (this.quickFilters.type !== 'all') {
        const t = (ticket.ticketType?.name || '').toLowerCase();
        if (!t.includes(this.quickFilters.type.toLowerCase())) return false;
      }

      if (this.quickFilters.assignedTo !== 'all') {
        const devName = ticket.assignedTo?.name || 'Não atribuído';
        if (devName !== this.quickFilters.assignedTo) return false;
      }

      if (this.quickFilters.database) {
        const db = (ticket.clientDatabase || '').toLowerCase();
        if (!db.includes(this.quickFilters.database.toLowerCase())) return false;
      }

      // 10. Quick Date Filter
      if (this.quickFilters.date !== 'all') {
        const dueStr = ticket.deliveryDueDate || ticket.clientDueDate;
        if (this.quickFilters.date === 'none') {
          if (dueStr) return false;
        } else {
          if (!dueStr) return false;
          const dueDate = new Date(dueStr);
          const dueDay = dueStr.slice(0, 10);

          if (this.quickFilters.date === 'overdue') {
            if (dueDate >= now || dueDay === todayStr) return false;
          } else if (this.quickFilters.date === 'today') {
            if (dueDay !== todayStr) return false;
          } else if (this.quickFilters.date === 'tomorrow') {
            if (dueDay !== tomorrowStr) return false;
          } else if (this.quickFilters.date === 'week') {
            if (dueDate < now && dueDay !== todayStr) return false; // exclude past
            if (dueDate > weekAhead) return false;
          } else if (this.quickFilters.date === 'month') {
            const thisMonth = now.toISOString().slice(0, 7);
            if (dueStr.slice(0, 7) !== thisMonth) return false;
          }
        }
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
    return this.demands.filter(ticket => {
      const isTicketIgnored = this.isIgnored(ticket.id);
      if (criteria.ignoredOnly) {
        if (!isTicketIgnored) return false;
      } else {
        if (isTicketIgnored) return false;
      }

      if (criteria.favoritesOnly && !this.isFavorite(ticket.id)) return false;


      if (criteria.isMyDemands && this.currentUser) {
        const isAssigned = ticket.assignedToId === this.currentUser.id || 
                           ticket.assignedTo?.id === this.currentUser.id ||
                           ticket.assignedTo?.name?.toLowerCase().includes(this.currentUser.name?.toLowerCase());
        const isRequested = ticket.requestedById === this.currentUser.id ||
                            ticket.requestedBy?.id === this.currentUser.id;
        if (!isAssigned && !isRequested) return false;
      }

      if (criteria.status && criteria.status.length > 0) {
        const ticketStatus = (ticket.status || '').toLowerCase();
        if (!criteria.status.some(s => ticketStatus.includes(s.toLowerCase()))) return false;
      }

      if (criteria.type && criteria.type.length > 0) {
        const typeName = (ticket.ticketType?.name || '').toLowerCase();
        const isUrgent = (ticket.title || '').toLowerCase().includes('urgente');
        if (!criteria.type.some(t => typeName.includes(t.toLowerCase())) && !(criteria.isUrgent && isUrgent)) {
          return false;
        }
      }

      if (criteria.developerId) {
        if (ticket.assignedToId !== criteria.developerId && ticket.assignedTo?.id !== criteria.developerId) return false;
      }

      if (criteria.database) {
        const db = (ticket.clientDatabase || '').toLowerCase();
        if (!db.includes(criteria.database.toLowerCase())) return false;
      }

      if (criteria.deadline === 'urgent') {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const dueStr = ticket.deliveryDueDate || ticket.clientDueDate;
        if (!dueStr) return false;
        const dueDate = new Date(dueStr);
        const isOverdue = dueDate < now && dueStr.slice(0, 10) !== todayStr;
        const isToday = dueStr.slice(0, 10) === todayStr;
        if (!isOverdue && !isToday) return false;
      }

      return true;
    }).length;
  }
}

window.appStore = new AppStore();
