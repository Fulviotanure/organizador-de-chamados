// UI Module: Dashboard Analítica de Chamados & Estatísticas por Desenvolvedor

(function () {
  const DASH_STATE = {
    period: 'all',
    developer: 'all',
    product: 'all',
    type: 'all',
    search: '',
    sortField: 'total',
    sortDir: 'desc',
    includeOverdueInReview: false,
    excludeIgnored: false,
    autoFullSyncTriggered: false,
    initialized: false
  };

  const DEV_PALETTE = [
    '#38bdf8', '#10b981', '#f59e0b', '#a855f7',
    '#f43f5e', '#6366f1', '#14b8a6', '#fb923c',
    '#ec4899', '#84cc16', '#06b6d4', '#eab308'
  ];

  function dashEsc(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getDevInitials(name) {
    const clean = String(name || '?').trim();
    if (!clean || clean === 'Não atribuído') return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatDurationShort(ms) {
    const num = Number(ms);
    if (!num || num <= 0) return '-';
    const totalMinutes = Math.round(num / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}m`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatDueShort(dueStr) {
    if (!dueStr) return 'Sem prazo';
    try {
      const d = new Date(dueStr);
      if (isNaN(d.getTime())) return String(dueStr).slice(0, 10);
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch (e) {
      return String(dueStr).slice(0, 10);
    }
  }

  function getDaysOverdue(dueStr) {
    if (!dueStr || typeof dueStr !== 'string') return 0;
    const dueDay = dueStr.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)) return 0;
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const [y, m, d] = dueDay.split('-').map(Number);
    const dueUtc = Date.UTC(y, m - 1, d);
    const diff = Math.floor((todayUtc - dueUtc) / 86400000);
    return diff > 0 ? diff : 0;
  }

  function getStatusFriendlyName(status) {
    const s = String(status || '').toLowerCase().trim();
    if (['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'].includes(s)) return 'Finalizado';
    if (s === 'review' || s === 'waiting_review') return 'Em Revisão';
    if (s === 'in_progress' || s === 'progress') return 'Em Progresso';
    if (s === 'paused') return 'Pausado';
    if (s.includes('waiting') || s.includes('requester') || s.includes('creator')) return 'Aguardando N2';
    if (s === 'triage') return 'Triagem';
    return 'Na Fila';
  }

  function getStatusPillClass(status) {
    const s = String(status || '').toLowerCase().trim();
    if (['done', 'closed', 'finished', 'completed', 'concluido', 'finalizado'].includes(s)) return 'dash-pill-done';
    if (s === 'review' || s === 'waiting_review') return 'dash-pill-review';
    if (s === 'in_progress' || s === 'progress') return 'dash-pill-progress';
    if (s === 'paused' || s.includes('waiting') || s.includes('requester')) return 'dash-pill-waiting';
    return 'dash-pill-queued';
  }

  // Gera SVG de Gráfico de Pizza (Rosca com tooltip e fatias proporcionais)
  function buildDonutChartSvg(segments, total, centerLabel, centerSubLabel) {
    const size = 190;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 80;
    const innerR = 48;

    const validSegments = (segments || []).filter(s => s.value > 0);

    if (!total || total <= 0 || validSegments.length === 0) {
      return `
        <svg viewBox="0 0 ${size} ${size}" class="dash-donut-svg" role="img" aria-label="${dashEsc(centerLabel)}">
          <circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${outerR - innerR}" />
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="dash-donut-center-val">0</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="dash-donut-center-sub">sem dados</text>
        </svg>
      `;
    }

    const sumVal = validSegments.reduce((acc, s) => acc + s.value, 0);
    let pathsHtml = '';

    if (validSegments.length === 1) {
      const seg = validSegments[0];
      const midR = (outerR + innerR) / 2;
      const strokeW = outerR - innerR;
      pathsHtml = `
        <circle
          cx="${cx}" cy="${cy}" r="${midR}"
          fill="none"
          stroke="${dashEsc(seg.color)}"
          stroke-width="${strokeW}"
          class="dash-pie-slice"
          data-slice-label="${dashEsc(seg.label)}"
          data-slice-value="${seg.value}"
          data-slice-pct="100"
        >
          <title>${dashEsc(seg.label)}: ${seg.value} (100%)</title>
        </circle>
      `;
    } else {
      let currentAngle = -Math.PI / 2;
      pathsHtml = validSegments.map(seg => {
        const fraction = seg.value / sumVal;
        const sliceAngle = fraction * Math.PI * 2;
        const endAngle = currentAngle + sliceAngle;
        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const x1Out = cx + outerR * Math.cos(currentAngle);
        const y1Out = cy + outerR * Math.sin(currentAngle);
        const x2Out = cx + outerR * Math.cos(endAngle);
        const y2Out = cy + outerR * Math.sin(endAngle);

        const x1In = cx + innerR * Math.cos(endAngle);
        const y1In = cy + innerR * Math.sin(endAngle);
        const x2In = cx + innerR * Math.cos(currentAngle);
        const y2In = cy + innerR * Math.sin(currentAngle);

        const d = [
          `M ${x1Out.toFixed(2)} ${y1Out.toFixed(2)}`,
          `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Out.toFixed(2)} ${y2Out.toFixed(2)}`,
          `L ${x1In.toFixed(2)} ${y1In.toFixed(2)}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2In.toFixed(2)} ${y2In.toFixed(2)}`,
          'Z'
        ].join(' ');

        const pct = Math.round(fraction * 100);
        currentAngle = endAngle;

        return `
          <path
            d="${d}"
            fill="${dashEsc(seg.color)}"
            stroke="#111827"
            stroke-width="1.5"
            class="dash-pie-slice"
            data-slice-label="${dashEsc(seg.label)}"
            data-slice-value="${seg.value}"
            data-slice-pct="${pct}"
          >
            <title>${dashEsc(seg.label)}: ${seg.value} (${pct}%)</title>
          </path>
        `;
      }).join('');
    }

    return `
      <svg viewBox="0 0 ${size} ${size}" class="dash-donut-svg" role="img" aria-label="${dashEsc(centerLabel)}">
        ${pathsHtml}
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="dash-donut-center-val" data-default-val="${total}">${total}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="dash-donut-center-sub" data-default-sub="${dashEsc(centerSubLabel)}">${dashEsc(centerSubLabel)}</text>
      </svg>
    `;
  }

  function renderPieCardHtml(title, subtitle, segments, centerTotal, centerSubLabel, emptyHint = 'Nenhum chamado encontrado') {
    const sumVal = segments.reduce((acc, s) => acc + s.value, 0);
    const svgHtml = buildDonutChartSvg(segments, centerTotal, title, centerSubLabel);

    const legendRows = segments.length === 0 || sumVal === 0
      ? `<div class="dash-pie-empty-hint">${dashEsc(emptyHint)}</div>`
      : segments.map(seg => {
          const pct = sumVal > 0 ? Math.round((seg.value / sumVal) * 100) : 0;
          return `
            <div class="dash-pie-legend-row" title="${dashEsc(seg.label)}: ${seg.value} (${pct}%)">
              <span class="dash-legend-dot" style="background-color: ${dashEsc(seg.color)};"></span>
              <span class="dash-legend-label">${dashEsc(seg.label)}</span>
              <span class="dash-legend-val">${seg.value}</span>
              <span class="dash-legend-pct">${pct}%</span>
            </div>
          `;
        }).join('');

    return `
      <div class="dash-chart-card dash-pie-card">
        <div class="dash-card-header">
          <div>
            <h3 class="dash-card-title">${dashEsc(title)}</h3>
            <p class="dash-card-subtitle">${dashEsc(subtitle)}</p>
          </div>
        </div>
        <div class="dash-pie-content">
          <div class="dash-pie-svg-wrap">${svgHtml}</div>
          <div class="dash-pie-legend">${legendRows}</div>
        </div>
      </div>
    `;
  }

  function populateFilterDropdowns() {
    const store = window.appStore;
    if (!store) return;

    const demands = (store.demands || []).filter(d => d && (!DASH_STATE.excludeIgnored || !store.isIgnored(d.id)));

    const devSelect = document.getElementById('dashFilterDev');
    if (devSelect) {
      const devs = new Set();
      demands.forEach(d => {
        const name = d.assignedTo?.name ? d.assignedTo.name.trim() : 'Não atribuído';
        devs.add(name);
      });
      const prevVal = DASH_STATE.developer;
      const sorted = Array.from(devs).sort((a, b) => a.localeCompare(b));
      devSelect.innerHTML = '<option value="all">Todos os Desenvolvedores</option>' +
        sorted.map(name => `<option value="${dashEsc(name)}">${dashEsc(name)}</option>`).join('');
      devSelect.value = sorted.includes(prevVal) ? prevVal : 'all';
      DASH_STATE.developer = devSelect.value;
    }

    const prodSelect = document.getElementById('dashFilterProduct');
    if (prodSelect) {
      const prods = new Set();
      (store.getProducts?.() || []).forEach(p => { if (p?.name) prods.add(p.name); });
      demands.forEach(d => {
        const pName = d.product?.name || d.productName;
        if (pName) prods.add(pName);
      });
      const prevVal = DASH_STATE.product;
      const sorted = Array.from(prods).sort((a, b) => a.localeCompare(b));
      prodSelect.innerHTML = '<option value="all">Todos os Produtos</option>' +
        sorted.map(name => `<option value="${dashEsc(name)}">${dashEsc(name)}</option>`).join('');
      prodSelect.value = sorted.includes(prevVal) ? prevVal : 'all';
      DASH_STATE.product = prodSelect.value;
    }

    const typeSelect = document.getElementById('dashFilterType');
    if (typeSelect) {
      const types = new Set();
      (store.getTicketTypes?.() || []).forEach(t => { if (t?.name) types.add(t.name); });
      demands.forEach(d => {
        const tName = d.ticketType?.name;
        if (tName) types.add(tName);
      });
      const prevVal = DASH_STATE.type;
      const sorted = Array.from(types).sort((a, b) => a.localeCompare(b));
      typeSelect.innerHTML = '<option value="all">Todos os Tipos</option>' +
        sorted.map(name => `<option value="${dashEsc(name)}">${dashEsc(name)}</option>`).join('');
      typeSelect.value = sorted.includes(prevVal) ? prevVal : 'all';
      DASH_STATE.type = typeSelect.value;
    }
  }

  function renderKpis(stats) {
    const container = document.getElementById('dashKpiGrid');
    if (!container) return;
    const t = stats.totals;

    const kpis = [
      {
        id: 'total',
        icon: '📊',
        label: 'Total de Demandas',
        value: t.total,
        accent: '#6366f1',
        sub: `${t.activeTotal} ativos · ${t.doneToday} concluídos hoje`,
        tone: 'indigo'
      },
      {
        id: 'open',
        icon: '🚀',
        label: 'Chamados em Aberto',
        value: t.openTotal,
        accent: '#38bdf8',
        sub: `${t.queued} na fila · ${t.inProgress} em progresso · ${t.pausedWaiting} paus./N2`,
        tone: 'blue'
      },
      {
        id: 'review',
        icon: '🔍',
        label: 'Em Revisão',
        value: t.review,
        accent: '#f59e0b',
        sub: `${t.activeTotal > 0 ? Math.round((t.review / t.activeTotal) * 100) : 0}% dos chamados ativos`,
        tone: 'amber'
      },
      {
        id: 'returned',
        icon: '↩️',
        label: 'Chamados Devolvidos',
        value: t.returned,
        accent: '#ec4899',
        sub: `${t.returnRate}% do total analisado (ajustes/retorno)`,
        tone: 'pink'
      },
      {
        id: 'overdue',
        icon: '⏰',
        label: 'Chamados Atrasados',
        value: t.overdueDev,
        accent: '#ef4444',
        sub: t.overdueReview > 0
          ? `+ ${t.overdueReview} em revisão com prazo vencido`
          : 'Prazo vencido na mão do dev',
        tone: 'red'
      },
      {
        id: 'done',
        icon: '✅',
        label: 'Chamados Finalizados',
        value: t.done,
        accent: '#10b981',
        sub: `${t.completionRate}% de taxa de conclusão`,
        tone: 'emerald'
      }
    ];

    container.innerHTML = kpis.map(k => `
      <div class="dash-kpi-card dash-kpi-${k.tone}" style="--kpi-accent: ${k.accent};">
        <div class="dash-kpi-top">
          <span class="dash-kpi-label">${dashEsc(k.label)}</span>
          <span class="dash-kpi-icon">${k.icon}</span>
        </div>
        <div class="dash-kpi-value">${k.value}</div>
        <div class="dash-kpi-sub">${dashEsc(k.sub)}</div>
      </div>
    `).join('');
  }

  function buildWrittenReportText(stats) {
    const t = stats.totals;
    const devs = stats.byDeveloper;
    const periodMap = {
      all: 'Todo o histórico carregado',
      today: 'Hoje',
      '7d': 'Últimos 7 dias',
      '30d': 'Últimos 30 dias',
      month: 'Mês atual'
    };

    const topOpen = [...devs].sort((a, b) => b.openTotal - a.openTotal)[0];
    const topReview = [...devs].sort((a, b) => b.review - a.review)[0];
    const topDone = [...devs].sort((a, b) => b.done - a.done)[0];
    const devsReturned = [...devs].filter(d => d.returned > 0).sort((a, b) => b.returned - a.returned);
    const devsOverdue = [...devs].filter(d => d.overdue > 0).sort((a, b) => b.overdue - a.overdue);

    const lines = [
      `RELATÓRIO ANALÍTICO DE CHAMADOS (${periodMap[DASH_STATE.period] || 'Geral'})`,
      `Total analisado: ${t.total} chamados (${t.activeTotal} ativos e ${t.done} finalizados - ${t.completionRate}% de conclusão).`,
      `• Em aberto com desenvolvedores: ${t.openTotal} (${t.queued} na fila, ${t.inProgress} em progresso e ${t.pausedWaiting} pausados/aguardando N2).`,
      `• Em revisão/validação: ${t.review} chamados.`,
      `• Devolvidos para ajuste: ${t.returned} chamados (${t.returnRate}% do total).`,
      `• Atrasados com desenvolvedores: ${t.overdueDev} chamados` + (t.overdueReview > 0 ? ` (+ ${t.overdueReview} em revisão com data vencida).` : '.'),
      ''
    ];

    if (topOpen && topOpen.openTotal > 0) {
      lines.push(`Maior carga em aberto: ${topOpen.name} (${topOpen.openTotal} em aberto: ${topOpen.queued} na fila, ${topOpen.inProgress} em progresso, ${topOpen.pausedWaiting} pausados/N2).`);
    }
    if (topReview && topReview.review > 0) {
      lines.push(`Maior fila de revisão: ${topReview.name} (${topReview.review} em revisão).`);
    }
    if (topDone && topDone.done > 0) {
      lines.push(`Maior volume finalizado: ${topDone.name} (${topDone.done} finalizados, taxa de ${topDone.completionRate}%).`);
    }
    if (devsReturned.length > 0) {
      lines.push(`Devolvidos por desenvolvedor: ${devsReturned.map(d => `${d.name} (${d.returned})`).join(', ')}.`);
    } else {
      lines.push('Devolvidos por desenvolvedor: Nenhum chamado devolvido no recorte atual.');
    }
    if (devsOverdue.length > 0) {
      lines.push(`Atrasados por desenvolvedor: ${devsOverdue.map(d => `${d.name} (${d.overdue})`).join(', ')}.`);
    } else {
      lines.push('Atrasados por desenvolvedor: Nenhum chamado atrasado na fila dos desenvolvedores no recorte atual.');
    }

    lines.push('', 'RESUMO POR DESENVOLVEDOR:');
    devs.forEach(d => {
      lines.push(`- ${d.name}: Total ${d.total} | Abertos ${d.openTotal} (Fila ${d.queued}, Prog. ${d.inProgress}, Paus/N2 ${d.pausedWaiting}) | Revisão ${d.review} | Devolvidos ${d.returned} | Atrasados ${d.overdue} | Finalizados ${d.done} (${d.completionRate}%)`);
    });

    return lines.join('\n');
  }

  function renderWrittenSummary(stats) {
    const container = document.getElementById('dashWrittenSummary');
    if (!container) return;

    const t = stats.totals;
    const devs = stats.byDeveloper;

    if (t.total === 0) {
      container.innerHTML = `
        <div class="dash-written-empty">
          Nenhum chamado encontrado para os filtros selecionados. Ajuste os filtros acima ou sincronize as demandas para visualizar o relatório escrito.
        </div>
      `;
      return;
    }

    const topOpen = [...devs].sort((a, b) => b.openTotal - a.openTotal)[0];
    const topReview = [...devs].sort((a, b) => b.review - a.review)[0];
    const topDone = [...devs].sort((a, b) => b.done - a.done)[0];
    const devsReturned = [...devs].filter(d => d.returned > 0).sort((a, b) => b.returned - a.returned);
    const devsOverdue = [...devs].filter(d => d.overdue > 0).sort((a, b) => b.overdue - a.overdue);

    const periodLabels = {
      all: 'Todo o histórico carregado',
      today: 'Hoje',
      '7d': 'Últimos 7 dias',
      '30d': 'Últimos 30 dias',
      month: 'Mês atual'
    };

    const devBulletsHtml = devs.map(d => `
      <div class="dash-written-dev-item">
        <div class="dash-written-dev-head">
          <span class="dash-written-dev-name">${dashEsc(d.name)}</span>
          <span class="dash-written-dev-total">${d.total} chamados</span>
        </div>
        <p class="dash-written-dev-line">
          Possui <strong>${d.openTotal}</strong> em aberto
          (<strong>${d.queued}</strong> na fila, <strong>${d.inProgress}</strong> em progresso, <strong>${d.pausedWaiting}</strong> pausados/N2),
          <strong class="txt-amber">${d.review}</strong> em revisão,
          <strong class="txt-pink">${d.returned}</strong> devolvido(s),
          <strong class="txt-red">${d.overdue}</strong> atrasado(s)${d.overdueReview > 0 ? ` <span class="txt-muted">(+${d.overdueReview} em revisão vencidos)</span>` : ''}
          e <strong class="txt-emerald">${d.done}</strong> finalizado(s) (${d.completionRate}%).
        </p>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="dash-written-columns">
        <div class="dash-written-block">
          <div class="dash-written-block-title">📋 Panorama Geral (${dashEsc(periodLabels[DASH_STATE.period] || 'Geral')})</div>
          <p class="dash-written-paragraph">
            Atualmente existem <strong>${t.total}</strong> chamados no recorte selecionado, sendo
            <strong class="txt-emerald">${t.done}</strong> finalizados (<strong>${t.completionRate}%</strong> de conclusão${t.doneToday > 0 ? `, com <strong>${t.doneToday}</strong> concluídos hoje` : ''})
            e <strong>${t.activeTotal}</strong> ativos.
            Entre os ativos, <strong class="txt-blue">${t.openTotal}</strong> estão em aberto com os desenvolvedores
            (<strong>${t.queued}</strong> na fila, <strong>${t.inProgress}</strong> em desenvolvimento e <strong>${t.pausedWaiting}</strong> pausados/aguardando N2)
            e <strong class="txt-amber">${t.review}</strong> estão em revisão aguardando validação.
          </p>
          <p class="dash-written-paragraph">
            No indicador de retrabalho e risco de prazo, contabilizamos
            <strong class="txt-pink">${t.returned}</strong> chamado(s) devolvido(s) (<strong>${t.returnRate}%</strong> do total)
            e <strong class="txt-red">${t.overdueDev}</strong> chamado(s) atrasado(s) sob responsabilidade direta dos desenvolvedores${t.overdueReview > 0 ? `, além de <strong>${t.overdueReview}</strong> em revisão com data de entrega ultrapassada` : ''}.
          </p>
          <ul class="dash-written-highlights">
            ${topOpen && topOpen.openTotal > 0 ? `<li><strong>Maior fila em aberto:</strong> ${dashEsc(topOpen.name)} com <strong>${topOpen.openTotal}</strong> demanda(s) ativa(s) em aberto.</li>` : ''}
            ${topReview && topReview.review > 0 ? `<li><strong>Mais chamados em revisão:</strong> ${dashEsc(topReview.name)} com <strong>${topReview.review}</strong> demanda(s) aguardando validação.</li>` : ''}
            ${topDone && topDone.done > 0 ? `<li><strong>Maior volume finalizado:</strong> ${dashEsc(topDone.name)} com <strong>${topDone.done}</strong> chamado(s) concluído(s) (${topDone.completionRate}%).</li>` : ''}
            <li><strong>Devolvidos por desenvolvedor:</strong> ${devsReturned.length > 0 ? devsReturned.map(d => `<span class="dash-inline-chip chip-pink">${dashEsc(d.name)}: ${d.returned}</span>`).join(' ') : '<span class="txt-emerald">Nenhum chamado devolvido</span>'}</li>
            <li><strong>Atrasados por desenvolvedor:</strong> ${devsOverdue.length > 0 ? devsOverdue.map(d => `<span class="dash-inline-chip chip-red">${dashEsc(d.name)}: ${d.overdue}</span>`).join(' ') : '<span class="txt-emerald">Nenhum chamado atrasado com os devs</span>'}</li>
          </ul>
        </div>
        <div class="dash-written-block">
          <div class="dash-written-block-title">👩‍💻 Diagnóstico Escrito por Desenvolvedor</div>
          <div class="dash-written-dev-list">${devBulletsHtml}</div>
        </div>
      </div>
    `;
  }

  function bindPieHoverEffects(container) {
    if (!container) return;
    container.querySelectorAll('.dash-pie-card').forEach(card => {
      const valText = card.querySelector('.dash-donut-center-val');
      const subText = card.querySelector('.dash-donut-center-sub');
      if (!valText || !subText) return;
      const defaultVal = valText.getAttribute('data-default-val') || valText.textContent;
      const defaultSub = subText.getAttribute('data-default-sub') || subText.textContent;

      card.querySelectorAll('.dash-pie-slice').forEach(slice => {
        slice.addEventListener('mouseenter', () => {
          valText.textContent = slice.getAttribute('data-slice-value') || defaultVal;
          const lbl = slice.getAttribute('data-slice-label') || '';
          const pct = slice.getAttribute('data-slice-pct') || '0';
          subText.textContent = `${lbl.slice(0, 14)} (${pct}%)`;
        });
        slice.addEventListener('mouseleave', () => {
          valText.textContent = defaultVal;
          subText.textContent = defaultSub;
        });
      });
    });
  }

  function renderPieCharts(stats) {
    const container = document.getElementById('dashPieChartsGrid');
    if (!container) return;

    const s = stats.byStatus;
    const h = stats.byHealth;
    const t = stats.totals;

    const statusSegments = [
      { label: 'Na Fila', value: s.queued, color: '#eab308' },
      { label: 'Em Progresso', value: s.inProgress, color: '#38bdf8' },
      { label: 'Em Revisão', value: s.review, color: '#f97316' },
      { label: 'Pausados / N2', value: s.pausedWaiting, color: '#a855f7' },
      { label: 'Finalizados', value: s.done, color: '#10b981' }
    ].filter(seg => seg.value > 0);

    const healthSegments = [
      { label: 'No Prazo (Dev)', value: h.onTime, color: '#10b981' },
      { label: 'Em Revisão', value: h.inReview, color: '#f59e0b' },
      { label: 'Devolvidos', value: h.returned, color: '#ec4899' },
      { label: 'Atrasados (Dev)', value: h.overdueDev, color: '#ef4444' }
    ].filter(seg => seg.value > 0);

    const returnedDevs = stats.byDeveloper.filter(d => d.returned > 0).sort((a, b) => b.returned - a.returned);
    const returnedSegments = returnedDevs.map((d, idx) => ({
      label: d.name,
      value: d.returned,
      color: DEV_PALETTE[idx % DEV_PALETTE.length]
    }));

    const typeSegments = stats.byType.map((tp, idx) => ({
      label: tp.name,
      value: tp.count,
      color: tp.color || DEV_PALETTE[idx % DEV_PALETTE.length]
    }));

    container.innerHTML = [
      renderPieCardHtml('Situação dos Chamados', 'Proporção geral por status', statusSegments, t.total, 'chamados'),
      renderPieCardHtml('Saúde dos Ativos', 'Abertos, revisão, devolvidos e atrasos', healthSegments, t.activeTotal, 'ativos'),
      renderPieCardHtml('Devolvidos por Dev', 'Distribuição de retornos por desenvolvedor', returnedSegments, t.returned, 'devolvidos', 'Nenhum chamado devolvido'),
      renderPieCardHtml('Chamados por Tipo', 'Distribuição por categoria da demanda', typeSegments, t.total, 'por tipo')
    ].join('');

    bindPieHoverEffects(container);
  }

  function renderBarCharts(stats) {
    const container = document.getElementById('dashBarChartsGrid');
    if (!container) return;

    const devs = stats.byDeveloper;
    if (!devs || devs.length === 0) {
      container.innerHTML = `
        <div class="dash-chart-card">
          <div class="dash-written-empty">Sem dados de desenvolvedores para exibir nos gráficos de barras.</div>
        </div>
      `;
      return;
    }

    const maxTotal = Math.max(1, ...devs.map(d => d.total));
    const maxRisk = Math.max(1, ...devs.map(d => Math.max(d.returned, d.overdue, d.review, d.openTotal)));

    const volumeRowsHtml = devs.map(d => {
      const openPct = (d.openTotal / maxTotal) * 100;
      const revPct = (d.review / maxTotal) * 100;
      const donePct = (d.done / maxTotal) * 100;
      const tooltip = `${d.name}: ${d.total} total | ${d.openTotal} abertos | ${d.review} em revisão | ${d.done} finalizados`;

      return `
        <div class="dash-hbar-row ${DASH_STATE.developer === d.name ? 'is-selected' : ''}" data-dash-filter-dev="${dashEsc(d.name)}" title="${dashEsc(tooltip)}">
          <div class="dash-hbar-meta">
            <span class="dash-hbar-name">${dashEsc(d.name)}</span>
            <span class="dash-hbar-total">${d.total}</span>
          </div>
          <div class="dash-hbar-track">
            ${d.openTotal > 0 ? `<div class="dash-hbar-seg seg-open" style="width: ${openPct.toFixed(2)}%;" title="Abertos (Fila + Progresso + Paus/N2): ${d.openTotal}"><span>${openPct > 8 ? d.openTotal : ''}</span></div>` : ''}
            ${d.review > 0 ? `<div class="dash-hbar-seg seg-review" style="width: ${revPct.toFixed(2)}%;" title="Em Revisão: ${d.review}"><span>${revPct > 8 ? d.review : ''}</span></div>` : ''}
            ${d.done > 0 ? `<div class="dash-hbar-seg seg-done" style="width: ${donePct.toFixed(2)}%;" title="Finalizados: ${d.done}"><span>${donePct > 8 ? d.done : ''}</span></div>` : ''}
          </div>
          <div class="dash-hbar-nums">
            <span class="num-open" title="Abertos">${d.openTotal} ab</span>
            <span class="num-rev" title="Em Revisão">${d.review} rev</span>
            <span class="num-done" title="Finalizados">${d.done} fin</span>
          </div>
        </div>
      `;
    }).join('');

    const comparisonRowsHtml = devs.map(d => {
      const wOpen = (d.openTotal / maxRisk) * 100;
      const wRev = (d.review / maxRisk) * 100;
      const wRet = (d.returned / maxRisk) * 100;
      const wOver = (d.overdue / maxRisk) * 100;

      return `
        <div class="dash-group-bar-row ${DASH_STATE.developer === d.name ? 'is-selected' : ''}" data-dash-filter-dev="${dashEsc(d.name)}">
          <div class="dash-group-dev-label">
            <span class="dash-dev-avatar-mini">${dashEsc(getDevInitials(d.name))}</span>
            <span class="dash-group-dev-name" title="${dashEsc(d.name)}">${dashEsc(d.name)}</span>
          </div>
          <div class="dash-group-bars">
            <div class="dash-mini-bar-line" title="Em Aberto (Fila + Progresso + Paus/N2): ${d.openTotal}">
              <span class="dash-mini-tag">Abertos</span>
              <div class="dash-mini-track"><div class="dash-mini-fill fill-open" style="width: ${wOpen.toFixed(1)}%;"></div></div>
              <span class="dash-mini-val">${d.openTotal}</span>
            </div>
            <div class="dash-mini-bar-line" title="Em Revisão: ${d.review}">
              <span class="dash-mini-tag">Revisão</span>
              <div class="dash-mini-track"><div class="dash-mini-fill fill-review" style="width: ${wRev.toFixed(1)}%;"></div></div>
              <span class="dash-mini-val">${d.review}</span>
            </div>
            <div class="dash-mini-bar-line" title="Devolvidos para Ajuste: ${d.returned}">
              <span class="dash-mini-tag">Devolvidos</span>
              <div class="dash-mini-track"><div class="dash-mini-fill fill-returned" style="width: ${wRet.toFixed(1)}%;"></div></div>
              <span class="dash-mini-val">${d.returned}</span>
            </div>
            <div class="dash-mini-bar-line" title="Atrasados (com o dev): ${d.overdue}${d.overdueReview > 0 ? ` (+${d.overdueReview} em revisão)` : ''}">
              <span class="dash-mini-tag">Atrasados</span>
              <div class="dash-mini-track"><div class="dash-mini-fill fill-overdue" style="width: ${wOver.toFixed(1)}%;"></div></div>
              <span class="dash-mini-val">${d.overdue}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dash-chart-card dash-bar-card">
        <div class="dash-card-header">
          <div>
            <h3 class="dash-card-title">📊 Chamados por Desenvolvedor (Status Empilhado)</h3>
            <p class="dash-card-subtitle">Clique em um desenvolvedor para filtrar ou comparar abertos, revisão e finalizados</p>
          </div>
          <div class="dash-bar-legend-inline">
            <span><i class="dot-open"></i> Abertos</span>
            <span><i class="dot-review"></i> Revisão</span>
            <span><i class="dot-done"></i> Finalizados</span>
          </div>
        </div>
        <div class="dash-hbar-list">${volumeRowsHtml}</div>
      </div>

      <div class="dash-chart-card dash-bar-card">
        <div class="dash-card-header">
          <div>
            <h3 class="dash-card-title">📉 Abertos, Revisão, Devolvidos e Atrasados por Dev</h3>
            <p class="dash-card-subtitle">Comparativo direto da carga ativa e gargalos por desenvolvedor</p>
          </div>
          <div class="dash-bar-legend-inline">
            <span><i class="dot-open"></i> Abertos</span>
            <span><i class="dot-review"></i> Revisão</span>
            <span><i class="dot-returned"></i> Devolvidos</span>
            <span><i class="dot-overdue"></i> Atrasados</span>
          </div>
        </div>
        <div class="dash-group-bar-list">${comparisonRowsHtml}</div>
      </div>
    `;

    container.querySelectorAll('[data-dash-filter-dev]').forEach(row => {
      row.addEventListener('click', () => {
        const dev = row.getAttribute('data-dash-filter-dev');
        if (!dev) return;
        toggleDashboardDeveloperFilter(dev);
      });
    });
  }

  function renderDevTable(stats) {
    const tbody = document.getElementById('dashDevStatsTableBody');
    if (!tbody) return;

    const devs = [...(stats.byDeveloper || [])];
    if (devs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 28px; color: var(--text-muted);">
            Nenhum desenvolvedor encontrado para os filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    const field = DASH_STATE.sortField || 'total';
    const dir = DASH_STATE.sortDir === 'asc' ? 1 : -1;

    devs.sort((a, b) => {
      if (field === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      const va = Number(a[field] ?? 0);
      const vb = Number(b[field] ?? 0);
      if (va !== vb) return (va - vb) * dir;
      return a.name.localeCompare(b.name);
    });

    // Atualiza indicadores de ordenação nos headers
    document.querySelectorAll('#dashDevStatsTable th[data-dash-sort]').forEach(th => {
      const f = th.getAttribute('data-dash-sort');
      const ind = th.querySelector('.dash-sort-ind');
      if (ind) {
        ind.textContent = f === field ? (DASH_STATE.sortDir === 'asc' ? '▲' : '▼') : '';
      }
      th.classList.toggle('is-sorted', f === field);
    });

    tbody.innerHTML = devs.map(d => {
      const isSelected = DASH_STATE.developer === d.name;
      return `
        <tr class="${isSelected ? 'is-selected' : ''}">
          <td>
            <div class="dash-table-dev-cell">
              <button type="button" class="dash-table-dev-btn" data-dash-table-dev="${dashEsc(d.name)}" title="Filtrar Dashboard para ${dashEsc(d.name)}">
                <span class="dash-dev-avatar-mini">${dashEsc(getDevInitials(d.name))}</span>
                <span>${dashEsc(d.name)}</span>
              </button>
              <button type="button" class="dash-table-open-list-btn" data-dash-goto-list="${dashEsc(d.name)}" title="Ver demandas de ${dashEsc(d.name)} na lista geral">↗</button>
            </div>
          </td>
          <td class="num-cell"><strong>${d.total}</strong></td>
          <td class="num-cell"><span class="dash-val-chip chip-yellow">${d.queued}</span></td>
          <td class="num-cell"><span class="dash-val-chip chip-blue">${d.inProgress}</span></td>
          <td class="num-cell"><span class="dash-val-chip chip-purple">${d.pausedWaiting}</span></td>
          <td class="num-cell"><span class="dash-val-chip chip-amber">${d.review}</span></td>
          <td class="num-cell"><span class="dash-val-chip ${d.returned > 0 ? 'chip-pink' : 'chip-muted'}">${d.returned}</span></td>
          <td class="num-cell">
            <span class="dash-val-chip ${d.overdue > 0 ? 'chip-red' : 'chip-muted'}" title="${d.overdueReview > 0 ? `${d.overdue} atrasados com o dev + ${d.overdueReview} em revisão vencidos` : `${d.overdue} atrasados com o dev`}">
              ${d.overdue}${d.overdueReview > 0 ? ` <small style="opacity:0.75;">(+${d.overdueReview})</small>` : ''}
            </span>
          </td>
          <td class="num-cell"><span class="dash-val-chip chip-emerald">${d.done}</span></td>
          <td class="num-cell">
            <div class="dash-rate-wrap">
              <div class="dash-rate-bar"><div class="dash-rate-fill" style="width: ${d.completionRate}%;"></div></div>
              <span>${d.completionRate}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-dash-table-dev]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dev = btn.getAttribute('data-dash-table-dev');
        if (dev) toggleDashboardDeveloperFilter(dev);
      });
    });

    tbody.querySelectorAll('[data-dash-goto-list]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dev = btn.getAttribute('data-dash-goto-list');
        if (!dev || !window.appStore) return;
        window.appStore.activeFilterId = 'all';
        window.appStore.quickFilters.assignedTo = dev === 'Não atribuído' ? ['__NONE__'] : [dev];
        if (typeof window.updateAllFilterDropdownsUI === 'function') window.updateAllFilterDropdownsUI();
        if (typeof window.renderFixedFiltersList === 'function') window.renderFixedFiltersList();
        if (typeof window.renderDemands === 'function') window.renderDemands();
        window.appTabs?.switchToTab('demands-list');
      });
    });
  }

  function renderTicketListItems(tickets, mode) {
    if (!tickets || tickets.length === 0) {
      const emptyMsgs = {
        returned: 'Nenhum chamado devolvido no filtro atual.',
        overdue: 'Nenhum chamado atrasado no filtro atual.',
        review: 'Nenhum chamado aguardando revisão no filtro atual.'
      };
      return `<div class="dash-list-empty">${emptyMsgs[mode] || 'Nenhum chamado encontrado.'}</div>`;
    }

    return tickets.map(t => {
      const devName = t.assignedTo?.name || 'Não atribuído';
      const revName = t.reviewer?.name || t.reviewerName || (typeof t.reviewer === 'string' ? t.reviewer : '');
      const dueStr = t.deliveryDueDate || t.clientDueDate;
      const daysLate = getDaysOverdue(dueStr);
      const layoutCode = t.layout?.code || t.layoutCode || '';
      const statusLabel = getStatusFriendlyName(t.status);
      const pillClass = getStatusPillClass(t.status);

      let extraMeta = '';
      if (mode === 'returned') {
        const returnRecord = window.appStore?.returnedTickets?.[t.id];
        const reason = returnRecord?.reason ? `Motivo: ${returnRecord.reason}` : (revName ? `Validador: ${revName}` : 'Retornado para ajustes');
        extraMeta = `<span class="dash-ticket-sub-tag tag-pink">${dashEsc(reason)}</span>`;
      } else if (mode === 'overdue') {
        extraMeta = `<span class="dash-ticket-sub-tag tag-red">Prazo: ${dashEsc(formatDueShort(dueStr))}${daysLate > 0 ? ` (${daysLate}d atraso)` : ''}</span>`;
      } else if (mode === 'review') {
        extraMeta = `<span class="dash-ticket-sub-tag tag-amber">${revName ? `Validador: ${dashEsc(revName)}` : 'Sem validador'}${dueStr ? ` · Prazo ${dashEsc(formatDueShort(dueStr))}` : ''}</span>`;
      }
      if (window.appStore?.isIgnored?.(t.id)) {
        extraMeta += `<span class="dash-ticket-sub-tag" style="background: rgba(100,116,139,0.2); color: #94a3b8;">🚫 Ignorado no painel</span>`;
      }

      return `
        <button type="button" class="dash-ticket-row-btn" data-dash-ticket-id="${dashEsc(t.id)}" title="Abrir chamado #${dashEsc(t.number)} em nova aba">
          <div class="dash-ticket-row-top">
            <span class="dash-ticket-num">#${dashEsc(t.number || '-')}</span>
            ${layoutCode ? `<span class="dash-ticket-layout">L.${dashEsc(layoutCode)}</span>` : ''}
            <span class="dash-ticket-status-pill ${pillClass}">${dashEsc(statusLabel)}</span>
            <span class="dash-ticket-dev">👤 ${dashEsc(devName)}</span>
          </div>
          <div class="dash-ticket-row-title">${dashEsc(t.title || 'Sem título')}</div>
          <div class="dash-ticket-row-meta">
            ${extraMeta}
          </div>
        </button>
      `;
    }).join('');
  }

  function renderTicketLists(stats) {
    const returnedEl = document.getElementById('dashReturnedList');
    const overdueEl = document.getElementById('dashOverdueList');
    const reviewEl = document.getElementById('dashReviewList');

    const returnedCountEl = document.getElementById('dashReturnedListCount');
    const overdueCountEl = document.getElementById('dashOverdueListCount');
    const reviewCountEl = document.getElementById('dashReviewListCount');
    const btnToggleOverdueReview = document.getElementById('btnToggleOverdueReview');

    const returnedList = stats.lists.returnedTickets || [];
    const overdueList = DASH_STATE.includeOverdueInReview
      ? [...(stats.lists.overdueTickets || []), ...(stats.lists.overdueReviewTickets || [])]
      : (stats.lists.overdueTickets || []);
    const reviewList = stats.lists.reviewTickets || [];

    if (returnedCountEl) returnedCountEl.textContent = returnedList.length;
    if (overdueCountEl) overdueCountEl.textContent = overdueList.length;
    if (reviewCountEl) reviewCountEl.textContent = reviewList.length;

    if (btnToggleOverdueReview) {
      const extraCount = (stats.lists.overdueReviewTickets || []).length;
      btnToggleOverdueReview.style.display = extraCount > 0 ? 'inline-flex' : 'none';
      btnToggleOverdueReview.classList.toggle('active', DASH_STATE.includeOverdueInReview);
      btnToggleOverdueReview.textContent = DASH_STATE.includeOverdueInReview
        ? `Ocultar Revisão (+${extraCount})`
        : `+ Revisão (${extraCount})`;
    }

    if (returnedEl) returnedEl.innerHTML = renderTicketListItems(returnedList, 'returned');
    if (overdueEl) overdueEl.innerHTML = renderTicketListItems(overdueList, 'overdue');
    if (reviewEl) reviewEl.innerHTML = renderTicketListItems(reviewList, 'review');

    document.querySelectorAll('#dashTicketListsGrid [data-dash-ticket-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticketId = btn.getAttribute('data-dash-ticket-id');
        const ticket = (window.appStore?.demands || []).find(d => String(d.id) === String(ticketId));
        if (ticket) {
          if (window.appTabs) {
            window.appTabs.openTicketTab(ticket, true);
          } else if (typeof window.openDemandDrawer === 'function') {
            window.openDemandDrawer(ticket);
          }
        }
      });
    });
  }

  function toggleDashboardDeveloperFilter(devName) {
    if (DASH_STATE.developer === devName) {
      DASH_STATE.developer = 'all';
    } else {
      DASH_STATE.developer = devName;
    }
    const sel = document.getElementById('dashFilterDev');
    if (sel) sel.value = DASH_STATE.developer;
    renderDashboardWorkspace();
  }

  function renderDashboardWorkspace() {
    if (!window.appStore || typeof window.appStore.getDashboardStats !== 'function') return;

    // Se o cache local ainda tiver apenas a 1ª página (~500 itens recentes sem os antigos),
    // dispara uma sincronização completa em segundo plano para buscar todas as páginas do Importer.
    if (!DASH_STATE.autoFullSyncTriggered && window.conciliadorAPI?.token && typeof window.syncDemands === 'function') {
      const nums = (window.appStore.demands || []).map(d => Number(d?.number)).filter(n => Number.isFinite(n) && n > 0);
      const minCachedNum = nums.length > 0 ? Math.min(...nums) : 0;
      const totalCached = (window.appStore.demands || []).length;
      if (totalCached > 0 && totalCached <= 530 && minCachedNum > 100) {
        DASH_STATE.autoFullSyncTriggered = true;
        Promise.resolve(window.syncDemands()).catch(() => {});
      }
    }

    populateFilterDropdowns();

    const stats = window.appStore.getDashboardStats({
      period: DASH_STATE.period,
      developer: DASH_STATE.developer,
      product: DASH_STATE.product,
      type: DASH_STATE.type,
      search: DASH_STATE.search,
      excludeIgnored: DASH_STATE.excludeIgnored
    });

    const syncInfoEl = document.getElementById('dashLastSyncInfo');
    if (syncInfoEl) {
      const lastSync = window.appStore.lastSync
        ? new Date(window.appStore.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Agora';
      const activeFiltersCount = [
        DASH_STATE.period !== 'all',
        DASH_STATE.developer !== 'all',
        DASH_STATE.product !== 'all',
        DASH_STATE.type !== 'all',
        Boolean(DASH_STATE.search.trim())
      ].filter(Boolean).length;
      const rangeText = (stats.totals.minNumber && stats.totals.maxNumber)
        ? ` (#${stats.totals.minNumber} ao #${stats.totals.maxNumber})`
        : '';
      const ignoredNote = stats.totals.ignoredCount > 0
        ? (DASH_STATE.excludeIgnored
          ? ` · ${stats.totals.ignoredCount} ignorado(s) oculto(s)`
          : ` · inclui ${stats.totals.ignoredCount} ignorado(s) do painel`)
        : '';
      syncInfoEl.textContent = `Dados direto do Importer Ultra: ${stats.totals.total} chamados${rangeText} · Atualizado às ${lastSync}${ignoredNote}${activeFiltersCount > 0 ? ` · ${activeFiltersCount} filtro(s) ativo(s)` : ''}`;
    }

    const btnToggleIgnored = document.getElementById('btnDashToggleIgnored');
    if (btnToggleIgnored) {
      const ignCount = stats.totals.ignoredCount || 0;
      if (ignCount > 0 || DASH_STATE.excludeIgnored) {
        btnToggleIgnored.style.display = 'inline-flex';
        btnToggleIgnored.classList.toggle('is-excluding', DASH_STATE.excludeIgnored);
        btnToggleIgnored.innerHTML = DASH_STATE.excludeIgnored
          ? `<span>🚫</span> Ignorados: Ocultos (${ignCount})`
          : `<span>👁️</span> Ignorados: Incluídos (${ignCount})`;
      } else {
        btnToggleIgnored.style.display = 'none';
      }
    }

    const btnClear = document.getElementById('btnDashClearFilters');
    if (btnClear) {
      const hasFilters = DASH_STATE.period !== 'all' || DASH_STATE.developer !== 'all' || DASH_STATE.product !== 'all' || DASH_STATE.type !== 'all' || Boolean(DASH_STATE.search.trim());
      btnClear.style.display = hasFilters ? 'inline-flex' : 'none';
    }

    renderKpis(stats);
    renderWrittenSummary(stats);
    renderPieCharts(stats);
    renderBarCharts(stats);
    renderDevTable(stats);
    renderTicketLists(stats);
  }

  function initDashboardEvents() {
    if (DASH_STATE.initialized) return;
    DASH_STATE.initialized = true;

    document.getElementById('btnDashboardBackToList')?.addEventListener('click', () => {
      window.appTabs?.switchToTab('demands-list');
    });

    document.getElementById('btnCloseDashboardTab')?.addEventListener('click', () => {
      window.appTabs?.closeTab('dashboard');
    });

    document.getElementById('btnDashboardSync')?.addEventListener('click', () => {
      if (typeof window.syncDemands === 'function') {
        window.syncDemands();
      } else {
        renderDashboardWorkspace();
      }
    });

    document.getElementById('dashFilterPeriod')?.addEventListener('change', (e) => {
      DASH_STATE.period = e.target.value || 'all';
      renderDashboardWorkspace();
    });

    document.getElementById('dashFilterDev')?.addEventListener('change', (e) => {
      DASH_STATE.developer = e.target.value || 'all';
      renderDashboardWorkspace();
    });

    document.getElementById('dashFilterProduct')?.addEventListener('change', (e) => {
      DASH_STATE.product = e.target.value || 'all';
      renderDashboardWorkspace();
    });

    document.getElementById('dashFilterType')?.addEventListener('change', (e) => {
      DASH_STATE.type = e.target.value || 'all';
      renderDashboardWorkspace();
    });

    document.getElementById('dashSearchInput')?.addEventListener('input', (e) => {
      DASH_STATE.search = e.target.value || '';
      renderDashboardWorkspace();
    });

    document.getElementById('btnDashClearFilters')?.addEventListener('click', () => {
      DASH_STATE.period = 'all';
      DASH_STATE.developer = 'all';
      DASH_STATE.product = 'all';
      DASH_STATE.type = 'all';
      DASH_STATE.search = '';
      const pEl = document.getElementById('dashFilterPeriod');
      const dEl = document.getElementById('dashFilterDev');
      const prEl = document.getElementById('dashFilterProduct');
      const tEl = document.getElementById('dashFilterType');
      const sEl = document.getElementById('dashSearchInput');
      if (pEl) pEl.value = 'all';
      if (dEl) dEl.value = 'all';
      if (prEl) prEl.value = 'all';
      if (tEl) tEl.value = 'all';
      if (sEl) sEl.value = '';
      renderDashboardWorkspace();
    });

    document.getElementById('btnToggleOverdueReview')?.addEventListener('click', () => {
      DASH_STATE.includeOverdueInReview = !DASH_STATE.includeOverdueInReview;
      renderDashboardWorkspace();
    });

    document.getElementById('btnDashToggleIgnored')?.addEventListener('click', () => {
      DASH_STATE.excludeIgnored = !DASH_STATE.excludeIgnored;
      renderDashboardWorkspace();
    });

    document.getElementById('btnCopyDashWrittenReport')?.addEventListener('click', async () => {
      if (!window.appStore?.getDashboardStats) return;
      const stats = window.appStore.getDashboardStats({
        period: DASH_STATE.period,
        developer: DASH_STATE.developer,
        product: DASH_STATE.product,
        type: DASH_STATE.type,
        search: DASH_STATE.search,
        excludeIgnored: DASH_STATE.excludeIgnored
      });
      const text = buildWrittenReportText(stats);
      try {
        await navigator.clipboard.writeText(text);
        if (typeof window.showToast === 'function') {
          window.showToast('📋 Relatório escrito copiado para a área de transferência!', 'success');
        }
      } catch (e) {
        console.warn('Erro ao copiar relatório:', e);
      }
    });

    document.querySelectorAll('#dashDevStatsTable th[data-dash-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-dash-sort');
        if (!field) return;
        if (DASH_STATE.sortField === field) {
          DASH_STATE.sortDir = DASH_STATE.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          DASH_STATE.sortField = field;
          DASH_STATE.sortDir = field === 'name' ? 'asc' : 'desc';
        }
        renderDashboardWorkspace();
      });
    });
  }

  window.renderDashboardWorkspace = renderDashboardWorkspace;
  window.initDashboardEvents = initDashboardEvents;
  window.buildDashboardWrittenReportText = buildWrittenReportText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardEvents);
  } else {
    initDashboardEvents();
  }
})();
