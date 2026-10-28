(function () {
  'use strict';

  const F = window.FIN;
  const E = F.Engine;
  const TRACKS = ['wealth', 'quant', 'side'];
  const CLOUD_SAVED_AT = 'leek_finance_rpg_v1_saved_at';
  const STAGE_META = [
    { key: 'brief', label: '情报', icon: '📰' },
    { key: 'quiz', label: '小测', icon: '✏️' },
    { key: 'case', label: '副本', icon: '🎭' },
    { key: 'trade', label: '调仓', icon: '🥧' },
    { key: 'settle', label: '结算', icon: '🏆' }
  ];

  let state = E.load();
  let view = 'today';
  let ui = {
    onboarding: { step: 'welcome', index: 0, answers: [], riskAnswers: [], queue: [], selected: null, result: null },
    feedback: null,
    hint: null,
    tradeTarget: null,
    tradeDate: null,
    modal: null,
    codexFilter: 'all',
    skillTab: 'wealth',
    practice: null,
    boss: null,
    code: null,
    bonus: null,
    justSettled: false
  };

  /* ============================================================
     helpers
     ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function termCard(id) {
    return conceptById(id) || (F.termCards && F.termCards[id]) || null;
  }
  function resolveTerm(term) {
    const alias = F.termAliases && F.termAliases[term];
    if (alias) return termCard(alias);
    return (F.termCards && F.termCards[term]) || null;
  }
  let termRegex = null;
  function annotateTerms(text) {
    const aliases = F.termAliases || {};
    const terms = Object.keys(aliases).sort((a, b) => b.length - a.length);
    if (!terms.length) return esc(text);
    if (!termRegex) termRegex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g');
    return esc(text).replace(termRegex, match => {
      const card = resolveTerm(match);
      if (!card) return match;
      return `<span class="term-link" data-action="term" data-term="${esc(match)}" data-card="${esc(card.id)}" title="看名词卡：${esc(card.title)}">${match}<span class="term-mark">i</span></span>`;
    });
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function fmtMoney(n) { return '¥' + Math.round(Number(n) || 0).toLocaleString('zh-CN'); }
  function fmtPct(n) { const v = (Number(n) || 0) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
  function fmtPctPlain(n) { return `${((Number(n) || 0) * 100).toFixed(1)}%`; }
  function fmtDate(key) {
    if (!key) return '';
    const d = new Date(key + 'T12:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function weekdayCN(key) {
    const d = key ? new Date(key + 'T12:00:00') : new Date();
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  }
  function todayLabel() { return `${fmtDate(E.todayKey())} · ${weekdayCN(E.todayKey())}`; }
  function trackMeta(t) { return F.trackMeta[t] || F.trackMeta.wealth; }
  function trackLevel(theta) { return clamp(Math.round(1 + ((theta + 1.5) / 3) * 4), 1, 5); }
  function conceptById(id) { return F.concepts.find(c => c.id === id); }
  function questionById(id) { return F.questions.find(q => q.id === id); }
  function caseById(id) { return F.cases.find(c => c.id === id); }
  function nodeById(id) { return F.nodes.find(n => n.id === id); }
  function currentNodeFor(track) {
    const nodes = F.nodes.filter(n => n.track === track);
    return nodes.find(n => E.nodeStatus(state, n) !== 'mastered') || nodes[nodes.length - 1];
  }
  function qualityLabel(q) { return q === 'good' ? '优质决策' : q === 'ok' ? '可接受' : '高风险决策'; }
  function qualityClass(q) { return q === 'good' ? 'good' : q === 'ok' ? 'ok' : 'bad'; }
  function qualityIcon(q) { return q === 'good' ? '✅' : q === 'ok' ? '🟡' : '⚠️'; }
  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function persist() {
    E.save(state);
    try { localStorage.setItem(CLOUD_SAVED_AT, String(Date.now())); } catch (e) { /* ignore */ }
    if (window.LeekCloudSave) window.LeekCloudSave.queue(state);
  }
  function cloudSaveText() {
    if (!window.LeekCloudSave) return '云存档脚本未加载，仅本地存档';
    return window.LeekCloudSave.statusText();
  }
  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    el.style.transition = 'opacity .22s ease, transform .22s ease';
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => el.remove(), 2900);
  }
  function celebrate() {
    if (state.settings.reduceMotion) return;
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    const colors = ['#b8ff4a', '#64e7ff', '#ffb84d', '#ff6b9d', '#f4efe2'];
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('span');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.transform = `rotate(${Math.random() * 180}deg)`;
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3200);
  }

  /* ============================================================
     mascot
     ============================================================ */
  function moodFor() {
    if (state.daily && state.daily.stage === 'done') return 'happy';
    const r = state.portfolio.lastReturn || 0;
    if (r > 0.012) return 'happy';
    if (r < -0.012) return 'worried';
    if ((state.player.streak || 0) >= 3) return 'happy';
    return 'neutral';
  }

  function mascotSVG(stage, mood, cosmetics) {
    stage = stage || 1;
    mood = mood || 'neutral';
    cosmetics = cosmetics || [];
    const cape = stage >= 7 || cosmetics.includes('cape');
    const shades = cosmetics.includes('shades');
    const mouth = mood === 'happy'
      ? '<path d="M91 135 Q100 145 109 135" fill="none" stroke="#101a0f" stroke-width="2.8" stroke-linecap="round"/>'
      : mood === 'worried'
        ? '<path d="M92 141 Q100 132 108 141" fill="none" stroke="#101a0f" stroke-width="2.8" stroke-linecap="round"/>'
        : '<path d="M93 137 L107 137" fill="none" stroke="#101a0f" stroke-width="2.8" stroke-linecap="round"/>';
    const brows = mood === 'worried'
      ? '<path d="M81 107 L92 111" stroke="#101a0f" stroke-width="2.2" stroke-linecap="round"/><path d="M119 107 L108 111" stroke="#101a0f" stroke-width="2.2" stroke-linecap="round"/>'
      : '';
    const eyes = shades
      ? '<g><path d="M77 115 Q84 109 93 115 L93 122 Q84 128 77 122 Z" fill="#080b09" stroke="#26382c" stroke-width="2"/><path d="M107 115 Q116 109 123 115 L123 122 Q116 128 107 122 Z" fill="#080b09" stroke="#26382c" stroke-width="2"/><path d="M93 118 L107 118" stroke="#26382c" stroke-width="2.4"/></g>'
      : '<g><ellipse cx="88" cy="118" rx="4.8" ry="5.6" fill="#101a0f"/><ellipse cx="112" cy="118" rx="4.8" ry="5.6" fill="#101a0f"/><circle cx="89.4" cy="116" r="1.5" fill="#fff"/><circle cx="113.4" cy="116" r="1.5" fill="#fff"/></g>';
    const glasses = stage >= 4 && !shades
      ? '<g fill="none" stroke="#bfe8ff" stroke-width="1.8" opacity=".9"><circle cx="88" cy="118" r="9.5"/><circle cx="112" cy="118" r="9.5"/><path d="M97.5 118 L102.5 118"/></g>'
      : '';
    const headband = stage >= 3
      ? '<path d="M77 93 Q100 84 123 93" fill="none" stroke="#b87333" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="88" r="3.5" fill="#ffd45e" stroke="#8a6415" stroke-width="1.4"/>'
      : '';
    const chain = stage >= 5
      ? '<path d="M84 150 Q100 161 116 150" fill="none" stroke="#ffd45e" stroke-width="2.5"/><circle cx="100" cy="157" r="4" fill="#ffd45e" stroke="#8a6415" stroke-width="1.2"/>'
      : '';
    const sprout = stage >= 2
      ? '<path d="M100 68 Q96 56 87 52" fill="none" stroke="#5cab25" stroke-width="3" stroke-linecap="round"/><path d="M88 52 Q82 45 84 40 Q91 42 94 49 Z" fill="#8fd62e" stroke="#101a0f" stroke-width="1.5"/>'
      : '';
    const laptop = stage >= 6
      ? '<g transform="translate(62 142) rotate(-3)"><rect x="0" y="0" width="76" height="44" rx="5" fill="#111c15" stroke="#64e7ff" stroke-width="2"/><rect x="8" y="8" width="42" height="3.4" rx="1.7" fill="#b8ff4a"/><rect x="8" y="15.5" width="30" height="3.4" rx="1.7" fill="#64e7ff"/><rect x="8" y="23" width="50" height="3.4" rx="1.7" fill="#8fa394"/><rect x="8" y="30.5" width="22" height="3.4" rx="1.7" fill="#ffb84d"/></g><path d="M74 124 Q62 136 66 146" fill="none" stroke="#101a0f" stroke-width="3.5" stroke-linecap="round"/><path d="M126 124 Q138 136 134 146" fill="none" stroke="#101a0f" stroke-width="3.5" stroke-linecap="round"/>'
      : '<path d="M74 124 Q61 130 59 142" fill="none" stroke="#101a0f" stroke-width="3.5" stroke-linecap="round"/><path d="M126 124 Q139 130 141 142" fill="none" stroke="#101a0f" stroke-width="3.5" stroke-linecap="round"/>';
    const crown = stage >= 8
      ? '<path d="M83 54 L89 34 L100 45 L111 34 L117 54 Z" fill="#ffd45e" stroke="#8a6415" stroke-width="2"/><circle cx="100" cy="43" r="2.6" fill="#ff6b9d"/>'
      : '';
    const aura = stage >= 8
      ? '<circle cx="100" cy="104" r="82" fill="none" stroke="#ffd45e" stroke-width="1.3" stroke-dasharray="4 9" opacity=".45"/>'
      : '';

    return `<svg class="mascot" viewBox="0 0 200 210" role="img" aria-label="韭菜精灵韭韭">
      ${aura}
      <ellipse cx="100" cy="196" rx="54" ry="8" fill="rgba(0,0,0,.38)"/>
      ${cape ? '<path d="M72 98 Q38 140 55 184 L100 166 L145 184 Q162 140 128 98 Z" fill="#ff6b9d" opacity=".85" stroke="#101a0f" stroke-width="2.5"/>' : ''}
      <g stroke="#0e1a0b" stroke-width="2.3" stroke-linejoin="round">
        <path d="M96 80 C84 52 62 42 48 49 C58 70 75 83 95 87 Z" fill="#4f8f22"/>
        <path d="M101 78 C96 42 102 22 111 13 C124 32 120 61 108 84 Z" fill="#72c92e"/>
        <path d="M105 82 C119 52 141 44 154 52 C146 73 127 86 108 89 Z" fill="#5cab25"/>
      </g>
      <path d="M100 79 C98 60 100 44 102 32" stroke="#a8f05a" stroke-width="2" fill="none" opacity=".65"/>
      ${sprout}
      <path d="M77 78 Q100 66 123 78 L129 158 Q100 178 71 158 Z" fill="#f4efe2" stroke="#101a0f" stroke-width="3"/>
      <path d="M84 86 Q100 78 116 86" stroke="#d9d0bd" stroke-width="2" fill="none"/>
      <circle cx="80" cy="130" r="5.5" fill="#ff9db9" opacity=".4"/>
      <circle cx="120" cy="130" r="5.5" fill="#ff9db9" opacity=".4"/>
      ${brows}${eyes}${mouth}${glasses}${headband}${chain}${laptop}
      ${crown}
      <path d="M82 160 Q100 170 118 160" stroke="#d9d0bd" stroke-width="1.6" fill="none" opacity=".7"/>
    </svg>`;
  }

  function playerSpeech() {
    const d = state.daily;
    if (!d) return '今天还没开始。先看情报，再答题。';
    if (d.stage === 'done') return '今天通关了。明天继续，别把连胜断了。';
    if (d.stage === 'brief') return '先看懂事件，再答题。别急着下单。';
    if (d.stage === 'quiz') return '不确定时，选你真正理解的那个，而不是看起来最爽的。';
    if (d.stage === 'case') return '副本里没有标准答案，只有后果。';
    if (d.stage === 'trade') return '调仓前先问：这笔钱多久不用？亏 20% 会影响生活吗？';
    if ((state.portfolio.maxDrawdown || 0) > 0.1) return '回撤有点深。先检查应急金，别在恐慌里操作。';
    return '每天 10 分钟，比周末补 2 小时更有效。';
  }

  /* ============================================================
     charts / donut
     ============================================================ */
  function normalizeAlloc(alloc) {
    const order = ['cash', 'bond', 'hs300', 'gold', 'tech'];
    const total = sum(order.map(a => Math.max(0, Number(alloc[a]) || 0)));
    const out = {};
    order.forEach(a => { out[a] = total > 0 ? Math.max(0, Number(alloc[a]) || 0) / total * 100 : 0; });
    return out;
  }
  function donutGradient(alloc) {
    const order = ['cash', 'bond', 'hs300', 'gold', 'tech'];
    const a = normalizeAlloc(alloc);
    let acc = 0;
    const parts = [];
    order.forEach(k => {
      const v = a[k];
      if (v <= 0.01) return;
      parts.push(`${F.assets[k].color} ${acc.toFixed(2)}% ${(acc + v).toFixed(2)}%`);
      acc += v;
    });
    return `conic-gradient(${parts.length ? parts.join(',') : '#26382c 0% 100%'})`;
  }
  function donutHTML(alloc, centerMain, centerSub) {
    return `<div class="donut" style="background:${donutGradient(alloc)}"><div class="donut-center"><strong>${esc(centerMain)}</strong><span>${esc(centerSub || '')}</span></div></div>`;
  }

  function sparkline(history) {
    const vals = (history || []).map(h => h.value);
    if (!vals.length) return '';
    if (vals.length === 1) vals.push(vals[0]);
    const w = 240, h = 54, p = 4;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const x = i => p + i * (w - p * 2) / (vals.length - 1);
    const y = v => h - p - ((v - min) / span) * (h - p * 2);
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#b8ff4a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="#b8ff4a"/></svg>`;
  }

  function lineChart(history) {
    const hist = (history || []).slice();
    if (hist.length < 3) {
      return `<div class="chart-empty"><div class="big">📈</div><div>${hist.length <= 1 ? '完成今日调仓后，这里会开始记录净值。' : '再完成 1 个交易日，就能看到像样的曲线。'}</div><div class="muted">至少 3 个交易日的数据，才能看出波动。</div></div>`;
    }
    const w = 700, h = 230, pL = 46, pR = 14, pT = 14, pB = 24;
    const all = hist.flatMap(x => [x.value, x.benchmark]);
    let min = Math.min(...all), max = Math.max(...all);
    if (max - min < 1) { max += 1; min -= 1; }
    const pad = (max - min) * 0.12;
    min -= pad; max += pad;
    const x = i => pL + i * (w - pL - pR) / (hist.length - 1);
    const y = v => pT + (1 - (v - min) / (max - min)) * (h - pT - pB);
    const path = key => hist.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h[key]).toFixed(1)}`).join(' ');
    const area = `${path('value')} L${x(hist.length - 1).toFixed(1)},${(h - pB).toFixed(1)} L${x(0).toFixed(1)},${(h - pB).toFixed(1)} Z`;
    const grid = [0, 1, 2, 3].map(i => {
      const yy = pT + i * (h - pT - pB) / 3;
      const val = max - (max - min) * i / 3;
      const label = (max - min) > 20 ? Math.round(val).toLocaleString('zh-CN') : val.toFixed(1);
      return `<line x1="${pL}" y1="${yy.toFixed(1)}" x2="${w - pR}" y2="${yy.toFixed(1)}" class="chart-grid"/><text x="${pL - 7}" y="${(yy + 3).toFixed(1)}" text-anchor="end" class="chart-label">${label}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="组合净值曲线">
      <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8ff4a" stop-opacity=".22"/><stop offset="100%" stop-color="#b8ff4a" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <path d="${area}" class="chart-area"/>
      <path d="${path('benchmark')}" class="chart-line bench"/>
      <path d="${path('value')}" class="chart-line"/>
      <circle cx="${x(hist.length - 1).toFixed(1)}" cy="${y(hist[hist.length - 1].value).toFixed(1)}" r="3.5" fill="#b8ff4a" stroke="#071006" stroke-width="1.5"/>
    </svg>`;
  }

  /* ============================================================
     render root
     ============================================================ */
  function render() {
    document.body.classList.toggle('reduce-motion', !!state.settings.reduceMotion);
    if (!state.player.onboarded || ui.onboarding.step === 'result') {
      renderOnboarding();
    } else {
      renderShell();
    }
    renderModal();
  }

  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `<div class="shell">
      ${renderSidebar()}
      <main class="main">
        ${renderMobileTop()}
        ${renderView()}
      </main>
      ${renderMobileNav()}
    </div>`;
  }

  function renderSidebar() {
    const lvl = E.getLevelInfo(state);
    const nav = [
      ['today', '🗓️', '今日副本', !isTodayDone() ? '10 min' : '✓'],
      ['skills', '🌳', '技能树', ''],
      ['portfolio', '📈', '模拟盘', ''],
      ['codex', '📖', '图鉴', ''],
      ['review', '🧾', '复盘', ''],
      ['online', '🌐', '联机', 'NEW']
    ];
    return `<aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">韭</div>
        <div><div class="brand-name">韭菜进化论</div><div class="brand-sub">10 MIN FINANCE RPG</div></div>
      </div>
      <div class="mascot-card">
        <div class="mascot-wrap">${mascotSVG(lvl.title.mascot, moodFor(), state.player.activeCosmetics)}</div>
        <div class="mascot-speech">${esc(playerSpeech())}</div>
        <div class="player-line"><span class="player-title">${esc(state.player.title)}</span><span class="player-level">Lv.${lvl.level}</span></div>
        <div class="xp-track"><span class="xp-fill" style="width:${Math.round(lvl.progress * 100)}%"></span></div>
        <div class="xp-meta"><span>${lvl.xpInLevel}/${lvl.xpForNext} XP</span><span>🔥 ${state.player.streak} 天</span></div>
      </div>
      <nav class="nav">
        ${nav.map(([v, icon, label, badge]) => `<button class="nav-item ${view === v ? 'active' : ''}" ${v === 'online' ? 'data-action="open-online"' : `data-action="nav" data-view="${v}"`}><span class="nav-icon">${icon}</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="sidebar-stats">
        <div class="mini-stat"><div class="mini-stat-label">叶币</div><div class="mini-stat-value amber">🪙 ${state.player.coins}</div></div>
        <div class="mini-stat"><div class="mini-stat-label">连胜</div><div class="mini-stat-value">🔥 ${state.player.streak}</div></div>
      </div>
      <div class="sidebar-footer">
        <button class="btn btn-sm" data-action="shop-open">🛒 商店</button>
        <button class="btn btn-sm" data-action="settings-open">⚙️ 设置</button>
      </div>
      <div style="font-size:9px;color:var(--muted-2);line-height:1.5">模拟盘与内容仅用于学习，不构成投资建议。</div>
    </aside>`;
  }

  function renderMobileTop() {
    const lvl = E.getLevelInfo(state);
    return `<div class="mobile-top">
      <div class="brand"><div class="brand-mark">韭</div><div><div class="brand-name">韭菜进化论</div></div></div>
      <div class="mobile-stats">
        <span class="mstat">🔥 ${state.player.streak}</span>
        <span class="mstat">🪙 ${state.player.coins}</span>
        <span class="mstat">Lv.${lvl.level}</span>
      </div>
    </div>`;
  }

  function renderMobileNav() {
    const items = [['today', '🗓️', '今日'], ['skills', '🌳', '技能'], ['portfolio', '📈', '模拟'], ['codex', '📖', '图鉴'], ['review', '🧾', '复盘'], ['online', '🌐', '联机']];
    return `<nav class="mobile-nav">${items.map(([v, i, l]) => `<button class="mnav-item ${view === v ? 'active' : ''}" ${v === 'online' ? 'data-action="open-online"' : `data-action="nav" data-view="${v}"`}><span class="i">${i}</span><span>${l}</span></button>`).join('')}</nav>`;
  }

  function renderView() {
    switch (view) {
      case 'skills': return renderSkills();
      case 'portfolio': return renderPortfolio();
      case 'codex': return renderCodex();
      case 'review': return renderReview();
      default: return renderToday();
    }
  }

  function isTodayDone() {
    return !!(state.daily && state.daily.date === E.todayKey() && state.daily.stage === 'done');
  }

  /* ============================================================
     today
     ============================================================ */
  function renderToday() {
    const d = E.ensureDaily(state);
    if (!state.player.onboarded) return '';
    persist();

    if (ui.tradeDate !== d.date) {
      ui.tradeDate = d.date;
      ui.tradeTarget = null;
    }

    const p = E.getDailyProgress(state);
    const pct = Math.round(p.pct * 100);
    const stageContent = ui.feedback ? renderQuizFeedback() : renderStage(d);

    return `
      ${renderHero(d, pct)}
      <div class="mt-14">${renderStepper(d)}</div>
      <div id="quest-anchor">${stageContent}</div>
      <div class="mt-20">${renderTrackCards()}</div>
      <div class="mt-14">${renderPortfolioSnapshot()}</div>
      <div class="mt-14">${renderCodeBanner()}</div>
      <div class="mt-14">${renderBonusCard()}</div>
    `;
  }

  function renderHero(d, pct) {
    if (d.stage !== 'brief' && d.stage !== 'done') return renderCompactHero(d, pct);
    const done = d.stage === 'done';
    const cta = done ? '去看看技能树' : d.stage === 'brief' ? '查看今日情报' : '继续今日副本';
    const lvl = E.getLevelInfo(state);
    const r = 56, c = 2 * Math.PI * r;
    const offset = c * (1 - pct / 100);
    return `<section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">DAY ${String(state.stats.daysCompleted + (done ? 0 : 1)).padStart(2, '0')} · ${todayLabel()}</div>
        <h1>${done ? '今天通关了，' : greeting() + '，'}<em>${esc(state.player.name)}</em>。</h1>
        <p class="hero-desc">${done ? '今日副本已完成。明天继续，别把连胜断了。' : '每天 10 分钟：看一条情报、答 4 道题、做一个决策、调一次仓。把“理财直觉”练成肌肉记忆。'}</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="hero-cta">${cta} →</button>
          <span class="hero-note">${done ? `🔥 ${state.player.streak} 天连胜` : '预计 10 分钟 · 无真钱风险'}</span>
        </div>
      </div>
      <div class="hero-side">
        ${mascotSVG(lvl.title.mascot, moodFor(), state.player.activeCosmetics)}
        <div class="progress-ring">
          <svg viewBox="0 0 132 132"><circle class="ring-bg" cx="66" cy="66" r="${r}"/><circle class="ring-fg" cx="66" cy="66" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/></svg>
          <div class="ring-center"><div class="ring-value">${pct}%</div><div class="ring-cap">TODAY</div></div>
        </div>
        <div class="ring-label">${done ? '已完成' : '今日进度'}</div>
      </div>
    </section>`;
  }

  function renderCompactHero(d, pct) {
    const map = {
      quiz: ['小测进行中', `第 ${Math.min(d.answers.length + 1, 3)} / ${d.plan.questionIds.length} 题 · 答错会进复习队列`],
      case: ['剧情副本', '做选择，承担后果，再看复盘'],
      trade: ['模拟盘调仓', '用 1 万元，决定股 / 债 / 金 / 现金的比例'],
      settle: ['今日结算', '看看市场今天怎么走，再领奖励']
    };
    const item = map[d.stage] || ['今日副本', '保持 10 分钟'];
    const lvl = E.getLevelInfo(state);
    const r = 56, c = 2 * Math.PI * r;
    const offset = c * (1 - pct / 100);
    return `<section class="hero compact">
      <div class="hero-copy">
        <div class="eyebrow">DAY ${String(state.stats.daysCompleted + 1).padStart(2, '0')} · ${fmtDate(E.todayKey())}</div>
        <h1>${item[0]}</h1>
        <p class="hero-desc">${item[1]}</p>
      </div>
      <div class="compact-side">
        ${mascotSVG(lvl.title.mascot, moodFor(), state.player.activeCosmetics)}
        <div class="progress-ring small">
          <svg viewBox="0 0 132 132"><circle class="ring-bg" cx="66" cy="66" r="${r}"/><circle class="ring-fg" cx="66" cy="66" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/></svg>
          <div class="ring-center"><div class="ring-value">${pct}%</div><div class="ring-cap">TODAY</div></div>
        </div>
      </div>
    </section>`;
  }

  function renderStepper(d) {
    const idx = STAGE_META.findIndex(s => s.key === d.stage);
    return `<div class="stepper">${STAGE_META.map((s, i) => {
      const done = d.stage === 'done' || i < idx;
      const active = i === idx && d.stage !== 'done';
      return `<div class="step ${done ? 'done' : ''} ${active ? 'active' : ''}"><span class="step-dot">${done ? '✓' : s.icon}</span><span>${s.label}</span></div>${i < STAGE_META.length - 1 ? '<span class="step-line"></span>' : ''}`;
    }).join('')}</div>`;
  }

  function renderStage(d) {
    switch (d.stage) {
      case 'brief': return renderBrief(d);
      case 'quiz': return renderQuiz(d);
      case 'case': return renderCase(d);
      case 'trade': return renderTrade(d);
      case 'settle': return renderSettle(d);
      case 'done': return renderDone(d);
      default: return renderBrief(d);
    }
  }

  function renderBrief(d) {
    const ev = F.events.find(e => e.id === d.plan.eventId) || F.events[0];
    const c = caseById(d.plan.caseId);
    const qs = d.plan.questionIds.map(questionById).filter(Boolean);
    return `<div class="brief-grid mt-14">
      <div class="card event-card pad-lg">
        <div class="event-tag">今日情报 · ${esc(ev.tag)}</div>
        <h2 class="event-title">${esc(ev.title)}</h2>
        <p class="event-body">${annotateTerms(ev.body)}</p>
        <div class="event-takeaway"><strong>人话解读：</strong>${annotateTerms(ev.takeaway)}</div>
        <div class="feedback-actions"><button class="btn btn-primary" data-action="start-quiz">开始小测 →</button><span class="hero-note">4 道题 · 约 2.5 分钟</span></div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">今日路线</div><div class="card-sub">${esc(d.plan.reason)}</div></div><span class="chip green">${d.plan.focus === 'mixed' ? '混合复习' : esc(trackMeta(d.plan.focus).name)}</span></div>
        <div class="route-list">
          <div class="route-item"><div class="route-num">01</div><div class="route-body"><div class="route-title">情报：${esc(ev.title)}</div><div class="route-sub">先理解事件，再做题。</div></div></div>
          <div class="route-item"><div class="route-num">02</div><div class="route-body"><div class="route-title">小测：${qs.map(q => esc(conceptById(q.concept)?.title || '')).join(' · ')}</div><div class="route-sub">难度会跟着你的正确率调整。</div></div></div>
          <div class="route-item"><div class="route-num">03</div><div class="route-body"><div class="route-title">副本：${esc(c ? c.title : '今日决策')}</div><div class="route-sub">做选择，承担后果，再复盘。</div></div></div>
          <div class="route-item"><div class="route-num">04</div><div class="route-body"><div class="route-title">模拟盘：用 1 万元做一次配置</div><div class="route-sub">行情是模拟的，风险是真的。</div></div></div>
        </div>
      </div>
    </div>`;
  }

  function renderQuiz(d) {
    const qid = d.plan.questionIds[d.answers.length];
    if (!qid) return renderCase(d);
    const q = questionById(qid);
    if (!q) return renderCase(d);
    const c = conceptById(q.concept);
    const hidden = ui.hint && ui.hint.qid === q.id ? ui.hint.hide : -1;
    return `<div class="quest-card card">
      <div class="quest-top">
        <div><div class="q-count">小测 ${d.answers.length + 1} / ${d.plan.questionIds.length}</div><div class="q-concept">${esc(c ? c.title : '')} · ${esc(trackMeta(q.track).name)}</div></div>
        <div class="quest-tools">
          <span class="difficulty-dots">${'●'.repeat(q.difficulty)}${'○'.repeat(5 - q.difficulty)}</span>
          <button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button>
          <button class="btn btn-sm btn-ghost" data-action="hint" data-qid="${q.id}" ${state.player.hints <= 0 ? 'disabled' : ''}>💡 提示 x${state.player.hints}</button>
        </div>
      </div>
      <div class="q-stem">${annotateTerms(q.stem)}</div>
      <div class="options">
        ${q.options.map((opt, i) => `<button class="option ${hidden === i ? 'dim' : ''}" data-action="answer" data-qid="${q.id}" data-choice="${i}" ${hidden === i ? 'disabled' : ''}><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`).join('')}
      </div>
      <div class="diag-note">答错不扣叶币；点带 <span class="term-mark">i</span> 的词可看名词卡；错题会进入 1/3/7 天复习队列。</div>
    </div>`;
  }

  function renderQuizFeedback() {
    const fb = ui.feedback;
    const q = questionById(fb.qid);
    const d = state.daily;
    if (!q) return '';
    return `<div class="quest-card card">
      <div class="quest-top"><div><div class="q-count">${fb.correct ? '答对了' : '答错了'} · ${esc(trackMeta(q.track).name)}</div><div class="q-concept">${esc(conceptById(q.concept)?.title || '')}</div></div><span class="chip ${fb.correct ? 'green' : 'red'}">${fb.correct ? '+25 XP' : '+10 XP'}</span></div>
      <div class="q-stem">${annotateTerms(q.stem)}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          let cls = 'dim';
          if (i === q.answer) cls = 'correct';
          else if (i === fb.choice) cls = 'wrong';
          return `<button class="option ${cls}" disabled><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`;
        }).join('')}
      </div>
      <div class="feedback ${fb.correct ? 'good' : 'bad'}">
        <div class="feedback-head">${fb.correct ? '✅ 判断正确' : '❌ 这里有个坑'} <span class="muted" style="font-weight:400;font-size:11px">+${fb.xp} XP</span></div>
        <p>${annotateTerms(q.explain)}</p>
        <div class="feedback-actions">
          <button class="btn btn-primary" data-action="next-question">${d.stage === 'case' ? '进入剧情副本 →' : '下一题 →'}</button>
          <button class="btn btn-sm btn-ghost" data-action="concept" data-concept="${q.concept}">看概念卡</button>
        </div>
      </div>
    </div>`;
  }

  function renderCase(d) {
    const c = caseById(d.plan.caseId);
    if (!c) return '<div class="empty">副本加载失败</div>';
    const chosen = d.caseChoice;
    if (chosen !== null && chosen !== undefined) {
      const opt = c.options[chosen];
      return `<div class="quest-card card">
        <div class="quest-top"><div><div class="q-count">剧情副本 · ${esc(trackMeta(c.track).name)}</div><div class="q-concept">${esc(c.subtitle)}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="chip ${qualityClass(opt.quality)}">${qualityIcon(opt.quality)} ${qualityLabel(opt.quality)}</span><button class="term-card-btn" data-action="term" data-card="${c.concept}">📖 名词卡</button></div></div>
        <div class="case-scene"><div class="case-illustration">${c.track === 'quant' ? '📐' : c.track === 'side' ? '🛠️' : '🎭'}</div><div><div class="card-kicker">你的选择</div><div class="q-stem" style="font-size:20px;margin:4px 0 0">${annotateTerms(opt.text)}</div></div></div>
        <div class="feedback ${qualityClass(opt.quality)}"><div class="feedback-head">${qualityIcon(opt.quality)} ${qualityLabel(opt.quality)}</div><p>${annotateTerms(opt.feedback)}</p></div>
        <div class="feedback-actions"><button class="btn btn-primary" data-action="case-continue">进入模拟盘 →</button><button class="btn btn-sm btn-ghost" data-action="concept" data-concept="${c.concept}">看概念卡</button></div>
      </div>`;
    }
    return `<div class="quest-card card">
      <div class="quest-top"><div><div class="q-count">剧情副本 · ${esc(trackMeta(c.track).name)}</div><div class="q-concept">${esc(c.subtitle)}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="chip amber">做选择，承担后果</span><button class="term-card-btn" data-action="term" data-card="${c.concept}">📖 名词卡</button></div></div>
      <div class="case-scene"><div class="case-illustration">${c.track === 'quant' ? '📐' : c.track === 'side' ? '🛠️' : '🎭'}</div><div><h2 class="case-title">${esc(c.title)}</h2><p class="event-body">${annotateTerms(c.scene)}</p></div></div>
      <div class="q-stem" style="font-size:19px;margin-top:10px">${annotateTerms(c.setup)}</div>
      <div class="options">
        ${c.options.map((opt, i) => `<button class="option" data-action="case-choice" data-case="${c.id}" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt.text)}</span></button>`).join('')}
      </div>
      <div class="diag-note">没有“标准答案”，但每个选择都有代价。选完会看到复盘。</div>
    </div>`;
  }

  function ensureTradeTarget() {
    if (ui.tradeTarget) return;
    const t = state.portfolio.target || {};
    const risky = (Number(t.bond) || 0) + (Number(t.hs300) || 0) + (Number(t.gold) || 0) + (Number(t.tech) || 0);
    if (risky < 0.5) ui.tradeTarget = { bond: 30, hs300: 35, gold: 15, tech: 10 };
    else ui.tradeTarget = { bond: Number(t.bond) || 0, hs300: Number(t.hs300) || 0, gold: Number(t.gold) || 0, tech: Number(t.tech) || 0 };
  }

  function currentTargetAlloc() {
    ensureTradeTarget();
    const r = ui.tradeTarget;
    const risky = ['bond', 'hs300', 'gold', 'tech'].map(a => Math.max(0, Number(r[a]) || 0));
    const s = sum(risky);
    return { cash: Math.max(0, 100 - s), bond: r.bond, hs300: r.hs300, gold: r.gold, tech: r.tech, total: s + Math.max(0, 100 - s) };
  }

  function estimateTrade() {
    const a = currentTargetAlloc();
    const total = state.portfolio.value;
    let trade = 0;
    ['cash', 'bond', 'hs300', 'gold', 'tech'].forEach(k => {
      const targetVal = total * (Number(a[k]) || 0) / 100;
      trade += Math.abs(targetVal - (state.portfolio.positions[k] || 0));
    });
    trade /= 2;
    return { trade, fee: trade * E.FEE_RATE };
  }

  function renderTrade(d) {
    if (d.trade) return renderSettle(d);
    ensureTradeTarget();
    const a = currentTargetAlloc();
    const fee = estimateTrade();
    const m = E.getPortfolioMetrics(state);
    const risky = [
      ['bond', '债券基金'],
      ['hs300', '沪深 300'],
      ['gold', '黄金'],
      ['tech', '科技成长']
    ];
    return `<div class="quest-card card">
      <div class="quest-top"><div><div class="q-count">模拟盘 · 第 ${(state.portfolio.day || 0) + 1} 个交易日</div><div class="q-concept">${esc(d.plan.reason)}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="chip amber">模拟行情</span><span class="chip cyan">手续费 0.1%</span></div></div>
      <h2 style="font-size:26px;margin:4px 0 4px">用 1 万元，做一次配置</h2>
      <p class="muted" style="font-size:12.5px">不预测明天，只决定“股、债、金、现金”各放多少。现金会自动补足剩下的比例。</p>
      <div class="grid grid-2 mt-14" style="align-items:center">
        <div style="display:flex;justify-content:center">${donutHTML(a, fmtMoney(m.value), '组合')}</div>
        <div>
          ${risky.map(([k, label]) => `<div class="alloc-row"><div class="alloc-name"><i style="background:${F.assets[k].color}"></i>${label}</div><input type="range" min="0" max="100" step="1" value="${a[k]}" data-alloc="${k}"><div class="alloc-val" id="alloc-val-${k}">${a[k]}%</div></div>`).join('')}
          <div class="alloc-row"><div class="alloc-name"><i style="background:${F.assets.cash.color}"></i>现金 / 货基</div><div class="bar"><span id="cash-bar" style="width:${a.cash}%"></span></div><div class="alloc-val" id="cash-pct">${a.cash}%</div></div>
        </div>
      </div>
      <div class="preset-row">
        <button class="btn btn-sm" data-action="preset" data-preset="conservative">稳健 · 现金15 债55 股20 金10</button>
        <button class="btn btn-sm" data-action="preset" data-preset="balanced">平衡 · 现金10 债30 股35 金15 科技10</button>
        <button class="btn btn-sm" data-action="preset" data-preset="aggressive">进取 · 现金5 债10 股45 金10 科技30</button>
        <button class="btn btn-sm" data-action="preset" data-preset="allcash">全现金</button>
      </div>
      <div class="alloc-total" id="alloc-total"><span>目标合计 <strong id="alloc-sum">${a.total}%</strong> · 预计手续费 <strong id="fee-est">${fmtMoney(fee.fee)}</strong></span><span class="muted" style="font-size:10px">当前净值 ${fmtMoney(m.value)}</span></div>
      <div class="feedback-actions">
        <button class="btn btn-primary" id="trade-confirm" data-action="trade-confirm" ${a.total > 100.5 ? 'disabled' : ''}>确认调仓，进入下一交易日 →</button>
        <button class="btn btn-ghost" data-action="trade-hold">保持不动，直接过一天</button>
      </div>
      <div class="diag-note">涨跌由本地模拟器生成，不是实时行情；调仓按成交金额收取 0.1% 模拟手续费，不调仓也会经历一个交易日。</div>
    </div>`;
  }

  function renderSettle(d) {
    const t = d.trade;
    if (!t) return '<div class="empty">先完成调仓</div>';
    const m = E.getPortfolioMetrics(state);
    const ev = t.event || F.events.find(e => e.id === d.plan.eventId);
    const order = ['cash', 'bond', 'hs300', 'gold', 'tech'];
    return `<div class="quest-card card">
      <div class="quest-top"><div><div class="q-count">收盘了 · 第 ${m.day} 个交易日</div><div class="q-concept">${esc(ev ? ev.title : '市场波动')}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="chip amber">模拟交易日</span><span class="chip ${t.dayReturn >= 0 ? 'green' : 'red'}">${t.dayReturn >= 0 ? '上涨' : '回撤'}</span></div></div>
      <h2 style="font-size:28px;margin:2px 0 6px">${fmtPct(t.dayReturn)} <span style="font-size:13px;color:var(--muted);font-weight:400">今日组合</span></h2>
      <div class="market-day"><span class="muted">沪深 300 ${fmtPct(t.benchmarkReturn)}</span><span class="muted">组合净值 ${fmtMoney(t.value)}</span><span class="muted">手续费 ${fmtMoney(t.fee)}</span></div>
      <div class="returns-list">
        ${order.map(k => `<div class="return-item"><div class="n">${F.assets[k].icon} ${F.assets[k].name}</div><div class="v ${t.returns[k] >= 0 ? 'green' : 'red'}">${fmtPct(t.returns[k])}</div></div>`).join('')}
      </div>
      <div class="feedback" style="margin-top:14px"><div class="feedback-head">📌 今天发生了什么</div><p>${ev ? annotateTerms(ev.body) : '市场每天都在波动。短期涨跌更多是噪音，长期结果取决于你的配置和纪律。'}</p><p style="margin-top:8px;color:var(--muted)">${ev ? annotateTerms(ev.takeaway) : ''}</p></div>
      <div class="feedback-actions"><button class="btn btn-primary" data-action="settle">领取今日奖励 →</button><button class="btn btn-sm btn-ghost" data-action="nav" data-view="portfolio">看完整模拟盘</button></div>
    </div>`;
  }

  function renderDone(d) {
    const r = d.rewards || { xp: 0, coins: 0, chest: 0, streak: state.player.streak, achievements: [] };
    const lvl = E.getLevelInfo(state);
    const m = E.getPortfolioMetrics(state);
    const correct = d.answers.filter(a => a.correct).length;
    if (ui.justSettled) {
      ui.justSettled = false;
      setTimeout(celebrate, 60);
    }
    return `<div class="quest-card card">
      <div class="result-hero">
        ${mascotSVG(lvl.title.mascot, 'happy', state.player.activeCosmetics)}
        <div class="eyebrow" style="justify-content:center">TODAY CLEARED</div>
        <h2 class="result-title">今日副本通关</h2>
        <p class="result-sub">第 ${state.stats.daysCompleted} 天 · 连胜 ${state.player.streak} 天 · ${esc(state.player.title)}</p>
      </div>
      <div class="reward-row">
        <div class="reward-box"><div class="icon">⚡</div><div class="val">+${r.xp}</div><div class="lbl">XP</div></div>
        <div class="reward-box"><div class="icon">🪙</div><div class="val">+${r.coins}</div><div class="lbl">叶币</div></div>
        <div class="reward-box"><div class="icon">📦</div><div class="val">+${r.chest}</div><div class="lbl">宝箱</div></div>
      </div>
      ${r.usedFreeze ? '<div class="center" style="margin:-6px 0 12px"><span class="chip cyan">🧊 已自动使用一张连胜冻结卡</span></div>' : ''}
      <div class="card flat" style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--muted)"><span>Lv.${lvl.level} ${esc(lvl.title.name)}</span><span>${lvl.xpInLevel}/${lvl.xpForNext} XP</span></div>
        <div class="bar mt-14"><span style="width:${Math.round(lvl.progress * 100)}%"></span></div>
        ${lvl.nextTitle ? `<div class="diag-note">距离「${esc(lvl.nextTitle.name)}」还差 ${Math.max(0, lvl.nextTitle.level - lvl.level)} 级</div>` : ''}
      </div>
      ${(r.achievements && r.achievements.length) ? `<div class="achievement-list">${r.achievements.map(a => `<div class="achievement"><span class="achievement-icon">${a.icon}</span><div><div class="achievement-title">${esc(a.title)}</div><div class="achievement-desc">${esc(a.desc)}</div></div><span class="achievement-coins">+${a.coins} 🪙</span></div>`).join('')}</div>` : ''}
      <div class="grid grid-3 mt-20">
        <div class="week-box"><div class="n">${correct}/${d.answers.length}</div><div class="l">小测正确</div></div>
        <div class="week-box"><div class="n">${m.maxDrawdown ? Math.round(m.maxDrawdown * 100) + '%' : '0%'}</div><div class="l">最大回撤</div></div>
        <div class="week-box"><div class="n">${fmtPct(m.returnPct)}</div><div class="l">模拟盘收益</div></div>
      </div>
      <div class="feedback-actions" style="justify-content:center;margin-top:18px">
        <button class="btn btn-primary" data-action="nav" data-view="skills">去技能树 →</button>
        <button class="btn btn-ghost" data-action="nav" data-view="portfolio">看模拟盘</button>
        <button class="btn btn-ghost" data-action="bonus-open">加练 3 题</button>
        <button class="btn btn-ghost" data-action="practice-random">随机加练</button>
      </div>
      <div class="diag-note center">明天再来，保持 10 分钟。连胜冻结卡可以救你一次。</div>
    </div>`;
  }

  function renderTrackCards() {
    return `<div class="grid grid-3">${TRACKS.map(t => {
      const meta = trackMeta(t);
      const node = currentNodeFor(t);
      const p = node ? E.getNodeProgress(state, node) : { pct: 0, status: 'locked' };
      const lv = trackLevel(state.theta[t] || 0);
      return `<button class="card track-card ${t}" data-action="open-track" data-track="${t}" style="text-align:left">
        <div class="track-top"><span class="track-name">${meta.icon} ${meta.name}</span><span class="track-lv">Lv.${lv}</span></div>
        <div class="track-node">${node ? esc(node.title) : '—'} · 掌握度 ${p.pct}%</div>
        <div class="bar ${t === 'quant' ? 'cyan' : t === 'side' ? 'amber' : ''}"><span style="width:${p.pct}%"></span></div>
        <div class="track-top" style="margin-top:8px"><span class="muted" style="font-size:10px">${p.status === 'mastered' ? '已点亮' : p.status === 'available' ? '可挑战' : '未解锁'}</span><span class="muted" style="font-size:10px">${p.pct}/45</span></div>
      </button>`;
    }).join('')}</div>`;
  }

  function renderPortfolioSnapshot() {
    const m = E.getPortfolioMetrics(state);
    return `<div class="card">
      <div class="card-head"><div><div class="card-title">模拟盘快照</div><div class="card-sub">第 ${m.day} 个交易日 · ${m.regime === 'bull' ? '牛市' : m.regime === 'bear' ? '熊市' : '震荡'}</div></div><button class="btn btn-sm btn-ghost" data-action="nav" data-view="portfolio">详情 →</button></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div><div class="stat-value">${fmtMoney(m.value)}</div><div class="stat-sub ${m.returnPct >= 0 ? 'trend-up' : 'trend-down'}">${fmtPct(m.returnPct)} · 基准 ${fmtPct(m.benchmarkPct)}</div></div>
        <div style="flex:1;min-width:180px;max-width:300px">${sparkline(m.history)}</div>
      </div>
    </div>`;
  }

  function renderCodeBanner() {
    const total = F.codeChallenges.length;
    const done = (state.codeDone || []).length;
    return `<div class="card" style="border-left:2px solid var(--cyan)">
      <div class="card-head"><div><div class="card-title">🧪 代码副本</div><div class="card-sub">读一段 Python，预测输出。不跑环境，也能练量化手感。</div></div><button class="btn btn-sm" data-action="code-open">${done >= total ? '复习 →' : '进入 →'}</button></div>
      <div style="display:flex;align-items:center;gap:12px"><div class="bar cyan" style="flex:1"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div><span class="mono" style="font-size:10px;color:var(--muted)">${done}/${total}</span></div>
    </div>`;
  }

  function renderBonusCard() {
    const dailyDone = !!(state.daily && state.daily.stage === 'done');
    const b = E.ensureBonus(state);
    const points = Math.min(3, b.points || 0);
    const totalCases = F.bonusCases.length;
    const doneCases = (state.bonusDone || []).length;
    const allCases = doneCases >= totalCases;
    let status = '完成今日副本后开放';
    let action = '';
    let btn = '未解锁';
    if (dailyDone) {
      if (b.caseDone) {
        status = allCases ? '支线档案已集齐' : '今日支线已完成';
        btn = '今日已完成';
      } else if (allCases) {
        status = '支线档案已集齐';
        btn = '全部完成';
      } else if (points >= 3 && b.caseId) {
        status = '支线副本已解锁';
        action = 'bonus-open';
        btn = '进入支线副本 →';
      } else {
        status = `探索点 ${points}/3`;
        action = 'bonus-open';
        btn = '加练 3 题 →';
      }
    }
    return `<div class="card bonus-card" style="border-left:2px solid var(--pink)">
      <div class="card-head"><div><div class="card-title">🎁 今日加练 · 支线探索</div><div class="card-sub">多做 3 道题，攒探索点，解锁额外剧情。答错也有探索点，不算白做。</div></div><span class="chip pink">${points}/3</span></div>
      <div style="display:flex;align-items:center;gap:10px"><div class="bar pink" style="flex:1"><span style="width:${(points / 3) * 100}%"></span></div><span class="mono" style="font-size:9px;color:var(--muted)">支线 ${doneCases}/${totalCases}</span></div>
      <div class="feedback-actions"><button class="btn ${action ? 'btn-primary' : 'btn-ghost'}" data-action="${action || 'noop'}" ${action ? '' : 'disabled'}>${btn}</button><span class="muted" style="font-size:10px">${status}</span></div>
    </div>`;
  }

  /* ============================================================
     skills
     ============================================================ */
  function renderSkills() {
    const t = ui.skillTab;
    const meta = trackMeta(t);
    const nodes = F.nodes.filter(n => n.track === t);
    const mastered = nodes.filter(n => E.nodeStatus(state, n) === 'mastered').length;
    const current = currentNodeFor(t);
    return `<div class="view-head">
      <div><div class="eyebrow">SKILL TREE</div><h2>技能树</h2><div class="view-sub">每个节点是一组概念。答对当前节点的题，掌握度到 45% 就能点亮，解锁下一段。</div></div>
      <span class="chip green">${mastered}/${nodes.length} 已点亮</span>
    </div>
    <div class="tabs">${TRACKS.map(x => `<button class="tab ${t === x ? 'active' : ''}" data-action="skill-tab" data-track="${x}">${trackMeta(x).icon} ${trackMeta(x).name}</button>`).join('')}</div>
    ${t === 'quant' ? `<div class="mt-14">${renderCodeBanner()}</div>` : ''}
    <div class="card" style="border-left:2px solid ${meta.color}">
      <div class="card-head"><div><div class="card-title">${meta.icon} ${meta.name}</div><div class="card-sub">${meta.desc}</div></div><span class="chip" style="color:${meta.color};border-color:${meta.color}44">当前：${esc(current ? current.title : '—')}</span></div>
      <div class="skill-path">${nodes.map(n => renderNodeCard(n)).join('')}</div>
    </div>`;
  }

  function renderNodeCard(n) {
    const p = E.getNodeProgress(state, n);
    const statusLabel = p.status === 'mastered' ? '已点亮' : p.status === 'available' ? '可挑战' : '未解锁';
    return `<div class="node ${p.status}">
      <div class="node-icon">${p.status === 'locked' ? '🔒' : n.icon}</div>
      <div>
        <div class="node-title">${esc(n.title)} <span class="muted" style="font-weight:400;font-size:10px">· ${esc(n.subtitle)}</span></div>
        <div class="node-sub">${n.concepts.map(cid => {
          const c = conceptById(cid);
          if (!c) return '';
          const unlocked = state.player.unlockedConcepts.includes(cid);
          return unlocked ? `<button class="concept-chip" data-action="concept" data-concept="${cid}">${esc(c.title)}</button>` : `<span class="concept-chip" title="遇到后解锁">🔒 ${esc(c.title)}</span>`;
        }).join(' ')}</div>
        <div class="node-progress"><div class="bar ${n.track === 'quant' ? 'cyan' : n.track === 'side' ? 'amber' : ''}"><span style="width:${p.pct}%"></span></div><span class="node-pct">${p.pct}%</span></div>
        <div class="node-meta"><span class="muted" style="font-size:9.5px">奖励 +${n.reward.xp} XP · +${n.reward.coins} 🪙</span></div>
      </div>
      <div class="node-side">
        <span class="node-status ${p.status}">${statusLabel}</span>
        ${p.status !== 'locked' ? `<button class="btn btn-sm" data-action="practice-node" data-node="${n.id}">加练</button>` : '<span class="muted" style="font-size:9px">先点亮上一节点</span>'}
      </div>
    </div>`;
  }

  /* ============================================================
     codex
     ============================================================ */
  function renderCodex() {
    const unlocked = state.player.unlockedConcepts;
    const filter = ui.codexFilter;
    const list = F.concepts.filter(c => filter === 'all' || c.track === filter);
    return `<div class="view-head">
      <div><div class="eyebrow">CODEX</div><h2>概念图鉴</h2><div class="view-sub">你遇到过的概念会在这里留下卡片。没解锁的，会在每日小测或副本里出现。</div></div>
      <span class="chip green">${unlocked.length}/${F.concepts.length} 已解锁</span>
    </div>
    <div class="tabs">
      <button class="tab ${filter === 'all' ? 'active' : ''}" data-action="codex-filter" data-filter="all">全部</button>
      ${TRACKS.map(t => `<button class="tab ${filter === t ? 'active' : ''}" data-action="codex-filter" data-filter="${t}">${trackMeta(t).icon} ${trackMeta(t).name}</button>`).join('')}
    </div>
    <div class="codex-grid">
      ${list.map(c => {
        const has = unlocked.includes(c.id);
        return `<button class="codex-card ${has ? '' : 'locked'}" ${has ? `data-action="concept" data-concept="${c.id}"` : 'disabled'}>
          <div class="codex-icon">${has ? c.icon : '🔒'}</div>
          <div class="codex-title">${has ? esc(c.title) : '???'}</div>
          <div class="codex-short">${has ? esc(c.short) : '在每日小测或剧情副本中遇到后解锁。'}</div>
          <div class="codex-tags">${has ? `<span class="chip">${esc(trackMeta(c.track).name)}</span>${(c.tags || []).slice(0, 2).map(x => `<span class="chip">${esc(x)}</span>`).join('')}` : '<span class="chip">未解锁</span>'}</div>
        </button>`;
      }).join('')}
    </div>`;
  }

  /* ============================================================
     portfolio
     ============================================================ */
  function renderPortfolio() {
    const m = E.getPortfolioMetrics(state);
    const order = ['cash', 'bond', 'hs300', 'gold', 'tech'];
    const posList = order.map(k => ({ k, v: state.portfolio.positions[k] || 0, pct: m.alloc[k] || 0 })).sort((a, b) => b.v - a.v);
    const trades = (state.portfolio.trades || []).slice(-6).reverse();
    return `<div class="view-head">
      <div><div class="eyebrow">PAPER PORTFOLIO</div><h2>模拟盘</h2><div class="view-sub">初始资金 1 万元。行情由本地模拟器生成，<strong>不是真实行情或实时数据</strong>；但你的配置、回撤和情绪反应是真的。每个交易日可在今日副本里调仓。</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip amber">模拟行情</span><span class="chip">第 ${m.day} 天</span><span class="chip ${m.regime === 'bull' ? 'green' : m.regime === 'bear' ? 'red' : 'cyan'}">${m.regime === 'bull' ? '牛市' : m.regime === 'bear' ? '熊市' : '震荡'}</span></div>
    </div>
    <div class="grid grid-4">
      <div class="card stat-card"><div class="stat-label">总净值</div><div class="stat-value">${fmtMoney(m.value)}</div><div class="stat-sub">初始 ¥10,000</div></div>
      <div class="card stat-card"><div class="stat-label">累计收益</div><div class="stat-value ${m.returnPct >= 0 ? 'trend-up' : 'trend-down'}">${fmtPct(m.returnPct)}</div><div class="stat-sub">基准 ${fmtPct(m.benchmarkPct)}</div></div>
      <div class="card stat-card"><div class="stat-label">最大回撤</div><div class="stat-value">${Math.round(m.maxDrawdown * 100)}%</div><div class="stat-sub">从最高点最多跌多少</div></div>
      <div class="card stat-card"><div class="stat-label">年化波动</div><div class="stat-value">${Math.round(m.volatility * 100)}%</div><div class="stat-sub">费用已付 ${fmtMoney(m.feesPaid)}</div></div>
    </div>
    <div class="card mt-14">
      <div class="card-head"><div><div class="card-title">净值曲线</div><div class="card-sub">你的组合 vs 模拟沪深 300</div></div><div class="legend"><span class="legend-item"><i class="legend-dot"></i>我的组合</span><span class="legend-item"><i class="legend-dot dashed"></i>沪深 300（模拟）</span></div></div>
      <div class="chart-wrap">${lineChart(m.history)}</div>
    </div>
    <div class="grid grid-2 mt-14">
      <div class="card">
        <div class="card-head"><div><div class="card-title">当前配置</div><div class="card-sub">按市值占比</div></div><span class="chip cyan">每日可调仓</span></div>
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">${donutHTML(m.alloc, fmtMoney(m.value), '总净值')}
          <div style="flex:1;min-width:180px">${posList.map(x => `<div class="alloc-row" style="grid-template-columns:78px minmax(0,1fr) 52px"><div class="alloc-name"><i style="background:${F.assets[x.k].color}"></i>${F.assets[x.k].name}</div><div class="bar"><span style="width:${x.pct}%;background:${F.assets[x.k].color}"></span></div><div class="alloc-val">${x.pct.toFixed(0)}%</div></div>`).join('')}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">持仓市值</div><div class="card-sub">四类资产 + 现金</div></div></div>
        ${posList.map(x => `<div class="journal-item"><div class="journal-date">${F.assets[x.k].icon}</div><div class="journal-body" style="flex:1"><div class="journal-title">${F.assets[x.k].name}</div><div class="journal-choice">${fmtMoney(x.v)} · ${x.pct.toFixed(1)}%</div></div></div>`).join('')}
        <div class="diag-note">现金不是“浪费”，它是你在下跌时还能行动的底气。</div>
      </div>
    </div>
    <div class="card mt-14">
      <div class="card-head"><div><div class="card-title">交易记录</div><div class="card-sub">每个交易日最多一次调仓</div></div></div>
      ${trades.length ? trades.map(t => `<div class="journal-item"><div class="journal-date">${fmtDate(t.date)}</div><div class="journal-body" style="flex:1"><div class="journal-title">${t.hold ? '保持不动' : '调仓'} · 手续费 ${fmtMoney(t.fee)}</div><div class="journal-choice">股 ${Math.round((t.target.hs300 || 0) + (t.target.tech || 0))}% · 债 ${Math.round(t.target.bond || 0)}% · 金 ${Math.round(t.target.gold || 0)}% · 现金 ${Math.round(t.target.cash || 0)}% · 净值 ${fmtMoney(t.value)}</div></div></div>`).join('') : '<div class="empty"><span class="big">📭</span>还没有交易记录。完成今日副本里的调仓后，这里会留下你的决策。</div>'}
    </div>
    <div class="diag-note" style="margin-top:14px">所有行情均为模拟，不构成投资建议。真实投资有本金损失风险。</div>`;
  }

  /* ============================================================
     review
     ============================================================ */
  function renderReview() {
    const w = E.getWeekStats(state);
    const p = E.buildProfile(state);
    const insights = E.getInsights(state);
    const journal = (state.journal || []).slice(-6).reverse();
    const acc = E.trackAccuracy(state);
    const codeDone = (state.codeDone || []).length;
    const quantAdvice = p.quantLevel >= 4 && acc.quant.accuracy >= 0.7 && codeDone >= 2
      ? '你有不错的概率直觉和代码底子。下一步别急着报课：做一个含交易成本的回测，记录你是在“享受验证假设”，还是“只想看漂亮曲线”。前者更像量化研究，后者更适合把量化当工具。'
      : p.quantLevel >= 3
        ? '你可以试水，但先补三块：概率统计、回测陷阱、Python 数据处理。用 2 个小项目验证自己是否喜欢“数据清洗—验证—否定—重来”的循环。'
        : '先别急着判断适不适合。把期望值、方差、基准率练熟，再写一个“读数据 → 算收益 → 算波动”的脚本。量化工作的大部分时间不是预测，而是数据、验证和否定自己的想法。';
    return `<div class="view-head">
      <div><div class="eyebrow">WEEKLY REVIEW</div><h2>复盘</h2><div class="view-sub">看看这一周你做对了什么、错过了什么。每周 5 天可解锁 Boss 战。</div></div>
      <span class="chip ${w.accuracy >= 0.7 ? 'green' : 'amber'}">本周正确率 ${Math.round(w.accuracy * 100)}%</span>
    </div>
    <div class="week-grid">
      <div class="week-box"><div class="n">${w.days}</div><div class="l">学习天数</div></div>
      <div class="week-box"><div class="n">${Math.round(w.accuracy * 100)}%</div><div class="l">答题正确率</div></div>
      <div class="week-box"><div class="n">${w.xp}</div><div class="l">获得 XP</div></div>
      <div class="week-box"><div class="n">${w.goodCases}</div><div class="l">优质决策</div></div>
    </div>
    <div class="grid grid-2 mt-14">
      <div class="card ${w.bossDone ? 'glow' : ''}">
        <div class="card-head"><div><div class="card-title">⚔️ 周末 Boss 战</div><div class="card-sub">6 道混合题，答对 5 道通关</div></div><span class="chip ${w.bossDone ? 'green' : w.days >= 5 ? 'amber' : ''}">${w.bossDone ? '已通关' : w.days >= 5 ? '已解锁' : '未解锁'}</span></div>
        ${w.bossDone ? `<p class="muted" style="font-size:12px">本周已击破，最高分 ${w.bestScore}/6。可以去技能树加练，或等下周刷新。</p><div class="feedback-actions"><button class="btn btn-sm" data-action="nav" data-view="skills">去加练</button></div>` : `<p class="muted" style="font-size:12px">${w.days >= 5 ? '你已完成 5 天，Boss 已解锁。' : `再完成 ${w.daysToBoss} 天每日副本，就能挑战本周 Boss。`}</p><div class="bar mt-14 ${w.days >= 5 ? 'amber' : ''}"><span style="width:${Math.min(100, w.days / 5 * 100)}%"></span></div><div class="feedback-actions"><button class="btn btn-primary" data-action="boss-open" ${w.days < 5 ? 'disabled' : ''}>${w.days >= 5 ? '挑战 Boss →' : `还差 ${w.daysToBoss} 天`}</button></div>`}
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">💡 本周洞察</div><div class="card-sub">根据你的答题与决策生成</div></div></div>
        <div class="insight-list">${insights.length ? insights.map(x => `<div class="insight"><span class="i">${x.icon}</span><span>${esc(x.text)}</span></div>`).join('') : '<div class="empty">再答几题，这里就会出现你的专属洞察。</div>'}</div>
      </div>
    </div>
    <div class="card mt-14">
      <div class="card-head"><div><div class="card-title">🧭 量化适性报告</div><div class="card-sub">不是算命，是给你下一步的实验建议</div></div><span class="chip cyan">动态更新</span></div>
      <div class="week-grid">
        <div class="week-box"><div class="n">Lv.${p.quantLevel}</div><div class="l">量化基础</div></div>
        <div class="week-box"><div class="n">${Math.round(acc.quant.accuracy * 100)}%</div><div class="l">量化题正确率</div></div>
        <div class="week-box"><div class="n">${codeDone}/${F.codeChallenges.length}</div><div class="l">代码副本</div></div>
        <div class="week-box"><div class="n">${state.stats.trades}</div><div class="l">调仓次数</div></div>
      </div>
      <p class="muted" style="font-size:12.5px;line-height:1.8;margin-top:12px">${esc(quantAdvice)}</p>
    </div>
    <div class="card mt-14">
      <div class="profile-banner">
        ${mascotSVG(E.getLevelInfo(state).title.mascot, 'neutral', state.player.activeCosmetics)}
        <div style="flex:1;min-width:220px"><div class="eyebrow">YOUR PROFILE</div><div class="profile-name">${esc(p.headline)}</div><div class="profile-desc">${esc(p.summary)}</div></div>
        <div style="min-width:220px;flex:1">
          <div class="level-bars">
            ${TRACKS.map(t => `<div class="level-bar-row"><span class="n">${trackMeta(t).name}</span><div class="bar ${t === 'quant' ? 'cyan' : t === 'side' ? 'amber' : ''}"><span style="width:${(p[t + 'Level'] / 5) * 100}%"></span></div><span class="v">Lv.${p[t + 'Level']}</span></div>`).join('')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><span class="chip">${esc(p.riskType)}型</span><span class="chip cyan">${esc(p.quantFit)}</span></div>
        </div>
      </div>
      <div class="profile-route">${p.route.map((x, i) => `<div class="route-item"><div class="route-num">0${i + 1}</div><div class="route-body"><div class="route-title">${esc(x)}</div></div></div>`).join('')}</div>
    </div>
    <div class="card mt-14">
      <div class="card-head"><div><div class="card-title">决策日志</div><div class="card-sub">当时为什么选，比选对更重要</div></div><button class="btn btn-sm" data-action="settings-open">数据管理</button></div>
      ${journal.length ? `<div class="journal">${journal.map(j => `<div class="journal-item"><div class="journal-date">${fmtDate(j.date)}</div><div class="journal-body" style="flex:1"><div class="journal-title">${qualityIcon(j.quality)} ${esc(j.title)}</div><div class="journal-choice">${esc(j.choiceText)}</div></div><span class="chip ${qualityClass(j.quality)}">${qualityLabel(j.quality)}</span></div>`).join('')}</div>` : '<div class="empty"><span class="big">📝</span>完成第一个剧情副本后，这里会记录你的决策。</div>'}
    </div>`;
  }

  /* ============================================================
     onboarding
     ============================================================ */
  function renderOnboarding() {
    const app = document.getElementById('app');
    if (ui.onboarding.step === 'quiz') app.innerHTML = renderOnboardQuiz();
    else if (ui.onboarding.step === 'result') app.innerHTML = renderOnboardResult();
    else app.innerHTML = renderOnboardWelcome();
  }

  function onboardTop(progressText) {
    return `<div class="onboard-top">
      <div class="brand"><div class="brand-mark">韭</div><div><div class="brand-name">韭菜进化论</div><div class="brand-sub">10 MIN FINANCE RPG</div></div></div>
      <div class="onboard-progress">${progressText || 'DIAGNOSTIC · 12 题'}</div>
    </div>`;
  }

  function renderOnboardWelcome() {
    return `<div class="onboarding">
      ${onboardTop()}
      <div class="onboard-hero">
        <div>
          <div class="eyebrow">A 10-MINUTE FINANCE RPG</div>
          <h1>每天 10 分钟，<br>把<em>韭菜</em>练成<em>镰刀克星</em>。</h1>
          <p class="onboard-lead">你不需要先成为金融专家。每天看一条情报、答 4 道题、做一个真实感决策、调一次模拟仓。难度会跟着你变，技能树会告诉你走到哪了。</p>
          <div class="onboard-actions">
            <button class="btn btn-primary btn-lg" data-action="start-diag">开始 12 题诊断 →</button>
            <button class="btn btn-ghost" data-action="skip-onboard">先跳过，直接开始</button>
          </div>
          <div class="diag-note">诊断不显示对错，只用来校准你的起点。约 3 分钟。</div>
        </div>
        <div class="onboard-visual">
          <div class="onboard-orbit"></div>
          ${mascotSVG(3, 'happy', [])}
          <div class="chip green" style="margin-top:8px">韭韭 · 你的学习搭子</div>
        </div>
      </div>
      <div class="onboard-features">
        <div class="feature"><div class="ico">🎯</div><div class="t">自适应难度</div><div class="d">答对变难，答错复习。每天 3 题，不贪多。</div></div>
        <div class="feature"><div class="ico">🎭</div><div class="t">真实感副本</div><div class="d">内幕消息、基金止盈、回测陷阱，做选择看后果。</div></div>
        <div class="feature"><div class="ico">📈</div><div class="t">模拟盘 + 技能树</div><div class="d">1 万元虚拟资金，三条成长线，等级和成就。</div></div>
      </div>
      <div class="onboard-foot"><span>纯前端 · 本地存档 · 不涉及真钱</span><span>内容仅用于学习，不构成投资建议</span></div>
    </div>`;
  }

  function renderOnboardQuiz() {
    const ob = ui.onboarding;
    const item = ob.queue[ob.index];
    if (!item) return '';
    const q = item.q;
    const isRisk = item.kind === 'risk';
    const pct = Math.round((ob.index / ob.queue.length) * 100);
    return `<div class="onboarding">
      ${onboardTop(`诊断 ${ob.index + 1} / ${ob.queue.length}`)}
      <div class="diag-wrap">
        <div class="diag-progress"><span style="width:${pct}%"></span></div>
        <div class="card diag-card">
          <div class="diag-kicker-row">
            <div class="diag-kicker">${isRisk ? '风险偏好 · 没有标准答案' : '基础诊断 · 理财 / 量化 / 变现'}</div>
            ${!isRisk && q.concept ? `<button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button>` : ''}
          </div>
          <div class="diag-stem">${annotateTerms(q.stem)}</div>
          <div class="options">
            ${q.options.map((opt, i) => `<button class="option ${ob.selected === i ? 'selected' : ''}" data-action="diag-option" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`).join('')}
          </div>
          <div class="diag-note">${isRisk ? '按真实反应选，别按“应该怎样”选。' : '不确定就凭直觉选；点带 i 的词可看名词卡。'}</div>
          <div class="diag-actions"><span class="muted" style="font-size:11px">${isRisk ? '最后 2 题' : '不显示对错'}</span><button class="btn btn-primary" data-action="diag-next" ${ob.selected === null ? 'disabled' : ''}>${ob.index === ob.queue.length - 1 ? '生成我的档案 →' : '下一题 →'}</button></div>
        </div>
      </div>
    </div>`;
  }

  function renderOnboardResult() {
    const p = ui.onboarding.result ? ui.onboarding.result.profile : E.buildProfile(state);
    return `<div class="onboarding">
      ${onboardTop('PROFILE READY')}
      <div class="profile-result">
        <div class="card glow">
          <div class="eyebrow">YOUR STARTING POINT</div>
          <h2 class="profile-headline">${esc(p.headline)}</h2>
          <p class="profile-summary">${esc(p.summary)}</p>
          <div class="grid grid-2 mt-20" style="align-items:center">
            <div>
              <div class="level-bars">
                ${TRACKS.map(t => `<div class="level-bar-row"><span class="n">${trackMeta(t).name}</span><div class="bar ${t === 'quant' ? 'cyan' : t === 'side' ? 'amber' : ''}"><span style="width:${(p[t + 'Level'] / 5) * 100}%"></span></div><span class="v">Lv.${p[t + 'Level']}</span></div>`).join('')}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><span class="chip">${esc(p.riskType)}型</span><span class="chip cyan">${esc(p.quantFit)}</span><span class="chip amber">主攻：${esc(trackMeta(p.weakest).name)}</span></div>
            </div>
            <div style="display:flex;justify-content:center">${mascotSVG(3, 'happy', [])}</div>
          </div>
          <div class="profile-route">${p.route.map((x, i) => `<div class="route-item"><div class="route-num">0${i + 1}</div><div class="route-body"><div class="route-title">${esc(x)}</div></div></div>`).join('')}</div>
          <div class="feedback-actions" style="margin-top:18px"><button class="btn btn-primary btn-lg" data-action="enter-greenhouse">进入韭菜温室 →</button><span class="hero-note">已获得 150 叶币 + 1 张冻结卡</span></div>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     modal
     ============================================================ */
  function closeModal() {
    ui.modal = null;
    renderModal();
  }

  function modalShell(content) {
    return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${content}</div></div>`;
  }

  function modalHead(title, sub) {
    return `<div class="modal-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="modal-sub">${esc(sub)}</div>` : ''}</div><button class="modal-close" data-action="close-modal" aria-label="关闭">×</button></div>`;
  }

  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    if (!ui.modal) { root.innerHTML = ''; return; }
    const type = ui.modal.type;
    if (type === 'concept') {
      const c = ui.modal.data;
      const body = String(c.body || '').split('\n\n').map(p => `<p>${esc(p)}</p>`).join('');
      root.innerHTML = modalShell(`${modalHead(c.title, `${trackMeta(c.track).name} · 难度 ${c.difficulty}/5`)}
        <div class="modal-body concept-detail">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><span style="font-size:32px">${c.icon}</span><span class="chip green">${esc(c.short)}</span></div>
          ${body}
          ${c.formula ? `<div class="formula">${esc(c.formula)}</div>` : ''}
          ${c.example ? `<div class="example"><strong>例子：</strong>${esc(c.example)}</div>` : ''}
          <div class="tags">${(c.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-action="close-modal">记住了</button></div>`);
    } else if (type === 'shop') {
      root.innerHTML = modalShell(`${modalHead('叶币商店', `你有 🪙 ${state.player.coins} 叶币`)}
        <div class="modal-body">
          ${F.shop.map(item => {
            let owned = '';
            if (item.type === 'consumable') owned = item.id === 'freeze' ? `持有 ${state.player.freezes}/${item.max}` : `持有 ${state.player.hints}/${item.max}`;
            if (item.type === 'cosmetic') owned = state.player.cosmetics.includes(item.id) ? (state.player.activeCosmetics.includes(item.id) ? '装备中' : '已拥有') : '';
            return `<div class="shop-item"><div class="shop-icon">${item.icon}</div><div class="shop-info"><div class="shop-name">${esc(item.name)} ${owned ? `<span class="chip">${owned}</span>` : ''}</div><div class="shop-desc">${esc(item.desc)}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="shop-price">🪙 ${item.price}</span><button class="btn btn-sm" data-action="buy" data-item="${item.id}">${item.type === 'cosmetic' && state.player.cosmetics.includes(item.id) ? '切换' : '购买'}</button></div></div>`;
          }).join('')}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>`);
    } else if (type === 'settings') {
      root.innerHTML = modalShell(`${modalHead('设置 & 存档', '本地优先；配置 Supabase 后自动云存档。')}
        <div class="modal-body">
          <div class="shop-item"><div class="shop-icon">☁️</div><div class="shop-info"><div class="shop-name">云存档</div><div class="shop-desc" id="cloud-save-desc">${esc(cloudSaveText())}</div><div class="shop-desc">游客账号仅本设备；跨设备请在联机版用邮箱登录后再回来。</div></div><div style="display:flex;flex-direction:column;gap:6px"><a class="btn btn-sm btn-ghost" href="online.html">邮箱登录</a><button class="btn btn-sm" data-action="cloud-sync">立即同步</button></div></div>
          <div class="shop-item"><div class="shop-icon">📤</div><div class="shop-info"><div class="shop-name">导出存档</div><div class="shop-desc">下载一个 JSON 文件，换设备或清缓存前备份。</div></div><button class="btn btn-sm" data-action="export">导出</button></div>
          <div class="shop-item"><div class="shop-icon">📥</div><div class="shop-info"><div class="shop-name">导入存档</div><div class="shop-desc">选择之前导出的 JSON，覆盖当前进度。</div></div><button class="btn btn-sm" data-action="import">选择文件</button></div>
          <div class="shop-item"><div class="shop-icon">🎞️</div><div class="shop-info"><div class="shop-name">减少动画</div><div class="shop-desc">关闭浮动、彩带和大部分过渡。</div></div><button class="btn btn-sm" data-action="toggle-motion">${state.settings.reduceMotion ? '已开启' : '关闭'}</button></div>
          <div class="shop-item"><div class="shop-icon">🗑️</div><div class="shop-info"><div class="shop-name">重置进度</div><div class="shop-desc">清空本地存档，重新开始。不可撤销。</div></div><button class="btn btn-sm btn-danger" data-action="reset">重置</button></div>
          <div class="diag-note">版本 v${E.VERSION} · 存档大小约 ${Math.round(JSON.stringify(state).length / 1024)} KB</div>
          <input type="file" id="import-file" accept=".json,application/json" class="hidden">
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>`);
    } else if (type === 'practice') {
      root.innerHTML = renderPracticeModal();
    } else if (type === 'boss') {
      root.innerHTML = renderBossModal();
    } else if (type === 'code') {
      root.innerHTML = renderCodeModal();
    } else if (type === 'bonus') {
      root.innerHTML = renderBonusModal();
    } else if (type === 'confirm-reset') {
      root.innerHTML = modalShell(`${modalHead('确定重置？', '这会清空所有进度：等级、叶币、技能树、模拟盘和日记。')}
        <div class="modal-body"><p>如果你只是想换设备，建议先导出存档。</p></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-danger" data-action="reset-confirm">确认重置</button></div>`);
    }
  }

  function renderBonusModal() {
    const p = ui.bonus;
    if (!p) return '';
    if (p.phase === 'done') {
      const s = p.summary || {};
      return modalShell(`${modalHead('支线完成', s.caseTitle || '今日加练')}
        <div class="modal-body center" style="padding:8px 0">
          ${mascotSVG(5, 'happy', state.player.activeCosmetics)}
          <h3 style="font-size:26px">${s.caseTitle ? '支线通关' : '今日加练完成'}</h3>
          ${s.xp ? `<div class="reward-row" style="margin-top:12px"><div class="reward-box"><div class="icon">⚡</div><div class="val">+${s.xp}</div><div class="lbl">XP</div></div><div class="reward-box"><div class="icon">🪙</div><div class="val">+${s.coins}</div><div class="lbl">叶币</div></div><div class="reward-box"><div class="icon">${qualityIcon(s.quality || 'ok')}</div><div class="val">${qualityLabel(s.quality || 'ok')}</div><div class="lbl">决策</div></div></div>` : ''}
          <p class="muted" style="font-size:11.5px">支线 ${(state.bonusDone || []).length}/${F.bonusCases.length} · 明天再来答 3 题，解锁下一个。</p>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-action="bonus-close">收下</button></div>`);
    }
    if (p.phase === 'case') {
      const c = p.caseData;
      if (!c) return '';
      if (p.caseFeedback) {
        const f = p.caseFeedback;
        return modalShell(`${modalHead('支线副本 · ' + c.title, '你做出了选择')}
          <div class="modal-body">
            <div class="q-stem" style="font-size:19px">${annotateTerms(f.opt.text)}</div>
            <div class="feedback ${qualityClass(f.quality)}"><div class="feedback-head">${qualityIcon(f.quality)} ${qualityLabel(f.quality)}</div><p>${annotateTerms(f.opt.feedback)}</p></div>
            <div class="reward-row" style="margin-top:14px"><div class="reward-box"><div class="icon">⚡</div><div class="val">+${f.xp}</div><div class="lbl">XP</div></div><div class="reward-box"><div class="icon">🪙</div><div class="val">+${f.coins}</div><div class="lbl">叶币</div></div><div class="reward-box"><div class="icon">🧭</div><div class="val">${(state.bonusDone || []).length}</div><div class="lbl">支线</div></div></div>
          </div>
          <div class="modal-foot"><button class="btn btn-primary" data-action="bonus-finish">完成支线</button></div>`);
      }
      return modalShell(`${modalHead('支线副本 · ' + c.title, c.subtitle)}
        <div class="modal-body">
          <p class="event-body">${annotateTerms(c.scene)}</p>
          <div class="q-stem" style="font-size:19px;margin-top:10px">${annotateTerms(c.setup)}</div>
          <div style="margin:-6px 0 10px"><button class="term-card-btn" data-action="term" data-card="${c.concept}">📖 名词卡</button></div>
          <div class="options">${c.options.map((opt, i) => `<button class="option" data-action="bonus-case-choice" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt.text)}</span></button>`).join('')}</div>
          <div class="diag-note">支线不计入每日主循环，但会影响概念掌握度和支线档案。</div>
        </div>`);
    }
    const q = p.questions[p.index];
    if (!q) return '';
    const points = Math.min(3, (state.bonus && state.bonus.points) || 0);
    const canUnlock = points >= 3 && !!(state.bonus && state.bonus.caseId);
    if (p.feedback) {
      const correct = p.feedback.correct;
      return modalShell(`${modalHead('🎁 今日加练 · 支线探索', `第 ${p.index + 1} / ${p.questions.length} 题 · 探索点 ${points}/3`)}
        <div class="modal-body">
          <div class="q-stem" style="font-size:19px">${annotateTerms(q.stem)}</div>
          <div class="options">${q.options.map((opt, i) => {
            let cls = 'dim';
            if (i === q.answer) cls = 'correct';
            else if (i === p.answers[q.id]) cls = 'wrong';
            return `<button class="option ${cls}" disabled><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`;
          }).join('')}</div>
          <div class="feedback ${correct ? 'good' : 'bad'}"><div class="feedback-head">${correct ? '✅ 答对了' : '❌ 答错了'} <span class="muted" style="font-weight:400;font-size:11px">+${p.feedback.xp} XP</span></div><p>${annotateTerms(q.explain)}</p></div>
          ${p.feedback.caseUnlocked ? '<div class="achievement"><span class="achievement-icon">🎁</span><div><div class="achievement-title">支线副本已解锁</div><div class="achievement-desc">探索点已满 3 点，下一屏进入支线。</div></div></div>' : ''}
          <div class="modal-foot"><button class="btn btn-primary" data-action="bonus-next">${canUnlock ? '查看支线 →' : (p.index >= p.questions.length - 1 ? '完成加练' : '下一题 →')}</button></div>
        </div>`);
    }
    return modalShell(`${modalHead('🎁 今日加练 · 支线探索', `第 ${p.index + 1} / ${p.questions.length} 题 · 探索点 ${points}/3`)}
      <div class="modal-body">
        <div class="bar pink"><span style="width:${(points / 3) * 100}%"></span></div>
        <div class="q-stem" style="font-size:19px;margin-top:12px">${annotateTerms(q.stem)}</div>
        <div style="margin:-6px 0 10px"><button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button></div>
        <div class="options">${q.options.map((opt, i) => `<button class="option" data-action="bonus-answer" data-qid="${q.id}" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`).join('')}</div>
        <div class="diag-note">答错也有 1 点探索点；3 点解锁一个支线副本。</div>
      </div>`);
  }

  function renderPracticeModal() {
    const p = ui.practice;
    if (!p) return '';
    const node = p.nodeId ? nodeById(p.nodeId) : null;
    const title = node ? `加练 · ${node.title}` : '随机加练';
    const mixedNote = p.mixedNext ? ' · 含同线新题' : '';
    if (p.done) {
      return modalShell(`${modalHead(title, '加练完成')}
        <div class="modal-body center" style="padding:10px 0">
          ${mascotSVG(4, 'happy', state.player.activeCosmetics)}
          <h3 style="font-size:24px;margin-top:4px">+${p.xp} XP</h3>
          <p class="muted" style="font-size:12px;margin-top:4px">加练不计入每日进度，但会更新掌握度和复习队列。</p>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-action="practice-close">收下</button></div>`);
    }
    const q = p.questions[p.index];
    if (!q) return '';
    if (p.feedback) {
      const correct = p.feedback.correct;
      return modalShell(`${modalHead(title, `第 ${p.index + 1} / ${p.questions.length} 题${mixedNote}`)}
        <div class="modal-body">
          <div class="q-stem" style="font-size:19px">${annotateTerms(q.stem)}</div>
          <div style="margin:-6px 0 10px"><button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button></div>
          <div class="options">${q.options.map((opt, i) => {
            let cls = 'dim';
            if (i === q.answer) cls = 'correct';
            else if (i === p.answers[p.index]) cls = 'wrong';
            return `<button class="option ${cls}" disabled><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`;
          }).join('')}</div>
          <div class="feedback ${correct ? 'good' : 'bad'}"><div class="feedback-head">${correct ? '✅ 正确' : '❌ 再想想'} <span class="muted" style="font-weight:400;font-size:11px">+${p.feedback.xp} XP</span></div><p>${annotateTerms(q.explain)}</p></div>
          <div class="modal-foot"><button class="btn btn-primary" data-action="practice-next">${p.index === p.questions.length - 1 ? '完成加练' : '下一题 →'}</button></div>
        </div>`);
    }
    return modalShell(`${modalHead(title, `第 ${p.index + 1} / ${p.questions.length} 题${mixedNote} · 答对最多 +15 XP/天`)}
      <div class="modal-body">
        ${p.mixedNext ? '<div class="diag-note" style="margin-bottom:10px">当前节点的新题已经练完，已顺带加入同线下一节点的题，避免原地重复。</div>' : ''}
        <div class="q-stem" style="font-size:19px">${annotateTerms(q.stem)}</div>
        <div style="margin:-6px 0 10px"><button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button></div>
        <div class="options">${q.options.map((opt, i) => `<button class="option" data-action="practice-answer" data-qid="${q.id}" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`).join('')}</div>
      </div>`);
  }

  function renderBossModal() {
    const b = ui.boss;
    if (!b) return '';
    if (b.result) {
      const r = b.result;
      return modalShell(`${modalHead('Boss 战结果', r.passed ? '你击破了本周 Boss' : '差一点，再来一次')}
        <div class="modal-body center" style="padding:6px 0">
          ${mascotSVG(r.passed ? 7 : 4, r.passed ? 'happy' : 'worried', state.player.activeCosmetics)}
          <div class="stat-value" style="font-size:42px">${r.score}/${r.total}</div>
          <p class="muted" style="font-size:12px">${r.passed ? '答对 5 题以上，通关。' : '答对 5 题即可通关。错题会在复习队列里再出现。'}</p>
          ${r.rewards ? `<div class="reward-row" style="margin-top:14px"><div class="reward-box"><div class="icon">⚡</div><div class="val">+${r.rewards.xp}</div><div class="lbl">XP</div></div><div class="reward-box"><div class="icon">🪙</div><div class="val">+${r.rewards.coins}</div><div class="lbl">叶币</div></div><div class="reward-box"><div class="icon">🏆</div><div class="val">${r.score}</div><div class="lbl">得分</div></div></div>` : ''}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button>${r.passed ? '' : '<button class="btn btn-primary" data-action="boss-retry">再来一次</button>'}</div>`);
    }
    if (b.index >= b.questions.length) {
      return modalShell(`${modalHead('Boss 战', '检查一下，再提交')}
        <div class="modal-body"><p>你已完成 ${b.questions.length} 道题。提交后一次性判分，答对 5 道通关。</p><div class="bar"><span style="width:100%"></span></div></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">退出</button><button class="btn btn-primary" data-action="boss-submit">提交答卷 →</button></div>`);
    }
    const q = b.questions[b.index];
    return modalShell(`${modalHead('⚔️ 周末 Boss 战', `第 ${b.index + 1} / ${b.questions.length} 题 · 答对 5 题通关`)}
      <div class="modal-body">
        <div class="bar"><span style="width:${(b.index / b.questions.length) * 100}%"></span></div>
        <div class="q-stem" style="font-size:20px;margin-top:14px">${annotateTerms(q.stem)}</div>
        <div style="margin:-6px 0 10px"><button class="term-card-btn" data-action="term" data-card="${q.concept}">📖 名词卡</button></div>
        <div class="options">${q.options.map((opt, i) => `<button class="option" data-action="boss-answer" data-choice="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${annotateTerms(opt)}</span></button>`).join('')}</div>
      </div>`);
  }

  function renderCodeModal() {
    const c = ui.code && ui.code.challenge;
    const total = F.codeChallenges.length;
    const done = (state.codeDone || []).length;
    if (!c) return '';
    if (done >= total && !(ui.code.feedback)) {
      return modalShell(`${modalHead('🧪 代码副本', '量化热身完成')}
        <div class="modal-body center" style="padding:8px 0">
          ${mascotSVG(6, 'happy', state.player.activeCosmetics)}
          <h3 style="font-size:24px">${done}/${total} 全部完成</h3>
          <p class="muted" style="font-size:12px;margin-top:4px">你已经读过收益率、年化波动、分组均值、未来函数、蒙特卡洛和表连接。下一步：自己写一个含交易成本的回测。</p>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-action="code-close">收下</button></div>`);
    }
    const fb = ui.code.feedback;
    return modalShell(`${modalHead('🧪 代码副本 · ' + c.title, `已通关 ${done}/${total} · ${trackMeta(c.track).name} · 难度 ${c.difficulty}/5`)}
      <div class="modal-body">
        <pre class="code-block">${esc(c.snippet)}</pre>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:-2px"><span class="muted" style="font-size:10.5px">先读代码，再判断输出或问题</span><button class="btn btn-sm btn-ghost" data-action="copy-code">复制代码</button></div>
        <div class="q-stem" style="font-size:18px;margin-top:12px">${esc(c.stem)}</div>
        <div class="options">${c.options.map((opt, i) => {
          let cls = '';
          if (fb) {
            cls = i === c.answer ? 'correct' : i === ui.code.choice ? 'wrong' : 'dim';
          }
          return `<button class="option ${cls}" ${fb ? 'disabled' : `data-action="code-answer" data-choice="${i}"`}><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${esc(opt)}</span></button>`;
        }).join('')}</div>
        ${fb ? `<div class="feedback ${fb.correct ? 'good' : 'bad'}"><div class="feedback-head">${fb.correct ? '✅ 读对了' : '❌ 再看一眼'} <span class="muted" style="font-weight:400;font-size:11px">${fb.first ? `+${fb.xp} XP` : '已练习过'}</span></div><p>${esc(fb.explain)}</p></div>` : ''}
      </div>
      <div class="modal-foot">${fb ? `<button class="btn btn-primary" data-action="code-next">${done >= total ? '完成' : '下一段 →'}</button>` : '<button class="btn btn-ghost" data-action="close-modal">先退出</button>'}</div>`);
  }

  /* ============================================================
     actions
     ============================================================ */
  function startDiagnostic() {
    const kQs = F.diagnosticIds.map(questionById).filter(Boolean);
    const queue = kQs.map(q => ({ kind: 'knowledge', q })).concat(F.riskQuestions.map(q => ({ kind: 'risk', q })));
    ui.onboarding = { step: 'quiz', index: 0, answers: [], riskAnswers: [], queue, selected: null, result: null };
    render();
  }

  function nextDiagnostic() {
    const ob = ui.onboarding;
    const item = ob.queue[ob.index];
    if (!item || ob.selected === null) return toast('先选一个答案', 'bad');
    if (item.kind === 'knowledge') ob.answers.push({ qid: item.q.id, choice: ob.selected });
    else ob.riskAnswers.push({ qid: item.q.id, choice: ob.selected });
    ob.index += 1;
    ob.selected = null;
    if (ob.index >= ob.queue.length) {
      const out = E.onboard(state, ob.answers, ob.riskAnswers);
      ob.result = out;
      ob.step = 'result';
      persist();
    }
    render();
  }

  function enterGreenhouse() {
    ui.onboarding.step = 'done';
    view = 'today';
    E.ensureDaily(state);
    E.refreshDerived(state);
    persist();
    render();
    celebrate();
  }

  function openPractice(nodeId) {
    const node = nodeId ? nodeById(nodeId) : null;
    const track = node ? node.track : 'mixed';
    const questions = E.getPracticeQuestions(state, track, 3, nodeId || null);
    const mixedNext = !!(node && questions.some(q => !node.concepts.includes(q.concept)));
    ui.practice = { nodeId: nodeId || null, track, questions, index: 0, answers: [], feedback: null, xp: 0, done: false, mixedNext };
    ui.modal = { type: 'practice' };
    render();
  }

  function openBonus() {
    if (!state.daily || state.daily.stage !== 'done') return toast('先完成今日副本，再来加练', 'bad');
    const b = E.ensureBonus(state);
    if (b.caseDone) return toast('今日支线已经完成，明天再来', 'gold');
    if ((state.bonusDone || []).length >= F.bonusCases.length) return toast('全部支线副本已集齐', 'gold');
    if (b.points >= 3 && b.caseId) {
      const c = F.bonusCases.find(x => x.id === b.caseId) || E.getBonusCase(state);
      if (!c) return toast('全部支线副本已集齐', 'gold');
      ui.bonus = { phase: 'case', questions: [], index: 0, answers: {}, feedback: null, caseData: c, caseFeedback: null, summary: null };
      ui.modal = { type: 'bonus' };
      render();
      return;
    }
    const questions = E.getBonusQuestions(state);
    if (!questions.length) return toast('今天的加练题已经答完了', 'gold');
    const answered = new Set((b.answers || []).map(a => a.qid));
    let idx = 0;
    while (idx < questions.length && answered.has(questions[idx].id)) idx++;
    if (idx >= questions.length) {
      if (b.points >= 3) {
        const c = E.getBonusCase(state);
        if (c) {
          b.caseId = c.id;
          ui.bonus = { phase: 'case', questions: [], index: 0, answers: {}, feedback: null, caseData: c, caseFeedback: null, summary: null };
          ui.modal = { type: 'bonus' };
          render();
          return;
        }
        return toast('全部支线副本已集齐', 'gold');
      }
      idx = 0;
    }
    ui.bonus = { phase: 'quiz', questions, index: idx, answers: {}, feedback: null, caseData: null, caseFeedback: null, summary: null };
    ui.modal = { type: 'bonus' };
    render();
  }

  function openBoss() {
    const w = E.getWeekStats(state);
    if (w.days < 5) return toast(`再完成 ${w.daysToBoss} 天每日副本`, 'bad');
    if (w.bossDone) return toast('本周 Boss 已通关', 'gold');
    const questions = E.getBossQuestions(state);
    ui.boss = { questions, index: 0, answers: [], result: null };
    ui.modal = { type: 'boss' };
    render();
  }

  function exportSave() {
    try {
      const blob = new Blob([E.exportState(state)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leek-finance-save-${E.todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('存档已导出');
    } catch (e) {
      toast('导出失败：' + e.message, 'bad');
    }
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = E.importState(String(reader.result || ''));
        state = next;
        E.refreshDerived(state);
        E.ensureDaily(state);
        persist();
        ui.modal = null;
        ui.feedback = null;
        ui.tradeTarget = null;
        ui.onboarding.step = 'done';
        view = 'today';
        render();
        toast('存档已导入');
      } catch (e) {
        toast('导入失败：' + e.message, 'bad');
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) { closeModal(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    switch (action) {
      case 'open-online':
        window.location.href = 'online.html';
        break;
      case 'nav':
        view = el.dataset.view || 'today';
        ui.modal = null;
        render();
        window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
        break;
      case 'hero-cta': {
        const d = E.ensureDaily(state);
        if (d.stage === 'done') { view = 'skills'; render(); }
        else document.getElementById('quest-anchor')?.scrollIntoView({ behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
        break;
      }
      case 'start-diag': startDiagnostic(); break;
      case 'skip-onboard':
        E.skipOnboarding(state);
        ui.onboarding.step = 'done';
        view = 'today';
        E.ensureDaily(state);
        persist();
        render();
        toast('已使用默认起点，之后答题会自动校准');
        break;
      case 'diag-option':
        ui.onboarding.selected = Number(el.dataset.choice);
        render();
        break;
      case 'diag-next': nextDiagnostic(); break;
      case 'enter-greenhouse': enterGreenhouse(); break;
      case 'start-quiz':
        E.startQuiz(state);
        ui.feedback = null;
        ui.hint = null;
        persist();
        render();
        break;
      case 'answer': {
        const qid = el.dataset.qid;
        const choice = Number(el.dataset.choice);
        try {
          const res = E.answerQuestion(state, qid, choice);
          ui.feedback = res;
          ui.hint = null;
          persist();
          render();
          if (res.achievements && res.achievements.length) toast(`成就解锁：${res.achievements[0].title} +${res.achievements[0].coins} 叶币`, 'gold');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'hint': {
        const res = E.getHint(state, el.dataset.qid);
        if (!res.ok) toast(res.msg, 'bad');
        else { ui.hint = { qid: el.dataset.qid, hide: res.hide }; persist(); render(); toast('已排除一个错误选项'); }
        break;
      }
      case 'next-question':
        ui.feedback = null;
        ui.hint = null;
        persist();
        render();
        break;
      case 'case-choice':
        try {
          E.chooseCase(state, el.dataset.case, Number(el.dataset.choice));
          persist();
          render();
        } catch (err) { toast(err.message, 'bad'); }
        break;
      case 'case-continue':
        if (state.daily && state.daily.stage === 'case') state.daily.stage = 'trade';
        persist();
        render();
        break;
      case 'preset': {
        const presets = {
          conservative: { bond: 55, hs300: 20, gold: 10, tech: 0 },
          balanced: { bond: 30, hs300: 35, gold: 15, tech: 10 },
          aggressive: { bond: 10, hs300: 45, gold: 10, tech: 30 },
          allcash: { bond: 0, hs300: 0, gold: 0, tech: 0 }
        };
        ui.tradeTarget = Object.assign({}, presets[el.dataset.preset] || presets.balanced);
        render();
        break;
      }
      case 'trade-confirm': {
        const a = currentTargetAlloc();
        if (a.total > 100.5) return toast('配置比例不能超过 100%', 'bad');
        try {
          const res = E.rebalance(state, { cash: a.cash, bond: a.bond, hs300: a.hs300, gold: a.gold, tech: a.tech }, {});
          ui.tradeTarget = null;
          persist();
          render();
          if (res.achievements && res.achievements.length) toast(`成就解锁：${res.achievements[0].title}`, 'gold');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'trade-hold':
        try {
          E.rebalance(state, null, { hold: true });
          ui.tradeTarget = null;
          persist();
          render();
          toast('保持不动也是一种决策');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      case 'settle': {
        const r = E.settleDay(state);
        if (!r) return toast('还没有完成调仓', 'bad');
        ui.feedback = null;
        ui.hint = null;
        ui.justSettled = true;
        persist();
        render();
        if (r.achievements && r.achievements.length) toast(`成就解锁：${r.achievements[0].title}`, 'gold');
        break;
      }
      case 'skill-tab':
        ui.skillTab = el.dataset.track;
        render();
        break;
      case 'open-track':
        ui.skillTab = el.dataset.track;
        view = 'skills';
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'codex-filter':
        ui.codexFilter = el.dataset.filter;
        render();
        break;
      case 'term': {
        const card = el.dataset.card ? termCard(el.dataset.card) : (el.dataset.term ? resolveTerm(el.dataset.term) : null);
        if (!card) return toast('这个名词还没有卡片', 'bad');
        ui.modal = { type: 'concept', data: card };
        renderModal();
        break;
      }
      case 'concept': {
        const c = conceptById(el.dataset.concept);
        if (!c) return;
        if (!state.player.unlockedConcepts.includes(c.id)) return toast('先在小测或副本里遇到它', 'bad');
        ui.modal = { type: 'concept', data: c };
        renderModal();
        break;
      }
      case 'bonus-open':
        openBonus();
        break;
      case 'bonus-answer': {
        const p = ui.bonus;
        if (!p || p.phase !== 'quiz') return;
        const q = p.questions[p.index];
        if (!q) return;
        try {
          const choice = Number(el.dataset.choice);
          const res = E.recordBonusAnswer(state, q.id, choice);
          p.answers[q.id] = choice;
          p.feedback = res;
          persist();
          render();
          if (res.achievements && res.achievements.length) toast(`成就解锁：${res.achievements[0].title}`, 'gold');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'bonus-next': {
        const p = ui.bonus;
        if (!p) return;
        const b = state.bonus || {};
        if (b.points >= 3 && b.caseId) {
          const c = F.bonusCases.find(x => x.id === b.caseId);
          if (c) {
            p.phase = 'case';
            p.caseData = c;
            p.caseFeedback = null;
            p.feedback = null;
            persist();
            render();
            break;
          }
        }
        if (b.points >= 3) {
          p.phase = 'done';
          p.summary = {};
          persist();
          render();
          break;
        }
        if (p.index + 1 < p.questions.length) {
          p.index += 1;
          p.feedback = null;
          persist();
          render();
        } else {
          p.phase = 'done';
          p.summary = {};
          persist();
          render();
        }
        break;
      }
      case 'bonus-case-choice': {
        const p = ui.bonus;
        if (!p || p.phase !== 'case' || !p.caseData) return;
        try {
          const res = E.chooseBonusCase(state, p.caseData.id, Number(el.dataset.choice));
          if (res.already) return toast('这个支线已经完成了', 'gold');
          p.caseFeedback = res;
          persist();
          render();
          if (res.achievements && res.achievements.length) toast(`成就解锁：${res.achievements[0].title}`, 'gold');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'bonus-finish': {
        const p = ui.bonus;
        if (!p) return;
        const f = p.caseFeedback || {};
        p.phase = 'done';
        p.summary = {
          caseTitle: p.caseData ? p.caseData.title : '',
          xp: f.xp || 0,
          coins: f.coins || 0,
          quality: f.quality || 'ok'
        };
        persist();
        render();
        break;
      }
      case 'bonus-close':
        ui.bonus = null;
        ui.modal = null;
        render();
        break;
      case 'practice-node': openPractice(el.dataset.node); break;
      case 'practice-random': openPractice(null); break;
      case 'practice-answer': {
        const p = ui.practice;
        if (!p) return;
        try {
          const res = E.recordPracticeAnswer(state, el.dataset.qid, Number(el.dataset.choice));
          p.answers[p.index] = Number(el.dataset.choice);
          p.feedback = res;
          p.xp += res.xp;
          persist();
          render();
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'practice-next': {
        const p = ui.practice;
        if (!p) return;
        if (p.index >= p.questions.length - 1) p.done = true;
        else { p.index += 1; p.feedback = null; }
        render();
        break;
      }
      case 'practice-close':
        ui.practice = null;
        ui.modal = null;
        render();
        break;
      case 'boss-open': openBoss(); break;
      case 'boss-answer': {
        const b = ui.boss;
        if (!b) return;
        b.answers[b.index] = Number(el.dataset.choice);
        b.index += 1;
        renderModal();
        break;
      }
      case 'boss-submit': {
        const b = ui.boss;
        if (!b) return;
        const answers = b.questions.map((q, i) => ({ qid: q.id, choice: b.answers[i] }));
        const res = E.submitBoss(state, answers);
        b.result = res;
        persist();
        render();
        if (res.passed) celebrate();
        break;
      }
      case 'boss-retry': {
        const questions = E.getBossQuestions(state);
        ui.boss = { questions, index: 0, answers: [], result: null };
        render();
        break;
      }
      case 'code-open':
        ui.code = { challenge: E.getCodeChallenge(state), feedback: null, choice: null };
        ui.modal = { type: 'code' };
        render();
        break;
      case 'code-answer': {
        if (!ui.code) return;
        try {
          const c = ui.code.challenge;
          const res = E.recordCodeAnswer(state, c.id, Number(el.dataset.choice));
          ui.code.feedback = res;
          ui.code.choice = Number(el.dataset.choice);
          persist();
          render();
          if (res.achievements && res.achievements.length) toast(`成就解锁：${res.achievements[0].title}`, 'gold');
        } catch (err) { toast(err.message, 'bad'); }
        break;
      }
      case 'code-next':
        ui.code = { challenge: E.getCodeChallenge(state), feedback: null, choice: null };
        render();
        break;
      case 'code-close':
        ui.code = null;
        ui.modal = null;
        render();
        break;
      case 'copy-code':
        if (ui.code && navigator.clipboard) {
          navigator.clipboard.writeText(ui.code.challenge.snippet).then(() => toast('代码已复制')).catch(() => toast('复制失败', 'bad'));
        } else {
          toast('当前浏览器不支持自动复制', 'bad');
        }
        break;
      case 'shop-open':
        ui.modal = { type: 'shop' };
        renderModal();
        break;
      case 'settings-open':
        ui.modal = { type: 'settings' };
        renderModal();
        break;
      case 'buy': {
        const res = E.buyItem(state, el.dataset.item);
        toast(res.msg, res.ok ? 'gold' : 'bad');
        if (res.ok) { persist(); render(); }
        break;
      }
      case 'toggle-motion':
        state.settings.reduceMotion = !state.settings.reduceMotion;
        persist();
        render();
        break;
      case 'export': exportSave(); break;
      case 'cloud-sync':
        if (!window.LeekCloudSave) { toast('云存档脚本未加载', 'bad'); break; }
        window.LeekCloudSave.syncNow()
          .then(() => toast('云存档已同步'))
          .catch(e => toast('云存档同步失败：' + e.message, 'bad'));
        break;
      case 'import': document.getElementById('import-file')?.click(); break;
      case 'reset':
        ui.modal = { type: 'confirm-reset' };
        renderModal();
        break;
      case 'reset-confirm':
        state = E.reset();
        ui.onboarding = { step: 'welcome', index: 0, answers: [], riskAnswers: [], queue: [], selected: null, result: null };
        ui.feedback = null; ui.hint = null; ui.tradeTarget = null; ui.modal = null; ui.practice = null; ui.boss = null;
        view = 'today';
        persist();
        render();
        toast('已重置，重新开始');
        break;
      case 'close-modal': closeModal(); break;
      default: break;
    }
  });

  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.matches('[data-alloc]')) {
      if (!ui.tradeTarget) ensureTradeTarget();
      const key = t.dataset.alloc;
      ui.tradeTarget[key] = Number(t.value) || 0;
      const a = currentTargetAlloc();
      const fee = estimateTrade();
      const sumEl = document.getElementById('alloc-sum');
      const feeEl = document.getElementById('fee-est');
      const cashEl = document.getElementById('cash-pct');
      const cashBar = document.getElementById('cash-bar');
      const totalEl = document.getElementById('alloc-total');
      const donutEl = document.querySelector('.donut');
      ['bond', 'hs300', 'gold', 'tech'].forEach(k => {
        const v = document.getElementById('alloc-val-' + k);
        if (v) v.textContent = Math.round(Number(ui.tradeTarget[k]) || 0) + '%';
      });
      if (sumEl) sumEl.textContent = a.total + '%';
      if (feeEl) feeEl.textContent = fmtMoney(fee.fee);
      if (cashEl) cashEl.textContent = Math.round(a.cash) + '%';
      if (cashBar) cashBar.style.width = a.cash + '%';
      if (totalEl) totalEl.classList.toggle('warn', a.total > 100.5);
      const btn = document.getElementById('trade-confirm');
      if (btn) btn.disabled = a.total > 100.5;
      if (donutEl) donutEl.style.background = donutGradient(a);
    }
    if (t.id === 'import-file' && t.files && t.files[0]) handleImportFile(t.files[0]);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.modal) closeModal();
  });

  /* ============================================================
     boot
     ============================================================ */
  const bootParams = new URLSearchParams(window.location.search);
  if (!state.player.onboarded && bootParams.get('demo') === '1') {
    E.skipOnboarding(state);
    E.ensureDaily(state);
    persist();
  }
  if (state.player.onboarded) {
    ui.onboarding.step = 'done';
    E.ensureDaily(state);
    E.refreshDerived(state);
    E.save(state);
  }
  if (bootParams.get('demo') === '1' && state.daily) {
    const bootStage = bootParams.get('stage');
    if (['quiz', 'case', 'trade'].includes(bootStage)) {
      state.daily.stage = bootStage;
      E.save(state);
    }
  }
  if (TRACKS.includes(bootParams.get('track'))) ui.skillTab = bootParams.get('track');
  const bootView = bootParams.get('view');
  if (['today', 'skills', 'portfolio', 'codex', 'review'].includes(bootView)) view = bootView;
  render();
})();
