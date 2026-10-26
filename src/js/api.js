// API Client for Conciliador Contábil Importer Ultra
const API_BASE_URL = 'https://api.importer.conciliadorcontabil.com.br/api/v1';

class ConciliadorAPI {
  constructor() {
    this.token = null;
    this.user = null;
    this._isRelogging = false;
  }

  setToken(token) {
    this.token = token;
  }

  setUser(user) {
    this.user = user;
  }

  getHeaders() {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Falha no login' }));
      throw new Error(err.message || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    this.token = data.accessToken;
    this.user = data.user;
    return data;
  }

  // Interceptor que renova a sessão automaticamente em caso de HTTP 401 usando credenciais salvas
  async fetchWithAuth(url, options = {}, isRetry = false) {
    const headers = {
      ...this.getHeaders(),
      ...(options.headers || {})
    };
    const reqOptions = {
      ...options,
      headers
    };

    const response = await fetch(url, reqOptions);

    if (response.status === 401 && !isRetry && !this._isRelogging) {
      const creds = window.appStore?.savedCredentials;
      if (creds && creds.email && creds.password) {
        this._isRelogging = true;
        try {
          console.warn('[ConciliadorAPI] Sessão expirada (401). Renovando autenticação com credenciais salvas...');
          const loginData = await this.login(creds.email, creds.password);
          if (window.appStore && typeof window.appStore.saveAuth === 'function') {
            await window.appStore.saveAuth(loginData.accessToken, loginData.user, creds);
          }
          this._isRelogging = false;
          // Reexecuta a requisição com o novo token válido
          return await this.fetchWithAuth(url, options, true);
        } catch (reloginErr) {
          this._isRelogging = false;
          console.error('[ConciliadorAPI] Erro ao renovar credenciais salvas:', reloginErr);
        }
      }
    }

    return response;
  }

  async fetchCurrentUser() {
    if (!this.token) return null;
    const response = await this.fetchWithAuth(`${API_BASE_URL}/auth/me`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Sessão expirada');
    }
    const data = await response.json();
    this.user = data;
    return data;
  }

  async fetchAllDemands(limit = 500) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/tickets?page=1&limit=${limit}`, {
      method: 'GET'
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(`Erro ao buscar demandas: HTTP ${response.status}`);
    }

    const json = await response.json();
    // Normalize status names to friendly labels if needed
    return {
      demands: json.data || [],
      total: json.total || 0,
      page: json.page || 1
    };
  }

  async fetchDemandDetails(ticketId) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro ao carregar detalhes: HTTP ${response.status}`);
    }

    return await response.json();
  }

  async fetchProducts() {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/products`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar produtos: HTTP ${response.status}`);
    }

    return await response.json();
  }

  async searchLayouts(query = '', limit = 15) {
    if (!this.token) throw new Error('Não autenticado');

    const url = query
      ? `${API_BASE_URL}/support/layouts?search=${encodeURIComponent(query)}&limit=${limit}`
      : `${API_BASE_URL}/support/layouts?limit=${limit}`;

    const response = await this.fetchWithAuth(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar layouts: HTTP ${response.status}`);
    }

    return await response.json();
  }

  async createTicket(ticketData) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets`, {
      method: 'POST',
      body: JSON.stringify(ticketData)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao criar chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async addComment(ticketId, content) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao enviar comentário' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async updateTicket(ticketId, payload) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao atualizar chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async changeTicketStatus(ticketId, status, reason = undefined) {
    if (!this.token) throw new Error('Não autenticado');

    // Ensure status matches backend enum: triage, queued, in_progress, paused, waiting_requester, review, done
    let normalizedStatus = String(status || '').toLowerCase().trim();
    if (normalizedStatus === 'closed' || normalizedStatus === 'completed' || normalizedStatus === 'finished' || normalizedStatus === 'concluido' || normalizedStatus === 'finalizado') {
      normalizedStatus = 'done';
    } else if (normalizedStatus === 'open' || normalizedStatus === 'aberto' || normalizedStatus === 'fila') {
      normalizedStatus = 'queued';
    } else if (normalizedStatus === 'waiting' || normalizedStatus === 'waiting_creator') {
      normalizedStatus = 'waiting_requester';
    } else if (normalizedStatus === 'progress') {
      normalizedStatus = 'in_progress';
    }

    const body = { status: normalizedStatus };
    if (reason) body.reason = reason;

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/status`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao alterar status do chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async linkTicketLayout(ticketId, layoutId) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/link-layout`, {
      method: 'PUT',
      body: JSON.stringify({ layoutId })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao vincular layout ao chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async assignTicket(ticketId, assignedToId, reason = 'Atribuição de responsável pelo Organizador de Chamados') {
    if (!this.token) throw new Error('Não autenticado');

    const body = {
      assignedToId: assignedToId || null,
      reason: reason || 'Atribuição de responsável'
    };

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/assignee`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao atribuir responsável ao chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async assignReviewer(ticketId, reviewerId, reason = 'Alteração de validador pelo Organizador de Chamados') {
    if (!this.token) throw new Error('Não autenticado');

    if (!reviewerId) {
      throw new Error('A API do Importer Ultra não permite deixar o chamado sem validador depois de já atribuído. Selecione outro membro da equipe para transferir a validação.');
    }

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/reviewer`, {
      method: 'PUT',
      body: JSON.stringify({ reviewerId, reason })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao atribuir validador ao chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async setTicketDates(ticketId, deliveryDueDate, clientDueDate, reason = 'Atualização de prazos pelo Organizador de Chamados') {
    if (!this.token) throw new Error('Não autenticado');

    const body = {
      deliveryDueDate: deliveryDueDate || null,
      clientDueDate: clientDueDate || null,
      reason: reason || 'Atualização de prazos'
    };

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/dates`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao atualizar prazos do chamado' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async archiveTicket(ticketId) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/archive`, {
      method: 'POST'
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro ao arquivar chamado' }));
      throw new Error(err.message || `Erro HTTP ${response.status}`);
    }

    return await response.json();
  }

  async uploadTicketAttachments(ticketId, fileList) {
    if (!this.token) throw new Error('Não autenticado');
    if (!fileList || fileList.length === 0) return [];

    const formData = new FormData();
    for (const file of fileList) {
      formData.append('files', file);
    }

    const response = await this.fetchWithAuth(`${API_BASE_URL}/support/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
        // Deixar Content-Type ser gerado automaticamente com boundary
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro no upload de anexos' }));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || `Erro HTTP ${response.status}`);
      throw new Error(msg);
    }

    return await response.json();
  }

  async fetchAttachmentBlob(ticketId, attachmentId) {
    if (!this.token) throw new Error('Não autenticado');
    const url = `${API_BASE_URL}/support/tickets/${ticketId}/attachments/${attachmentId}/download`;
    const response = await this.fetchWithAuth(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro ao baixar anexo: HTTP ${response.status}`);
    }

    return await response.blob();
  }
}

window.conciliadorAPI = new ConciliadorAPI();
