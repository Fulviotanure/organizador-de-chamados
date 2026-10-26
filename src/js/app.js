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
  setupAppDialogHandlers();
  setupWindowControls();
  setupAutoUpdaterRenderer();
  initQuickFilterDropdowns();
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

// ==========================================================================
// Sistema de Tradução de Erros em Português e Diálogos no Layout do Sistema
// ==========================================================================
function translateErrorMessage(rawError) {
  if (!rawError) return 'Ocorreu um erro desconhecido na operação.';

  let rawMsg = '';
  if (typeof rawError === 'string') {
    rawMsg = rawError;
  } else if (rawError && typeof rawError.message === 'string') {
    rawMsg = rawError.message;
  } else {
    try {
      rawMsg = JSON.stringify(rawError);
    } catch {
      rawMsg = String(rawError);
    }
  }

  // Dividir caso haja múltiplos erros (ex: validação do NestJS separada por vírgula)
  const parts = rawMsg.split(/,\s*/);
  const translatedParts = parts.map(part => {
    const trimmed = part.trim();
    if (!trimmed) return '';

    // Property X should not exist
    const shouldNotExistMatch = trimmed.match(/property\s+([a-zA-Z0-9_]+)\s+should not exist/i);
    if (shouldNotExistMatch) {
      const field = shouldNotExistMatch[1];
      const fieldMap = {
        status: 'Status da Demanda (deve ser atualizado pela ação de status)',
        layoutId: 'Vínculo de Layout (deve ser vinculado pelo botão de layout)',
        ticketTypeId: 'Tipo de Chamado',
        typeId: 'Tipo de Demanda',
        createdAt: 'Data de Criação',
        updatedAt: 'Data de Alteração',
        id: 'Identificador do Registro'
      };
      return `O campo "${fieldMap[field] || field}" não é permitido nesta alteração direta.`;
    }

    if (/is not a valid email/i.test(trimmed)) {
      return 'O e-mail digitado não possui um formato válido.';
    }
    if (/must be a UUID/i.test(trimmed)) {
      return 'Identificador interno inválido (deve ser um código UUID válido).';
    }
    if (/should not be empty/i.test(trimmed)) {
      return 'Este campo é obrigatório e não pode ficar em branco.';
    }
    if (/must be a string/i.test(trimmed)) {
      return 'O valor preenchido deve ser um texto válido.';
    }
    if (/must be an integer/i.test(trimmed) || /must be a number/i.test(trimmed)) {
      return 'O valor preenchido deve ser numérico.';
    }
    if (/Unauthorized/i.test(trimmed) || trimmed === '401' || /HTTP 401/i.test(trimmed)) {
      return 'Sua sessão expirou ou suas credenciais são inválidas. Faça login novamente.';
    }
    if (/Forbidden/i.test(trimmed) || trimmed === '403' || /HTTP 403/i.test(trimmed)) {
      return 'Acesso negado. Você não tem permissão para realizar esta operação no Importer Ultra.';
    }
    if (/Not Found/i.test(trimmed) || trimmed === '404' || /HTTP 404/i.test(trimmed)) {
      return 'O registro ou recurso solicitado não foi encontrado no servidor.';
    }
    if (/Internal server error/i.test(trimmed) || trimmed === '500' || /HTTP 500/i.test(trimmed)) {
      return 'Ocorreu um erro interno no servidor Importer Ultra. Tente novamente em instantes.';
    }
    if (/Failed to fetch|NetworkError|ENOTFOUND|ECONNREFUSED/i.test(trimmed)) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
    }
    return trimmed;
  });

  const finalMsg = translatedParts.filter(Boolean).join('\n• ');
  return finalMsg;
}

let appDialogResolver = null;

function showAppAlert(message, title = 'Aviso do Sistema', type = 'info', techDetails = null) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appSystemDialogModal');
    const card = document.getElementById('appDialogCard');
    const titleEl = document.getElementById('appDialogTitle');
    const subtitleEl = document.getElementById('appDialogSubtitle');
    const msgEl = document.getElementById('appDialogMessage');
    const iconEl = document.getElementById('appDialogIcon');
    const btnConfirm = document.getElementById('btnAppDialogConfirm');
    const btnCancel = document.getElementById('btnAppDialogCancel');
    const techBox = document.getElementById('appDialogTechDetails');
    const techPre = document.getElementById('appDialogTechText');

    if (!modal) {
      if (window.nativeAlert) window.nativeAlert(message);
      return resolve(true);
    }

    appDialogResolver = resolve;

    if (card) {
      card.className = `app-dialog-card type-${type}`;
    }

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
      subtitleEl.textContent = type === 'error' ? 'Falha na Operação' : (type === 'warning' ? 'Atenção Necessária' : (type === 'success' ? 'Operação Concluída' : 'Organizador de Chamados'));
    }

    if (iconEl) {
      if (type === 'error') iconEl.textContent = '❌';
      else if (type === 'warning') iconEl.textContent = '⚠️';
      else if (type === 'success') iconEl.textContent = '✅';
      else iconEl.textContent = 'ℹ️';
    }

    if (msgEl) {
      msgEl.textContent = typeof message === 'string' ? message : translateErrorMessage(message);
    }

    if (techBox && techPre) {
      if (techDetails) {
        techBox.style.display = 'block';
        techPre.textContent = typeof techDetails === 'string' ? techDetails : JSON.stringify(techDetails, null, 2);
      } else {
        techBox.style.display = 'none';
        techPre.textContent = '';
      }
    }

    if (btnCancel) btnCancel.style.display = 'none';
    if (btnConfirm) {
      btnConfirm.style.display = 'inline-flex';
      btnConfirm.textContent = 'OK';
      btnConfirm.className = 'btn-primary';
    }

    modal.style.display = 'flex';
    setTimeout(() => btnConfirm?.focus(), 50);
  });
}

function showAppConfirm(message, title = 'Confirmação', options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appSystemDialogModal');
    const card = document.getElementById('appDialogCard');
    const titleEl = document.getElementById('appDialogTitle');
    const subtitleEl = document.getElementById('appDialogSubtitle');
    const msgEl = document.getElementById('appDialogMessage');
    const iconEl = document.getElementById('appDialogIcon');
    const btnConfirm = document.getElementById('btnAppDialogConfirm');
    const btnCancel = document.getElementById('btnAppDialogCancel');
    const techBox = document.getElementById('appDialogTechDetails');

    if (!modal) {
      const ok = window.nativeConfirm ? window.nativeConfirm(message) : true;
      return resolve(ok);
    }

    appDialogResolver = resolve;

    const isDanger = !!options.isDanger;
    if (card) {
      card.className = `app-dialog-card type-${isDanger ? 'error' : (options.type || 'warning')}`;
    }

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = options.subtitle || 'Confirme para prosseguir';
    if (iconEl) iconEl.textContent = options.icon || (isDanger ? '🗑️' : '❓');
    if (msgEl) msgEl.textContent = message;
    if (techBox) techBox.style.display = 'none';

    if (btnCancel) {
      btnCancel.style.display = 'inline-flex';
      btnCancel.textContent = options.cancelText || 'Cancelar';
    }

    if (btnConfirm) {
      btnConfirm.style.display = 'inline-flex';
      btnConfirm.textContent = options.confirmText || 'Confirmar';
      btnConfirm.className = options.confirmClass || (isDanger ? 'btn-danger' : 'btn-primary');
    }

    modal.style.display = 'flex';
    setTimeout(() => btnConfirm?.focus(), 50);
  });
}

function showAppError(title, err) {
  const friendly = translateErrorMessage(err);
  let techDetails = null;
  if (err) {
    if (err.stack) techDetails = err.stack;
    else if (err.message && err.message !== friendly) techDetails = err.message;
    else if (typeof err === 'object') techDetails = JSON.stringify(err, null, 2);
  }
  return showAppAlert(friendly, title || 'Ocorreu um Erro', 'error', techDetails);
}

function closeAppDialog(result = false) {
  const modal = document.getElementById('appSystemDialogModal');
  if (modal) modal.style.display = 'none';
  if (appDialogResolver) {
    const fn = appDialogResolver;
    appDialogResolver = null;
    fn(result);
  }
}

function setupAppDialogHandlers() {
  document.getElementById('btnAppDialogConfirm')?.addEventListener('click', () => closeAppDialog(true));
  document.getElementById('btnAppDialogCancel')?.addEventListener('click', () => closeAppDialog(false));
  document.getElementById('btnAppDialogClose')?.addEventListener('click', () => closeAppDialog(false));

  const modal = document.getElementById('appSystemDialogModal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeAppDialog(false);
  });

  document.addEventListener('keydown', (e) => {
    if (modal && modal.style.display !== 'none') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAppDialog(false);
      } else if (e.key === 'Enter') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'textarea') {
          e.preventDefault();
          closeAppDialog(true);
        }
      }
    }
  });

  // Guardar referência nativa e sobrescrever window.alert para garantir padrão visual dark do sistema
  if (!window.nativeAlert) {
    window.nativeAlert = window.alert;
    window.alert = function(msg) {
      showAppAlert(msg, 'Aviso do Sistema', 'info');
    };
  }
}

window.showAppAlert = showAppAlert;
window.showAppConfirm = showAppConfirm;
window.showAppError = showAppError;
window.translateErrorMessage = translateErrorMessage;

// Global toast notification
function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('appGlobalToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'appGlobalToastContainer';
    toastContainer.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'rgba(239, 68, 68, 0.95)' : (type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(24, 26, 30, 0.95)');
  const border = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : 'rgba(16, 185, 129, 0.5)');
  const icon = type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️');

  toast.style.cssText = `background: ${bg}; color: #ffffff; border: 1px solid ${border}; border-radius: 6px; padding: 10px 16px; font-size: 13px; font-weight: 500; box-shadow: 0 8px 24px rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; gap: 8px; pointer-events: auto; opacity: 0; transform: translateY(10px); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);`;
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(String(message))}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
window.showToast = showToast;

// Auto-updater UI integration (GitHub Releases)
let isUpdateReadyToInstall = false;

function setupAutoUpdaterRenderer() {
  if (!window.electronAPI) return;

  const banner = document.getElementById('updateBanner');
  const text = document.getElementById('updateBannerText');
  const btnRestart = document.getElementById('btnRestartUpdate');
  const btnCheckUpdates = document.getElementById('btnCheckUpdates');
  const discordToast = document.getElementById('discordUpdateToast');
  const discordToastBadge = document.getElementById('discordToastBadge');
  const discordToastDesc = document.getElementById('discordToastDesc');
  const btnDiscordToastRestart = document.getElementById('btnDiscordToastRestart');
  const btnDiscordToastLater = document.getElementById('btnDiscordToastLater');

  if (window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then(v => {
      const verEl = document.getElementById('appVersionLabel');
      if (verEl && v) verEl.textContent = `Versão v${v}`;
    });
  }

  function handleTriggerRestart() {
    if (window.electronAPI && window.electronAPI.restartAndInstallUpdate) {
      window.electronAPI.restartAndInstallUpdate();
    }
  }

  btnRestart?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleTriggerRestart();
  });
  banner?.addEventListener('click', (e) => {
    if (isUpdateReadyToInstall) {
      handleTriggerRestart();
    }
  });
  btnDiscordToastRestart?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleTriggerRestart();
  });
  btnDiscordToastLater?.addEventListener('click', () => {
    if (discordToast) discordToast.style.display = 'none';
  });

  if (window.electronAPI.onUpdaterStatus) {
    window.electronAPI.onUpdaterStatus(data => {
      console.log('Updater status received:', data);

      if (data.status === 'checking') {
        if (banner && text && banner.dataset.manualCheck === 'true') {
          banner.style.display = 'inline-flex';
          banner.style.background = 'rgba(56, 189, 248, 0.15)';
          banner.style.borderColor = 'rgba(56, 189, 248, 0.35)';
          text.style.color = '#38bdf8';
          text.textContent = 'Verificando atualizações...';
        }
      } else if (data.status === 'available') {
        // Baixa 100% em segundo plano SEM interromper o usuário com modal
        if (banner && text) {
          banner.style.display = 'inline-flex';
          banner.style.background = 'rgba(56, 189, 248, 0.15)';
          banner.style.borderColor = 'rgba(56, 189, 248, 0.35)';
          text.style.color = '#38bdf8';
          text.textContent = data.version ? `⬇️ Baixando v${data.version} em 2º plano...` : '⬇️ Baixando atualização em 2º plano...';
        }
        if (btnCheckUpdates) {
          btnCheckUpdates.innerHTML = '<span>⬇️</span> Baixando...';
        }
      } else if (data.status === 'downloading') {
        const p = data.percent || 0;
        if (banner && text) {
          banner.style.display = 'inline-flex';
          text.textContent = `⬇️ Baixando atualização em 2º plano (${p}%)...`;
        }
        if (btnCheckUpdates) {
          btnCheckUpdates.innerHTML = `<span>⬇️</span> Baixando ${p}%`;
        }
      } else if (data.status === 'downloaded') {
        isUpdateReadyToInstall = true;
        const verStr = data.version ? `v${data.version}` : 'Nova versão';

        // 1. Banner superior estilo Discord com botão verde de reiniciar
        if (banner && text) {
          banner.style.display = 'inline-flex';
          banner.style.background = 'rgba(34, 197, 94, 0.2)';
          banner.style.borderColor = 'rgba(34, 197, 94, 0.5)';
          banner.style.cursor = 'pointer';
          banner.title = 'Clique para reiniciar e aplicar a nova versão';
          text.style.color = '#4ade80';
          text.textContent = `✨ ${verStr} pronta!`;
        }
        if (btnRestart) {
          btnRestart.style.display = 'inline-flex';
          btnRestart.className = 'btn-discord-restart';
          btnRestart.style.cursor = 'pointer';
          btnRestart.innerHTML = '<span>🔄</span> Reiniciar para Atualizar';
        }

        // 2. Botão no rodapé esquerdo transforma-se em "Reiniciar para Atualizar"
        if (btnCheckUpdates) {
          btnCheckUpdates.innerHTML = '<span>🚀</span> Reiniciar para Atualizar';
          btnCheckUpdates.classList.add('btn-restart-ready');
          btnCheckUpdates.title = 'Clique para reiniciar e aplicar a nova versão imediatamente';
        }

        // 3. Notificação flutuante discreta tipo Discord no canto da tela (não bloqueante)
        if (discordToast) {
          if (discordToastBadge) discordToastBadge.textContent = verStr;
          if (discordToastDesc) {
            discordToastDesc.textContent = `A atualização ${verStr} foi baixada em segundo plano. Reinicie quando quiser para aplicar.`;
          }
          discordToast.style.display = 'flex';
        }
      } else if (data.status === 'not-available') {
        if (banner && text && banner.dataset.manualCheck === 'true') {
          banner.style.display = 'inline-flex';
          banner.style.background = 'rgba(56, 189, 248, 0.15)';
          banner.style.borderColor = 'rgba(56, 189, 248, 0.35)';
          text.style.color = '#38bdf8';
          text.textContent = 'Organizador de Chamados já está na versão mais recente.';
          if (btnRestart) btnRestart.style.display = 'none';
          setTimeout(() => { banner.style.display = 'none'; delete banner.dataset.manualCheck; }, 4000);
        }
      } else if (data.status === 'error') {
        if (banner && text && banner.dataset.manualCheck === 'true') {
          banner.style.display = 'inline-flex';
          text.textContent = data.message || 'Erro ao verificar atualizações';
          if (btnRestart) btnRestart.style.display = 'none';
          setTimeout(() => { banner.style.display = 'none'; delete banner.dataset.manualCheck; }, 5000);
        }
      }
    });
  }

  document.getElementById('btnCheckUpdates')?.addEventListener('click', async () => {
    // Se a atualização já estiver baixada, o clique reinicia direto!
    if (isUpdateReadyToInstall) {
      handleTriggerRestart();
      return;
    }

    if (banner) banner.dataset.manualCheck = 'true';
    if (btnCheckUpdates) btnCheckUpdates.innerHTML = '<span>⏳</span> Checando...';
    if (banner && text) {
      banner.style.display = 'inline-flex';
      text.textContent = 'Buscando atualizações no GitHub...';
    }
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (!isUpdateReadyToInstall && btnCheckUpdates) {
        btnCheckUpdates.innerHTML = '<span>🔄</span> Atualizar';
      }
      if (res && !res.success) {
        if (banner && text) {
          text.textContent = res.error || 'Não foi possível verificar atualizações no momento.';
          setTimeout(() => { banner.style.display = 'none'; }, 5000);
        }
      }
    } catch (e) {
      if (btnCheckUpdates) btnCheckUpdates.innerHTML = '<span>🔄</span> Atualizar';
      if (banner && text) {
        text.textContent = e.message || 'Erro ao checar atualizações';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
      }
    }
  });
}

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
    updateUserProfileUI();
    renderFixedFiltersList();
    populateDeveloperSelects();

    // Render cached demands immediately for instant UI
    if (window.appStore.demands && window.appStore.demands.length > 0) {
      renderDemands();
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

// ------------------- Configurações e Reconhecimento do Usuário (Engrenagem ⚙️) -------------------

async function recognizeCurrentUser(forceApi = false) {
  let user = window.appStore.currentUser;

  // Se solicitado ou se faltar dados essenciais, buscar perfil atualizado direto da API
  if (forceApi || !user || !user.name) {
    if (window.conciliadorAPI && window.appStore.token) {
      try {
        const apiUser = await window.conciliadorAPI.fetchCurrentUser();
        if (apiUser) {
          user = apiUser;
          await window.appStore.saveCurrentUser(apiUser);
        }
      } catch (err) {
        console.warn('Erro ao reconhecer usuário na API:', err);
      }
    }
  }

  // Atualizar visual da barra lateral
  updateUserProfileUI();

  // Atualizar campos do modal de configurações
  const avatarEl = document.getElementById('settingsUserAvatar');
  const nameEl = document.getElementById('settingsUserName');
  const emailEl = document.getElementById('settingsUserEmail');
  const roleEl = document.getElementById('settingsUserRoleBadge');
  const statusEl = document.getElementById('settingsUserAuthStatus');

  const displayName = user?.name || user?.email || (window.appStore.savedCredentials?.email || 'Usuário Não Reconhecido');
  const displayEmail = user?.email || (window.appStore.savedCredentials?.email || 'Sem e-mail cadastrado');
  const roleName = user?.role === 'support' ? 'Suporte' : (user?.role === 'developer' ? 'Desenvolvedor' : (user?.role || 'Usuário'));

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = displayEmail;
  if (roleEl) roleEl.textContent = roleName;

  if (avatarEl) {
    if (user?.name) {
      const parts = user.name.split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    } else {
      avatarEl.textContent = (displayEmail.slice(0, 2) || '--').toUpperCase();
    }
  }

  if (statusEl) {
    if (window.appStore.token) {
      statusEl.innerHTML = '<span class="status-dot-active" style="color: #10b981;">🟢</span> Sessão Ativa no Importer Ultra';
      statusEl.style.color = '#34d399';
    } else {
      statusEl.innerHTML = '<span style="color: #ef4444;">🔴</span> Sessão Desconectada';
      statusEl.style.color = '#f87171';
    }
  }

  return user;
}

async function openUserSettingsModal(promptPasswordIfMissing = false) {
  const modal = document.getElementById('modalUserSettings');
  if (!modal) return;

  modal.style.display = 'flex';

  // 1. Reconhecer usuário na API / Store
  const user = await recognizeCurrentUser(false);

  // 2. Verificar se tem senha salva
  const hasPassword = window.appStore.hasSavedPassword();
  const warningBox = document.getElementById('settingsNoPasswordWarning');
  const successBox = document.getElementById('settingsHasPasswordSuccess');
  const statusBadge = document.getElementById('settingsPasswordStatusBadge');
  const emailInput = document.getElementById('settingsInputEmail');
  const pwdInput = document.getElementById('settingsInputPassword');

  const currentEmail = window.appStore.savedCredentials?.email || user?.email || '';
  if (emailInput) emailInput.value = currentEmail;

  if (hasPassword) {
    if (warningBox) warningBox.style.display = 'none';
    if (successBox) successBox.style.display = 'block';
    if (statusBadge) {
      statusBadge.textContent = '✅ Senha Salva';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      statusBadge.style.color = '#34d399';
      statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
    }
    if (pwdInput) {
      pwdInput.value = window.appStore.savedCredentials.password;
      pwdInput.style.borderColor = '';
      pwdInput.style.boxShadow = '';
    }
  } else {
    // NÃO TEM SENHA SALVA -> Pedir para inserir
    if (warningBox) warningBox.style.display = 'block';
    if (successBox) successBox.style.display = 'none';
    if (statusBadge) {
      statusBadge.textContent = '⚠️ Senha Ausente';
      statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      statusBadge.style.color = '#fbbf24';
      statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    }
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.style.borderColor = '#f59e0b';
      pwdInput.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.25)';
      setTimeout(() => pwdInput.focus(), 150);
    }

    if (promptPasswordIfMissing) {
      warningBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 3. Status e Configurações do Google Drive
  const driveStatusPill = document.getElementById('settingsDriveStatusPill');
  const driveStatusDot = document.getElementById('settingsDriveStatusDot');
  const driveEmail = document.getElementById('settingsDriveEmail');
  const inputDriveEmail = document.getElementById('settingsDriveInputEmail');
  const inputDrivePassword = document.getElementById('settingsDriveInputPassword');
  const inputMirrorPath = document.getElementById('settingsLocalMirrorPath');

  if (window.electronAPI) {
    try {
      let cfg = null;
      if (window.electronAPI.getDriveConfig) {
        cfg = await window.electronAPI.getDriveConfig();
      } else if (window.electronAPI.loadStorage) {
        cfg = {
          email: await window.electronAPI.loadStorage('googleDriveEmail', ''),
          password: await window.electronAPI.loadStorage('googleDrivePassword', ''),
          mirrorPath: await window.electronAPI.loadStorage('googleDriveMirrorPath', '')
        };
      }
      if (cfg) {
        if (inputDriveEmail) inputDriveEmail.value = cfg.email || '';
        if (inputDrivePassword) inputDrivePassword.value = cfg.password || '';
        if (inputMirrorPath) inputMirrorPath.value = cfg.mirrorPath || '';
      }

      if (window.electronAPI.getDriveStatus) {
        const driveStatus = await window.electronAPI.getDriveStatus();
        if (driveStatus && driveStatus.connected) {
          if (driveStatusDot) driveStatusDot.textContent = '🟢';
          const emailDisplay = driveStatus.user?.emailAddress || cfg?.email || 'Conectado';
          if (driveEmail) driveEmail.textContent = `${driveStatus.user?.displayName || 'Google Drive'} (${emailDisplay})`;
          if (driveStatusPill) {
            driveStatusPill.style.background = 'rgba(35, 134, 54, 0.15)';
            driveStatusPill.style.color = '#3fb950';
            driveStatusPill.style.borderColor = 'rgba(46, 160, 67, 0.4)';
          }
        } else if (cfg?.email) {
          if (driveStatusDot) driveStatusDot.textContent = '🟡';
          if (driveEmail) driveEmail.textContent = `Configurado: ${cfg.email}`;
          if (driveStatusPill) {
            driveStatusPill.style.background = 'rgba(210, 153, 34, 0.15)';
            driveStatusPill.style.color = '#e3b341';
            driveStatusPill.style.borderColor = 'rgba(210, 153, 34, 0.4)';
          }
        } else {
          if (driveStatusDot) driveStatusDot.textContent = '⚪';
          if (driveEmail) driveEmail.textContent = 'Google Drive: Não conectado';
          if (driveStatusPill) {
            driveStatusPill.style.background = 'rgba(110, 118, 129, 0.15)';
            driveStatusPill.style.color = '#8b949e';
            driveStatusPill.style.borderColor = 'rgba(110, 118, 129, 0.3)';
          }
        }
      }
    } catch (e) {
      if (driveStatusDot) driveStatusDot.textContent = '⚪';
      if (driveEmail) driveEmail.textContent = 'Google Drive: Desconectado';
    }
  }

  // 4. Intervalo de auto-refresh
  const refreshSelect = document.getElementById('settingsAutoRefreshSelect');
  if (refreshSelect) {
    refreshSelect.value = String(window.appStore.autoRefreshMinutes ?? 3);
  }
}

function closeUserSettingsModal() {
  const modal = document.getElementById('modalUserSettings');
  if (modal) modal.style.display = 'none';
}

async function saveUserSettingsCredentials() {
  const email = document.getElementById('settingsInputEmail')?.value.trim();
  const password = document.getElementById('settingsInputPassword')?.value.trim();
  const remember = document.getElementById('settingsRememberCredentials')?.checked;

  if (!password) {
    showAppAlert('Por favor, digite a sua senha de acesso para que o sistema possa salvá-la.', 'Senha Obrigatória', 'warning');
    document.getElementById('settingsInputPassword')?.focus();
    return;
  }

  const finalEmail = email || window.appStore.currentUser?.email || (window.appStore.savedCredentials?.email || '');
  if (!finalEmail) {
    showAppAlert('Por favor, informe seu e-mail de acesso.', 'E-mail Obrigatório', 'warning');
    document.getElementById('settingsInputEmail')?.focus();
    return;
  }

  try {
    const creds = remember ? { email: finalEmail, password } : null;
    await window.appStore.saveCredentials(creds);

    // Atualizar UI do modal
    const warningBox = document.getElementById('settingsNoPasswordWarning');
    const successBox = document.getElementById('settingsHasPasswordSuccess');
    const statusBadge = document.getElementById('settingsPasswordStatusBadge');
    const pwdInput = document.getElementById('settingsInputPassword');

    if (warningBox) warningBox.style.display = 'none';
    if (successBox) successBox.style.display = 'block';
    if (statusBadge) {
      statusBadge.textContent = '✅ Senha Salva';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      statusBadge.style.color = '#34d399';
      statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
    }
    if (pwdInput) {
      pwdInput.style.borderColor = '';
      pwdInput.style.boxShadow = '';
    }

    showAppAlert('Senha e informações de usuário salvas com sucesso! O sistema usará essas credenciais para reconexão automática.', 'Configurações Salvas', 'success');
  } catch (err) {
    showAppError('Erro ao Salvar Configurações', err);
  }
}

function setupUserSettingsHandlers() {
  // Botões de engrenagem para abrir o modal
  document.getElementById('btnTitlebarSettings')?.addEventListener('click', () => openUserSettingsModal());
  document.getElementById('btnUserSettings')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openUserSettingsModal();
  });
  document.getElementById('btnOpenUserCardSettings')?.addEventListener('click', () => openUserSettingsModal());

  // Fechar modal
  document.getElementById('btnCloseUserSettingsModal')?.addEventListener('click', closeUserSettingsModal);
  document.getElementById('btnCloseUserSettingsBottom')?.addEventListener('click', closeUserSettingsModal);
  document.getElementById('modalUserSettings')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalUserSettings') closeUserSettingsModal();
  });

  // Botão reconhecer perfil
  document.getElementById('btnRefreshUserProfile')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnRefreshUserProfile');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Reconhecendo...';
    }
    await recognizeCurrentUser(true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄</span> Reconhecer';
    }
  });

  // Botão salvar senha / credenciais
  document.getElementById('btnSaveUserSettingsCreds')?.addEventListener('click', saveUserSettingsCredentials);

  // Alternar visibilidade de senha
  document.getElementById('btnToggleShowSettingsPassword')?.addEventListener('click', () => {
    const pwdInput = document.getElementById('settingsInputPassword');
    const toggleBtn = document.getElementById('btnToggleShowSettingsPassword');
    if (pwdInput && toggleBtn) {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = '🙈 Ocultar';
      } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = '👁️ Ver';
      }
    }
  });

  // Botão desconectar no modal de configurações
  document.getElementById('btnUserSettingsLogout')?.addEventListener('click', () => {
    closeUserSettingsModal();
    document.getElementById('btnLogout')?.click();
  });

  // Toggle visualização da senha do Google Drive
  document.getElementById('btnToggleShowDrivePassword')?.addEventListener('click', () => {
    const pwdInput = document.getElementById('settingsDriveInputPassword');
    const toggleBtn = document.getElementById('btnToggleShowDrivePassword');
    if (pwdInput && toggleBtn) {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = '🙈 Ocultar';
      } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = '👁️ Ver';
      }
    }
  });

  // Alterar pasta de backup do espelho local via seletor nativo
  document.getElementById('btnSelectSettingsMirrorFolder')?.addEventListener('click', async () => {
    const inputPath = document.getElementById('settingsLocalMirrorPath');
    const current = inputPath?.value || '';
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      const res = await window.electronAPI.selectDirectory(current);
      if (res && !res.canceled && res.path) {
        if (inputPath) inputPath.value = res.path;
      }
    } else {
      showAppAlert('A seleção de pastas requer o aplicativo Desktop Electron.', 'Desktop Necessário', 'info');
    }
  });

  // Salvar configurações do Google Drive e pasta de backup
  document.getElementById('btnSaveDriveSettings')?.addEventListener('click', async () => {
    const email = document.getElementById('settingsDriveInputEmail')?.value.trim() || '';
    const password = document.getElementById('settingsDriveInputPassword')?.value.trim() || '';
    const mirrorPath = document.getElementById('settingsLocalMirrorPath')?.value.trim() || '';

    try {
      if (window.electronAPI && window.electronAPI.saveDriveConfig) {
        const res = await window.electronAPI.saveDriveConfig({ email, password, mirrorPath });
        if (!res.success) throw new Error(res.error || 'Erro ao salvar configurações do Drive');
      } else if (window.electronAPI && window.electronAPI.saveStorage) {
        await window.electronAPI.saveStorage('googleDriveEmail', email);
        await window.electronAPI.saveStorage('googleDrivePassword', password);
        await window.electronAPI.saveStorage('googleDriveMirrorPath', mirrorPath);
      }

      showAppAlert('Configurações de acesso do Google Drive e pasta de backup salvas com sucesso!', 'Drive Salvo', 'success');

      // Atualizar status e pílula visual
      await checkGoogleDriveStatus();
      if (window.electronAPI && window.electronAPI.getDriveStatus) {
        const status = await window.electronAPI.getDriveStatus();
        const driveStatusDot = document.getElementById('settingsDriveStatusDot');
        const driveEmail = document.getElementById('settingsDriveEmail');
        const driveStatusPill = document.getElementById('settingsDriveStatusPill');
        if (status?.connected) {
          if (driveStatusDot) driveStatusDot.textContent = '🟢';
          if (driveEmail) driveEmail.textContent = `${status.user?.displayName || 'Google Drive'} (${status.user?.emailAddress || email || 'Conectado'})`;
          if (driveStatusPill) {
            driveStatusPill.style.background = 'rgba(35, 134, 54, 0.15)';
            driveStatusPill.style.color = '#3fb950';
            driveStatusPill.style.borderColor = 'rgba(46, 160, 67, 0.4)';
          }
        } else if (email) {
          if (driveStatusDot) driveStatusDot.textContent = '🟡';
          if (driveEmail) driveEmail.textContent = `Configurado: ${email}`;
        }
      }
    } catch (err) {
      showAppError('Erro ao Salvar Configurações do Drive', err);
    }
  });

  // Desconectar / Limpar credenciais do Google Drive
  document.getElementById('btnDisconnectDrive')?.addEventListener('click', async () => {
    const ok = await showAppConfirm('Deseja realmente desconectar e limpar as credenciais do Google Drive deste computador?', 'Desconectar Google Drive', { isDanger: true, confirmText: 'Desconectar' });
    if (ok) {
      if (window.electronAPI && window.electronAPI.disconnectDrive) {
        await window.electronAPI.disconnectDrive();
      } else if (window.electronAPI && window.electronAPI.saveStorage) {
        await window.electronAPI.saveStorage('googleDriveEmail', '');
        await window.electronAPI.saveStorage('googleDrivePassword', '');
        await window.electronAPI.saveStorage('googleDriveMirrorPath', '');
      }

      const emailInput = document.getElementById('settingsDriveInputEmail');
      const pwdInput = document.getElementById('settingsDriveInputPassword');
      const mirrorInput = document.getElementById('settingsLocalMirrorPath');
      if (emailInput) emailInput.value = '';
      if (pwdInput) pwdInput.value = '';
      if (mirrorInput) mirrorInput.value = '';

      const driveStatusDot = document.getElementById('settingsDriveStatusDot');
      const driveEmail = document.getElementById('settingsDriveEmail');
      const driveStatusPill = document.getElementById('settingsDriveStatusPill');

      if (driveStatusDot) driveStatusDot.textContent = '⚪';
      if (driveEmail) driveEmail.textContent = 'Google Drive: Não conectado';
      if (driveStatusPill) {
        driveStatusPill.style.background = 'rgba(110, 118, 129, 0.15)';
        driveStatusPill.style.color = '#8b949e';
        driveStatusPill.style.borderColor = 'rgba(110, 118, 129, 0.3)';
      }

      await checkGoogleDriveStatus();
      showAppAlert('Credenciais do Google Drive removidas com sucesso! O sistema está pronto para uma nova conexão.', 'Drive Desconectado', 'info');
    }
  });

  // 1. Conectar via Login Google (OAuth no navegador)
  document.getElementById('btnOAuthLoginDrive')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnOAuthLoginDrive');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Abrindo Navegador...';
    }
    try {
      if (window.electronAPI && window.electronAPI.startDriveOAuth) {
        showAppAlert('Uma página do navegador será aberta para você fazer login na sua conta Google e autorizar o acesso.\n\nApós autorizar no navegador, o aplicativo conectará automaticamente!', 'Login Google', 'info');
        const res = await window.electronAPI.startDriveOAuth();
        if (res && res.success) {
          showAppAlert(`Google Drive conectado com sucesso!\n\nConta: ${res.userEmail || res.status?.user?.emailAddress || 'Conectada'}`, 'Conexão Realizada', 'success');
          await checkGoogleDriveStatus();
        } else {
          showAppAlert(res.error || 'Não foi possível concluir o login do Google Drive.', 'Falha na Autorização', 'warning');
        }
      } else {
        showAppAlert('O login via navegador requer a execução no aplicativo desktop.', 'Recurso Desktop', 'info');
      }
    } catch (err) {
      showAppError('Erro ao Conectar com Google Drive', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🌐</span> Conectar com Conta Google (Login)';
      }
      await checkGoogleDriveStatus();
    }
  });

  // 2. Sincronizar com AutoDrive Local
  document.getElementById('btnSyncAutoDrive')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncAutoDrive');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Buscando...';
    }
    try {
      if (window.electronAPI && window.electronAPI.syncAutoDriveLocal) {
        const res = await window.electronAPI.syncAutoDriveLocal();
        if (res && res.success) {
          showAppAlert(`Credenciais do AutoDrive vinculadas com sucesso!\n\nConta: ${res.status?.user?.emailAddress || res.status?.user?.displayName || 'Ativa'}`, 'AutoDrive Vinculado', 'success');
          await checkGoogleDriveStatus();
        } else {
          showAppAlert(`Não foi possível importar do AutoDrive:\n\n${res.error || 'Nenhum token encontrado.'}\n\nVocê também pode conectar clicando em "Conectar com Conta Google (Login)" ou importando o token.json.`, 'AutoDrive Não Encontrado', 'warning');
        }
      }
    } catch (err) {
      showAppError('Erro ao Sincronizar com AutoDrive', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡</span> Sincronizar com AutoDrive Local';
      }
      await checkGoogleDriveStatus();
    }
  });

  // 3. Importar token.json manualmente
  document.getElementById('btnImportDriveToken')?.addEventListener('click', async () => {
    try {
      if (window.electronAPI && window.electronAPI.importDriveToken) {
        const res = await window.electronAPI.importDriveToken();
        if (res && !res.canceled) {
          if (res.success) {
            showAppAlert(`Token importado com sucesso!\n\nConta: ${res.status?.user?.emailAddress || res.status?.user?.displayName || 'Conectada'}`, 'Token Importado', 'success');
            await checkGoogleDriveStatus();
          } else {
            showAppAlert(`Falha ao importar arquivo:\n\n${res.error || 'Arquivo inválido.'}`, 'Erro no Arquivo', 'warning');
          }
        }
      }
    } catch (err) {
      showAppError('Erro ao Importar Token', err);
    }
  });

  // Testar Conexão Google Drive
  document.getElementById('btnTestDriveConnection')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnTestDriveConnection');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Testando...';
    }

    try {
      const email = document.getElementById('settingsDriveInputEmail')?.value.trim() || '';
      const password = document.getElementById('settingsDriveInputPassword')?.value.trim() || '';
      const mirrorPath = document.getElementById('settingsLocalMirrorPath')?.value.trim() || '';

      if (window.electronAPI && window.electronAPI.saveDriveConfig) {
        await window.electronAPI.saveDriveConfig({ email, password, mirrorPath });
      }

      if (window.electronAPI && window.electronAPI.getDriveStatus) {
        const status = await window.electronAPI.getDriveStatus();
        if (status && status.connected) {
          showAppAlert(`Conexão com Google Drive estabelecida com sucesso!\n\nConta: ${status.user?.emailAddress || email || 'Ativa'}\nNome: ${status.user?.displayName || 'Google Drive'}`, 'Conexão Estabelecida', 'success');
        } else {
          showAppAlert(`Não foi possível conectar ao Google Drive:\n\n${status?.error || 'Verifique as credenciais ou token informado.'}`, 'Falha de Conexão', 'warning');
        }
      }
    } catch (err) {
      showAppError('Erro ao Testar Conexão com Google Drive', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span> Testar Conexão Drive';
      }
      await checkGoogleDriveStatus();
    }
  });

  // Abrir espelho local
  document.getElementById('btnOpenSettingsMirrorFolder')?.addEventListener('click', () => {
    const mirrorPath = document.getElementById('settingsLocalMirrorPath')?.value || '';
    if (mirrorPath && window.electronAPI && window.electronAPI.openPath) {
      window.electronAPI.openPath(mirrorPath);
    } else {
      showAppAlert('Nenhuma pasta de backup configurada ou pasta ainda não selecionada.', 'Pasta Não Definida', 'info');
    }
  });

  // Intervalo de auto-refresh
  document.getElementById('settingsAutoRefreshSelect')?.addEventListener('change', async (e) => {
    const minutes = parseFloat(e.target.value);
    window.appStore.autoRefreshMinutes = isNaN(minutes) ? 3 : minutes;
    if (window.electronAPI) {
      await window.electronAPI.saveStorage('autoRefreshMinutes', window.appStore.autoRefreshMinutes);
    }
    const sidebarSelect = document.getElementById('selectAutoRefresh');
    if (sidebarSelect) sidebarSelect.value = String(window.appStore.autoRefreshMinutes);
    setupAutoRefresh();
  });
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
            <a href="#" class="btn-open-layout table-layout-link" data-ticket-id="${t.id}" data-layout-id="${layoutId || ''}" data-layout-code="${layoutCode}" title="Abrir Layout ${layoutCode} no Importer Ultra">
              <span>📐</span> <span>${layoutCode}</span> <span class="layout-link-icon" style="font-size: 10px; opacity: 0.85;">↗</span>
            </a>
          ` : '<span style="color: var(--text-muted);">-</span>'}
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
  }).join('');

  // Attach row click events
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't open if clicked favorite star, ignore button, autodrive button, movidesk link or layout link directly
      if (e.target.closest('.favorite-star') || e.target.closest('.btn-open-movi') || e.target.closest('.btn-open-layout') || e.target.closest('.btn-toggle-ignore') || e.target.closest('.btn-quick-autodrive')) return;
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

  // Attach layout link click (opens importer in external browser)
  tbody.querySelectorAll('.btn-open-layout').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = link.dataset.layoutId;
      const code = link.dataset.layoutCode;
      openLayoutInImporter(id, code);
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
                <a href="#" class="btn-open-layout kanban-layout-link" data-ticket-id="${t.id}" data-layout-id="${layoutId || ''}" data-layout-code="${layoutCode}" title="Abrir Layout ${layoutCode} no Importer Ultra">
                  <span>📐</span> <span>${layoutCode}</span> <span style="font-size: 10px; opacity: 0.85;">↗</span>
                </a>
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
      if (ticket) openDemandDrawer(ticket);
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
    showAppError('Erro ao Baixar Anexo', err);
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
    showAppError('Erro ao Abrir Anexo', err);
  }
}

let lightboxGallery = [];
let currentLightboxIndex = 0;

function openImageLightbox(blobUrl, fileName, ticketId, attId, gallery = null, initialIndex = 0) {
  const overlay = document.getElementById('imageLightboxOverlay');
  const imgEl = document.getElementById('lightboxImage');
  if (!overlay || !imgEl) return;

  if (Array.isArray(gallery) && gallery.length > 0) {
    lightboxGallery = gallery.map(item => ({
      blobUrl: item.blobUrl || item.url || '',
      fileName: item.fileName || item.name || 'imagem.png',
      ticketId: item.ticketId || ticketId,
      attId: item.attId || attId
    }));
    currentLightboxIndex = (initialIndex >= 0 && initialIndex < lightboxGallery.length) ? initialIndex : 0;
  } else {
    lightboxGallery = [{
      blobUrl,
      fileName: fileName || 'imagem.png',
      ticketId,
      attId
    }];
    currentLightboxIndex = 0;
  }

  updateLightboxView();
  overlay.style.display = 'flex';
}

function updateLightboxView() {
  if (!lightboxGallery || lightboxGallery.length === 0) return;
  const current = lightboxGallery[currentLightboxIndex] || lightboxGallery[0];
  const imgEl = document.getElementById('lightboxImage');
  const nameEl = document.getElementById('lightboxFileName');
  const counterEl = document.getElementById('lightboxCounter');
  const btnPrev = document.getElementById('btnLightboxPrev');
  const btnNext = document.getElementById('btnLightboxNext');
  const btnDownload = document.getElementById('btnLightboxDownload');

  currentLightboxAttachment = current;
  if (imgEl) imgEl.src = current.blobUrl;
  if (nameEl) nameEl.textContent = current.fileName;

  const total = lightboxGallery.length;
  if (counterEl) {
    if (total > 1) {
      counterEl.textContent = `${currentLightboxIndex + 1} de ${total}`;
      counterEl.style.display = 'inline-block';
    } else {
      counterEl.style.display = 'none';
    }
  }

  if (btnPrev && btnNext) {
    if (total > 1) {
      btnPrev.classList.remove('hidden');
      btnNext.classList.remove('hidden');
      btnPrev.style.display = 'flex';
      btnNext.style.display = 'flex';
    } else {
      btnPrev.classList.add('hidden');
      btnNext.classList.add('hidden');
      btnPrev.style.display = 'none';
      btnNext.style.display = 'none';
    }
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      const a = document.createElement('a');
      a.href = current.blobUrl;
      a.download = current.fileName || 'imagem.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  }
}

function navigateLightbox(dir) {
  if (!lightboxGallery || lightboxGallery.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + dir + lightboxGallery.length) % lightboxGallery.length;
  updateLightboxView();
}

function closeImageLightbox() {
  const overlay = document.getElementById('imageLightboxOverlay');
  if (overlay) overlay.style.display = 'none';
  currentLightboxAttachment = null;
  lightboxGallery = [];
  currentLightboxIndex = 0;
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

// Renderiza o campo de Layout Selecionado (DENTRO do próprio campo, sempre apenas 1 único layout)
function renderDrawerLayoutField(layoutId, layoutCode, layoutName) {
  const hiddenId = document.getElementById('drawerEditLayoutId');
  const selectedBox = document.getElementById('drawerSelectedLayoutBox');
  const searchBox = document.getElementById('drawerLayoutSearchBox');
  const labelEl = document.getElementById('drawerSelectedLayoutLabel');
  const subEl = document.getElementById('drawerSelectedLayoutSub');
  const btnOpen = document.getElementById('btnDrawerOpenLayoutFromField');
  const searchInput = document.getElementById('drawerEditLayoutSearch');
  const dropdown = document.getElementById('drawerLayoutSearchResults');

  if (hiddenId) hiddenId.value = layoutId || '';

  const cleanName = layoutName ? String(layoutName).replace(/^[\s\-_:]+/, '').trim() : '';

  if (layoutCode) {
    if (labelEl) labelEl.textContent = `Layout ${layoutCode}`;
    if (subEl) {
      subEl.textContent = cleanName ? `• ${cleanName}` : '';
      subEl.title = cleanName ? `Layout ${layoutCode} • ${cleanName}` : `Layout ${layoutCode}`;
    }
    if (selectedBox) selectedBox.style.display = 'flex';
    if (searchBox) searchBox.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';

    if (btnOpen) {
      btnOpen.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLayoutInImporter(layoutId, layoutCode);
      };
    }
  } else {
    if (selectedBox) selectedBox.style.display = 'none';
    if (searchBox) searchBox.style.display = 'block';
    if (searchInput) searchInput.value = '';
    if (dropdown) dropdown.style.display = 'none';
  }
}

function renderNewTicketLayoutField(layoutId, layoutCode, layoutName) {
  const hiddenId = document.getElementById('newTicketLayoutId');
  const selectedBox = document.getElementById('newTicketSelectedLayoutBox');
  const searchBox = document.getElementById('newTicketLayoutSearchBox');
  const labelEl = document.getElementById('newTicketSelectedLayoutLabel');
  const subEl = document.getElementById('newTicketSelectedLayoutSub');
  const searchInput = document.getElementById('newTicketLayoutSearch');
  const dropdown = document.getElementById('layoutSearchResults');

  if (hiddenId) hiddenId.value = layoutId || '';

  const cleanName = layoutName ? String(layoutName).replace(/^[\s\-_:]+/, '').trim() : '';

  if (layoutCode) {
    if (labelEl) labelEl.textContent = `Layout ${layoutCode}`;
    if (subEl) {
      subEl.textContent = cleanName ? `• ${cleanName}` : '';
      subEl.title = cleanName ? `Layout ${layoutCode} • ${cleanName}` : `Layout ${layoutCode}`;
    }
    if (selectedBox) selectedBox.style.display = 'flex';
    if (searchBox) searchBox.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';
  } else {
    if (selectedBox) selectedBox.style.display = 'none';
    if (searchBox) searchBox.style.display = 'block';
    if (searchInput) searchInput.value = '';
    if (dropdown) dropdown.style.display = 'none';
  }
}

async function openDemandDrawer(ticket) {
  selectedTicket = ticket;
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('demandDrawer');

  const layoutInfo = getTicketLayoutInfo(ticket);
  const layoutCode = layoutInfo.code;
  const layoutName = layoutInfo.name ? ` - ${layoutInfo.name}` : '';
  const currentLayoutId = resolveLayoutId(layoutInfo.id, layoutCode);

  const numEl = document.getElementById('drawerDemandNumber');
  if (numEl) {
    if (layoutCode) {
      numEl.innerHTML = `<span>#${ticket.number}</span> • <a href="#" class="btn-open-layout drawer-header-layout-link" data-layout-id="${currentLayoutId || ''}" data-layout-code="${layoutCode}" title="Abrir Layout ${layoutCode} no Importer Ultra" style="color: #34d399; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><span>📐 Layout ${layoutCode}${escapeHtml(layoutName)}</span> <span style="font-size: 11px;">↗</span></a>`;
      numEl.querySelector('.drawer-header-layout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLayoutInImporter(currentLayoutId, layoutCode);
      });
    } else {
      numEl.textContent = `#${ticket.number} • Sem Layout`;
    }
  }

  // Top action bar button for Layout
  const btnDrawerLayout = document.getElementById('btnDrawerOpenLayout');
  const btnDrawerLayoutText = document.getElementById('btnDrawerOpenLayoutText');
  if (btnDrawerLayout) {
    if (layoutCode) {
      btnDrawerLayout.style.display = 'inline-flex';
      if (btnDrawerLayoutText) {
        btnDrawerLayoutText.textContent = `Abrir Layout (${layoutCode}) ↗`;
      }
    } else {
      btnDrawerLayout.style.display = 'none';
    }
  }
  document.getElementById('drawerDemandTitle').textContent = ticket.title || '';

  // Badges
  const isDrawerIgnored = window.appStore.isIgnored(ticket.id);
  const badgesBox = document.getElementById('drawerBadges');
  if (badgesBox) {
    const ignoredBadge = isDrawerIgnored ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 Ignorado</span>' : '';
    badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml(ticket.status)} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)} ${ignoredBadge}`;
  }

  // Action buttons
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
    let stVal = (ticket.status || 'queued').toLowerCase().trim();
    if (stVal === 'open' || stVal === 'aberto' || stVal === 'fila') stVal = 'queued';
    if (stVal === 'closed' || stVal === 'completed' || stVal === 'finished') stVal = 'done';
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

  const reviewerSelect = document.getElementById('drawerEditReviewer');
  if (reviewerSelect) {
    const currentRevId = ticket.reviewer?.id || ticket.reviewerId || '';
    const currentUser = window.appStore?.currentUser;
    const allMembers = window.appStore.getKnownDevelopers();

    let optionsHtml = '<option value="">Sem validador (Não definido)</option>';
    allMembers.forEach(m => {
      const isMe = currentUser && m.id === currentUser.id;
      const prefix = isMe ? '👤' : '⚖️';
      const suffix = isMe ? ' (Você)' : '';
      optionsHtml += `<option value="${m.id}">${prefix} ${escapeHtml(m.name)}${suffix}</option>`;
    });

    if (currentRevId && !allMembers.some(m => m.id === currentRevId)) {
      const currentRevName = ticket.reviewer?.name || ticket.reviewerName || (typeof ticket.reviewer === 'string' ? ticket.reviewer : 'Validador Atual');
      optionsHtml += `<option value="${currentRevId}">⚖️ ${escapeHtml(currentRevName)}</option>`;
    }

    reviewerSelect.innerHTML = optionsHtml;
    reviewerSelect.value = currentRevId;
  }

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

  // Layout field (único, selecionado DENTRO do campo)
  renderDrawerLayoutField(currentLayoutId, layoutCode, layoutName);

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

  // Render dynamic workflow buttons and same layout open tickets
  renderDrawerWorkflowButtons(ticket);
  renderSameLayoutTickets(ticket);

  overlay?.classList.add('open');
  drawer?.classList.add('open');

  // Fetch full ticket details asynchronously
  try {
    const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);
    selectedTicket = { ...ticket, ...details };

    // Refresh dynamic workflow buttons and same layout with fresh API details
    renderDrawerWorkflowButtons(selectedTicket);
    renderSameLayoutTickets(selectedTicket);

    // Update layout title and button if full details have layout name
    const freshLayoutInfo = getTicketLayoutInfo(details);
    const finalLayoutCode = freshLayoutInfo.code || layoutCode;
    const finalLayoutName = freshLayoutInfo.name ? ` - ${freshLayoutInfo.name}` : layoutName;
    const finalLayoutId = resolveLayoutId(freshLayoutInfo.id, finalLayoutCode) || currentLayoutId;

    if (finalLayoutId && finalLayoutCode) {
      registerLayoutInCache({ id: finalLayoutId, code: finalLayoutCode, name: freshLayoutInfo.name });
    }

    if (numEl) {
      if (finalLayoutCode) {
        numEl.innerHTML = `<span>#${ticket.number}</span> • <a href="#" class="btn-open-layout drawer-header-layout-link" data-layout-id="${finalLayoutId || ''}" data-layout-code="${finalLayoutCode}" title="Abrir Layout ${finalLayoutCode} no Importer Ultra" style="color: #34d399; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><span>📐 Layout ${finalLayoutCode}${escapeHtml(finalLayoutName)}</span> <span style="font-size: 11px;">↗</span></a>`;
        numEl.querySelector('.drawer-header-layout-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openLayoutInImporter(finalLayoutId, finalLayoutCode);
        });
      } else {
        numEl.textContent = `#${ticket.number} • Sem Layout`;
      }
    }

    if (btnDrawerLayout) {
      if (finalLayoutCode) {
        btnDrawerLayout.style.display = 'inline-flex';
        if (btnDrawerLayoutText) {
          btnDrawerLayoutText.textContent = `Abrir Layout (${finalLayoutCode}) ↗`;
        }
      } else {
        btnDrawerLayout.style.display = 'none';
      }
    }

    renderDrawerLayoutField(finalLayoutId, finalLayoutCode, finalLayoutName);

    if (details.reviewer && reviewerSelect) {
      const currentRevId = details.reviewer.id || details.reviewerId || '';
      const currentRevName = details.reviewer.name || details.reviewerName || '';
      if (currentRevId && !Array.from(reviewerSelect.options).some(o => o.value === currentRevId)) {
        const opt = document.createElement('option');
        opt.value = currentRevId;
        opt.textContent = `⚖️ ${currentRevName || 'Validador'}`;
        reviewerSelect.appendChild(opt);
      }
      reviewerSelect.value = currentRevId;
    }
    if (details.deliveryDueDate && deliveryDateInput) {
      deliveryDateInput.value = formatDateToBrInput(details.deliveryDueDate);
    }
    if (details.clientDueDate && clientDateInput) {
      clientDateInput.value = formatDateToBrInput(details.clientDueDate);
    }
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
      try {
        renderAuthenticatedDescription(details.description, ticket.id, descBox);
      } catch (renderDescErr) {
        console.warn('Erro ao renderizar descrição autenticada:', renderDescErr);
        if (descBox) descBox.innerHTML = details.description;
      }
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
    if (descBox && (!ticket.description || descBox.innerHTML.includes('Carregando'))) {
      descBox.innerHTML = `<span style="color: var(--status-error);">Não foi possível carregar a descrição completa (${escapeHtml(err.message || 'Erro de comunicação')}).</span>`;
    }
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

      // Render attachments associated with this comment if any
      const commentAttachments = c.attachments || [];
      let attachmentsHtml = '';
      if (commentAttachments.length > 0) {
        attachmentsHtml = `
          <div class="comment-attachments-container">
            ${commentAttachments.map(att => {
              const fileName = att.fileName || att.filename || att.name || 'anexo';
              const ext = (fileName.split('.').pop() || '').toLowerCase();
              const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
              if (isImage) {
                return `
                  <div class="comment-img-attachment-card" data-att-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Clique para ampliar imagem">
                    <img id="comment_thumb_${att.id}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90'><rect width='120' height='90' fill='%231e293b'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-size='15'>🖼️ Carregando...</text></svg>" alt="${escapeHtml(fileName)}">
                    <div class="comment-img-footer"><span>🖼️</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(fileName)}</span></div>
                  </div>
                `;
              } else {
                return `
                  <div class="comment-file-attachment-card" data-att-id="${att.id}" data-filename="${escapeHtml(fileName)}" title="Clique para abrir ou baixar">
                    <span>📎</span> <span>${escapeHtml(fileName)}</span>
                  </div>
                `;
              }
            }).join('')}
          </div>
        `;
      }

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
          ${attachmentsHtml}
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

  // Load blob thumbnails for comment images and attach event listeners
  const ticketId = selectedTicket?.id;
  if (ticketId) {
    filtered.forEach(it => {
      if (it.itemType === 'comment' && Array.isArray(it.raw.attachments)) {
        it.raw.attachments.forEach(att => {
          const fileName = att.fileName || att.filename || att.name || '';
          const ext = (fileName.split('.').pop() || '').toLowerCase();
          const isImage = att.category === 'image' || (att.mimeType && att.mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
          if (isImage) {
            getOrFetchAttachmentBlobUrl(ticketId, att.id).then(blobUrl => {
              if (blobUrl) {
                const imgEl = document.getElementById(`comment_thumb_${att.id}`);
                if (imgEl) imgEl.src = blobUrl;
              }
            });
          }
        });
      }
    });

    container.querySelectorAll('.comment-img-attachment-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        e.stopPropagation();
        const attId = card.dataset.attId;
        const fileName = card.dataset.filename || 'imagem';
        const blobUrl = await getOrFetchAttachmentBlobUrl(ticketId, attId);
        if (blobUrl) {
          openImageLightbox(blobUrl, fileName, ticketId, attId);
        }
      });
    });

    container.querySelectorAll('.comment-file-attachment-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const attId = card.dataset.attId;
        const fileName = card.dataset.filename || 'anexo';
        openAttachmentFile(ticketId, attId, fileName);
      });
    });
  }

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
      const clickedAttId = el.dataset.attId || el.dataset.id;
      const clickedFileName = el.dataset.filename || 'imagem.png';
      if (ticketId && clickedAttId) {
        const clickedBlobUrl = await getOrFetchAttachmentBlobUrl(ticketId, clickedAttId);
        if (clickedBlobUrl) {
          const imgExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
          const imageAtts = (attachments || []).filter(a => {
            const ext = ((a.fileName || a.filename || a.name || '').split('.').pop() || '').toLowerCase();
            return imgExtensions.includes(ext);
          });
          const gallery = await Promise.all(imageAtts.map(async (a) => {
            const bUrl = await getOrFetchAttachmentBlobUrl(ticketId, a.id);
            return {
              blobUrl: bUrl || '',
              fileName: a.fileName || a.filename || a.name || 'imagem.png',
              ticketId,
              attId: a.id
            };
          }));
          const filteredGallery = gallery.filter(g => !!g.blobUrl);
          const initialIdx = filteredGallery.findIndex(g => String(g.attId) === String(clickedAttId));
          openImageLightbox(clickedBlobUrl, clickedFileName, ticketId, clickedAttId, filteredGallery, initialIdx !== -1 ? initialIdx : 0);
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

let timelinePendingAttachments = [];

function renderTimelinePendingAttachments() {
  const container = document.getElementById('drawerCommentPendingAttachments');
  if (!container) return;

  if (timelinePendingAttachments.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = timelinePendingAttachments.map((file, idx) => {
    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
    const thumbUrl = isImage ? URL.createObjectURL(file) : '';
    const sizeStr = formatFileSize(file.size);
    const fileName = file.name || `print_${idx + 1}.png`;

    return `
      <div class="comment-pending-chip" data-idx="${idx}">
        ${isImage ? `<img src="${thumbUrl}" class="comment-pending-thumb" alt="Preview">` : `<span style="font-size: 18px;">📎</span>`}
        <div class="comment-pending-info">
          <span class="comment-pending-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
          <span class="comment-pending-size">${sizeStr} • Pronto para enviar</span>
        </div>
        <button type="button" class="comment-pending-remove" data-idx="${idx}" title="Remover este anexo">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.comment-pending-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      if (!isNaN(idx) && idx >= 0 && idx < timelinePendingAttachments.length) {
        timelinePendingAttachments.splice(idx, 1);
        renderTimelinePendingAttachments();
      }
    });
  });
}

function handleCommentPaste(e) {
  if (!selectedTicket) return;
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const items = Array.from(clipboardData.items || []);
  const filesToAdd = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        let fileName = file.name || 'print.png';
        if (fileName === 'image.png' || !fileName) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          fileName = `print_${timeStr}.png`;
        }
        const namedFile = new File([file], fileName, { type: file.type || 'image/png' });
        filesToAdd.push(namedFile);
      }
    }
  }

  if (filesToAdd.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (const f of Array.from(clipboardData.files)) {
      filesToAdd.push(f);
    }
  }

  if (filesToAdd.length > 0) {
    e.preventDefault();
    filesToAdd.forEach(f => timelinePendingAttachments.push(f));
    renderTimelinePendingAttachments();
    showToast(`📸 ${filesToAdd.length} print/imagem colado! Clique em 'Salvar Interação' para publicar.`);
  }
}

async function submitComment() {
  if (!selectedTicket) return;
  const textarea = document.getElementById('drawerNewCommentText');
  const statusEl = document.getElementById('commentSendStatus');
  const btn = document.getElementById('btnSubmitComment');

  let content = textarea?.value?.trim() || '';
  const hasPendingFiles = timelinePendingAttachments.length > 0;

  if (!content && !hasPendingFiles) {
    showAppAlert('Por favor, digite uma mensagem ou cole uma imagem para enviar.', 'Mensagem Vazia', 'warning');
    textarea?.focus();
    return;
  }

  if (!content && hasPendingFiles) {
    content = timelinePendingAttachments.length === 1
      ? `📸 Print anexado: ${timelinePendingAttachments[0].name}`
      : `📸 ${timelinePendingAttachments.length} prints anexados`;
  }

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'inline';
    statusEl.style.color = '#38bdf8';
    statusEl.textContent = hasPendingFiles ? 'Enviando anexo(s)...' : 'Enviando resposta...';
  }

  try {
    let uploadedAttachmentIds = [];
    if (hasPendingFiles) {
      const filesToUpload = [...timelinePendingAttachments];
      const uploadedAttachments = await window.conciliadorAPI.uploadTicketAttachments(selectedTicket.id, filesToUpload);
      if (Array.isArray(uploadedAttachments)) {
        uploadedAttachmentIds = uploadedAttachments.map(a => a.id).filter(Boolean);
      }
      timelinePendingAttachments = [];
      renderTimelinePendingAttachments();
    }

    if (statusEl) statusEl.textContent = 'Publicando na linha do tempo...';
    await window.conciliadorAPI.addComment(selectedTicket.id, content, uploadedAttachmentIds);

    if (textarea) textarea.value = '';
    if (statusEl) {
      statusEl.style.color = '#10b981';
      statusEl.textContent = '✅ Enviado!';
    }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);

    // Refresh ticket details
    const details = await window.conciliadorAPI.fetchDemandDetails(selectedTicket.id);
    selectedTicket = { ...selectedTicket, ...details };
    drawerCurrentComments = details.comments || [];
    drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
    renderDrawerActivityStream();
    renderDrawerAttachments(details.attachments || []);
  } catch (err) {
    console.error('Failed to post comment / attachments:', err);
    if (statusEl) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = '❌ Erro: ' + err.message;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function sanitizeMovideskId(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Se o usuário colou URL completa do Movidesk: https://.../Ticket/Edit/12345
  const urlMatch = str.match(/Ticket\/(?:Edit\/)?(\d+)/i);
  if (urlMatch && urlMatch[1]) {
    return String(urlMatch[1]).slice(0, 40);
  }

  // Se tiver prefixo de hashtag ou número puro: #12345 ou 12345
  const hashMatch = str.match(/^#?(\d+)$/);
  if (hashMatch && hashMatch[1]) {
    return String(hashMatch[1]).slice(0, 40);
  }

  return str.slice(0, 40);
}

function getStatusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('queue') || s === 'open') return 'Na Fila (Aberto)';
  if (s.includes('progress')) return 'Em Progresso';
  if (s.includes('review')) return 'Em Revisão';
  if (s.includes('waiting') || s.includes('requester')) return 'Aguardando Resposta do N2';
  if (s.includes('done') || s.includes('close') || s.includes('finish') || s.includes('complet')) return 'Concluído';
  if (s.includes('triage')) return 'Triagem';
  if (s.includes('pause')) return 'Pausado';
  return status || 'Pendente';
}

async function refreshDrawerActivity(ticketId) {
  if (!ticketId) return;
  try {
    const details = await window.conciliadorAPI.fetchDemandDetails(ticketId);
    if (selectedTicket && selectedTicket.id === ticketId) {
      selectedTicket = { ...selectedTicket, ...details };
      drawerCurrentComments = details.comments || [];
      drawerCurrentEvents = (details.events || []).filter(e => e.kind !== 'comment');
      renderDrawerActivityStream();
    }
  } catch (e) {
    console.warn('Erro ao atualizar histórico da demanda:', e);
  }
}

function promptJustification({
  icon = '📝',
  title = 'Justificativa da Alteração',
  subtitle = '',
  bannerText = 'Informe a justificativa desta modificação:',
  suggestions = [],
  placeholder = 'Escreva detalhadamente a justificativa...',
  confirmText = 'Confirmar Alteração',
  confirmClass = 'btn-primary',
  defaultComment = true,
  requireReason = true
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalJustificationPrompt');
    if (!modal) {
      const reason = prompt(`${title}\n${bannerText}`);
      if (reason === null) return resolve({ confirmed: false });
      return resolve({ confirmed: true, reason: reason.trim(), addComment: defaultComment });
    }

    const iconEl = document.getElementById('justificationModalIcon');
    const titleEl = document.getElementById('justificationModalTitle');
    const subtitleEl = document.getElementById('justificationModalSubtitle');
    const bannerEl = document.getElementById('justificationModalBannerText');
    const suggestionsSection = document.getElementById('justificationSuggestionsSection');
    const chipsContainer = document.getElementById('justificationSuggestionsChips');
    const textarea = document.getElementById('justificationReasonInput');
    const checkbox = document.getElementById('justificationAddComment');
    const confirmBtn = document.getElementById('btnJustificationConfirm');
    const cancelBtn = document.getElementById('btnJustificationCancel');
    const closeBtn = document.getElementById('btnJustificationClose');
    const confirmTextEl = document.getElementById('justificationConfirmText');

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
      subtitleEl.textContent = subtitle || '';
      subtitleEl.style.display = subtitle ? 'block' : 'none';
    }
    if (bannerEl) bannerEl.textContent = bannerText;
    if (confirmTextEl) confirmTextEl.textContent = confirmText;
    if (confirmBtn) {
      confirmBtn.className = `btn-primary ${confirmClass}`;
    }
    if (textarea) {
      textarea.value = '';
      textarea.placeholder = placeholder;
    }
    if (checkbox) {
      checkbox.checked = defaultComment;
    }

    // Render suggestion chips
    if (chipsContainer) {
      chipsContainer.innerHTML = '';
      if (suggestions && suggestions.length > 0) {
        if (suggestionsSection) suggestionsSection.style.display = 'block';
        suggestions.forEach(s => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'justification-chip';
          chip.textContent = s;
          chip.addEventListener('click', () => {
            if (textarea) {
              textarea.value = s;
              textarea.focus();
            }
          });
          chipsContainer.appendChild(chip);
        });
      } else if (suggestionsSection) {
        suggestionsSection.style.display = 'none';
      }
    }

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      modal.style.display = 'none';
      modal.classList.remove('open');
      confirmBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      textarea?.removeEventListener('keydown', onTextareaKeyDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };

    const onConfirm = () => {
      const reasonVal = textarea ? textarea.value.trim() : '';
      if (requireReason && !reasonVal) {
        showAppAlert('Por favor, digite ou selecione uma sugestão de justificativa para prosseguir.', 'Justificativa Obrigatória', 'warning');
        textarea?.focus();
        return;
      }
      const shouldComment = checkbox ? checkbox.checked : false;
      cleanup();
      resolve({ confirmed: true, reason: reasonVal, addComment: shouldComment });
    };

    const onCancel = () => {
      cleanup();
      resolve({ confirmed: false });
    };

    const onTextareaKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    const onDocumentKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    confirmBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    textarea?.addEventListener('keydown', onTextareaKeyDown);
    document.addEventListener('keydown', onDocumentKeyDown);

    modal.style.display = 'flex';
    modal.classList.add('open');
    setTimeout(() => { textarea?.focus(); }, 100);
  });
}

// Ação de Fluxo: Finalizar Chamado (Status: closed - Sem exigir justificativa)
async function handleFinalizeTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const ok = await showAppConfirm(
    `Deseja realmente finalizar e concluir a demanda #${ticket.number || ticket.movideskTicketId || ticket.id.slice(0, 8)}? O status passará para "Concluído".`,
    'Finalizar Chamado',
    {
      confirmText: 'Finalizar Chamado',
      confirmClass: 'btn-confirm-finalize',
      icon: '✅',
      type: 'success',
      subtitle: 'Conclusão da Demanda'
    }
  );

  if (!ok) return;

  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Finalizando demanda...';
  }

  try {
    // 1. Alterar status na API para 'done' diretamente sem exigir justificativa
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'done');

    // 2. Atualizar localmente
    ticket.status = 'done';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'done';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'done';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        const isDrawerIgnored = window.appStore.isIgnored(ticket.id);
        const ignoredBadge = isDrawerIgnored ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 Ignorado</span>' : '';
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('done')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)} ${ignoredBadge}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '✅ Demanda finalizada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda finalizada com sucesso!', 'Concluído', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao finalizar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Devolver para o Desenvolvedor (Status: in_progress)
async function handleReturnTicketToDev(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const devName = ticket.assignedTo?.name || 'Desenvolvedor';
  const result = await promptJustification({
    icon: '↩️',
    title: 'Devolver para o Desenvolvedor',
    subtitle: `Responsável atual: ${devName} | #${ticket.number || ticket.movideskTicketId || ticket.id.slice(0, 8)}`,
    bannerText: 'O status do chamado voltará para "Em Desenvolvimento" para que o desenvolvedor realize as correções necessárias.',
    suggestions: [
      'Inconsistência encontrada durante os testes de homologação',
      'Necessário ajustar regras de layout e campos obrigatórios',
      'Faltam arquivos de teste ou retorno do cliente',
      'Regra de negócio não atende à especificação',
      'Erro retornado durante a importação',
      'Ajustar mapeamento de colunas'
    ],
    placeholder: 'Descreva os erros encontrados ou o que precisa ser corrigido pelo desenvolvedor...',
    confirmText: 'Devolver p/ Desenvolvedor',
    confirmClass: 'btn-confirm-return',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Devolvendo demanda para o desenvolvedor...';
  }

  try {
    // 1. Alterar status na API para in_progress
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'in_progress', reason);

    // 2. Adicionar comentário na linha do tempo se marcado (apenas a mensagem direta)
    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de devolução:', cErr);
      }
    }

    // 3. Atualizar localmente
    ticket.status = 'in_progress';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'in_progress';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'in_progress';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('in_progress')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '↩️ Demanda devolvida para o desenvolvedor!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda devolvida para o desenvolvedor com sucesso!', 'Em Desenvolvimento', 'info');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao devolver chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Iniciar Demanda (Status: in_progress)
async function handleStartTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const result = await promptJustification({
    icon: '🚀',
    title: 'Iniciar Desenvolvimento',
    subtitle: `Demanda #${ticket.number || ticket.id.slice(0, 8)} - ${ticket.title}`,
    bannerText: 'O status do chamado passará para "Em Desenvolvimento" e a contagem de tempo de produção será ativada.',
    suggestions: [
      'Iniciando desenvolvimento e implementação',
      'Assumindo demanda da fila para execução',
      'Iniciando análise técnica e desenvolvimento de layout',
      'Iniciando correções e testes na base'
    ],
    placeholder: 'Observações de início (opcional)...',
    confirmText: 'Iniciar Demanda',
    confirmClass: 'btn-confirm-start',
    defaultComment: false,
    requireReason: false
  });

  if (!result.confirmed) return;

  const reason = result.reason || 'Desenvolvimento iniciado';
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Iniciando demanda...';
  }

  try {
    // Se o chamado não tiver desenvolvedor atribuído e o usuário logado tiver ID, atribui automaticamente
    if (!ticket.assignedTo?.id && window.appStore.currentUser?.id) {
      try {
        await window.conciliadorAPI.assignTicket(ticket.id, window.appStore.currentUser.id, 'Atribuído automaticamente ao iniciar');
        ticket.assignedTo = {
          id: window.appStore.currentUser.id,
          name: window.appStore.currentUser.name || window.appStore.currentUser.email
        };
      } catch (assignErr) {
        console.warn('Não foi possível auto-atribuir ao iniciar:', assignErr);
      }
    }

    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'in_progress', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de início:', cErr);
      }
    }

    ticket.status = 'in_progress';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'in_progress';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'in_progress';
      if (ticket.assignedTo) window.appStore.demands[idx].assignedTo = ticket.assignedTo;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('in_progress')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#10b981';
        statusText.textContent = '🚀 Demanda iniciada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda iniciada com sucesso!', 'Em Desenvolvimento', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao iniciar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Pausar Chamado (Status: paused)
async function handlePauseTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const result = await promptJustification({
    icon: '⏸️',
    title: 'Pausar Chamado',
    subtitle: `Demanda #${ticket.number || ticket.id.slice(0, 8)} - ${ticket.title}`,
    bannerText: 'O chamado será pausado. O cronômetro de produção será congelado temporariamente.',
    suggestions: [
      'Pausa para intervalo / almoço',
      'Aguardando liberação de acesso ou arquivo adicional',
      'Priorização temporária de outro chamado urgente',
      'Pausa técnica no desenvolvimento'
    ],
    placeholder: 'Informe o motivo da pausa...',
    confirmText: 'Pausar Chamado',
    confirmClass: 'btn-confirm-pause',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Pausando demanda...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'paused', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de pausa:', cErr);
      }
    }

    ticket.status = 'paused';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'paused';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'paused';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('paused')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#f59e0b';
        statusText.textContent = '⏸️ Demanda pausada!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda pausada com sucesso!', 'Pausado', 'warning');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao pausar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Aguardar Quem Abriu / N2 (Status: waiting_requester)
async function handleWaitRequesterTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const reqName = ticket.requestedBy?.name || 'Solicitante';
  const result = await promptJustification({
    icon: '⏳',
    title: 'Aguardar Quem Abriu (N2)',
    subtitle: `Solicitante: ${reqName} | #${ticket.number || ticket.id.slice(0, 8)}`,
    bannerText: 'O status passará para "Aguardando Resposta do N2". O SLA fica congelado até a resposta.',
    suggestions: [
      'Inconsistência nos dados fornecidos pelo cliente. Aguardando esclarecimento.',
      'Aguardando envio de arquivo de exemplo para teste',
      'Necessário alinhamento de regra de negócio com o cliente',
      'Dúvida de especificação aguardando resposta do solicitante'
    ],
    placeholder: 'Descreva a dúvida ou informação que você precisa de quem abriu o chamado...',
    confirmText: 'Aguardar Resposta',
    confirmClass: 'btn-confirm-waiting',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Alterando para aguardando quem abriu...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'waiting_requester', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de aguardo:', cErr);
      }
    }

    ticket.status = 'waiting_requester';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'waiting_requester';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'waiting_requester';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('waiting_requester')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#38bdf8';
        statusText.textContent = '⏳ Demanda aguardando resposta de quem abriu!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda colocada em espera por resposta do solicitante!', 'Aguardando N2', 'info');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao alterar status: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Enviar para Revisão (Status: review)
async function handleSendToReviewTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const currentRevName = ticket.reviewer?.name || ticket.reviewerName || 'Nenhum definido';
  const result = await promptJustification({
    icon: '📤',
    title: 'Enviar para Revisão',
    subtitle: `Validador: ${currentRevName} | #${ticket.number || ticket.id.slice(0, 8)}`,
    bannerText: 'O chamado será encaminhado para a etapa de "Em Revisão" para homologação.',
    suggestions: [
      'Desenvolvimento concluído e testado localmente. Pronto para homologação.',
      'Layout criado conforme especificações técnicas. Aguardando validação.',
      'Ajustes realizados e validados na base de teste. Liberado para revisão.',
      'Correções concluídas. Aguardando teste final do validador.'
    ],
    placeholder: 'Descreva os testes realizados ou instruções para o validador...',
    confirmText: 'Enviar para Revisão',
    confirmClass: 'btn-confirm-review',
    defaultComment: true,
    requireReason: true
  });

  if (!result.confirmed) return;

  const reason = result.reason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Enviando para revisão...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'review', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de envio para revisão:', cErr);
      }
    }

    ticket.status = 'review';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'review';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'review';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('review')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#c084fc';
        statusText.textContent = '📤 Demanda enviada para revisão com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert('Demanda enviada para revisão com sucesso!', 'Em Revisão', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao enviar para revisão: ' + err.message, 'Erro', 'error');
  }
}

// Ação de Fluxo: Retomar Desenvolvimento (Status: in_progress)
async function handleResumeTicket(targetTicket = null) {
  const ticket = targetTicket || selectedTicket;
  if (!ticket) return;

  const isClosed = ticket.status === 'closed' || ticket.status === 'done';
  const isPaused = ticket.status === 'paused';
  const result = await promptJustification({
    icon: isClosed ? '🔄' : '▶️',
    title: isClosed ? 'Reabrir Chamado' : 'Retomar Desenvolvimento',
    subtitle: `Demanda #${ticket.number || ticket.id.slice(0, 8)} - ${ticket.title}`,
    bannerText: isClosed
      ? 'O chamado será reaberto e voltará para o status "Em Desenvolvimento".'
      : (isPaused 
        ? 'O chamado sairá da pausa e voltará para "Em Desenvolvimento".' 
        : 'O chamado sairá de espera e voltará para desenvolvimento ativo ("Em Progresso").'),
    suggestions: isClosed ? [
      'Reabrindo para ajustes solicitados pelo cliente',
      'Correção necessária após homologação',
      'Novas alterações solicitadas no layout',
      'Dúvidas reabertas pelo solicitante'
    ] : (isPaused ? [
      'Retomando desenvolvimento após pausa',
      'Ambiente liberado, continuando implementação',
      'Retomando prioridade do chamado'
    ] : [
      'Retomando desenvolvimento após resposta do solicitante',
      'Informações recebidas, continuando ajustes',
      'Dúvidas esclarecidas, prosseguindo com a demanda'
    ]),
    placeholder: isClosed ? 'Motivo da reabertura do chamado (opcional)...' : 'Observações de retomada (opcional)...',
    confirmText: isClosed ? 'Reabrir Chamado' : 'Retomar Demanda',
    confirmClass: isClosed ? 'btn-confirm-review' : 'btn-confirm-start',
    defaultComment: isClosed,
    requireReason: false
  });

  if (!result.confirmed) return;

  const defaultReason = isClosed ? 'Chamado reaberto para novos ajustes' : 'Desenvolvimento retomado';
  const reason = result.reason || defaultReason;
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText && ticket === selectedTicket) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = isClosed ? 'Reabrindo chamado...' : 'Retomando demanda...';
  }

  try {
    await window.conciliadorAPI.changeTicketStatus(ticket.id, 'in_progress', reason);

    if (result.addComment && reason) {
      try {
        await window.conciliadorAPI.addComment(ticket.id, reason.trim());
      } catch (cErr) {
        console.warn('Erro ao postar comentário de retomada/reabertura:', cErr);
      }
    }

    ticket.status = 'in_progress';
    const statusSelect = document.getElementById('drawerEditStatus');
    if (statusSelect && ticket === selectedTicket) statusSelect.value = 'in_progress';

    const idx = window.appStore.demands.findIndex(d => d.id === ticket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].status = 'in_progress';
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (ticket === selectedTicket) {
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        badgesBox.innerHTML = `${getTypeBadgeHtml(ticket.ticketType?.name)} ${getStatusBadgeHtml('in_progress')} ${getPriorityBadgeHtml(ticket.priority)} ${getLabelsBadgesHtml(ticket.labels)}`;
      }
      renderDrawerWorkflowButtons(ticket);
      renderSameLayoutTickets(ticket);

      if (statusText) {
        statusText.style.color = '#2dd4bf';
        statusText.textContent = isClosed ? '🔄 Chamado reaberto com sucesso!' : '▶️ Demanda retomada com sucesso!';
        setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
      }
      await refreshDrawerActivity(ticket.id);
    }

    renderDemands();
    showAppAlert(isClosed ? 'Chamado reaberto para desenvolvimento!' : 'Demanda retomada para desenvolvimento!', isClosed ? 'Chamado Reaberto' : 'Em Desenvolvimento', 'success');
  } catch (err) {
    if (statusText && ticket === selectedTicket) statusText.textContent = '';
    showAppAlert('Erro ao processar chamado: ' + err.message, 'Erro', 'error');
  }
}

// Gera o HTML dos botões de fluxo de acordo com o status e o container
function getWorkflowButtonsHtml(status, isQuick = false) {
  status = (status || 'open').toLowerCase();

  if (isQuick) {
    if (status === 'review') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-finalize" data-action="finalize" title="Finalizar e concluir chamado">
          <span>✅</span> Finalizar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-return" data-action="return-dev" title="Devolver para o desenvolvedor">
          <span>↩️</span> Devolver p/ Dev
        </button>
      `;
    }
    if (status === 'waiting_requester' || status === 'waiting' || status === 'waiting_creator' || status === 'paused') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-resume" data-action="resume" title="Retomar chamado">
          <span>▶️</span> Retomar
        </button>
      `;
    }
    if (status === 'queued' || status === 'open' || status === 'triage') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-start" data-action="start" title="Iniciar desenvolvimento">
          <span>🚀</span> Iniciar
        </button>
      `;
    }
    if (status === 'in_progress' || status === 'progress') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-pause" data-action="pause" title="Pausar">
          <span>⏸️</span> Pausar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-waiting" data-action="waiting" title="Aguardar Quem Abriu">
          <span>⏳</span> Aguardar
        </button>
        <button type="button" class="btn-quick-workflow btn-quick-review" data-action="review" title="Enviar para Revisão">
          <span>📤</span> Revisão
        </button>
      `;
    }
    if (status === 'closed' || status === 'done') {
      return `
        <button type="button" class="btn-quick-workflow btn-quick-resume" data-action="reopen" title="Reabrir chamado">
          <span>🔄</span> Reabrir
        </button>
      `;
    }
    return '';
  }

  // Ações no Fim do Chamado (junto do botão Salvar Alterações / Salvar Interação)
  if (status === 'review') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-finalize" data-action="finalize" title="Finalizar e homologar chamado">
        <span>✅</span> <span>Finalizar Chamado</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-return" data-action="return-dev" title="Devolver chamado para o desenvolvedor com justificativa">
        <span>↩️</span> <span>Devolver para o Dev</span>
      </button>
    `;
  }
  if (status === 'waiting_requester' || status === 'waiting' || status === 'waiting_creator') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-resume" data-action="resume" title="Retomar desenvolvimento ativo do chamado">
        <span>▶️</span> <span>Retomar Desenvolvimento</span>
      </button>
    `;
  }
  if (status === 'queued' || status === 'open' || status === 'triage') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-start" data-action="start" title="Iniciar desenvolvimento desta demanda">
        <span>🚀</span> <span>Iniciar Demanda</span>
      </button>
    `;
  }
  if (status === 'in_progress' || status === 'progress') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-pause" data-action="pause" title="Pausar desenvolvimento temporariamente">
        <span>⏸️</span> <span>Pausar</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-waiting" data-action="waiting" title="Colocar chamado em espera por resposta de quem abriu (N2)">
        <span>⏳</span> <span>Aguardar Quem Abriu</span>
      </button>
      <button type="button" class="btn-bottom-action btn-bottom-review" data-action="review" title="Enviar chamado concluído para revisão e homologação">
        <span>📤</span> <span>Enviar para Revisão</span>
      </button>
    `;
  }
  if (status === 'paused') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-resume" data-action="resume" title="Retomar desenvolvimento da demanda">
        <span>▶️</span> <span>Retomar Desenvolvimento</span>
      </button>
    `;
  }
  if (status === 'closed' || status === 'done') {
    return `
      <button type="button" class="btn-bottom-action btn-bottom-reopen" data-action="reopen" title="Reabrir demanda concluída para novos ajustes e correções">
        <span>🔄</span> <span>Reabrir Chamado</span>
      </button>
    `;
  }
  return '';
}

// Renderiza os botões dinâmicos de fluxo no final do chamado (junto de salvar alterações e interações) e no card
function renderDrawerWorkflowButtons(ticket) {
  const bottomContainer = document.getElementById('drawerBottomWorkflowActionsContainer');
  const commentContainer = document.getElementById('drawerCommentWorkflowActionsContainer');
  const quickContainer = document.getElementById('drawerQuickWorkflowActionsContainer');
  const topContainer = document.getElementById('drawerWorkflowActionsContainer');

  const targets = [
    { el: bottomContainer, isQuick: false },
    { el: commentContainer, isQuick: false },
    { el: quickContainer, isQuick: true },
    { el: topContainer, isQuick: false }
  ];

  if (!ticket) {
    targets.forEach(t => { if (t.el) t.el.innerHTML = ''; });
    return;
  }

  const status = ticket.status || 'open';
  const bottomHtml = getWorkflowButtonsHtml(status, false);
  const quickHtml = getWorkflowButtonsHtml(status, true);

  targets.forEach(({ el, isQuick }) => {
    if (!el) return;
    el.innerHTML = isQuick ? quickHtml : bottomHtml;

    el.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (action === 'finalize') handleFinalizeTicket(ticket);
        else if (action === 'return-dev') handleReturnTicketToDev(ticket);
        else if (action === 'start') handleStartTicket(ticket);
        else if (action === 'pause') handlePauseTicket(ticket);
        else if (action === 'waiting') handleWaitRequesterTicket(ticket);
        else if (action === 'review') handleSendToReviewTicket(ticket);
        else if (action === 'resume' || action === 'reopen') handleResumeTicket(ticket);
      });
    });
  });
}

// Cache em memória de mapeamento código de layout -> { id, name }
const layoutCodeToIdCache = new Map();

function registerLayoutInCache(layout) {
  if (!layout) return;
  const id = layout.id || layout.layoutId;
  const code = layout.code != null ? layout.code : (typeof layout === 'number' || typeof layout === 'string' ? layout : null);
  if (id && code) {
    layoutCodeToIdCache.set(String(code).trim(), { id: String(id), name: layout.name || '' });
  }
}

// Helper: Extrair código e ID de layout de um chamado
function getTicketLayoutInfo(ticket) {
  if (!ticket) return { code: null, name: null, id: null };
  const id = ticket.layoutId || ticket.layout?.id || null;
  let code = ticket.layout?.code || (typeof ticket.layout === 'number' || typeof ticket.layout === 'string' ? ticket.layout : null);
  let name = ticket.layout?.name || '';
  
  // Fallback: se não tiver no objeto, tentar extrair do título caso seja "14 - ERRO..." ou "3024 - NOVO LAYOUT..."
  if (!code && ticket.title) {
    const match = ticket.title.match(/^\s*(\d{2,5})\s*[-–—]/) || ticket.title.match(/layout\s*(\d{2,5})/i);
    if (match) {
      code = parseInt(match[1], 10);
    }
  }

  if (id && code) {
    registerLayoutInCache({ id, code, name });
  }

  return { code, name, id };
}

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
      registerLayoutInCache({ id: info.id, code: info.code, name: info.name });
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

// Ação de Fluxo: Alterar Validador - Direto sem modal e sem mensagem no chat
async function changeReviewerWorkflow(targetReviewerId, targetReviewerName) {
  if (!selectedTicket) return;

  const currentReviewerId = selectedTicket.reviewer?.id || selectedTicket.reviewerId || '';
  const currentReviewerName = selectedTicket.reviewer?.name || selectedTicket.reviewerName || 'Nenhum';

  // Se o validador for o mesmo que já está salvo, não precisa fazer nada
  if ((targetReviewerId || '') === (currentReviewerId || '')) return;

  const isLeavingBlank = !targetReviewerId;
  const reviewerSelect = document.getElementById('drawerEditReviewer');

  // A API do Importer Ultra exige um UUID e não aceita remover validador para em branco após ter sido atribuído
  if (isLeavingBlank && currentReviewerId) {
    if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    showAppAlert(
      'A API do Importer Ultra não permite deixar o chamado sem validador após ele já ter sido atribuído.\n\nPara transferir a validação, selecione outro membro da equipe no campo Validador.',
      'Validador Obrigatório na API',
      'warning'
    );
    return;
  }

  const cleanName = (targetReviewerName || 'Novo Validador').replace(/^[👤⚖️]\s*/, '').replace(/\s*\(Você\)$/, '').trim();
  const statusText = document.getElementById('drawerSaveStatusText');
  if (statusText) {
    statusText.style.color = 'var(--accent-primary)';
    statusText.textContent = 'Atribuindo validador...';
  }

  try {
    // 1. Chamar assignReviewer na API diretamente (sem modal e sem postar mensagem de chat)
    await window.conciliadorAPI.assignReviewer(selectedTicket.id, targetReviewerId, 'Alteração de validador pelo Organizador de Chamados');

    // 2. Atualizar estado local
    selectedTicket.reviewer = { id: targetReviewerId, name: cleanName };
    selectedTicket.reviewerId = targetReviewerId;
    selectedTicket.reviewerName = cleanName;

    if (reviewerSelect) {
      reviewerSelect.value = targetReviewerId;
    }

    const idx = window.appStore.demands.findIndex(d => d.id === selectedTicket.id);
    if (idx !== -1) {
      window.appStore.demands[idx].reviewer = selectedTicket.reviewer;
      window.appStore.demands[idx].reviewerId = selectedTicket.reviewerId;
      window.appStore.demands[idx].reviewerName = selectedTicket.reviewerName;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      }
    }

    if (statusText) {
      statusText.style.color = '#10b981';
      statusText.textContent = `⚖️ Validador definido: ${cleanName}`;
      setTimeout(() => { if (statusText) statusText.textContent = ''; }, 3000);
    }

    renderDemands();
    await refreshDrawerActivity(selectedTicket.id);
  } catch (err) {
    if (statusText) statusText.textContent = '';
    if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    showAppAlert('Erro ao alterar validador: ' + err.message, 'Erro', 'error');
  }
}

async function saveDrawerTicketChanges() {
  if (!selectedTicket) return;

  const btnTop = document.getElementById('btnDrawerSaveTicket');
  const btnBottom = document.getElementById('btnDrawerSaveTicketBottom');
  const statusText = document.getElementById('drawerSaveStatusText');

  const title = document.getElementById('drawerEditTitle')?.value.trim();
  if (!title) {
    showAppAlert('O título da demanda não pode ficar vazio.', 'Aviso', 'warning');
    document.getElementById('drawerEditTitle')?.focus();
    return;
  }

  const newStatus = document.getElementById('drawerEditStatus')?.value;
  const assignedToId = document.getElementById('drawerEditAssignedTo')?.value || null;
  const priority = normalizePriorityToApi(document.getElementById('drawerEditPriority')?.value);
  const clientDatabase = document.getElementById('drawerEditDatabase')?.value.trim() || null;
  const movideskRaw = document.getElementById('drawerEditMovidesk')?.value;
  const movideskTicketId = sanitizeMovideskId(movideskRaw);
  const newLayoutId = document.getElementById('drawerEditLayoutId')?.value || null;
  const ticketTypeId = document.getElementById('drawerEditType')?.value || null;
  const productId = document.getElementById('drawerEditProduct')?.value || null;

  // Se o status foi alterado manualmente pelo select, pedir justificativa
  let statusJustification = 'Alteração de status pelo Organizador de Chamados';
  let statusAddComment = true;
  if (newStatus && newStatus !== selectedTicket.status) {
    const fromLabel = getStatusLabel(selectedTicket.status);
    const toLabel = getStatusLabel(newStatus);
    const isClosing = newStatus === 'closed' || newStatus === 'done';
    const isReturning = newStatus === 'in_progress';

    const justResult = await promptJustification({
      icon: isClosing ? '✅' : (isReturning ? '↩️' : '🔄'),
      title: isClosing ? 'Finalizar Demanda' : (isReturning ? 'Devolver / Em Progresso' : 'Alterar Situação do Chamado'),
      subtitle: `De: ${fromLabel} ➔ Para: ${toLabel}`,
      bannerText: `Você está alterando a situação desta demanda para "${toLabel}".`,
      suggestions: isClosing ? [
        'Homologado e validado em produção com sucesso',
        'Demanda aprovada sem pendências',
        'Ajustes validados e conferidos com o cliente',
        'Finalizado conforme solicitado'
      ] : (isReturning ? [
        'Inconsistência encontrada durante testes de homologação',
        'Necessário ajustar regras de layout e campos',
        'Faltam arquivos de teste ou retorno do cliente',
        'Ajustar mapeamento de colunas'
      ] : [
        `Situação alterada de ${fromLabel} para ${toLabel}`,
        'Atualização de status do chamado',
        'Ajuste de fila e situação'
      ]),
      placeholder: 'Descreva a justificativa desta alteração de situação...',
      confirmText: 'Confirmar e Salvar',
      confirmClass: isClosing ? 'btn-confirm-finalize' : (isReturning ? 'btn-confirm-return' : 'btn-primary'),
      defaultComment: true,
      requireReason: false
    });

    if (!justResult.confirmed) {
      const stSelect = document.getElementById('drawerEditStatus');
      if (stSelect) stSelect.value = selectedTicket.status;
      return;
    }

    statusJustification = justResult.reason || `Situação alterada de ${fromLabel} para ${toLabel}`;
    statusAddComment = justResult.addComment;
  }

  const deliveryDueInput = document.getElementById('drawerEditDeliveryDueDate')?.value.trim();
  const clientDueInput = document.getElementById('drawerEditClientDueDate')?.value.trim();

  const deliveryDueDate = parseBrDateToIso(deliveryDueInput);
  const clientDueDate = parseBrDateToIso(clientDueInput);

  // Payload exclusivo para campos descritivos no PATCH /support/tickets/:id
  // Proibido no PATCH: status, layoutId, assignedToId, deliveryDueDate, clientDueDate
  const payload = {
    title,
    priority,
    clientDatabase,
    typeId: ticketTypeId,
    productId,
    labelIds: Array.from(selectedDrawerLabels)
  };

  if (movideskTicketId) {
    payload.movideskTicketId = movideskTicketId;
  } else if (selectedTicket.movideskTicketId) {
    payload.movideskTicketId = null;
  }

  // Se o usuário abriu e editou a descrição
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
    // 1. Se o status foi alterado, chamar o endpoint de status dedicado
    if (newStatus && newStatus !== selectedTicket.status) {
      try {
        await window.conciliadorAPI.changeTicketStatus(selectedTicket.id, newStatus, statusJustification);
        if (statusAddComment && statusJustification) {
          try {
            await window.conciliadorAPI.addComment(selectedTicket.id, statusJustification.trim());
          } catch (cErr) {}
        }
      } catch (statusErr) {
        console.warn('Erro ao alterar status:', statusErr);
        throw new Error('Falha ao alterar status da demanda: ' + statusErr.message);
      }
    }

    // 2. Se o layout foi alterado, vincular layout pelo endpoint dedicado
    const currentLayoutId = selectedTicket.layoutId || selectedTicket.layout?.id || null;
    if (newLayoutId && newLayoutId !== currentLayoutId) {
      try {
        await window.conciliadorAPI.linkTicketLayout(selectedTicket.id, newLayoutId);
      } catch (layoutErr) {
        console.warn('Erro ao vincular layout:', layoutErr);
        throw new Error('Falha ao vincular layout à demanda: ' + layoutErr.message);
      }
    }

    // 3. Se o responsável foi alterado, usar a rota de atribuição dedicada
    const currentAssignedToId = selectedTicket.assignedTo?.id || selectedTicket.assignedToId || null;
    const newAssignedToId = assignedToId || null;
    if (newAssignedToId !== currentAssignedToId) {
      try {
        await window.conciliadorAPI.assignTicket(selectedTicket.id, newAssignedToId, 'Alteração de responsável pelo Organizador de Chamados');
      } catch (assignErr) {
        console.warn('Erro ao atribuir responsável:', assignErr);
        throw new Error('Falha ao definir responsável da demanda: ' + assignErr.message);
      }
    }

    // 4. Se os prazos foram alterados, usar a rota de datas dedicada
    const currentDeliveryIso = selectedTicket.deliveryDueDate ? new Date(selectedTicket.deliveryDueDate).toISOString().slice(0, 10) : null;
    const currentClientIso = selectedTicket.clientDueDate ? new Date(selectedTicket.clientDueDate).toISOString().slice(0, 10) : null;
    const newDeliveryIso = deliveryDueDate ? new Date(deliveryDueDate).toISOString().slice(0, 10) : null;
    const newClientIso = clientDueDate ? new Date(clientDueDate).toISOString().slice(0, 10) : null;

    if (newDeliveryIso !== currentDeliveryIso || newClientIso !== currentClientIso) {
      try {
        await window.conciliadorAPI.setTicketDates(selectedTicket.id, deliveryDueDate, clientDueDate, 'Atualização de prazos pelo Organizador de Chamados');
      } catch (dateErr) {
        console.warn('Erro ao atualizar prazos:', dateErr);
        throw new Error('Falha ao atualizar prazos da demanda: ' + dateErr.message);
      }
    }

    // 5. Se o validador foi alterado no select do drawer
    const reviewerSelect = document.getElementById('drawerEditReviewer');
    const newReviewerId = reviewerSelect ? (reviewerSelect.value || null) : (selectedTicket.reviewerId || null);
    const currentReviewerId = selectedTicket.reviewer?.id || selectedTicket.reviewerId || null;
    let newReviewerObj = selectedTicket.reviewer || null;

    if (newReviewerId && newReviewerId !== currentReviewerId) {
      try {
        await window.conciliadorAPI.assignReviewer(selectedTicket.id, newReviewerId, 'Alteração de validador pelo Organizador de Chamados');
        const opt = reviewerSelect ? reviewerSelect.selectedOptions[0] : null;
        const revName = opt ? opt.text.replace(/^[👤⚖️]\s*/, '').replace(/\s*\(Você\)$/, '').trim() : 'Validador';
        newReviewerObj = { id: newReviewerId, name: revName };
      } catch (revErr) {
        console.warn('Erro ao atualizar validador:', revErr);
        throw new Error('Falha ao atualizar validador: ' + revErr.message);
      }
    } else if (!newReviewerId && currentReviewerId) {
      if (reviewerSelect) reviewerSelect.value = currentReviewerId;
    }

    // 5. Atualizar dados gerais e descritivos no PATCH do ticket
    const updated = await window.conciliadorAPI.updateTicket(selectedTicket.id, payload);

    // Atualizar no cache local de demandas
    const idx = window.appStore.demands.findIndex(d => d.id === selectedTicket.id);
    if (idx !== -1) {
      const existing = window.appStore.demands[idx];
      const merged = {
        ...existing,
        ...updated,
        ...payload,
        status: newStatus || existing.status,
        layoutId: newLayoutId || existing.layoutId,
        deliveryDueDate: deliveryDueDate !== undefined ? deliveryDueDate : existing.deliveryDueDate,
        clientDueDate: clientDueDate !== undefined ? clientDueDate : existing.clientDueDate
      };
      if (assignedToId) {
        const devObj = window.appStore.getKnownDevelopers().find(d => d.id === assignedToId);
        merged.assignedTo = devObj || { id: assignedToId };
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
      merged.reviewer = newReviewerObj;
      merged.reviewerId = newReviewerId;
      merged.reviewerName = newReviewerObj ? newReviewerObj.name : null;
      window.appStore.demands[idx] = merged;
      if (typeof window.appStore.saveDemandsCache === 'function') {
        await window.appStore.saveDemandsCache();
      } else if (window.electronAPI) {
        await window.electronAPI.saveStorage('cachedDemands', window.appStore.demands);
      }
    }

    selectedTicket = {
      ...selectedTicket,
      ...updated,
      ...payload,
      status: newStatus || selectedTicket.status,
      layoutId: newLayoutId || selectedTicket.layoutId,
      deliveryDueDate: deliveryDueDate !== undefined ? deliveryDueDate : selectedTicket.deliveryDueDate,
      clientDueDate: clientDueDate !== undefined ? clientDueDate : selectedTicket.clientDueDate
    };
    if (assignedToId) {
      const devObj = window.appStore.getKnownDevelopers().find(d => d.id === assignedToId);
      selectedTicket.assignedTo = devObj || { id: assignedToId };
    } else {
      selectedTicket.assignedTo = null;
    }
    selectedTicket.reviewer = newReviewerObj;
    selectedTicket.reviewerId = newReviewerId;
    selectedTicket.reviewerName = newReviewerObj ? newReviewerObj.name : null;

    // Atualizar cabeçalho e badges do painel lateral
    document.getElementById('drawerDemandTitle').textContent = title;
    const badgesBox = document.getElementById('drawerBadges');
    if (badgesBox) {
      badgesBox.innerHTML = `${getTypeBadgeHtml(selectedTicket.ticketType?.name)} ${getStatusBadgeHtml(selectedTicket.status)} ${getPriorityBadgeHtml(selectedTicket.priority)} ${getLabelsBadgesHtml(selectedTicket.labels)}`;
    }

    // Se a descrição foi salva, atualizar visualização
    if (payload.description) {
      const descBox = document.getElementById('drawerDescription');
      if (descBox) descBox.innerHTML = payload.description;
      toggleDrawerDescEdit(false);
    }

    // Feedback de sucesso
    if (statusText) {
      statusText.style.color = '#10b981';
      statusText.textContent = '✅ Alterações salvas com sucesso!';
      setTimeout(() => { if (statusText) statusText.textContent = ''; }, 4000);
    }

    // Atualizar tabela/kanban para refletir alterações
    renderDemands();

    // Recarregar detalhes frescos do backend
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
      statusText.textContent = '❌ Erro ao salvar: ' + translateErrorMessage(err);
    }
    showAppError('Erro ao Salvar Demanda', err);
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
  const ok = await showAppConfirm(`Deseja realmente arquivar a demanda #${selectedTicket.number}?`, 'Arquivar Demanda', { isDanger: true, confirmText: 'Arquivar Demanda' });
  if (ok) {
    try {
      await window.conciliadorAPI.archiveTicket(selectedTicket.id);
      closeDemandDrawer();
      await syncDemands();
      showAppAlert(`A demanda #${selectedTicket.number} foi arquivada com sucesso.`, 'Demanda Arquivada', 'success');
    } catch (err) {
      showAppError('Erro ao Arquivar Demanda', err);
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
  timelinePendingAttachments = [];
  renderTimelinePendingAttachments();
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

  // Botão Limpar / Trocar Layout dentro do campo
  document.getElementById('btnDrawerClearLayoutField')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderDrawerLayoutField('', null, '');
    const btnDrawerLayout = document.getElementById('btnDrawerOpenLayout');
    if (btnDrawerLayout) btnDrawerLayout.style.display = 'none';
    const searchInput = document.getElementById('drawerEditLayoutSearch');
    if (searchInput) searchInput.focus();
  });

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

            registerLayoutInCache({ id, code, name });
            renderDrawerLayoutField(id, code, name);

            const btnDrawerLayout = document.getElementById('btnDrawerOpenLayout');
            const btnDrawerLayoutText = document.getElementById('btnDrawerOpenLayoutText');
            if (btnDrawerLayout) {
              btnDrawerLayout.style.display = 'inline-flex';
              if (btnDrawerLayoutText) {
                btnDrawerLayoutText.textContent = `Abrir Layout (${code}) ↗`;
              }
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

  // Permite colar imagens/prints diretamente com Ctrl+V na aba Anexos
  window.addEventListener('paste', async (e) => {
    const drawer = document.getElementById('demandDrawer');
    if (!drawer || !drawer.classList.contains('open') || !selectedTicket) return;
    if (drawerActiveTab !== 'attachments') return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const files = [];
    const items = Array.from(clipboardData.items || []);
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          let fileName = file.name || 'print.png';
          if (fileName === 'image.png' || !fileName) {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            fileName = `print_${timeStr}.png`;
          }
          files.push(new File([file], fileName, { type: file.type || 'image/png' }));
        }
      }
    }

    if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
      for (const f of Array.from(clipboardData.files)) files.push(f);
    }

    if (files.length > 0) {
      e.preventDefault();
      await uploadDrawerFiles(files);
    }
  });
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
  renderNewTicketLayoutField('', null, '');
  checkNewTicketLayoutConflicts(null, null);

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

    if (/^\d{2,5}$/.test(rawQuery)) {
      checkNewTicketLayoutConflicts(rawQuery, null);
    } else if (!rawQuery) {
      checkNewTicketLayoutConflicts(null, null);
    }

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
            renderNewTicketLayoutField(id, code, name);
            checkNewTicketLayoutConflicts(code, id);
          });
        });
      } catch (err) {
        console.warn('Layout search error:', err);
      }
    }, 250);
  });

  document.getElementById('btnNewTicketClearLayoutField')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderNewTicketLayoutField('', null, '');
    checkNewTicketLayoutConflicts(null, null);
    const searchInput = document.getElementById('newTicketLayoutSearch');
    if (searchInput) searchInput.focus();
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
    if (movidesk) {
      const cleanMovi = sanitizeMovideskId(movidesk);
      if (cleanMovi) payload.movideskTicketId = cleanMovi;
    }
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
}

function updateAllFilterDropdownsUI() {
  Object.keys(filterConfigs).forEach(key => {
    renderFilterDropdownOptions(key);
  });
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

  // Initialize interactive Multi-Select Quick Filters
  initQuickFilterDropdowns();

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

  // Workflow Actions (Finalizar e Devolver p/ Desenvolvedor)
  document.getElementById('btnDrawerFinalizeTicket')?.addEventListener('click', handleFinalizeTicket);
  document.getElementById('btnQuickFinalize')?.addEventListener('click', handleFinalizeTicket);
  document.getElementById('btnDrawerReturnToDev')?.addEventListener('click', handleReturnTicketToDev);
  document.getElementById('btnQuickReturnDev')?.addEventListener('click', handleReturnTicketToDev);

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

  // Paste image directly on comment textarea
  commentTextarea?.addEventListener('paste', handleCommentPaste);

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

  // Global paste handler when comment tab is open
  window.addEventListener('paste', (e) => {
    const drawer = document.getElementById('demandDrawer');
    if (!drawer || !drawer.classList.contains('open') || !selectedTicket) return;
    if (drawerActiveTab !== 'comments') return;

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
      showAppAlert('Esta demanda não possui número do chamado Movidesk associado.', 'Movidesk', 'info');
    }
  };

  document.getElementById('btnOpenWeb')?.addEventListener('click', openTicketInImporter);
  document.getElementById('btnDrawerOpenConciliador')?.addEventListener('click', openTicketInImporter);
  document.getElementById('btnDrawerOpenLayout')?.addEventListener('click', () => {
    if (!selectedTicket) return;
    const info = getTicketLayoutInfo(selectedTicket);
    const hiddenId = document.getElementById('drawerEditLayoutId')?.value;
    openLayoutInImporter(hiddenId || info.id, info.code);
  });
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
      const badgesBox = document.getElementById('drawerBadges');
      if (badgesBox) {
        const ignoredBadge = isNowIgnored ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 Ignorado</span>' : '';
        badgesBox.innerHTML = `${getTypeBadgeHtml(selectedTicket.ticketType?.name)} ${getStatusBadgeHtml(selectedTicket.status)} ${getPriorityBadgeHtml(selectedTicket.priority)} ${getLabelsBadgesHtml(selectedTicket.labels)} ${ignoredBadge}`;
      }
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

    // Esc -> close drawer / modals / lightbox
    if (e.key === 'Escape') {
      closeUserSettingsModal();
      closeImageLightbox();
      closeAutoDriveModal();
      closeDemandDrawer();
      closeCreateTicketModal();
      closeFilterModal();
    }
  });

  // Configurações do usuário & Engrenagem ⚙️
  setupUserSettingsHandlers();
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

// ------------------- AutoDrive Integration Module -------------------
let currentAutoDriveTicket = null;
let stagedAutoDriveImages = [];
let stagedAutoDrivePdfs = [];
let autoDriveLastResult = null;
let isGoogleDriveChecking = false;

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function checkGoogleDriveStatus() {
  if (isGoogleDriveChecking) return;
  isGoogleDriveChecking = true;

  const dotEl = document.getElementById('autoDriveStatusDot');
  const emailEl = document.getElementById('autoDriveAccountEmail');
  const pillEl = document.getElementById('autoDriveAccountStatus');

  const setDotEl = document.getElementById('settingsDriveStatusDot');
  const setEmailEl = document.getElementById('settingsDriveEmail');
  const setPillEl = document.getElementById('settingsDriveStatusPill');

  if (emailEl) emailEl.textContent = 'Verificando Google Drive...';
  if (dotEl) dotEl.textContent = '⏳';
  if (setEmailEl) setEmailEl.textContent = 'Verificando Google Drive...';
  if (setDotEl) setDotEl.textContent = '⏳';

  try {
    if (window.electronAPI && window.electronAPI.getDriveStatus) {
      const status = await window.electronAPI.getDriveStatus();
      if (status && status.connected) {
        const emailText = status.user?.emailAddress || 'Conectado';
        const displayLabel = status.user?.displayName ? `${status.user.displayName} (${emailText})` : `Drive: ${emailText}`;
        if (dotEl) dotEl.textContent = '🟢';
        if (emailEl) emailEl.textContent = `Drive: ${emailText}`;
        if (pillEl) {
          pillEl.style.background = 'rgba(35, 134, 54, 0.15)';
          pillEl.style.color = '#3fb950';
          pillEl.style.borderColor = 'rgba(46, 160, 67, 0.4)';
        }
        if (setDotEl) setDotEl.textContent = '🟢';
        if (setEmailEl) setEmailEl.textContent = displayLabel;
        if (setPillEl) {
          setPillEl.style.background = 'rgba(35, 134, 54, 0.15)';
          setPillEl.style.color = '#3fb950';
          setPillEl.style.borderColor = 'rgba(46, 160, 67, 0.4)';
        }
      } else {
        if (dotEl) dotEl.textContent = '⚪';
        if (emailEl) emailEl.textContent = 'Drive não conectado';
        if (pillEl) {
          pillEl.style.background = 'rgba(110, 118, 129, 0.15)';
          pillEl.style.color = '#8b949e';
          pillEl.style.borderColor = 'rgba(110, 118, 129, 0.3)';
        }
        if (setDotEl) setDotEl.textContent = '⚪';
        if (setEmailEl) setEmailEl.textContent = 'Google Drive: Não conectado';
        if (setPillEl) {
          setPillEl.style.background = 'rgba(110, 118, 129, 0.15)';
          setPillEl.style.color = '#8b949e';
          setPillEl.style.borderColor = 'rgba(110, 118, 129, 0.3)';
        }
      }
    } else {
      if (dotEl) dotEl.textContent = '⚪';
      if (emailEl) emailEl.textContent = 'Disponível no Desktop';
    }
  } catch (err) {
    if (dotEl) dotEl.textContent = '⚪';
    if (emailEl) emailEl.textContent = 'Drive não conectado';
    if (setDotEl) setDotEl.textContent = '⚪';
    if (setEmailEl) setEmailEl.textContent = 'Google Drive: Não conectado';
  } finally {
    isGoogleDriveChecking = false;
  }
}

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
  const rawDb = (ticket.clientDatabase || '').trim().toUpperCase();
  const ticketNumber = ticket.number != null ? String(ticket.number).trim() : '';
  const layoutCode = ticket.layout?.code != null ? String(ticket.layout.code).trim() : '';
  const layoutName = (ticket.layout?.name || '').trim();

  let numeroLayout = layoutCode || ticketNumber || '';
  let remainingTitle = rawTitle;

  // 1. Extrair número no início do título (#10328 - ...)
  const numMatch = remainingTitle.match(/^\s*#?(\d+)\s*[-–—:]\s*(.*)$/i);
  if (numMatch) {
    if (!numeroLayout) numeroLayout = numMatch[1];
    remainingTitle = numMatch[2].trim();
  }

  // 2. Remover prefixos de operação comuns (NOVO LAYOUT -, etc.)
  const ignorePrefixes = ["NOVO LAYOUT", "NOVO", "ALTERACAO", "ALTERAÇÃO", "AJUSTE", "ATUALIZACAO", "ATUALIZAÇÃO", "CORRECAO", "CORREÇÃO", "LAYOUT", "MELHORIA", "ERRO"];
  for (const p of ignorePrefixes) {
    const reg = new RegExp(`^${p}\\s*[-–—:]\\s*(.*)$`, 'i');
    const m = remainingTitle.match(reg);
    if (m) {
      remainingTitle = m[1].trim();
      break;
    }
  }

  // 3. Normalizar variações de -CONT- ou -CONT_ no título
  remainingTitle = remainingTitle.replace(/[-–—]\s*CONT(?=[-_\s]|$)/gi, ' - CONT');

  // 4. Separar segmentos pelo traço
  let parts = remainingTitle.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);

  // 5. Ignorar qualquer termo de banco de dados/cliente (-CONT-, CONT_..., CONT-...)
  // Se esse termo estiver no final, descarta-o para pegar o nome do documento antes dele
  function isContPart(p) {
    if (!p) return false;
    const up = p.toUpperCase();
    if (up === 'CONT' || up === 'CONT-' || up === 'CONT_' || up === '-CONT-') return true;
    if (up.startsWith('CONT_') || up.startsWith('CONT-') || up.startsWith('CONT ')) return true;
    if (rawDb && (up === rawDb || up.includes(rawDb))) return true;
    return false;
  }

  const contIdx = parts.findIndex(isContPart);
  if (contIdx !== -1) {
    parts = parts.slice(0, contIdx);
  }

  // Remover sufixo de banco de dados se colado no último termo
  if (parts.length > 0 && rawDb) {
    let last = parts[parts.length - 1];
    if (last.toUpperCase().endsWith(rawDb)) {
      last = last.substring(0, last.length - rawDb.length).replace(/[-–—_\s]+$/, '').trim();
      if (last) parts[parts.length - 1] = last;
      else parts.pop();
    }
  }

  let entidade = '';
  let nomeDocumento = '';

  if (parts.length >= 2) {
    // A última informação do título depois do traço é sempre o NOME DO DOCUMENTO
    nomeDocumento = parts[parts.length - 1];
    // O que vem antes dele (entre o número e o último traço) é o BANCO OU SISTEMA
    entidade = parts.slice(0, parts.length - 1).join(' - ');
  } else if (parts.length === 1) {
    nomeDocumento = parts[0];
    entidade = layoutName || parts[0];
  } else {
    nomeDocumento = layoutName || '';
    entidade = layoutName || '';
  }

  const cleanEntidade = sanitizeAutoDriveText(entidade);
  const cleanDocumento = sanitizeAutoDriveText(nomeDocumento);
  const cleanNumero = sanitizeAutoDriveText(numeroLayout);

  const categoria = guessAutoDriveCategory(cleanEntidade, cleanDocumento);

  // Formato padrão: [NUMERO] - [BANCO OU SISTEMA] - [NOME DO DOCUMENTO]
  const quickParts = [];
  if (cleanNumero) quickParts.push(cleanNumero);
  if (cleanEntidade) quickParts.push(cleanEntidade);
  if (cleanDocumento && cleanDocumento !== cleanEntidade) quickParts.push(cleanDocumento);

  const quickText = quickParts.join(' - ');

  return {
    numero_layout: cleanNumero,
    entidade: cleanEntidade,
    nome_documento: cleanDocumento,
    categoria: categoria || 'BANCOS',
    quick: quickText
  };
}

async function openAutoDriveModal(ticket) {
  if (!ticket) return;
  currentAutoDriveTicket = ticket;
  stagedAutoDriveImages = [];
  stagedAutoDrivePdfs = [];
  autoDriveLastResult = null;

  const modal = document.getElementById('modalAutoDrive');
  if (!modal) return;

  // Reset Approval, Progress and Success screens
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
  const progressBox = document.getElementById('autoDriveProgressBox');
  if (progressBox) progressBox.style.display = 'none';
  const successBox = document.getElementById('autoDriveSuccessBox');
  if (successBox) successBox.style.display = 'none';

  // Check Drive status in background
  checkGoogleDriveStatus();

  // Update dynamic mirror notice path in modal
  const noticePathEl = document.getElementById('autoDriveMirrorNoticePath');
  if (noticePathEl) {
    let currentMirror = '';
    if (window.electronAPI?.getDriveConfig) {
      const cfg = await window.electronAPI.getDriveConfig();
      if (cfg?.mirrorPath) currentMirror = cfg.mirrorPath;
    } else if (window.electronAPI?.loadStorage) {
      currentMirror = (await window.electronAPI.loadStorage('googleDriveMirrorPath', '')) || '';
    }
    noticePathEl.textContent = currentMirror || 'Pasta padrão do sistema';
    noticePathEl.title = currentMirror || 'Pasta padrão';
  }

  const parsed = parseDemandForAutoDrive(ticket);

  const inputQuick = document.getElementById('autoDriveQuickText');
  const inputNum = document.getElementById('autoDriveNumeroLayout');
  const selCat = document.getElementById('autoDriveCategoria');
  const inputEnt = document.getElementById('autoDriveEntidade');
  const inputDoc = document.getElementById('autoDriveDocumento');
  const inputSenha = document.getElementById('autoDriveSenha');

  if (inputQuick) inputQuick.value = parsed.quick;
  if (inputNum) inputNum.value = parsed.numero_layout;
  if (selCat) selCat.value = parsed.categoria;
  if (inputEnt) inputEnt.value = parsed.entidade;
  if (inputDoc) inputDoc.value = parsed.nome_documento;

  // Auto-detect password from ticket description or title or stored notes
  let detectedSenha = '';
  const textToSearch = `${ticket.title || ''} ${ticket.description || ''}`;
  const senhaMatch = textToSearch.match(/(?:senha|password|pass|chave)\s*(?:do\s*(?:pdf|arquivo|layout))?\s*[:=]\s*([A-Za-z0-9@#$_!.\-]+)/i);
  if (senhaMatch) {
    detectedSenha = senhaMatch[1].trim();
  }
  const savedSenha = window.appStore.localNotes?.[`autodrive_pwd_${ticket.id}`];
  if (savedSenha) {
    detectedSenha = savedSenha;
  }
  if (inputSenha) {
    inputSenha.value = detectedSenha;
    inputSenha.type = 'password';
  }
  const togglePwdBtn = document.getElementById('btnToggleAutoDrivePassword');
  if (togglePwdBtn) togglePwdBtn.textContent = '👁️ Ver';

  // Initial placeholder rendering
  const imagesGrid = document.getElementById('autoDriveImagesGrid');
  if (imagesGrid) {
    imagesGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; grid-column: 1 / -1; padding: 12px 0;">🔍 Baixando e renderizando imagens da demanda...</div>';
  }
  const pdfContainer = document.getElementById('autoDrivePdfCardContainer');
  if (pdfContainer) {
    pdfContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 8px 0;">Carregando manuais PDF...</div>';
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  // Load ticket details and attachments if needed
  let attachments = ticket.attachments || [];
  if (!attachments || attachments.length === 0) {
    try {
      const details = await window.conciliadorAPI.fetchDemandDetails(ticket.id);
      if (details && details.attachments) {
        ticket.attachments = details.attachments;
        attachments = details.attachments;
      }
    } catch (err) {
      console.warn('Erro ao carregar anexos para o AutoDrive:', err);
    }
  }

  // Process attachments
  const imgExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
  for (const att of attachments) {
    const fName = att.fileName || att.filename || att.originalName || att.name || 'arquivo';
    const ext = (fName.split('.').pop() || '').toLowerCase();

    if (ext === 'pdf') {
      try {
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, att.id);
        const buffer = await blob.arrayBuffer();
        stagedAutoDrivePdfs.push({
          id: String(att.id || Math.random().toString(36).substring(2)),
          name: fName,
          size: blob.size,
          blob,
          buffer
        });
        renderAutoDrivePdfCards();
      } catch (err) {
        console.warn('Erro ao carregar PDF:', err);
      }
    } else if (imgExtensions.includes(ext)) {
      try {
        const blob = await window.conciliadorAPI.fetchAttachmentBlob(ticket.id, att.id);
        const objectUrl = URL.createObjectURL(blob);
        stagedAutoDriveImages.push({
          id: String(att.id || Math.random().toString(36).substring(2)),
          name: fName,
          size: blob.size,
          blob,
          objectUrl,
          isMapping: false
        });
        renderAutoDriveImagesGrid();
      } catch (err) {
        console.warn('Erro ao carregar imagem:', err);
      }
    }
  }

  // Automatic best guess for mapping image
  if (stagedAutoDriveImages.length > 0) {
    const candidate = stagedAutoDriveImages.find(img => {
      const n = img.name.toLowerCase();
      return n.includes('map') || n.includes('layout') || n.includes('tela') || n.includes('print');
    });
    if (candidate) {
      candidate.isMapping = true;
    } else {
      stagedAutoDriveImages[0].isMapping = true;
    }
  }

  renderAutoDriveImagesGrid();
  renderAutoDrivePdfCards();
}

function renderAutoDriveImagesGrid() {
  const grid = document.getElementById('autoDriveImagesGrid');
  const countBadge = document.getElementById('autoDriveImagesCountBadge');
  if (!grid) return;

  const count = stagedAutoDriveImages.length;
  if (countBadge) {
    countBadge.textContent = `${count} imagem${count === 1 ? '' : 's'}`;
  }

  if (count === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-muted); background: #0d1117; border-radius: 8px; border: 1px dashed var(--border-color);">
        <div style="font-size: 24px; margin-bottom: 6px;">🖼️</div>
        <div style="font-size: 12px; font-weight: 600; color: #c9d1d9;">Nenhuma imagem anexada</div>
        <div style="font-size: 11px; margin-top: 4px;">Você pode colar um print diretamente com <strong>Ctrl+V</strong> ou clicar no botão "Adicionar Imagem".</div>
      </div>
    `;
    return;
  }

  // Calculate mapping images count and indices
  const mappingImages = stagedAutoDriveImages.filter(img => img.isMapping);

  grid.innerHTML = stagedAutoDriveImages.map(img => {
    const isMap = !!img.isMapping;
    let badgeHtml = '';
    if (isMap) {
      if (mappingImages.length > 1) {
        const mapNum = mappingImages.findIndex(m => String(m.id) === String(img.id)) + 1;
        badgeHtml = `<span class="autodrive-mapping-badge">🌟 Mapeamento ${mapNum}</span>`;
      } else {
        badgeHtml = `<span class="autodrive-mapping-badge">🌟 Mapeamento Oficial</span>`;
      }
    } else {
      badgeHtml = `<span style="font-size: 10px; color: #8b949e; font-weight: 600;">🖼️ Imagem Anexa</span>`;
    }

    return `
      <div class="autodrive-image-card ${isMap ? 'is-mapping' : ''}" data-id="${escapeHtml(img.id)}">
        <!-- Top row: Badge and Delete Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
          <div>
            ${badgeHtml}
          </div>
          <button type="button" class="autodrive-delete-btn btn-delete-autodrive-img" data-id="${escapeHtml(img.id)}" title="Apagar esta imagem da lista (não será enviada ao Google Drive)">
            <span>🗑️</span> <span>Apagar</span>
          </button>
        </div>

        <!-- Thumbnail Image Container (Clickable to Lightbox with full gallery navigation) -->
        <div class="autodrive-thumb-wrap btn-zoom-autodrive-img" data-id="${escapeHtml(img.id)}" title="Clique para ver em tela cheia (com navegação por setas)">
          <img src="${img.objectUrl}" alt="${escapeHtml(img.name)}">
          <div class="autodrive-thumb-zoom-overlay">
            <span>🔍</span> <span>Ver em Tela Cheia</span>
          </div>
        </div>

        <!-- Bottom Info & Mapping Selector -->
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #f0f6fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(img.name)}">
            ${escapeHtml(img.name)}
          </div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
            ${formatBytes(img.size)}
          </div>
        </div>

        <!-- Mapping Selection Button (Toggleable for Multiple Mappings) -->
        <div style="margin-top: auto; padding-top: 4px;">
          ${isMap
            ? `<button type="button" class="autodrive-select-mapping-btn active btn-toggle-as-mapping" data-id="${escapeHtml(img.id)}" style="width: 100%;" title="Clique para desmarcar como mapeamento">✓ Mapeamento Selecionado</button>`
            : `<button type="button" class="autodrive-select-mapping-btn btn-toggle-as-mapping" data-id="${escapeHtml(img.id)}" style="width: 100%;" title="Clique para adicionar como mapeamento">⭐ Marcar como Mapeamento</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Attach delete buttons
  grid.querySelectorAll('.btn-delete-autodrive-img').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleDeleteAutoDriveImage(id);
    });
  });

  // Attach toggle mapping selectors (Multiple allowed)
  grid.querySelectorAll('.btn-toggle-as-mapping').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleToggleAutoDriveMapping(id);
    });
  });

  // Attach zoom lightbox with full gallery and arrows support
  grid.querySelectorAll('.btn-zoom-autodrive-img').forEach(wrap => {
    wrap.addEventListener('click', () => {
      const imgId = wrap.getAttribute('data-id');
      const gallery = stagedAutoDriveImages.map(i => ({
        blobUrl: i.objectUrl,
        fileName: i.name,
        id: i.id
      }));
      const idx = stagedAutoDriveImages.findIndex(i => String(i.id) === String(imgId));
      const initialIdx = idx !== -1 ? idx : 0;
      openImageLightbox(gallery[initialIdx].blobUrl, gallery[initialIdx].fileName, currentAutoDriveTicket?.id, null, gallery, initialIdx);
    });
  });
}

function handleDeleteAutoDriveImage(imgId) {
  const idx = stagedAutoDriveImages.findIndex(img => String(img.id) === String(imgId));
  if (idx !== -1) {
    const removed = stagedAutoDriveImages.splice(idx, 1)[0];
    if (removed && removed.objectUrl) {
      try { URL.revokeObjectURL(removed.objectUrl); } catch (e) {}
    }
    // If no image is marked as mapping after deletion, ensure first remaining is marked
    if (!stagedAutoDriveImages.some(img => img.isMapping) && stagedAutoDriveImages.length > 0) {
      stagedAutoDriveImages[0].isMapping = true;
    }
    renderAutoDriveImagesGrid();
    showToast('Imagem removida com sucesso');
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function handleToggleAutoDriveMapping(imgId) {
  const img = stagedAutoDriveImages.find(i => String(i.id) === String(imgId));
  if (img) {
    img.isMapping = !img.isMapping;
  }
  renderAutoDriveImagesGrid();
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
}

async function handleAddAutoDriveImageFiles(files) {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) continue;
    const objectUrl = URL.createObjectURL(file);
    stagedAutoDriveImages.push({
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2),
      name: file.name || 'print_mapeamento.png',
      size: file.size,
      blob: file,
      objectUrl,
      isMapping: (stagedAutoDriveImages.length === 0)
    });
  }
  renderAutoDriveImagesGrid();
}

async function handleAddAutoDrivePdfFiles(files) {
  if (!files || files.length === 0) return;
  const fileList = Array.from(files);
  let addedCount = 0;
  for (const file of fileList) {
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') continue;
    try {
      const buffer = await file.arrayBuffer();
      stagedAutoDrivePdfs.push({
        id: 'pdf_local_' + Date.now() + '_' + Math.random().toString(36).substring(2),
        name: file.name || 'manual.pdf',
        size: file.size,
        blob: file,
        buffer
      });
      addedCount++;
    } catch (err) {
      console.warn('Erro ao carregar arquivo PDF:', err);
    }
  }
  if (addedCount > 0) {
    renderAutoDrivePdfCards();
    showToast(`${addedCount} manual(is) PDF adicionado(s)`);
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function handleDeleteAutoDrivePdf(pdfId) {
  const idx = stagedAutoDrivePdfs.findIndex(p => String(p.id) === String(pdfId));
  if (idx !== -1) {
    stagedAutoDrivePdfs.splice(idx, 1);
    renderAutoDrivePdfCards();
    showToast('Manual PDF removido');
    const approvalBox = document.getElementById('autoDriveApprovalBox');
    if (approvalBox) approvalBox.style.display = 'none';
  }
}

function renderAutoDrivePdfCards() {
  const container = document.getElementById('autoDrivePdfCardContainer');
  const badge = document.getElementById('autoDrivePdfStatusBadge');
  if (!container) return;

  const count = stagedAutoDrivePdfs.length;
  if (count === 0) {
    if (badge) {
      badge.textContent = 'Nenhum';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#f87171';
    }
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #0d1117; border: 1px dashed var(--border-color); border-radius: 6px;">
        <span style="font-size: 11px; color: var(--text-muted);">Nenhum manual PDF anexado. Caso a demanda possua manuais de layout, clique em "Adicionar PDF(s)".</span>
      </div>
    `;
    return;
  }

  if (badge) {
    badge.textContent = `${count} arquivo${count === 1 ? '' : 's'}`;
    badge.style.background = 'rgba(16, 185, 129, 0.2)';
    badge.style.color = '#34d399';
  }

  container.innerHTML = stagedAutoDrivePdfs.map((pdf, idx) => {
    return `
      <div class="autodrive-pdf-card" data-id="${escapeHtml(pdf.id)}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #0d1117; border: 1px solid var(--border-color); border-radius: 6px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
          <span style="font-size: 18px; flex-shrink: 0;">📕</span>
          <div style="overflow: hidden; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
              ${count > 1 ? `<span style="font-size: 10px; font-weight: 700; color: #58a6ff; background: rgba(56, 139, 253, 0.15); border-radius: 4px; padding: 0 4px; flex-shrink: 0;">#${idx + 1}</span>` : ''}
              <div style="font-family: Consolas, monospace; font-size: 12px; font-weight: 600; color: #f0f6fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(pdf.name)}">
                ${escapeHtml(pdf.name)}
              </div>
            </div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">
              ${formatBytes(pdf.size)}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button type="button" class="btn-secondary btn-preview-autodrive-pdf" data-id="${escapeHtml(pdf.id)}" style="height: 26px; font-size: 11px; padding: 0 10px; gap: 4px;" title="Visualizar arquivo PDF">
            <span>👁️</span> <span>Visualizar</span>
          </button>
          <button type="button" class="autodrive-delete-btn btn-delete-autodrive-pdf" data-id="${escapeHtml(pdf.id)}" title="Remover este PDF da lista">
            <span>🗑️</span> <span>Remover</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire preview buttons
  container.querySelectorAll('.btn-preview-autodrive-pdf').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const targetPdf = stagedAutoDrivePdfs.find(p => String(p.id) === String(id));
      if (targetPdf && window.electronAPI && window.electronAPI.openBufferTemp) {
        const buf = targetPdf.buffer || (await targetPdf.blob.arrayBuffer());
        window.electronAPI.openBufferTemp(targetPdf.name, buf);
      }
    });
  });

  // Wire delete buttons
  container.querySelectorAll('.btn-delete-autodrive-pdf').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      handleDeleteAutoDrivePdf(id);
    });
  });
}

function closeAutoDriveModal() {
  const modal = document.getElementById('modalAutoDrive');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  if (approvalBox) approvalBox.style.display = 'none';
  const progressBox = document.getElementById('autoDriveProgressBox');
  if (progressBox) progressBox.style.display = 'none';
  const successBox = document.getElementById('autoDriveSuccessBox');
  if (successBox) successBox.style.display = 'none';

  // Clean up object URLs
  stagedAutoDriveImages.forEach(img => {
    if (img.objectUrl) {
      try { URL.revokeObjectURL(img.objectUrl); } catch (e) {}
    }
  });
  stagedAutoDriveImages = [];
  stagedAutoDrivePdfs = [];
  currentAutoDriveTicket = null;
}

async function handlePreFlightCheck() {
  if (!currentAutoDriveTicket) return;

  const btn = document.getElementById('btnLaunchAutoDriveNow');
  const btnIcon = document.getElementById('autoDriveBtnIcon');
  const btnText = document.getElementById('autoDriveBtnText');
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  const approvalDetails = document.getElementById('autoDriveApprovalDetails');

  const num = (document.getElementById('autoDriveNumeroLayout')?.value || '').trim();
  const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
  const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();
  const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
  const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';

  if (!num) {
    showAppAlert('Por favor, informe o Número do Layout.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveNumeroLayout')?.focus();
    return;
  }
  if (cat !== 'DESCONHECIDOS' && !ent) {
    showAppAlert('Por favor, informe o Banco ou Instituição.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveEntidade')?.focus();
    return;
  }
  if (!doc) {
    showAppAlert('Por favor, informe o Nome do Sistema / Documento.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveDocumento')?.focus();
    return;
  }

  // Collect all images marked as mapping
  const effectiveMappings = stagedAutoDriveImages.filter(img => img.isMapping);
  if (effectiveMappings.length === 0 && stagedAutoDriveImages.length > 0) {
    effectiveMappings.push(stagedAutoDriveImages[0]);
  }

  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Verificando no Google Drive...';

  try {
    if (!window.electronAPI || !window.electronAPI.checkDriveLayout) {
      throw new Error('Função de verificação requer execução no aplicativo Desktop Electron.');
    }

    // Verificar se o Google Drive está conectado antes de tentar a busca
    if (window.electronAPI.getDriveStatus) {
      const driveStatus = await window.electronAPI.getDriveStatus();
      if (!driveStatus || !driveStatus.connected) {
        if (btn) btn.disabled = false;
        if (btnIcon) btnIcon.textContent = '🔍';
        if (btnText) btnText.textContent = 'Verificar no Google Drive';

        const openSettings = await showAppConfirm(
          'O Google Drive não está conectado neste computador.\n\nPara verificar layouts e enviar arquivos, conecte sua conta Google ou sincronize com o AutoDrive nas Configurações.\n\nDeseja abrir as Configurações agora?',
          'Google Drive Não Conectado',
          { confirmText: 'Abrir Configurações', cancelText: 'Agora Não' }
        );
        if (openSettings) {
          document.getElementById('ticketModal')?.classList.remove('active');
          document.getElementById('settingsModal')?.classList.add('active');
          setTimeout(() => {
            document.getElementById('settingsDriveStatusPill')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
        return;
      }
    }

    const savedMirrorDir = document.getElementById('settingsLocalMirrorPath')?.value || undefined;
    const checkData = {
      categoria: cat,
      entidade: ent,
      numero_layout: num,
      nome_documento: doc,
      senha,
      customMirrorDir: savedMirrorDir,
      pdfFiles: stagedAutoDrivePdfs.map(p => ({ name: p.name, size: p.size })),
      pdfName: stagedAutoDrivePdfs[0]?.name || null,
      mappingImages: effectiveMappings.map(img => ({ name: img.name, size: img.size })),
      extraImages: stagedAutoDriveImages.filter(img => !effectiveMappings.includes(img)).map(img => ({ name: img.name, size: img.size }))
    };

    const res = await window.electronAPI.checkDriveLayout(checkData);

    if (!res.success) {
      throw new Error(res.error || 'Erro desconhecido na verificação do Drive.');
    }

    if (approvalDetails) {
      const isDirectCategory = !res.categoria?.hasEntitySubfolder || cat === 'DESCONHECIDOS';
      const entityExists = !!(res.entity?.exists || res.entityFolder?.exists);
      const entityName = res.entity?.matchedName || res.entity?.name || res.stdNames?.folderEntityName || ent;
      const layoutExists = !!(res.layout?.exists || res.layoutFolder?.exists);
      const layoutName = res.layout?.matchedName || res.layout?.name || res.stdNames?.folderLayoutName;
      const conflicts = res.conflicts || [];
      const existingFiles = res.existingFiles || [];

      let entityStatusHtml = '';
      if (isDirectCategory) {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(56, 139, 253, 0.12); border: 1px solid rgba(56, 139, 253, 0.35); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Destino Categoria: ${escapeHtml(res.categoria?.folderName || '1DESCONHECIDOS')}</div>
                <div style="color: #8b949e; font-size: 11px;">Criação direta na categoria raiz (sem criar pasta intermediária de banco/sistema)</div>
              </div>
            </div>
            <span style="background: rgba(56, 139, 253, 0.25); color: #58a6ff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">Subpasta Direta</span>
          </div>
        `;
      } else if (entityExists) {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(35, 134, 54, 0.1); border: 1px solid rgba(46, 160, 67, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Pasta da Entidade / Banco:</div>
                <div style="font-family: Consolas, monospace; color: #58a6ff; font-size: 11px;">${escapeHtml(entityName)}</div>
              </div>
            </div>
            <span style="background: rgba(35, 134, 54, 0.25); color: #3fb950; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✓ Já existe no Drive</span>
          </div>
        `;
      } else {
        entityStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(210, 153, 34, 0.1); border: 1px solid rgba(210, 153, 34, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Pasta da Entidade / Banco:</div>
                <div style="font-family: Consolas, monospace; color: #e3b341; font-size: 11px;">${escapeHtml(entityName)}</div>
              </div>
            </div>
            <span style="background: rgba(210, 153, 34, 0.25); color: #e3b341; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✨ Será criada nova</span>
          </div>
        `;
      }

      let layoutStatusHtml = '';
      if (layoutExists) {
        layoutStatusHtml = `
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📂</span>
                <div>
                  <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Subpasta do Layout:</div>
                  <div style="font-family: Consolas, monospace; color: #f87171; font-size: 11px;">${escapeHtml(layoutName)}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${res.layout?.webViewLink ? `
                  <button type="button" class="btn-secondary btn-open-existing-drive-link" data-link="${escapeHtml(res.layout.webViewLink)}" style="font-size: 11px; height: 24px; padding: 0 8px; gap: 4px;" title="Ver pasta existente no Google Drive">
                    <span>🌐</span> <span>Abrir no Drive</span>
                  </button>
                ` : ''}
                <span style="background: rgba(239, 68, 68, 0.25); color: #f87171; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">⚠️ Já existe no Drive</span>
              </div>
            </div>
            ${existingFiles.length > 0 ? `
              <div style="font-size: 11px; color: #8b949e; border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 4px; margin-top: 2px;">
                <strong>Arquivos atuais na pasta:</strong> ${existingFiles.map(f => `<code style="color: #c9d1d9;">${escapeHtml(f.name)}</code>`).join(', ')}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        layoutStatusHtml = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(56, 139, 253, 0.1); border: 1px solid rgba(56, 139, 253, 0.3); border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📂</span>
              <div>
                <div style="font-weight: 700; color: #f0f6fc; font-size: 12px;">Subpasta do Layout:</div>
                <div style="font-family: Consolas, monospace; color: #58a6ff; font-size: 11px;">${escapeHtml(layoutName)}</div>
              </div>
            </div>
            <span style="background: rgba(56, 139, 253, 0.25); color: #58a6ff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">✨ Será criada nova</span>
          </div>
        `;
      }

      const plannedPdfs = res.stdNames?.pdfFilenames || (res.stdNames?.pdfFilename ? [res.stdNames.pdfFilename] : []);
      const plannedMappings = res.stdNames?.imageFilenames || (res.stdNames?.imageFilename ? [res.stdNames.imageFilename] : []);

      const pdfItemsHtml = plannedPdfs.map((pdfName, idx) => {
        const hasConflict = existingFiles.some(f => f.name && f.name.toUpperCase() === pdfName.toUpperCase());
        const label = plannedPdfs.length > 1 ? `Manual PDF ${idx + 1}:` : 'Manual PDF:';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>📕</span> <strong>${label}</strong> <code style="color: #79c0ff;">${escapeHtml(pdfName)}</code>
            </span>
            ${hasConflict
              ? '<span style="color: #f87171; font-weight: 700;">⚠️ Já existe (será atualizado)</span>'
              : '<span style="color: #3fb950; font-weight: 600;">✓ Novo envio</span>'
            }
          </div>
        `;
      }).join('');

      const mappingItemsHtml = plannedMappings.map((imgName, idx) => {
        const hasConflict = existingFiles.some(f => f.name && f.name.toUpperCase() === imgName.toUpperCase());
        const label = plannedMappings.length > 1 ? `Mapeamento ${idx + 1}:` : 'Mapeamento:';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>🖼️</span> <strong>${label}</strong> <code style="color: #79c0ff;">${escapeHtml(imgName)}</code>
            </span>
            ${hasConflict
              ? '<span style="color: #f87171; font-weight: 700;">⚠️ Já existe (será atualizado)</span>'
              : '<span style="color: #3fb950; font-weight: 600;">✓ Novo envio</span>'
            }
          </div>
        `;
      }).join('');

      const filesHtml = `
        <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; background: rgba(22, 27, 34, 0.8); border: 1px solid var(--border-color); border-radius: 6px;">
          <div style="font-weight: 700; color: #c9d1d9; font-size: 11px; text-transform: uppercase;">Arquivos preparados para envio:</div>
          ${pdfItemsHtml || `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>📕</span> <strong>Manual PDF:</strong> <span style="color: #8b949e;">Nenhum anexado</span>
              </span>
              <span style="color: #8b949e;">-</span>
            </div>
          `}
          ${mappingItemsHtml || '<div style="font-size: 11px; color: #8b949e;">Nenhuma imagem de mapeamento selecionada</div>'}
          ${senha ? `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px; margin-top: 2px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>🔑</span> <strong>Senha do Arquivo / PDF:</strong> <code style="color: #38bdf8;">${escapeHtml(senha)}</code>
              </span>
              <span style="color: #38bdf8; font-weight: 600;">✓ Protegido</span>
            </div>
          ` : ''}
        </div>
      `;

      const mirrorDir = res.mirror?.targetDir || res.mirrorFolder || '';
      const mirrorExists = !!(res.mirror?.exists || res.mirrorExists);
      const mirrorHtml = `
        <div style="font-size: 11px; color: #8b949e; padding: 4px 6px;">
          💾 <strong>Espelho Local:</strong> <code style="color: #c9d1d9;">${escapeHtml(mirrorDir)}</code>
          ${mirrorExists ? '<span style="color: #e3b341; margin-left: 6px;">(pasta local já existe)</span>' : '<span style="color: #3fb950; margin-left: 6px;">(será criada localmente)</span>'}
        </div>
      `;

      approvalDetails.innerHTML = entityStatusHtml + layoutStatusHtml + filesHtml + mirrorHtml;

      // Wire existing layout link button if present
      approvalDetails.querySelectorAll('.btn-open-existing-drive-link').forEach(btnEl => {
        btnEl.addEventListener('click', () => {
          const lk = btnEl.getAttribute('data-link');
          if (lk) {
            if (window.electronAPI && window.electronAPI.openExternal) window.electronAPI.openExternal(lk);
            else window.open(lk, '_blank');
          }
        });
      });
    }

    if (approvalBox) {
      approvalBox.style.display = 'block';
      approvalBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

  } catch (err) {
    if (err.message && (err.message.includes('Google Drive não está conectado') || err.message.includes('refresh_token'))) {
      const openSettings = await showAppConfirm(
        'O Google Drive não está conectado neste computador.\n\nPara verificar layouts e enviar arquivos, conecte sua conta Google ou sincronize com o AutoDrive nas Configurações.\n\nDeseja abrir as Configurações agora?',
        'Google Drive Não Conectado',
        { confirmText: 'Abrir Configurações', cancelText: 'Agora Não' }
      );
      if (openSettings) {
        document.getElementById('ticketModal')?.classList.remove('active');
        document.getElementById('settingsModal')?.classList.add('active');
        setTimeout(() => {
          document.getElementById('settingsDriveStatusPill')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    } else {
      showAppError('Verificação no Google Drive', err);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = '🔍';
    if (btnText) btnText.textContent = 'Verificar no Google Drive';
  }
}

async function executeAutoDriveLaunch() {
  if (!currentAutoDriveTicket) return;

  const btn = document.getElementById('btnLaunchAutoDriveNow');
  const btnIcon = document.getElementById('autoDriveBtnIcon');
  const btnText = document.getElementById('autoDriveBtnText');
  const approvalBox = document.getElementById('autoDriveApprovalBox');
  const progressBox = document.getElementById('autoDriveProgressBox');
  const progressMsg = document.getElementById('autoDriveProgressMsg');
  const progressStepText = document.getElementById('autoDriveProgressStepText');
  const successBox = document.getElementById('autoDriveSuccessBox');

  const quick = document.getElementById('autoDriveQuickText')?.value || '';
  const num = (document.getElementById('autoDriveNumeroLayout')?.value || '').trim();
  const ent = (document.getElementById('autoDriveEntidade')?.value || '').trim();
  const doc = (document.getElementById('autoDriveDocumento')?.value || '').trim();
  const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
  const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';
  const saveMirror = document.getElementById('chkAutoDriveSaveMirror')?.checked ?? true;

  if (!num) {
    showAppAlert('Por favor, preencha o Número do Layout.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveNumeroLayout')?.focus();
    return;
  }
  if (cat !== 'DESCONHECIDOS' && !ent) {
    showAppAlert('Por favor, preencha o Banco ou Instituição.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveEntidade')?.focus();
    return;
  }
  if (!doc) {
    showAppAlert('Por favor, preencha o Nome do Sistema / Documento.', 'Campo Obrigatório', 'warning');
    document.getElementById('autoDriveDocumento')?.focus();
    return;
  }

  // Selected mapping images (support multiple)
  let effectiveMappings = stagedAutoDriveImages.filter(img => img.isMapping);
  if (effectiveMappings.length === 0 && stagedAutoDriveImages.length > 0) {
    effectiveMappings = [stagedAutoDriveImages[0]];
  }

  if (effectiveMappings.length === 0 && stagedAutoDrivePdfs.length === 0) {
    const confirmNoMedia = await showAppConfirm(
      'Nenhuma imagem de mapeamento nem manual PDF foi selecionado. Deseja criar apenas as pastas organizadas no Google Drive?',
      'Criar Pastas no Google Drive',
      { confirmText: 'Criar Pastas Apenas' }
    );
    if (!confirmNoMedia) return;
  }

  // Esconder caixa de aprovação ao iniciar envio
  if (approvalBox) approvalBox.style.display = 'none';

  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Sincronizando com o Drive...';

  if (progressBox) progressBox.style.display = 'block';
  if (successBox) successBox.style.display = 'none';

  try {
    const preparedPdfs = [];
    for (let i = 0; i < stagedAutoDrivePdfs.length; i++) {
      const p = stagedAutoDrivePdfs[i];
      const buf = p.buffer || (await p.blob.arrayBuffer());
      preparedPdfs.push({
        id: p.id,
        name: p.name,
        buffer: buf,
        size: p.size
      });
    }

    const preparedMappingImages = [];
    for (let i = 0; i < effectiveMappings.length; i++) {
      const mImg = effectiveMappings[i];
      const buf = await mImg.blob.arrayBuffer();
      preparedMappingImages.push({
        id: mImg.id,
        name: mImg.name,
        buffer: buf
      });
    }

    const savedMirrorDir = document.getElementById('settingsLocalMirrorPath')?.value || undefined;
    const payload = {
      quick,
      numero_layout: num,
      entidade: ent,
      nome_documento: doc,
      categoria: cat,
      senha,
      pdfBuffer: preparedPdfs[0]?.buffer || null,
      pdfName: preparedPdfs[0]?.name || null,
      pdfFiles: preparedPdfs,
      imageBuffer: preparedMappingImages[0]?.buffer || null,
      imageName: preparedMappingImages[0]?.name || null,
      mappingImages: preparedMappingImages,
      saveMirror,
      customMirrorDir: savedMirrorDir
    };

    if (window.electronAPI && window.electronAPI.uploadDriveLayout) {
      if (progressMsg) progressMsg.textContent = 'Iniciando upload e sincronização com Google Drive...';

      let unsubProgress = null;
      if (window.electronAPI.onDriveProgress) {
        unsubProgress = window.electronAPI.onDriveProgress((p) => {
          if (progressMsg) progressMsg.textContent = p.message || 'Processando...';
          if (progressStepText) progressStepText.textContent = p.step || '';
        });
      }

      const res = await window.electronAPI.uploadDriveLayout(payload);
      if (unsubProgress) unsubProgress();

      if (!res.success) {
        throw new Error(res.error || 'Erro ao sincronizar com Google Drive');
      }

      autoDriveLastResult = res;

      // Show success screen and scroll smoothly to it
      if (progressBox) progressBox.style.display = 'none';
      if (successBox) {
        successBox.style.display = 'block';
        const sumEl = document.getElementById('autoDriveSuccessSummary');
        if (sumEl) {
          const mappedListHtml = (res.uploadedImages && res.uploadedImages.length > 0)
            ? res.uploadedImages.map((upImg, idx) => `<div>🖼️ <strong>Mapeamento ${res.uploadedImages.length > 1 ? (idx + 1) + ': ' : ''}</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(upImg.filename || res.stdNames.imageFilename)}</span></div>`).join('')
            : (res.stdNames?.imageFilename ? `<div>🖼️ <strong>Mapeamento:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.stdNames.imageFilename)}</span></div>` : '');

          const pdfsListHtml = (res.uploadedPdfs && res.uploadedPdfs.length > 0)
            ? res.uploadedPdfs.map((upPdf, idx) => `<div>📕 <strong>Manual PDF ${res.uploadedPdfs.length > 1 ? (idx + 1) + ': ' : ''}</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(upPdf.filename || res.stdNames.pdfFilename)}</span></div>`).join('')
            : (res.stdNames?.pdfFilename ? `<div>📕 <strong>Manual PDF:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.stdNames.pdfFilename)}</span></div>` : '');

          sumEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
              <div>📁 <strong>Pasta no Drive:</strong> <span style="font-family: Consolas, monospace; color: #58a6ff; font-weight: 700;">${escapeHtml(res.stdNames.folderLayoutName)}</span></div>
              ${pdfsListHtml}
              ${mappedListHtml}
              ${senha ? `<div>🔑 <strong>Senha do Arquivo / PDF:</strong> <span style="font-family: Consolas, monospace; color: #38bdf8;">${escapeHtml(senha)}</span></div>` : ''}
              ${res.mirror?.targetDir ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">💾 <strong>Espelho Local:</strong> <span style="font-family: Consolas, monospace;">${escapeHtml(res.mirror.targetDir)}</span></div>` : ''}
            </div>
          `;
        }
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Check minimize
      const shouldMinimize = document.getElementById('chkAutoDriveMinimizeApp')?.checked;
      if (shouldMinimize && window.electronAPI && window.electronAPI.minimize) {
        window.electronAPI.minimize();
      }

      // Show native notification
      if (window.electronAPI && window.electronAPI.showNotification) {
        window.electronAPI.showNotification('AutoDrive • Sucesso', `Layout ${res.stdNames.folderLayoutName} sincronizado com sucesso!`);
      }

    } else {
      throw new Error('Integração com Google Drive requer execução no aplicativo Desktop Electron.');
    }

  } catch (err) {
    if (progressBox) progressBox.style.display = 'none';
    if (err.message && (err.message.includes('Google Drive não está conectado') || err.message.includes('refresh_token'))) {
      showAppAlert(
        'O Google Drive não está conectado neste computador.\n\nAcesse as Configurações ⚙️ para conectar sua conta Google ou sincronizar com o AutoDrive.',
        'Google Drive Não Conectado',
        'warning'
      );
    } else {
      showAppError('Erro ao enviar layout para o Google Drive', err);
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = '🚀';
    if (btnText) btnText.textContent = 'Enviar para o Google Drive';
  }
}

async function executeExternalPythonLaunch() {
  if (!currentAutoDriveTicket) return;

  try {
    const quick = document.getElementById('autoDriveQuickText')?.value || '';
    const num = document.getElementById('autoDriveNumeroLayout')?.value || '';
    const ent = document.getElementById('autoDriveEntidade')?.value || '';
    const doc = document.getElementById('autoDriveDocumento')?.value || '';
    const senha = (document.getElementById('autoDriveSenha')?.value || '').trim();
    const cat = document.getElementById('autoDriveCategoria')?.value || 'BANCOS';

    const mappingImg = stagedAutoDriveImages.find(img => img.isMapping) || stagedAutoDriveImages[0];
    const preparedPdfs = [];
    for (let i = 0; i < stagedAutoDrivePdfs.length; i++) {
      const p = stagedAutoDrivePdfs[i];
      const buf = p.buffer || (await p.blob.arrayBuffer());
      preparedPdfs.push({
        id: p.id,
        name: p.name,
        buffer: buf,
        size: p.size
      });
    }

    let imageBuffer = null;
    let imageName = null;
    if (mappingImg) {
      imageName = mappingImg.name || 'mapeamento.png';
      imageBuffer = await mappingImg.blob.arrayBuffer();
    }

    const launchData = {
      quick,
      numero_layout: num,
      entidade: ent,
      nome_documento: doc,
      categoria: cat,
      senha,
      pdfBuffer: preparedPdfs[0]?.buffer || null,
      pdfName: preparedPdfs[0]?.name || null,
      pdfFiles: preparedPdfs,
      imageBuffer,
      imageName
    };

    if (window.electronAPI && window.electronAPI.launchAutoDrive) {
      const res = await window.electronAPI.launchAutoDrive(launchData);
      if (!res.success) {
        showAppError('Erro ao abrir AutoDrive externo', res.error || 'Falha ao executar executável');
        return;
      }
      showToast('AutoDrive externo iniciado');
      closeAutoDriveModal();
    } else {
      showAppAlert('Disponível apenas no Desktop Electron.', 'Recurso Desktop', 'info');
    }
  } catch (err) {
    showAppError('Erro ao iniciar AutoDrive externo', err);
  }
}

