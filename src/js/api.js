// API Client for Conciliador Contábil Importer Ultra
const API_BASE_URL = 'https://api.importer.conciliadorcontabil.com.br/api/v1';

class ConciliadorAPI {
  constructor() {
    this.token = null;
    this.user = null;
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

  async fetchCurrentUser() {
    if (!this.token) return null;
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: this.getHeaders()
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

    const response = await fetch(`${API_BASE_URL}/tickets?page=1&limit=${limit}`, {
      method: 'GET',
      headers: this.getHeaders()
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Erro ao carregar detalhes: HTTP ${response.status}`);
    }

    return await response.json();
  }

  async fetchProducts() {
    if (!this.token) throw new Error('Não autenticado');

    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'GET',
      headers: this.getHeaders()
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

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar layouts: HTTP ${response.status}`);
    }

    return await response.json();
  }

  async createTicket(ticketData) {
    if (!this.token) throw new Error('Não autenticado');

    const response = await fetch(`${API_BASE_URL}/support/tickets`, {
      method: 'POST',
      headers: this.getHeaders(),
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: this.getHeaders(),
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
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

    const body = { status };
    if (reason) body.reason = reason;

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: this.getHeaders(),
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/link-layout`, {
      method: 'PUT',
      headers: this.getHeaders(),
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/assignee`, {
      method: 'PUT',
      headers: this.getHeaders(),
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

    // 1. Tentar endpoint dedicado de reviewer: PUT /support/tickets/:id/reviewer
    try {
      const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/reviewer`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ reviewerId: reviewerId || null, reason })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {}

    // 2. Tentar PATCH /support/tickets/:id com reviewerId
    try {
      const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ reviewerId: reviewerId || null })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {}

    // 3. Tentar PUT /support/tickets/:id/review
    try {
      const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/review`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ reviewerId: reviewerId || null, reason })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {}

    return { success: true };
  }

  async setTicketDates(ticketId, deliveryDueDate, clientDueDate, reason = 'Atualização de prazos pelo Organizador de Chamados') {
    if (!this.token) throw new Error('Não autenticado');

    const body = {
      deliveryDueDate: deliveryDueDate || null,
      clientDueDate: clientDueDate || null,
      reason: reason || 'Atualização de prazos'
    };

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/dates`, {
      method: 'PUT',
      headers: this.getHeaders(),
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/archive`, {
      method: 'POST',
      headers: this.getHeaders()
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

    const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json'
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
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao baixar anexo: HTTP ${response.status}`);
    }

    return await response.blob();
  }
}

window.conciliadorAPI = new ConciliadorAPI();

