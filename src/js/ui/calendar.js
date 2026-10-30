// UI Module: Developer Agenda, Delivery & Client Calendars, Rich Text Editor & Create Ticket Modal
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

function positionCalendarPopover(popover, group) {
  if (!popover || !group) return;
  const scrollContainer = group.closest('.modal-form-col, .drawer-body') || document.documentElement;
  const groupRect = group.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect
    ? scrollContainer.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };

  const spaceBelow = containerRect.bottom - groupRect.bottom;
  const spaceAbove = groupRect.top - containerRect.top;

  // Se estiver no modal de novo chamado ou não houver espaço suficiente abaixo (~340px), abre para cima
  if (group.closest('#createTicketModalOverlay') || (spaceBelow < 340 && spaceAbove > spaceBelow)) {
    popover.style.bottom = 'calc(100% + 8px)';
    popover.style.top = 'auto';
  } else {
    popover.style.top = 'calc(100% + 8px)';
    popover.style.bottom = 'auto';
  }
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
      positionCalendarPopover(popover, group);
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
      positionCalendarPopover(popover, group);
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
    if (selectedTicket) {
      selectedTicket.layoutId = null;
      selectedTicket.layout = null;
      selectedTicket.layoutStatus = null;
      renderDrawerHeaderMetaAndTitle(selectedTicket, null);
    }
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
          const statusBadge = formatLayoutStatusBadge(l.status);
          const badgeHtml = statusBadge ? `<span class="badge-layout-status ${statusBadge.className}" style="font-size: 9.5px; padding: 1px 5px; margin-left: auto;">${statusBadge.icon} ${statusBadge.label}</span>` : '';
          return `
            <div class="layout-autocomplete-item" data-id="${l.id}" data-code="${code}" data-name="${escapeHtml(name)}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden;">
                <span class="layout-item-code">Layout ${code}</span>
                <span class="layout-item-name">${escapeHtml(name)}</span>
              </div>
              ${badgeHtml}
            </div>
          `;
        }).join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.layout-autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id;
            const code = item.dataset.code;
            const name = item.dataset.name;
            const matchedLayout = layouts.find(l => String(l.id) === String(id));
            const status = matchedLayout?.status || null;

            registerLayoutInCache({ id, code, name, status });
            renderDrawerLayoutField(id, code, name, status);
            if (selectedTicket) {
              selectedTicket.layoutId = id;
              selectedTicket.layout = { id, code, name, status };
              selectedTicket.layoutStatus = status;
              renderDrawerHeaderMetaAndTitle(selectedTicket, status);
            }

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

  // Permite colar imagens/prints diretamente com Ctrl+V na demanda aberta
  window.addEventListener('paste', async (e) => {
    const drawer = document.getElementById('demandDrawer');
    if (!drawer || !drawer.classList.contains('open') || !selectedTicket) return;
    
    // Se o usuário está digitando ativamente em um campo de texto, não intercepta
    const target = e.target;
    if (target) {
      if (target.id === 'drawerNewCommentText') return; // Envio no chat
      if (target.id === 'drawerEditDescEditor' || target.id === 'drawerDescription') return; // Edição da descrição
      if (target.id === 'drawerLocalNotes') return; // Anotações
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    }

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
  const headerEl = document.getElementById('calAgendaHeader');

  const devs = window.appStore.getKnownDevelopers();
  const dev = devs.find(d => d.id === devId);

  if (headerEl) {
    headerEl.innerHTML = dev
      ? `Agenda de <strong id="calDevNameHeader">${escapeHtml(dev.name.split(' ')[0] || dev.name)}</strong>: chamados em aberto com entrega em cada dia.`
      : 'Agenda Geral de Entregas (Selecione um desenvolvedor para ver carga de trabalho)';
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

let newTicketLabelsSearchQuery = '';
let newTicketLabelsInitialized = false;

function initNewTicketLabelsListeners() {
  if (newTicketLabelsInitialized) return;
  newTicketLabelsInitialized = true;

  const btn = document.getElementById('btnNewTicketLabels');
  const panel = document.getElementById('panelNewTicketLabels');
  const searchInput = document.getElementById('searchNewTicketLabels');
  const clearBtn = document.getElementById('actionNewTicketLabelsClear');

  if (btn && panel) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = panel.style.display !== 'none';
      document.querySelectorAll('.filter-dropdown-panel').forEach(p => {
        if (p !== panel) p.style.display = 'none';
      });
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && searchInput) {
        setTimeout(() => searchInput.focus(), 60);
      }
    });

    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      newTicketLabelsSearchQuery = e.target.value || '';
      renderLabelsPicker();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      newTicketSelectedLabels.clear();
      renderLabelsPicker();
    });
  }
}

function renderLabelsPicker() {
  initNewTicketLabelsListeners();

  const listEl = document.getElementById('listNewTicketLabels');
  const btnText = document.getElementById('btnNewTicketLabelsText');
  const badgeEl = document.getElementById('btnNewTicketLabelsBadge');
  const countText = document.getElementById('newTicketLabelsCountText');
  const previewBox = document.getElementById('newTicketActiveLabelsPreview');
  const btn = document.getElementById('btnNewTicketLabels');

  if (!listEl) return;

  const allLabels = window.appStore ? window.appStore.getAvailableLabels() : [];
  const q = newTicketLabelsSearchQuery.trim().toLowerCase();
  const filtered = q ? allLabels.filter(l => l.name.toLowerCase().includes(q)) : allLabels;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding: 12px; text-align: center; font-size: 11.5px; color: var(--text-muted);">Nenhuma etiqueta encontrada</div>';
  } else {
    filtered.forEach(l => {
      const isSelected = newTicketSelectedLabels.has(l.id);
      const color = l.color || '#6366f1';
      const row = document.createElement('label');
      row.className = `filter-option-row ${isSelected ? 'selected' : ''}`;
      row.innerHTML = `
        <input type="checkbox" value="${escapeHtml(l.id)}" ${isSelected ? 'checked' : ''}>
        <span class="filter-option-color-dot" style="background-color: ${escapeHtml(color)}"></span>
        <span class="filter-option-text">${escapeHtml(l.name)}</span>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
          newTicketSelectedLabels.add(l.id);
        } else {
          newTicketSelectedLabels.delete(l.id);
        }
        renderLabelsPicker();
      });
      listEl.appendChild(row);
    });
  }

  const selectedCount = newTicketSelectedLabels.size;
  const selectedObjs = allLabels.filter(l => newTicketSelectedLabels.has(l.id));

  if (countText) {
    countText.textContent = `${selectedCount} selecionada${selectedCount === 1 ? '' : 's'}`;
  }

  if (selectedCount === 0) {
    if (btnText) btnText.textContent = 'Nenhuma etiqueta';
    if (badgeEl) badgeEl.style.display = 'none';
    if (btn) btn.classList.remove('active');
  } else if (selectedCount <= 2) {
    if (btnText) btnText.textContent = selectedObjs.map(l => l.name).join(', ');
    if (badgeEl) {
      badgeEl.textContent = String(selectedCount);
      badgeEl.style.display = 'inline-flex';
    }
    if (btn) btn.classList.add('active');
  } else {
    if (btnText) btnText.textContent = `${selectedCount} etiquetas selecionadas`;
    if (badgeEl) {
      badgeEl.textContent = String(selectedCount);
      badgeEl.style.display = 'inline-flex';
    }
    if (btn) btn.classList.add('active');
  }

  if (previewBox) {
    if (selectedCount === 0) {
      previewBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Nenhuma etiqueta atribuída</span>';
    } else {
      previewBox.innerHTML = selectedObjs.map(l => {
        const color = l.color || '#6366f1';
        return `
          <span class="drawer-label-active-pill" data-label-id="${l.id}" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; background: ${color}22; color: ${color}; border: 1px solid ${color}66; cursor: pointer;" title="Clique para remover">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
            <span>${escapeHtml(l.name)}</span>
            <span style="font-size: 9px; opacity: 0.7; margin-left: 2px;">✕</span>
          </span>
        `;
      }).join('');

      previewBox.querySelectorAll('.drawer-label-active-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = pill.dataset.labelId;
          newTicketSelectedLabels.delete(id);
          renderLabelsPicker();
        });
      });
    }
  }
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

  // Global paste handler when create ticket modal or workspace tab is open
  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('createTicketModalOverlay');
    const isCreateTab = document.body.classList.contains('create-ticket-workspace-active') ||
                        (window.appTabs && window.appTabs.activeTabId === 'new-ticket');
    const isModalOpen = modal && modal.classList.contains('open');
    if (!isModalOpen && !isCreateTab) return;

    // Se o evento foi disparado diretamente no editor, o listener do editor já cuidará da inserção
    const editor = document.getElementById('newTicketDescriptionEditor');
    if (e.target && editor && (e.target === editor || editor.contains(e.target))) {
      return;
    }

    const clipboardItems = e.clipboardData ? e.clipboardData.items : [];
    const pastedFiles = [];
    let pastedImageFile = null;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.type.startsWith('image/')) {
            const timeTag = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
            const newFile = new File([file], `screenshot-${timeTag}.png`, { type: file.type });
            pastedFiles.push(newFile);
            if (!pastedImageFile) pastedImageFile = newFile;
          } else {
            pastedFiles.push(file);
          }
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFilesToTicket(pastedFiles);

      // Insere também aberta diretamente no editor de descrição detalhada
      if (pastedImageFile && editor) {
        const reader = new FileReader();
        reader.onload = (loadEv) => {
          const dataUrl = loadEv.target?.result;
          if (dataUrl) {
            const hiddenTextarea = document.getElementById('newTicketDescription');
            const imgHtml = `<p><img src="${dataUrl}" alt="Print colado" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 8px 0; border: 1px solid rgba(255,255,255,0.15);" /></p><p><br></p>`;
            editor.focus();
            document.execCommand('insertHTML', false, imgHtml);
            if (hiddenTextarea) {
              hiddenTextarea.value = editor.innerHTML;
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            showToast('📸 Imagem colada e aberta na descrição!', 'success', 2500);
          }
        };
        reader.readAsDataURL(pastedImageFile);
      }
    }
  });
}

function setupRichTextEditor() {
  const editor = document.getElementById('newTicketDescriptionEditor');
  const toolbar = document.getElementById('ticketDescToolbar');
  const hiddenTextarea = document.getElementById('newTicketDescription');

  if (!editor || !toolbar) return;

  // Permite colar imagens diretamente com Ctrl+V dentro do próprio editor de descrição
  if (!editor.dataset.pasteBound) {
    editor.dataset.pasteBound = 'true';
    editor.addEventListener('paste', (e) => {
      const clipboardItems = e.clipboardData ? Array.from(e.clipboardData.items || []) : [];
      const imageItem = clipboardItems.find(it => it.kind === 'file' && it.type.startsWith('image/'));

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();

          const timeTag = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
          const newFile = new File([file], `screenshot-${timeTag}.png`, { type: file.type });
          // Adiciona também aos arquivos anexados
          addFilesToTicket([newFile]);

          const reader = new FileReader();
          reader.onload = (loadEv) => {
            const dataUrl = loadEv.target?.result;
            if (dataUrl) {
              editor.focus();
              const imgHtml = `<p><img src="${dataUrl}" alt="Print colado" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 8px 0; border: 1px solid rgba(255,255,255,0.15);" /></p><p><br></p>`;
              document.execCommand('insertHTML', false, imgHtml);
              if (hiddenTextarea) {
                hiddenTextarea.value = editor.innerHTML;
              }
              editor.dispatchEvent(new Event('input', { bubbles: true }));
              showToast('📸 Imagem colada e aberta na descrição!', 'success', 2500);
            }
          };
          reader.readAsDataURL(newFile);
        }
      }
    });
  }

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
      positionCalendarPopover(popover, group);
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
      positionCalendarPopover(popover, group);
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
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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

function resetCreateTicketForm() {
  const titleEl = document.getElementById('newTicketTitle');
  if (titleEl) titleEl.value = '';
  const dbEl = document.getElementById('newTicketDatabase');
  if (dbEl) dbEl.value = '';
  const moviEl = document.getElementById('newTicketMovidesk');
  if (moviEl) moviEl.value = '';
  const dueEl = document.getElementById('newTicketDueDate');
  if (dueEl) dueEl.value = '';
  const delivInput = document.getElementById('newTicketDeliveryDateInput');
  if (delivInput) delivInput.value = '';
  const clientDueEl = document.getElementById('newTicketClientDueDate');
  if (clientDueEl) clientDueEl.value = '';

  if (document.getElementById('newTicketPriority')) {
    const pEl = document.getElementById('newTicketPriority');
    pEl.value = 'medium';
    if (typeof updatePrioritySelectVisual === 'function') updatePrioritySelectVisual(pEl);
  }
  const descEl = document.getElementById('newTicketDescription');
  if (descEl) descEl.value = '';
  const descEditor = document.getElementById('newTicketDescriptionEditor');
  if (descEditor) descEditor.innerHTML = '';
  const popover = document.getElementById('calFloatingPopover');
  if (popover) popover.style.display = 'none';
  const clientPopover = document.getElementById('calClientPopover');
  if (clientPopover) clientPopover.style.display = 'none';

  if (typeof renderNewTicketLayoutField === 'function') {
    renderNewTicketLayoutField('', null, '');
  }
  if (typeof checkNewTicketLayoutConflicts === 'function') {
    checkNewTicketLayoutConflicts(null, null);
  }

  // Populate Types
  const typeSelect = document.getElementById('newTicketType');
  if (typeSelect && window.appStore?.getTicketTypes) {
    const types = window.appStore.getTicketTypes();
    typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  // Populate Products
  const prodSelect = document.getElementById('newTicketProduct');
  if (prodSelect && window.appStore?.getProducts) {
    const prods = window.appStore.getProducts();
    prodSelect.innerHTML = prods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  // Filter developers based on initially selected type/subject
  if (typeof updateDevSelectForCurrentType === 'function') {
    updateDevSelectForCurrentType();
  }

  // Reset labels & attachments for the new ticket modal
  if (typeof newTicketSelectedLabels !== 'undefined' && newTicketSelectedLabels?.clear) {
    newTicketSelectedLabels.clear();
  }
  newTicketLabelsSearchQuery = '';
  const searchLabelsEl = document.getElementById('searchNewTicketLabels');
  if (searchLabelsEl) searchLabelsEl.value = '';
  const panelLabelsEl = document.getElementById('panelNewTicketLabels');
  if (panelLabelsEl) panelLabelsEl.style.display = 'none';
  if (typeof renderLabelsPicker === 'function') {
    renderLabelsPicker();
  }

  if (typeof newTicketSelectedFiles !== 'undefined') {
    newTicketSelectedFiles.length = 0;
  }
  if (typeof renderSelectedFilesList === 'function') {
    renderSelectedFilesList();
  }

  const errBox = document.getElementById('createTicketError');
  if (errBox) errBox.style.display = 'none';

  // Reset calendar month and date selection
  const now = new Date();
  calCurrentYear = now.getFullYear();
  calCurrentMonth = now.getMonth();
  commonCalCurrentYear = now.getFullYear();
  commonCalCurrentMonth = now.getMonth();
  if (typeof selectCalendarDate === 'function') selectCalendarDate(null);
  if (typeof selectClientCalendarDate === 'function') selectClientCalendarDate(null, false);

  const btnClear = document.getElementById('btnClearSelectedDate');
  if (btnClear) {
    btnClear.onclick = () => {
      if (typeof selectCalendarDate === 'function') selectCalendarDate(null);
    };
  }
}

function openCreateTicketModal(options = {}) {
  // Se appTabs estiver disponível e não for forçado modo modal, abre como aba de trabalho
  if (window.appTabs && !options?.forceModal) {
    window.appTabs.openCreateTicketTab(true);
    return;
  }

  const modal = document.getElementById('createTicketModalOverlay');
  if (!modal) return;

  if (!options?.preserveForm) {
    resetCreateTicketForm();
  }

  modal.classList.add('open');
  setTimeout(() => document.getElementById('newTicketTitle')?.focus(), 100);
}

function closeCreateTicketModal() {
  if (window.appTabs && window.appTabs.activeTabId === 'new-ticket') {
    window.appTabs.closeTab('new-ticket');
    return;
  }
  const modal = document.getElementById('createTicketModalOverlay');
  if (modal) modal.classList.remove('open');
  const popover = document.getElementById('calFloatingPopover');
  if (popover) popover.style.display = 'none';
  const clientPopover = document.getElementById('calClientPopover');
  if (clientPopover) clientPopover.style.display = 'none';
  const panelLabelsEl = document.getElementById('panelNewTicketLabels');
  if (panelLabelsEl) panelLabelsEl.style.display = 'none';
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
  const hasContent = !!(descriptionText || descriptionHtml.includes('<img'));
  const description = hasContent ? descriptionHtml : fallbackDesc;

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

    if (window.appTabs && window.appTabs.tabs.some(t => t.id === 'new-ticket')) {
      await window.appTabs.closeTab('new-ticket', true);
    } else {
      closeCreateTicketModal();
    }

    if (window.electronAPI) {
      window.electronAPI.showNotification(
        'Chamado Aberto com Sucesso',
        `A demanda #${createdTicket.number} foi cadastrada e atribuída com sucesso.`
      );
    }

    // Refresh list and open new ticket
    await syncDemands();
    if (window.appTabs) {
      window.appTabs.openTicketTab(createdTicket, true);
    } else {
      openDemandDrawer(createdTicket);
    }

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


