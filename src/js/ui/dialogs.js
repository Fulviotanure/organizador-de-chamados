// UI Module: Dialogs, Alerts, Toasts, Auto-Updater & User Settings
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
      subtitleEl.textContent = type === 'error' ? 'Falha na Operação' : (type === 'warning' ? 'Atenção Necessária' : (type === 'success' ? 'Operação Concluída' : 'Chamados Conciliador Contábil'));
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
      const baseClass = isDanger ? 'btn-danger' : 'btn-primary';
      const extraClass = (options.confirmClass || '').trim();
      if (!extraClass) {
        btnConfirm.className = baseClass;
      } else if (extraClass.includes('btn-primary') || extraClass.includes('btn-danger')) {
        btnConfirm.className = extraClass;
      } else {
        btnConfirm.className = `${baseClass} ${extraClass}`;
      }
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
          text.textContent = 'Chamados Conciliador Contábil já está na versão mais recente.';
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

