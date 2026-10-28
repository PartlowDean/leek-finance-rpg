(function () {
  'use strict';

  const F = window.FIN;
  const Game = F.OnlineGame;
  const SB = window.LeekSupabase;
  const app = document.getElementById('online-app');

  function readStored(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  const S = {
    service: null,
    session: null,
    profile: null,
    view: 'auth',
    room: null,
    players: [],
    activities: [],
    online: [],
    roomOnline: [],
    pendingRoomCode: (new URLSearchParams(location.search).get('room') || '').toUpperCase(),
    busy: false,
    error: '',
    fatal: '',
    emailSent: false,
    authMode: 'guest',
    installPrompt: null,
    ui: {
      nickname: readStored('leek_online_nickname'),
      email: '',
      setupUrl: '',
      setupKey: '',
      joinCode: '',
      game: 'coop',
      showSetupKey: false
    },
    game: {
      allocation: Object.assign({}, Game.DEFAULT_ALLOC),
      allocationDay: 0,
      resolving: false,
      lastResolved: null
    }
  };

  let lobbyChannel = null;
  let activityChannel = null;
  let roomChannel = null;
  let roomPresence = null;
  let roomPoll = null;

  /* ============================================================
     helpers
     ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function money(n) { return '¥' + Math.round(Number(n) || 0).toLocaleString('zh-CN'); }
  function pct(n) { const v = (Number(n) || 0) * 100; return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
  function qualityLabel(q) { return q === 'good' ? '优质决策' : q === 'ok' ? '可接受' : '高风险决策'; }
  function qualityClass(q) { return q === 'good' ? 'good' : q === 'ok' ? 'ok' : 'bad'; }
  function qualityIcon(q) { return q === 'good' ? '✅' : q === 'ok' ? '🟡' : '⚠️'; }
  function usernameOf(id) {
    const p = S.players.find(x => x.user_id === id);
    return p ? p.nickname : '玩家';
  }
  function isHost() { return !!(S.room && S.profile && S.room.host_id === S.profile.id); }
  function playerOnline(id) { return S.roomOnline.some(x => x.user_id === id); }
  function onlineInfo(id) { return S.online.find(x => x.user_id === id) || null; }
  function readLocalProgress() {
    try {
      const raw = localStorage.getItem('leek_finance_rpg_v1');
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const p = saved && saved.player ? saved.player : null;
      if (!p) return null;
      return {
        level: Math.max(1, Number(p.level) || 1),
        xp: Math.max(0, Number(p.xp) || 0),
        streak: Math.max(0, Number(p.streak) || 0)
      };
    } catch (e) { return null; }
  }
  async function syncProfileProgress() {
    if (!S.profile || !S.session) return;
    const p = readLocalProgress();
    if (!p) return;
    try {
      S.profile = await S.service.upsertProfile(S.session.user.id, {
        level: p.level,
        xp: p.xp,
        streak: p.streak
      });
    } catch (e) {
      console.warn('sync progress', e);
    }
  }
  function newMatchId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function makeCoopState(playerIds) {
    const state = Game.createCoopState(Date.now(), playerIds);
    state.matchId = newMatchId();
    return state;
  }
  function makePortfolioState(playerIds) {
    const state = Game.createPortfolioState(Date.now(), playerIds, 5);
    state.matchId = newMatchId();
    return state;
  }
  function sameMatch(choice, state) {
    return !!(choice && state && choice.matchId === state.matchId);
  }

  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => el.remove(), 2900);
  }

  function handleError(e) {
    console.error(e);
    S.busy = false;
    S.error = e && e.message ? e.message : String(e);
    render();
    toast(S.error, 'bad');
  }

  function timeLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }

  /* ============================================================
     boot / auth
     ============================================================ */
  async function boot() {
    if (!SB) {
      S.fatal = 'Supabase 适配器没有加载';
      S.view = 'setup';
      render();
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      S.fatal = 'Supabase JS 没有加载成功，请检查 js/vendor/supabase.js 是否存在';
      S.view = 'setup';
      render();
      return;
    }
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo) {
      setupDemo(demo);
      return;
    }
    const c = SB.getConfig();
    S.ui.setupUrl = c.supabaseUrl;
    S.ui.setupKey = c.supabaseAnonKey;
    if (!SB.isConfigured()) {
      S.view = 'setup';
      render();
      return;
    }
    try {
      S.service = SB.createService();
      S.service.onAuthStateChange(async (session, event) => {
        if (event === 'SIGNED_OUT') {
          S.session = null; S.profile = null; S.view = 'auth';
          cleanupGlobal(); cleanupRoom();
          render();
          return;
        }
        if (S.busy) return;
        if (session && !S.session) {
          S.session = session;
          await afterSession();
        }
      });
      const session = await S.service.getSession();
      if (session) {
        S.session = session;
        await afterSession();
      } else {
        S.view = 'auth';
        render();
      }
    } catch (e) {
      S.fatal = e.message;
      S.view = 'setup';
      render();
    }
  }

  function setupDemo(mode) {
    const p1 = { id: 'u1', nickname: '韭菜一号', avatar: '🌱' };
    const p2 = { id: 'u2', nickname: '韭菜二号', avatar: '🌿' };
    S.profile = p1;
    S.online = [p1, p2];
    S.roomOnline = [
      { user_id: 'u1', nickname: p1.nickname, avatar: p1.avatar },
      { user_id: 'u2', nickname: p2.nickname, avatar: p2.avatar }
    ];
    S.activities = [
      { id: 1, nickname: p1.nickname, text: '创建了合作剧情房间 ABC12', created_at: new Date(Date.now() - 120000).toISOString() },
      { id: 2, nickname: p2.nickname, text: '加入了房间 ABC12', created_at: new Date(Date.now() - 90000).toISOString() },
      { id: 3, nickname: p1.nickname, text: '在合作剧情第 1 轮提交了选择', created_at: new Date(Date.now() - 40000).toISOString() }
    ];
    S.service = null;
    S.error = '';

    if (mode === 'coop' || mode === 'coop-reveal') {
      let state = Game.createCoopState(123, ['u1', 'u2']);
      if (mode === 'coop-reveal') {
        const c = Game.caseById(state.caseIds[0]);
        const good = c.options.findIndex(o => o.quality === 'good');
        const bad = c.options.findIndex(o => o.quality === 'bad');
        state = Game.resolveCoop(state, {
          u1: { round: 1, index: good },
          u2: { round: 1, index: bad }
        });
      }
      S.room = { id: 'demo-coop', code: 'ABC12', game: 'coop', status: 'playing', host_id: 'u1', state };
      S.players = [
        { user_id: 'u1', nickname: p1.nickname, choice: null },
        { user_id: 'u2', nickname: p2.nickname, choice: null }
      ];
      S.view = 'room';
    } else if (mode === 'portfolio' || mode === 'portfolio-result') {
      let state = Game.createPortfolioState(42, ['u1', 'u2'], 5);
      if (mode === 'portfolio-result') {
        const allocation = { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 };
        state = Game.portfolioDay(state, {
          u1: { day: 1, allocation },
          u2: { day: 1, allocation: { cash: 5, bond: 15, hs300: 40, gold: 10, tech: 30 } }
        });
      }
      S.room = { id: 'demo-portfolio', code: 'PK123', game: 'portfolio', status: 'playing', host_id: 'u1', state };
      S.players = [
        { user_id: 'u1', nickname: p1.nickname, choice: null },
        { user_id: 'u2', nickname: p2.nickname, choice: null }
      ];
      S.view = 'room';
    } else {
      S.room = null;
      S.view = 'home';
    }
    render();
  }

  async function afterSession() {
    if (!S.session) return;
    const profile = await S.service.getProfile(S.session.user.id);
    if (profile) {
      S.profile = profile;
      await syncProfileProgress();
      await enterHome();
    } else {
      S.view = 'nickname';
      render();
    }
  }

  async function enterHome() {
    cleanupGlobal();
    cleanupRoom();
    S.room = null;
    S.players = [];
    S.view = 'home';
    S.error = '';
    render();
    await loadActivities();
    subscribeGlobal();
    if (S.pendingRoomCode) {
      const code = S.pendingRoomCode;
      S.pendingRoomCode = '';
      setTimeout(() => joinRoom(code), 250);
      return;
    }
    maybeRejoin();
  }

  async function maybeRejoin() {
    if (!S.service || !S.profile) return;
    let roomId = '';
    try { roomId = localStorage.getItem('leek_online_room') || ''; } catch (e) { /* ignore */ }
    if (!roomId) return;
    try {
      const room = await S.service.getRoom(roomId);
      if (!room) { localStorage.removeItem('leek_online_room'); return; }
      const players = await S.service.listPlayers(roomId);
      if (!players.some(p => p.user_id === S.profile.id)) {
        localStorage.removeItem('leek_online_room');
        return;
      }
      await enterRoom(room);
    } catch (e) {
      console.warn('auto rejoin', e);
    }
  }

  async function loadActivities() {
    if (!S.service) return;
    try {
      S.activities = await S.service.listActivities(30);
      render();
    } catch (e) {
      // 活动流失败不阻塞主流程
      console.warn('activities', e);
    }
  }

  function subscribeGlobal() {
    if (!S.service || !S.profile) return;
    cleanupGlobal();
    lobbyChannel = S.service.subscribePresence('leek:lobby', S.profile, list => {
      S.online = list;
      render();
    });
    activityChannel = S.service.subscribeActivities(row => {
      if (!row) return;
      if (!S.activities.some(a => a.id === row.id)) {
        S.activities = [row].concat(S.activities).slice(0, 30);
        render();
      }
    });
  }

  function cleanupGlobal() {
    if (!S.service) return;
    if (lobbyChannel) { S.service.removeChannel(lobbyChannel); lobbyChannel = null; }
    if (activityChannel) { S.service.removeChannel(activityChannel); activityChannel = null; }
  }

  function cleanupRoom() {
    if (S.service) {
      if (roomChannel) { S.service.removeChannel(roomChannel); roomChannel = null; }
      if (roomPresence) { S.service.removeChannel(roomPresence); roomPresence = null; }
    }
    if (roomPoll) { clearInterval(roomPoll); roomPoll = null; }
    S.roomOnline = [];
  }

  async function signOut() {
    cleanupGlobal();
    cleanupRoom();
    try { await S.service.signOut(); } catch (e) { /* ignore */ }
    S.session = null;
    S.profile = null;
    S.room = null;
    S.online = [];
    S.activities = [];
    S.roomOnline = [];
    S.view = 'auth';
    render();
  }

  async function anonymousLogin() {
    if (S.busy) return;
    const nickname = String(S.ui.nickname || '').trim();
    if (nickname.length < 2) return toast('昵称至少 2 个字', 'bad');
    S.busy = true;
    try {
      await S.service.signInAnonymous();
      const session = await S.service.getSession();
      S.session = session;
      const profile = await S.service.upsertProfile(session.user.id, { nickname, avatar: '🌱' });
      S.profile = profile;
      writeStored('leek_online_nickname', nickname);
      await syncProfileProgress();
      S.busy = false;
      await enterHome();
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  async function saveNickname() {
    const nickname = String(S.ui.nickname || '').trim();
    if (nickname.length < 2) return toast('昵称至少 2 个字', 'bad');
    if (!S.session) return;
    S.busy = true;
    try {
      S.profile = await S.service.upsertProfile(S.session.user.id, { nickname, avatar: '🌱' });
      writeStored('leek_online_nickname', nickname);
      await syncProfileProgress();
      S.busy = false;
      await enterHome();
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  async function emailLogin() {
    if (S.busy) return;
    const email = String(S.ui.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('请输入有效邮箱', 'bad');
    S.busy = true;
    S.error = '';
    try {
      await S.service.signInWithOtp(email);
      S.emailSent = true;
      S.busy = false;
      render();
      toast('登录链接已发送，请检查邮箱', 'gold');
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  /* ============================================================
     rooms
     ============================================================ */
  async function createRoom(game) {
    if (S.busy || !S.profile) return;
    S.busy = true;
    S.error = '';
    try {
      const room = await S.service.createRoom(game, S.profile);
      S.busy = false;
      await enterRoom(room);
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  async function joinRoom(code) {
    const normalized = String(code || S.ui.joinCode || '').trim().toUpperCase();
    if (!normalized) return toast('先输入房间码', 'bad');
    if (S.busy || !S.profile) return;
    S.busy = true;
    S.error = '';
    try {
      const room = await S.service.joinRoom(normalized, S.profile);
      S.busy = false;
      S.ui.joinCode = '';
      await enterRoom(room);
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  async function enterRoom(room) {
    cleanupRoom();
    try {
      const fresh = await S.service.getRoom(room.id);
      if (fresh) room = fresh;
    } catch (e) { /* 用传入的 room 先渲染 */ }
    S.room = room;
    S.view = 'room';
    S.error = '';
    try { localStorage.setItem('leek_online_room', room.id); } catch (e) { /* ignore */ }
    try {
      S.players = await S.service.listPlayers(room.id);
      if (S.game.allocationDay !== (room.state && room.state.day)) {
        S.game.allocation = Object.assign({}, Game.DEFAULT_ALLOC);
        S.game.allocationDay = room.state ? room.state.day : 0;
      }
      render();
      subscribeRoom(room.id);
      subscribeRoomPresence(room.id);
      if (!roomPoll) roomPoll = setInterval(() => { reloadRoom(); }, 10000);
      maybeHostResolve();
    } catch (e) {
      handleError(e);
    }
  }

  function subscribeRoom(roomId) {
    roomChannel = S.service.subscribeRoom(roomId,
      payload => {
        if (payload && payload.eventType === 'DELETE') {
          toast('房间已关闭', 'bad');
          cleanupRoom();
          S.room = null;
          enterHome();
          return;
        }
        reloadRoom();
      },
      () => reloadRoom()
    );
  }

  function subscribeRoomPresence(roomId) {
    if (!S.profile) return;
    roomPresence = S.service.subscribePresence('leek:room:' + roomId + ':presence', S.profile, list => {
      S.roomOnline = list;
      render();
    });
  }

  async function reloadRoom() {
    if (!S.room || !S.service) return;
    try {
      const room = await S.service.getRoom(S.room.id);
      if (!room) {
        toast('房间已关闭', 'bad');
        cleanupRoom();
        S.room = null;
        await enterHome();
        return;
      }
      S.room = room;
      S.players = await S.service.listPlayers(room.id);
      render();
      maybeHostResolve();
    } catch (e) {
      console.warn('reload room', e);
    }
  }

  async function hostStart() {
    if (!isHost() || S.busy) return;
    if (S.players.length < 2) return toast('等第二位玩家加入再开始', 'bad');
    S.busy = true;
    try {
      const playerIds = S.players.map(p => p.user_id);
      const state = S.room.game === 'coop'
        ? makeCoopState(playerIds)
        : makePortfolioState(playerIds);
      await S.service.updateRoom(S.room.id, { status: 'playing', state });
      S.busy = false;
      await reloadRoom();
      try {
        await S.service.insertActivity(S.profile,
          `开启了${S.room.game === 'coop' ? '合作剧情' : '模拟盘 PK'}（房间 ${S.room.code}）`,
          'start', S.room.id);
      } catch (e) { console.warn('activity', e); }
    } catch (e) {
      S.busy = false;
      handleError(e);
    }
  }

  async function maybeHostResolve() {
    if (!isHost() || !S.room || S.room.status !== 'playing' || S.game.resolving) return;
    const state = S.room.state;
    if (!state || !state.playerIds) return;
    const players = S.players;
    if (players.length < 2) return;

    if (state.game === 'coop' && state.phase === 'choose') {
      const picks = {};
      for (const p of players) {
        if (sameMatch(p.choice, state) && Number(p.choice.round) === state.round) picks[p.user_id] = p.choice;
      }
      if (Object.keys(picks).length !== state.playerIds.length) return;
      const next = Game.resolveCoop(state, picks);
      if (!next) return;
      S.game.resolving = true;
      let changed = false;
      try {
        await S.service.updateRoom(S.room.id, { state: next, status: 'playing' });
        changed = true;
        await S.service.insertActivity(S.profile,
          `第 ${state.round} 轮结果：团队 ${next.result.teamScore} 分`,
          'coop_result', S.room.id);
      } catch (e) {
        console.warn('resolve coop', e);
      } finally {
        S.game.resolving = false;
      }
      if (changed) await reloadRoom();
    }

    if (state.game === 'portfolio' && state.phase === 'alloc') {
      const choices = {};
      for (const p of players) {
        if (sameMatch(p.choice, state) && Number(p.choice.day) === state.day) choices[p.user_id] = p.choice;
      }
      if (Object.keys(choices).length !== state.playerIds.length) return;
      const next = Game.portfolioDay(state, choices);
      if (!next) return;
      S.game.resolving = true;
      let changed = false;
      try {
        await S.service.updateRoom(S.room.id, {
          state: next,
          status: next.phase === 'final' ? 'finished' : 'playing'
        });
        changed = true;
        await S.service.insertActivity(S.profile,
          `模拟盘第 ${state.day} 天结算完成`,
          'portfolio_result', S.room.id);
      } catch (e) {
        console.warn('resolve portfolio', e);
      } finally {
        S.game.resolving = false;
      }
      if (changed) await reloadRoom();
    }
  }

  async function chooseCoop(index) {
    if (!S.room || !S.profile) return;
    const state = S.room.state;
    if (!state || state.phase !== 'choose') return;
    const own = S.players.find(p => p.user_id === S.profile.id);
    if (own && sameMatch(own.choice, state) && Number(own.choice.round) === state.round) return;
    try {
      await S.service.updateChoice(S.room.id, S.profile.id, {
        matchId: state.matchId,
        round: state.round,
        index,
        at: new Date().toISOString()
      });
      await reloadRoom();
      try {
        await S.service.insertActivity(S.profile,
          `在合作剧情第 ${state.round} 轮提交了选择`,
          'coop_choice', S.room.id);
      } catch (e) { console.warn('activity', e); }
    } catch (e) { handleError(e); }
  }

  async function nextCoop() {
    if (!isHost() || !S.room || !S.room.state) return;
    const next = Game.nextCoopRound(S.room.state);
    S.busy = true;
    try {
      await S.service.updateRoom(S.room.id, {
        state: next,
        status: next.phase === 'final' ? 'finished' : 'playing'
      });
      S.busy = false;
      await reloadRoom();
    } catch (e) { S.busy = false; handleError(e); }
  }

  async function coopRematch() {
    if (!isHost()) return;
    const playerIds = S.players.map(p => p.user_id);
    const state = makeCoopState(playerIds);
    try {
      await S.service.updateRoom(S.room.id, { state, status: 'playing' });
      await reloadRoom();
    } catch (e) { handleError(e); }
  }

  async function submitPortfolio() {
    if (!S.room || !S.profile || !S.room.state) return;
    const state = S.room.state;
    if (state.phase !== 'alloc') return;
    const a = S.game.allocation;
    const risky = sum(['bond', 'hs300', 'gold', 'tech'].map(k => Math.max(0, Number(a[k]) || 0)));
    const allocation = {
      cash: Math.max(0, 100 - risky),
      bond: Math.max(0, Number(a.bond) || 0),
      hs300: Math.max(0, Number(a.hs300) || 0),
      gold: Math.max(0, Number(a.gold) || 0),
      tech: Math.max(0, Number(a.tech) || 0)
    };
    if (!Game.allocationValid(allocation)) return toast('配置合计必须是 100%', 'bad');
    const own = S.players.find(p => p.user_id === S.profile.id);
    if (own && sameMatch(own.choice, state) && Number(own.choice.day) === state.day) return;
    try {
      await S.service.updateChoice(S.room.id, S.profile.id, {
        matchId: state.matchId,
        day: state.day,
        allocation: Game.normalizeAllocation(allocation),
        at: new Date().toISOString()
      });
      await reloadRoom();
      try {
        await S.service.insertActivity(S.profile,
          `提交了模拟盘第 ${state.day} 天配置`,
          'portfolio_choice', S.room.id);
      } catch (e) { console.warn('activity', e); }
    } catch (e) { handleError(e); }
  }

  async function nextPortfolio() {
    if (!isHost() || !S.room || !S.room.state) return;
    const next = Game.nextPortfolioDay(S.room.state);
    try {
      await S.service.updateRoom(S.room.id, {
        state: next,
        status: next.phase === 'final' ? 'finished' : 'playing'
      });
      S.game.allocation = Object.assign({}, Game.DEFAULT_ALLOC);
      S.game.allocationDay = 0;
      await reloadRoom();
    } catch (e) { handleError(e); }
  }

  async function portfolioRematch() {
    if (!isHost()) return;
    const playerIds = S.players.map(p => p.user_id);
    const state = makePortfolioState(playerIds);
    try {
      await S.service.updateRoom(S.room.id, { state, status: 'playing' });
      S.game.allocation = Object.assign({}, Game.DEFAULT_ALLOC);
      S.game.allocationDay = 0;
      await reloadRoom();
    } catch (e) { handleError(e); }
  }

  async function leaveRoom() {
    if (!S.room) return;
    const host = isHost();
    if (host && S.players.length > 1 && !confirm('你是房主，离开会关闭房间。确定吗？')) return;
    try {
      await S.service.leaveRoom(S.room.id, S.profile.id, host);
    } catch (e) {
      // 即使删除失败也回到首页
      console.warn(e);
    }
    cleanupRoom();
    S.room = null;
    try { localStorage.removeItem('leek_online_room'); } catch (e) { /* ignore */ }
    await enterHome();
  }

  async function copyInvite() {
    if (!S.room) return;
    const url = location.origin + location.pathname + '?room=' + encodeURIComponent(S.room.code);
    const text = `来韭菜进化论联机：${url}（房间码 ${S.room.code}）`;
    try {
      await navigator.clipboard.writeText(text);
      toast('邀请链接已复制');
    } catch (e) {
      prompt('复制这个邀请链接给朋友：', text);
    }
  }

  /* ============================================================
     render
     ============================================================ */
  function render() {
    if (!app) return;
    if (S.view === 'setup') { app.innerHTML = renderSetup(); return; }
    if (S.view === 'auth') { app.innerHTML = renderAuth(); return; }
    if (S.view === 'nickname') { app.innerHTML = renderNickname(); return; }
    if (S.view === 'room' && S.room) { app.innerHTML = renderRoom(); return; }
    app.innerHTML = renderHome();
  }

  function topBar() {
    return `<header class="online-top">
      <a class="brand" href="index.html" style="text-decoration:none">
        <div class="brand-mark">韭</div>
        <div><div class="brand-name">韭菜进化论</div><div class="brand-sub">ONLINE · 2P</div></div>
      </a>
      <div class="online-top-right">
        <span class="chip green">● ${S.online.length} 在线</span>
        ${S.profile ? `<span class="online-user"><span class="online-avatar">${esc(S.profile.avatar || '🌱')}</span>${esc(S.profile.nickname)} <span class="muted">Lv.${Number(S.profile.level) || 1}</span></span><button class="btn btn-sm btn-ghost" data-action="signout">换账号</button>` : ''}
        ${S.session && !S.session.user.email ? '<button class="btn btn-sm btn-ghost" data-action="switch-email">邮箱登录</button>' : ''}
        ${S.installPrompt ? '<button class="btn btn-sm" data-action="install">安装到桌面</button>' : ''}
        <a class="btn btn-sm btn-ghost" href="index.html">单机版</a>
      </div>
    </header>`;
  }

  function renderSetup() {
    const stored = SB ? SB.getConfig() : { supabaseUrl: '', supabaseAnonKey: '' };
    return `<div class="online-page">
      ${topBar()}
      <div class="online-auth">
        <div class="card">
          <div class="eyebrow">ONLINE SETUP</div>
          <h1>先把联机后端接上</h1>
          <p>当前版本用 Supabase 做账号、房间和实时同步。你只需要创建一个免费 Supabase 项目，运行 <code>supabase/schema.sql</code>，然后把 URL 和 anon key 填进来。</p>
          ${S.fatal ? `<div class="online-error" style="margin-top:14px">${esc(S.fatal)}</div>` : ''}
          ${S.error ? `<div class="online-error" style="margin-top:14px">${esc(S.error)}</div>` : ''}
          <div class="online-form">
            <label class="online-note">Supabase URL</label>
            <input class="online-input" id="setup-url" value="${esc(S.ui.setupUrl || stored.supabaseUrl)}" placeholder="https://xxxx.supabase.co">
            <label class="online-note">Supabase Publishable key（或旧版 anon public key）</label>
            <input class="online-input" id="setup-key" type="password" value="${esc(S.ui.setupKey || stored.supabaseAnonKey)}" placeholder="sb_publishable_... 或 eyJ...">
            <button class="btn btn-primary" data-action="save-config">保存并连接</button>
          </div>
          <div class="online-note">
            还需要在 Supabase Dashboard 开启 <strong>Authentication → Providers → Anonymous</strong>，并运行 <code>supabase/schema.sql</code>。<br>
            详细步骤见 <a href="ONLINE_SETUP.md" target="_blank">ONLINE_SETUP.md</a>。
          </div>
          <div class="feedback-actions">
            <a class="btn btn-ghost" href="index.html">先玩单机版</a>
            <button class="btn btn-sm btn-ghost" data-action="clear-config">清除本机配置</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderAuth() {
    const guest = S.authMode !== 'email';
    return `<div class="online-page">
      ${topBar()}
      <div class="online-auth">
        <div class="card">
          <div class="eyebrow">ONLINE · 2P</div>
          <h1>两个人，<em style="color:var(--green);font-style:normal">一起玩</em>。</h1>
          <p>不同网络也能联机：一个创建房间，另一个用房间码加入。每人一个账号，进度互不覆盖。</p>
          ${S.error ? `<div class="online-error" style="margin-top:14px">${esc(S.error)}</div>` : ''}
          <div class="online-preset-row" style="margin-top:16px">
            <button class="btn btn-sm ${guest ? 'btn-primary' : 'btn-ghost'}" data-action="auth-mode" data-mode="guest">游客进入</button>
            <button class="btn btn-sm ${guest ? 'btn-ghost' : 'btn-primary'}" data-action="auth-mode" data-mode="email">邮箱登录</button>
          </div>
          ${guest ? `<div class="online-form">
            <label class="online-note">你的昵称</label>
            <input class="online-input" id="online-nickname" maxlength="12" value="${esc(S.ui.nickname)}" placeholder="例如：韭菜一号">
            <button class="btn btn-primary btn-lg" data-action="anonymous-login" ${S.busy ? 'disabled' : ''}>${S.busy ? '连接中…' : '游客进入 →'}</button>
          </div>
          <div class="online-note">游客账号只在本设备有效；换设备会创建新账号。要跨设备，用邮箱登录。</div>` : `<div class="online-form">
            <label class="online-note">邮箱</label>
            <input class="online-input" id="online-email" type="email" autocomplete="email" value="${esc(S.ui.email)}" placeholder="you@example.com">
            <button class="btn btn-primary btn-lg" data-action="email-login" ${S.busy ? 'disabled' : ''}>${S.busy ? '发送中…' : '发送登录链接 →'}</button>
          </div>
          ${S.emailSent ? '<div class="online-note" style="color:var(--green)">登录链接已发送，去邮箱点开它；会回到这个页面并自动登录。</div>' : '<div class="online-note">邮箱只用于登录和云存档，不会公开展示。首次登录后会让你填昵称。</div>'}`}
          <div class="feedback-actions"><a class="btn btn-ghost" href="index.html">先玩单机版</a></div>
        </div>
      </div>
    </div>`;
  }

  function renderNickname() {
    return `<div class="online-page">
      ${topBar()}
      <div class="online-auth">
        <div class="card">
          <div class="eyebrow">ONE MORE STEP</div>
          <h1>给自己起个名字</h1>
          <p>这个名字会显示在房间和实时动态里。</p>
          ${S.error ? `<div class="online-error" style="margin-top:14px">${esc(S.error)}</div>` : ''}
          <div class="online-form">
            <input class="online-input" id="online-nickname" maxlength="12" value="${esc(S.ui.nickname)}" placeholder="例如：韭菜一号">
            <button class="btn btn-primary" data-action="nickname-save">进入联机大厅 →</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderOnlinePeople() {
    if (!S.online.length) return '<div class="online-note">等朋友上线中…</div>';
    return `<div class="online-online-list">${S.online.map(p => `<span class="online-person"><span class="online-avatar sm">${esc(p.avatar || '🌱')}</span>${esc(p.nickname)} <span class="muted">Lv.${p.level || 1} · 🔥${p.streak || 0}</span></span>`).join('')}</div>`;
  }

  function renderFeed() {
    if (!S.activities.length) return '<div class="online-empty">还没有动态。创建房间或等朋友上线，这里会实时刷新。</div>';
    return `<div class="online-feed">${S.activities.slice(0, 30).map(a => `
      <div class="online-feed-item">
        <span class="online-avatar sm">${esc((a.nickname || '韭')[0])}</span>
        <div class="online-feed-body"><div class="online-feed-text"><strong>${esc(a.nickname || '玩家')}</strong> ${esc(a.text)}</div><div class="online-feed-time">${timeLabel(a.created_at)}</div></div>
      </div>`).join('')}</div>`;
  }

  function renderHome() {
    return `<div class="online-page">
      ${topBar()}
      <section class="online-hero">
        <div class="online-hero-copy">
          <div class="eyebrow">LIVE · 2 PLAYERS</div>
          <h1>和朋友，来一局<em>金融对决</em>。</h1>
          <p>合作剧情：两个人分别做选择，一起看结果。模拟盘 PK：同一段模拟行情，各自配置，跑 5 天看谁更稳。</p>
          <div class="feedback-actions" style="margin-top:18px">
            <button class="btn btn-primary" data-action="create-room" data-game="coop">创建合作剧情 →</button>
            <button class="btn btn-ghost" data-action="create-room" data-game="portfolio">创建模拟盘 PK</button>
          </div>
          <div class="online-invite">
            <span class="muted" style="font-size:10px">有房间码？</span>
            <input class="online-input" id="join-code" maxlength="5" style="max-width:110px;text-transform:uppercase;letter-spacing:.16em" placeholder="ABC12" value="${esc(S.ui.joinCode)}">
            <button class="btn btn-sm" data-action="join-room">加入房间</button>
          </div>
        </div>
        <div class="online-hero-side">
          <div><div class="online-online-count">${S.online.length}</div><div class="online-note">现在在线</div></div>
          ${renderOnlinePeople()}
          <div class="online-note">实时动态由 Supabase Realtime 推送；两个人都要在线才能开始。</div>
        </div>
      </section>

      <div class="online-grid">
        <div class="online-stack">
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">🎭 今日双人玩法</div><div class="online-card-sub">合作剧情 + 模拟盘 PK 都已接入。房主创建房间，朋友用房间码加入。</div></div><span class="chip green">2P</span></div>
            <div class="online-game-card">
              <div class="online-game-title">🎭 合作剧情 <span class="chip amber">推荐</span></div>
              <div class="online-game-desc">3 轮真实感决策。两人各自选择，双方都提交后实时揭晓，比较“优质决策”得分。不是对抗，是一起把题做对。</div>
              <div class="online-game-actions"><button class="btn btn-sm btn-primary" data-action="create-room" data-game="coop">创建合作房间 →</button></div>
            </div>
            <div class="online-game-card">
              <div class="online-game-title">📈 模拟盘 PK</div>
              <div class="online-game-desc">同一段模拟行情、同一个 seed，各自配置 5 个交易日。每天双方提交后结算，最后比收益和回撤。</div>
              <div class="online-game-actions"><button class="btn btn-sm" data-action="create-room" data-game="portfolio">创建 PK 房间 →</button></div>
            </div>
          </div>
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">📡 实时动态</div><div class="online-card-sub">好友创建房间、提交选择、结算结果都会实时出现。</div></div><span class="chip">LIVE</span></div>
            ${renderFeed()}
          </div>
        </div>
        <div class="online-stack">
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">🟢 在线玩家</div><div class="online-card-sub">Supabase Presence 实时在线状态。</div></div></div>
            ${S.online.length ? `<div class="online-online-list">${S.online.map(p => `<span class="online-person"><span class="online-avatar sm">${esc(p.avatar || '🌱')}</span>${esc(p.nickname)}</span>`).join('')}</div>` : '<div class="online-empty">还没有其他人在线。把链接发给朋友吧。</div>'}
          </div>
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">🔗 怎么分享</div><div class="online-card-sub">创建房间后，把邀请链接和房间码一起发给朋友。</div></div></div>
            <div class="online-note">朋友打开同一个网址 → 游客进入 → 输入房间码。不同 Wi-Fi 也可以，只要 Supabase 项目已部署。</div>
            <div class="feedback-actions"><button class="btn btn-sm btn-ghost" data-action="copy-page">复制本页链接</button></div>
          </div>
        </div>
      </div>
      ${S.error ? `<div class="online-error" style="margin-top:14px">${esc(S.error)}</div>` : ''}
      <div class="online-note" style="margin-top:18px">联机版只用于学习；模拟盘仍是模拟行情，不构成投资建议。</div>
    </div>`;
  }

  function renderRoom() {
    const room = S.room;
    const host = isHost();
    return `<div class="online-page">
      ${topBar()}
      <div class="online-room-head">
        <div>
          <div class="eyebrow">${room.game === 'coop' ? 'CO-OP STORY' : 'PORTFOLIO PK'} · ROOM</div>
          <h2 style="margin-top:4px">${room.game === 'coop' ? '合作剧情' : '模拟盘 PK'} <span class="online-room-code" style="margin-left:6px">${esc(room.code)}</span></h2>
          <div class="online-note">${room.status === 'lobby' ? '等待玩家加入' : room.status === 'finished' ? '本局已结束' : '进行中'}</div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn btn-sm" data-action="copy-invite">复制邀请</button>
          <button class="btn btn-sm btn-ghost" data-action="leave-room">离开房间</button>
        </div>
      </div>
      ${S.error ? `<div class="online-error" style="margin-bottom:12px">${esc(S.error)}</div>` : ''}
      ${room.status === 'playing' && S.players.length < 2 ? '<div class="online-error" style="margin-bottom:12px">对手已离开，本局无法继续。房主可以离开房间后重新开一局。</div>' : ''}
      <div class="online-room-layout">
        <div class="online-stack">
          ${room.status === 'lobby' ? renderLobby(host) : renderGame(room, host)}
        </div>
        <div class="online-stack">
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">👥 房间玩家</div><div class="online-card-sub">最多 2 人 · ${S.roomOnline.length} 在线</div></div></div>
            ${renderPlayers()}
            <div class="online-invite"><span class="muted" style="font-size:10px">房间码</span><span class="code">${esc(room.code)}</span><span class="muted" style="font-size:10px">发给朋友</span></div>
          </div>
          <div class="card online-card">
            <div class="online-card-head"><div><div class="online-card-title">📡 实时动态</div><div class="online-card-sub">双方操作会实时出现</div></div></div>
            ${renderFeed()}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderPlayers() {
    if (!S.players.length) return '<div class="online-empty">还没有玩家</div>';
    return S.players.map(p => {
      const host = S.room && p.user_id === S.room.host_id;
      const info = onlineInfo(p.user_id);
      return `<div class="online-player">
        <span class="online-dot ${playerOnline(p.user_id) ? 'online' : ''}"></span>
        <div><div class="online-player-name">${esc(p.nickname)} ${host ? '<span class="chip amber" style="font-size:8px">房主</span>' : ''}</div><div class="online-player-sub">${playerOnline(p.user_id) ? `在线${info ? ` · Lv.${info.level || 1} · 🔥${info.streak || 0}` : ''}` : '离线 / 连接中'}${p.user_id === (S.profile && S.profile.id) ? ' · 你' : ''}</div></div>
        <span class="online-avatar sm">${esc((p.nickname || '韭')[0])}</span>
      </div>`;
    }).join('');
  }

  function renderLobby(host) {
    const ready = S.players.length >= 2;
    return `<div class="card online-card">
      <div class="online-card-head"><div><div class="online-card-title">${S.room.game === 'coop' ? '🎭 合作剧情' : '📈 模拟盘 PK'}</div><div class="online-card-sub">${S.room.game === 'coop' ? '3 轮决策，两人各自选择，双方提交后揭晓。' : '5 个交易日，同一段模拟行情，各自配置。'}</div></div><span class="chip ${ready ? 'green' : 'amber'}">${ready ? '2/2 就绪' : '1/2 等待'}</span></div>
      ${ready ? (host ? `<button class="btn btn-primary btn-lg" data-action="start-game">开始游戏 →</button>` : '<div class="online-empty">等房主开始游戏…</div>') : `<div class="online-empty">把房间码 <strong>${esc(S.room.code)}</strong> 发给朋友，等他加入。</div>`}
      <div class="online-note">两个人都要在线。房主离开会关闭房间。</div>
    </div>`;
  }

  function renderGame(room, host) {
    if (!room.state || !room.state.game) return '<div class="online-empty">游戏状态加载中…</div>';
    return room.game === 'coop' ? renderCoop(room, host) : renderPortfolio(room, host);
  }

  function renderCoop(room, host) {
    const state = room.state;
    const caseId = state.caseIds && state.caseIds[state.round - 1];
    const c = Game.caseById(caseId);
    if (!c) return '<div class="online-empty">副本加载失败</div>';
    const own = S.players.find(p => p.user_id === (S.profile && S.profile.id));
    const ownChoice = own && sameMatch(own.choice, state) && Number(own.choice.round) === state.round ? own.choice : null;
    const other = S.players.find(p => p.user_id !== (S.profile && S.profile.id));
    const otherChoice = other && sameMatch(other.choice, state) && Number(other.choice.round) === state.round ? other.choice : null;
    const head = `<div class="online-card-head"><div><div class="online-card-title">第 ${state.round} / ${state.totalRounds} 轮 · ${esc(c.title)}</div><div class="online-card-sub">${esc(c.subtitle)}</div></div><span class="chip ${state.phase === 'final' ? 'green' : 'amber'}">${state.phase === 'final' ? '已结束' : state.phase === 'reveal' ? '已揭晓' : '选择中'}</span></div>`;

    if (state.phase === 'final') {
      const board = Game.coopLeaderboard(state);
      return `<div class="card online-card">${head}
        <div class="online-scene"><div class="online-scene-title">🏁 合作通关</div><div class="online-scene-text">${esc(state.caseIds.length)} 轮结束。总分只是学习反馈，不是能力定论。</div></div>
        <div class="online-leaderboard">${board.map((x, i) => `<div class="online-rank"><span class="pos">#${i + 1}</span><span class="online-avatar sm">${esc((usernameOf(x.userId) || '韭')[0])}</span><span>${esc(usernameOf(x.userId))}</span><span class="score">${x.score} 分</span></div>`).join('')}</div>
        ${host ? `<div class="feedback-actions"><button class="btn btn-primary" data-action="coop-rematch">再来一局</button><button class="btn btn-ghost" data-action="leave-room">离开房间</button></div>` : '<div class="online-note">等房主开下一局，或离开房间。</div>'}
      </div>`;
    }

    if (state.phase === 'reveal' && state.result) {
      const r = state.result;
      return `<div class="card online-card">${head}
        <div class="online-scene"><div class="online-scene-title">双方选择已揭晓</div><div class="online-scene-text">团队本轮得分：<strong style="color:var(--green)">${r.teamScore} / 4</strong></div></div>
        ${S.players.map(p => {
          const d = r.details[p.user_id];
          if (!d) return '';
          return `<div class="feedback ${qualityClass(d.quality)}" style="margin-top:10px"><div class="feedback-head">${esc(p.nickname)} · ${qualityIcon(d.quality)} ${qualityLabel(d.quality)} <span class="muted" style="font-weight:400;font-size:10px">${d.score} 分</span></div><p><strong>${esc(d.text)}</strong></p><p style="margin-top:5px">${esc(d.feedback)}</p></div>`;
        }).join('')}
        <div class="online-result-grid">${S.players.map(p => `<div class="online-result-box"><div class="l">${esc(p.nickname)} 累计</div><div class="v">${state.totals[p.user_id] || 0} 分</div></div>`).join('')}</div>
        ${host ? `<button class="btn btn-primary" data-action="next-coop">${state.round >= state.totalRounds ? '查看最终结果 →' : '进入下一轮 →'}</button>` : '<div class="online-note">等房主进入下一轮。</div>'}
      </div>`;
    }

    return `<div class="card online-card">${head}
      <div class="online-scene"><div class="online-scene-title">${esc(c.title)}</div><div class="online-scene-text">${esc(c.scene)}</div></div>
      <div class="q-stem" style="font-size:18px;margin:8px 0 12px">${esc(c.setup)}</div>
      <div class="online-case-options">
        ${c.options.map((opt, i) => `<button class="option" data-action="coop-pick" data-index="${i}" ${ownChoice ? 'disabled' : ''}><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${esc(opt.text)}</span></button>`).join('')}
      </div>
      <div class="online-note">${ownChoice ? '你已提交选择，等待队友…' : otherChoice ? '队友已提交，轮到你选择。' : '两人都提交后揭晓结果。'}</div>
    </div>`;
  }

  function renderPortfolio(room, host) {
    const state = room.state;
    const own = S.players.find(p => p.user_id === (S.profile && S.profile.id));
    const ownChoice = own && sameMatch(own.choice, state) && Number(own.choice.day) === state.day ? own.choice : null;
    const head = `<div class="online-card-head"><div><div class="online-card-title">第 ${state.day} / ${state.totalDays} 天 · 模拟盘 PK</div><div class="online-card-sub">同一段模拟行情，各自配置；双方提交后结算。</div></div><span class="chip ${state.phase === 'final' ? 'green' : state.phase === 'result' ? 'amber' : 'cyan'}">${state.phase === 'final' ? '已结束' : state.phase === 'result' ? '已结算' : '配置中'}</span></div>`;

    if (state.phase === 'final') {
      const board = Game.portfolioLeaderboard(state);
      return `<div class="card online-card">${head}
        <div class="online-scene"><div class="online-scene-title">🏁 5 天 PK 结束</div><div class="online-scene-text">同一段行情，不同的配置。比的不只是收益，还有回撤。</div></div>
        <div class="online-leaderboard">${board.map((x, i) => `<div class="online-rank"><span class="pos">#${i + 1}</span><span class="online-avatar sm">${esc((usernameOf(x.userId) || '韭')[0])}</span><span>${esc(usernameOf(x.userId))}<br><span class="online-note">${pct(x.returnPct)} · 回撤 ${Math.round(x.maxDrawdown * 100)}%</span></span><span class="score">${money(x.value)}</span></div>`).join('')}</div>
        ${host ? `<div class="feedback-actions"><button class="btn btn-primary" data-action="portfolio-rematch">再来一局</button><button class="btn btn-ghost" data-action="leave-room">离开房间</button></div>` : '<div class="online-note">等房主开下一局，或离开房间。</div>'}
      </div>`;
    }

    if (state.phase === 'result' && state.result) {
      const r = state.result;
      return `<div class="card online-card">${head}
        <div class="online-scene"><div class="online-scene-title">第 ${r.day} 天结算</div><div class="online-scene-text">${assetReturnHTML(r.returns)}</div></div>
        <div class="online-result-grid">${S.players.map(p => `<div class="online-result-box"><div class="l">${esc(p.nickname)} 净值</div><div class="v">${money(state.values[p.user_id])}</div><div class="online-note">${pct(state.values[p.user_id] / 10000 - 1)}</div></div>`).join('')}</div>
        <div class="online-note">双方配置：${S.players.map(p => `${esc(p.nickname)} 股 ${Math.round(((r.allocations[p.user_id] || {}).hs300 || 0) + ((r.allocations[p.user_id] || {}).tech || 0))}%`).join(' · ')}</div>
        ${host ? `<button class="btn btn-primary" data-action="next-portfolio">${state.day >= state.totalDays ? '查看最终结果 →' : '进入下一天 →'}</button>` : '<div class="online-note">等房主进入下一天。</div>'}
      </div>`;
    }

    if (ownChoice) {
      return `<div class="card online-card">${head}
        <div class="online-empty">你已提交第 ${state.day} 天配置，等待队友…</div>
        <div class="online-note">当前净值 ${money(state.values[S.profile.id])} · 双方都提交后自动结算。</div>
      </div>`;
    }

    const a = ensureAllocation(state);
    const riskyTotal = sum(['bond', 'hs300', 'gold', 'tech'].map(k => Math.max(0, Number(a[k]) || 0)));
    const cash = Math.max(0, 100 - riskyTotal);
    const total = riskyTotal <= 100 ? 100 : riskyTotal;
    const rows = [['bond', '债券基金'], ['hs300', '沪深 300'], ['gold', '黄金'], ['tech', '科技成长']];
    return `<div class="card online-card">${head}
      <div class="online-note">当前净值 ${money(state.values[S.profile.id])}。现金补足剩余比例；双方都提交后结算。</div>
      <div class="online-preset-row">
        <button class="btn btn-sm" data-action="online-preset" data-preset="conservative">稳健</button>
        <button class="btn btn-sm" data-action="online-preset" data-preset="balanced">平衡</button>
        <button class="btn btn-sm" data-action="online-preset" data-preset="aggressive">进取</button>
        <button class="btn btn-sm" data-action="online-preset" data-preset="allcash">全现金</button>
      </div>
      ${rows.map(([k, label]) => `<div class="online-alloc-row"><div class="online-alloc-name"><i style="background:${F.assets[k].color}"></i>${label}</div><input type="range" min="0" max="100" step="1" value="${a[k]}" data-online-alloc="${k}"><div class="online-alloc-val" id="ol-val-${k}">${a[k]}%</div></div>`).join('')}
      <div class="online-alloc-row"><div class="online-alloc-name"><i style="background:${F.assets.cash.color}"></i>现金</div><div class="bar"><span id="ol-cash-bar" style="width:${cash}%"></span></div><div class="online-alloc-val" id="ol-cash">${cash}%</div></div>
      <div class="online-invite" style="margin-top:12px"><span class="muted" style="font-size:10px">目标合计</span><strong id="ol-total" style="font-family:var(--font-mono);color:${total > 100 ? 'var(--red)' : 'var(--green)'}">${total}%</strong><span class="muted" style="font-size:10px">现金自动补足</span></div>
      <button class="btn btn-primary" id="ol-submit" data-action="portfolio-submit" ${total > 100 ? 'disabled' : ''}>提交第 ${state.day} 天配置 →</button>
    </div>`;
  }

  function assetReturnHTML(returns) {
    if (!returns) return '';
    return Game.ASSETS.map(k => `<span class="chip" style="margin:2px">${F.assets[k].icon} ${F.assets[k].name} ${pct(returns[k])}</span>`).join(' ');
  }

  function ensureAllocation(state) {
    if (S.game.allocationDay !== state.day) {
      const d = Game.DEFAULT_ALLOC;
      S.game.allocation = { bond: d.bond, hs300: d.hs300, gold: d.gold, tech: d.tech };
      S.game.allocationDay = state.day;
    }
    return S.game.allocation;
  }

  function updateAllocationUI() {
    const a = S.game.allocation;
    const risky = ['bond', 'hs300', 'gold', 'tech'].map(k => Math.max(0, Number(a[k]) || 0));
    const riskyTotal = sum(risky);
    const cash = Math.max(0, 100 - riskyTotal);
    const total = riskyTotal <= 100 ? 100 : riskyTotal;
    ['bond', 'hs300', 'gold', 'tech'].forEach(k => {
      const el = document.getElementById('ol-val-' + k);
      if (el) el.textContent = Math.round(Number(a[k]) || 0) + '%';
    });
    const cashEl = document.getElementById('ol-cash');
    const cashBar = document.getElementById('ol-cash-bar');
    const totalEl = document.getElementById('ol-total');
    const submit = document.getElementById('ol-submit');
    if (cashEl) cashEl.textContent = Math.round(cash) + '%';
    if (cashBar) cashBar.style.width = cash + '%';
    if (totalEl) {
      totalEl.textContent = total + '%';
      totalEl.style.color = total > 100 ? 'var(--red)' : 'var(--green)';
    }
    if (submit) submit.disabled = total > 100;
  }

  /* ============================================================
     events
     ============================================================ */
  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'noop') return;
    event.preventDefault();
    if (action === 'save-config') {
      try {
        if (!SB) throw new Error('Supabase 适配器没有加载');
        SB.saveConfig(document.getElementById('setup-url').value, document.getElementById('setup-key').value);
        location.reload();
      } catch (e) { toast(e.message, 'bad'); }
      return;
    }
    if (action === 'clear-config') {
      SB.clearConfig();
      location.reload();
      return;
    }
    if (action === 'auth-mode') {
      S.authMode = el.dataset.mode === 'email' ? 'email' : 'guest';
      S.emailSent = false;
      S.error = '';
      render();
      return;
    }
    if (action === 'anonymous-login') {
      anonymousLogin();
      return;
    }
    if (action === 'email-login') {
      emailLogin();
      return;
    }
    if (action === 'nickname-save') {
      saveNickname();
      return;
    }
    if (action === 'signout') {
      signOut();
      return;
    }
    if (action === 'switch-email') {
      signOut().then(() => {
        S.authMode = 'email';
        S.emailSent = false;
        S.error = '';
        render();
      });
      return;
    }
    if (action === 'install') {
      if (!S.installPrompt) return toast('当前浏览器没有可用的安装提示，试试浏览器菜单里的“安装应用”', 'bad');
      S.installPrompt.prompt();
      S.installPrompt = null;
      render();
      return;
    }
    if (!S.service) return;
    if (action === 'create-room') {
      createRoom(el.dataset.game || 'coop');
      return;
    }
    if (action === 'join-room') {
      joinRoom();
      return;
    }
    if (action === 'start-game') {
      hostStart();
      return;
    }
    if (action === 'leave-room') {
      leaveRoom();
      return;
    }
    if (action === 'copy-invite') {
      copyInvite();
      return;
    }
    if (action === 'copy-page') {
      const text = location.origin + location.pathname;
      navigator.clipboard ? navigator.clipboard.writeText(text).then(() => toast('链接已复制')) : prompt('复制链接：', text);
      return;
    }
    if (action === 'coop-pick') {
      chooseCoop(Number(el.dataset.index));
      return;
    }
    if (action === 'next-coop') {
      nextCoop();
      return;
    }
    if (action === 'coop-rematch') {
      coopRematch();
      return;
    }
    if (action === 'portfolio-submit') {
      submitPortfolio();
      return;
    }
    if (action === 'online-preset') {
      const presets = {
        conservative: { cash: 15, bond: 55, hs300: 20, gold: 10, tech: 0 },
        balanced: { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 },
        aggressive: { cash: 5, bond: 10, hs300: 45, gold: 10, tech: 30 },
        allcash: { cash: 100, bond: 0, hs300: 0, gold: 0, tech: 0 }
      };
      S.game.allocation = Object.assign({}, presets[el.dataset.preset] || presets.balanced);
      render();
      return;
    }
    if (action === 'next-portfolio') {
      nextPortfolio();
      return;
    }
    if (action === 'portfolio-rematch') {
      portfolioRematch();
      return;
    }
  }

  function onInput(event) {
    const t = event.target;
    if (t.id === 'online-nickname') {
      S.ui.nickname = t.value;
      return;
    }
    if (t.id === 'online-email') {
      S.ui.email = t.value;
      return;
    }
    if (t.id === 'join-code') {
      S.ui.joinCode = t.value.toUpperCase();
      return;
    }
    if (t.id === 'setup-url') { S.ui.setupUrl = t.value; return; }
    if (t.id === 'setup-key') { S.ui.setupKey = t.value; return; }
    if (t.dataset.onlineAlloc) {
      S.game.allocation[t.dataset.onlineAlloc] = Number(t.value) || 0;
      updateAllocationUI();
    }
  }

  if (app) {
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      S.installPrompt = event;
      render();
    });
    // 测试/预览钩子：不参与正常用户流程。
    window.LeekOnlineUI = {
      state: S,
      render,
      setService(service) { S.service = service; }
    };
    boot();
  }
})();
