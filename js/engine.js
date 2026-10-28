(function (root) {
  'use strict';

  const F = root.FIN;
  const VERSION = 1;
  const STORAGE_KEY = 'leek_finance_rpg_v1';
  const LEVEL_XP = 45;
  const NODE_THRESHOLD = 45;
  const FEE_RATE = 0.001;
  const TRACKS = ['wealth', 'quant', 'side'];
  const STAGES = ['brief', 'quiz', 'case', 'trade', 'settle', 'done'];

  let dateOverride = null;

  /* ---------------- 基础工具 ---------------- */
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function localDateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  function todayKey() {
    if (dateOverride) return dateOverride;
    return localDateKey(new Date());
  }
  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return localDateKey(d);
  }
  function daysBetween(a, b) {
    if (!a || !b) return 0;
    const da = Date.UTC(...a.split('-').map((x, i) => i === 1 ? Number(x) - 1 : Number(x)));
    const db = Date.UTC(...b.split('-').map((x, i) => i === 1 ? Number(x) - 1 : Number(x)));
    return Math.round((db - da) / 86400000);
  }
  function weekStartKey(key) {
    const d = parseKey(key);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return localDateKey(d);
  }
  function setToday(key) { dateOverride = key; }
  function clearToday() { dateOverride = null; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function mergeDeep(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
    if (base && typeof base === 'object') {
      const out = Object.assign({}, base);
      if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach(k => { out[k] = mergeDeep(base[k], extra[k]); });
      }
      return out;
    }
    return extra === undefined ? base : extra;
  }

  function byId(id) { return F.questions.find(q => q.id === id); }
  function conceptById(id) { return F.concepts.find(c => c.id === id); }
  function caseById(id) { return F.cases.find(c => c.id === id); }
  function eventById(id) { return F.events.find(e => e.id === id); }
  function nodeById(id) { return F.nodes.find(n => n.id === id); }

  /* ---------------- 初始状态 ---------------- */
  function defaultState() {
    const today = todayKey();
    return {
      version: VERSION,
      createdAt: today,
      lastVisit: today,
      lastDailyDate: null,
      player: {
        name: '韭韭',
        onboarded: false,
        xp: 0,
        level: 1,
        coins: 0,
        streak: 0,
        bestStreak: 0,
        freezes: 0,
        hints: 1,
        title: '韭菜种子',
        mascotStage: 1,
        unlockedConcepts: [],
        achievements: [],
        cosmetics: [],
        activeCosmetics: []
      },
      riskType: null,
      diagnostic: {
        completed: false,
        scores: { wealth: 0, quant: 0, side: 0 },
        totals: { wealth: 0, quant: 0, side: 0 },
        answered: 0
      },
      theta: { wealth: 0, quant: 0, side: 0 },
      mastery: {},
      conceptStats: {},
      srs: {},
      recentQuestions: [],
      daily: null,
      portfolio: {
        value: 10000,
        positions: { cash: 10000, bond: 0, hs300: 0, gold: 0, tech: 0 },
        target: { cash: 100, bond: 0, hs300: 0, gold: 0, tech: 0 },
        history: [{ day: 0, value: 10000, benchmark: 10000, date: today }],
        trades: [],
        maxValue: 10000,
        maxDrawdown: 0,
        feesPaid: 0,
        day: 0,
        regime: 'chop',
        regimeDays: 30,
        seed: 20261025,
        lastReturn: 0,
        benchmark: 10000
      },
      stats: {
        daysCompleted: 0, quizzes: 0, correct: 0, cases: 0, goodCases: 0,
        trades: 0, bossClears: 0, sideNodes: 0, xpEarned: 0, coinsEarned: 0
      },
      flags: { perfectQuiz: false, noFomo: false },
      journal: [],
      history: [],
      seenCases: [],
      seenEvents: [],
      boss: { weekKey: null, done: false, bestScore: 0, attempts: 0, current: [] },
      weekly: { key: null, days: [] },
      practice: { date: null, xp: 0 },
      practiceHistory: [],
      bonus: { date: null, questionIds: [], answers: [], points: 0, correct: 0, caseId: null, caseDone: false },
      bonusDone: [],
      codeDone: [],
      claimedNodes: [],
      settings: { sound: false, reduceMotion: false }
    };
  }

  function load() {
    try {
      if (!root.localStorage) return defaultState();
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return defaultState();
      return mergeDeep(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    try {
      if (root.localStorage) root.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function exportState(state) {
    return JSON.stringify(Object.assign({}, state, { exportedAt: new Date().toISOString() }), null, 2);
  }

  function importState(json) {
    const parsed = JSON.parse(json);
    if (!parsed || parsed.version !== VERSION) throw new Error('存档版本不匹配');
    if (!parsed.player) throw new Error('存档缺少玩家数据');
    return mergeDeep(defaultState(), parsed);
  }

  /* ---------------- 等级 / 称号 ---------------- */
  function getLevelInfo(state) {
    const xp = Math.max(0, state.player.xp || 0);
    const level = 1 + Math.floor(Math.sqrt(xp / LEVEL_XP));
    let title = F.titles[0];
    for (const t of F.titles) if (level >= t.level) title = t;
    const prevXp = LEVEL_XP * Math.pow(level - 1, 2);
    const nextXp = LEVEL_XP * Math.pow(level, 2);
    const xpInLevel = xp - prevXp;
    const xpForNext = Math.max(1, nextXp - prevXp);
    return {
      level, xp, title,
      xpInLevel, xpForNext,
      progress: xpInLevel / xpForNext,
      nextTitle: F.titles.find(t => t.level > level) || null
    };
  }

  function grantXp(state, amount) {
    const before = getLevelInfo(state);
    state.player.xp = Math.max(0, (state.player.xp || 0) + amount);
    state.stats.xpEarned = (state.stats.xpEarned || 0) + amount;
    const after = getLevelInfo(state);
    state.player.level = after.level;
    state.player.title = after.title.name;
    state.player.mascotStage = after.title.mascot;
    return { amount, level: after.level, title: after.title, leveledUp: after.level > before.level, before, after };
  }

  function addCoins(state, amount) {
    state.player.coins = Math.max(0, (state.player.coins || 0) + amount);
    state.stats.coinsEarned = (state.stats.coinsEarned || 0) + amount;
  }

  /* ---------------- 技能树 ---------------- */
  function nodeMastery(state, node) {
    if (!node || !node.concepts.length) return 0;
    return sum(node.concepts.map(c => state.mastery[c] || 0)) / node.concepts.length;
  }

  function nodeStatus(state, node) {
    if (nodeMastery(state, node) >= NODE_THRESHOLD) return 'mastered';
    if (!node.requires) return 'available';
    const prev = nodeById(node.requires);
    return prev && nodeMastery(state, prev) >= NODE_THRESHOLD ? 'available' : 'locked';
  }

  function getNodeProgress(state, node) {
    const avg = nodeMastery(state, node);
    return {
      pct: Math.round(avg),
      status: nodeStatus(state, node),
      missing: node.concepts.filter(c => (state.mastery[c] || 0) < NODE_THRESHOLD).map(c => conceptById(c)).filter(Boolean)
    };
  }

  function currentNode(state, track) {
    const nodes = F.nodes.filter(n => n.track === track);
    for (const n of nodes) {
      if (nodeStatus(state, n) !== 'mastered') return n;
    }
    return nodes[nodes.length - 1];
  }

  function claimNodeRewards(state) {
    if (!Array.isArray(state.claimedNodes)) state.claimedNodes = [];
    const claimed = [];
    F.nodes.forEach(n => {
      if (!state.claimedNodes.includes(n.id) && nodeStatus(state, n) === 'mastered') {
        state.claimedNodes.push(n.id);
        grantXp(state, n.reward.xp);
        addCoins(state, n.reward.coins);
        claimed.push(n);
      }
    });
    return claimed;
  }

  function refreshDerived(state) {
    const info = getLevelInfo(state);
    state.player.level = info.level;
    state.player.title = info.title.name;
    state.player.mascotStage = info.title.mascot;
    state.stats.sideNodes = F.nodes.filter(n => n.track === 'side' && nodeStatus(state, n) === 'mastered').length;
    claimNodeRewards(state);
    const after = getLevelInfo(state);
    state.player.level = after.level;
    state.player.title = after.title.name;
    state.player.mascotStage = after.title.mascot;
    return state;
  }

  /* ---------------- 诊断 / 档案 ---------------- */
  function trackLevel(theta) {
    return clamp(Math.round(1 + ((theta + 1.5) / 3) * 4), 1, 5);
  }

  function buildProfile(state) {
    const scores = state.diagnostic.scores;
    const totals = state.diagnostic.totals;
    const pct = t => totals[t] ? scores[t] / totals[t] : 0;
    const wl = trackLevel(state.theta.wealth);
    const ql = trackLevel(state.theta.quant);
    const sl = trackLevel(state.theta.side);
    const risk = state.riskType || '稳健';
    const quantFit = ql >= 4 ? '有潜力，用项目验证' : ql >= 3 ? '可以试水，先补概率统计' : '先补基础，再判断适不适合';
    const weakest = TRACKS.reduce((a, b) => (pct(a) <= pct(b) ? a : b));
    const routeMap = {
      wealth: ['先建 3–6 个月应急金', '用宽基指数基金理解波动', '再学资产配置与再平衡'],
      quant: ['先补期望值、方差、基准率', '用 Python 跑一次含成本的回测', '判断自己是否享受“验证假设”'],
      side: ['盘点可交付技能', '做 1 个可展示的小项目', '尝试第一次合规的小额接单']
    };
    const headline = `${risk}型 · ${ql >= 4 ? '量化苗子' : ql >= 3 ? '量化学徒' : '量化萌新'}`;
    const summary = weakest === 'wealth'
      ? '你的直觉不差，但现金流和配置的地基还需要补。先把“不亏钱”练成习惯，再追求收益。'
      : weakest === 'quant'
        ? '你已经能看懂一些市场故事，接下来要用概率和统计拆掉“故事”，建立可验证的决策。'
        : '你缺的不是知识，而是把能力变成交付物的路径。先跑通一次“需求—交付—收款”的闭环。';
    return {
      headline, summary, riskType: risk,
      wealthLevel: wl, quantLevel: ql, sideLevel: sl,
      quantFit,
      weakest,
      scores, totals,
      route: routeMap[weakest],
      recommended: weakest
    };
  }

  function onboard(state, answers, riskAnswers) {
    const diagQs = F.diagnosticIds.map(byId).filter(Boolean);
    const totals = { wealth: 0, quant: 0, side: 0 };
    const scores = { wealth: 0, quant: 0, side: 0 };
    const answerMap = {};
    (answers || []).forEach(a => { answerMap[a.qid] = a.choice; });

    diagQs.forEach(q => {
      totals[q.track] += 1;
      const choice = answerMap[q.id];
      const correct = choice === q.answer;
      if (correct) scores[q.track] += 1;
      const concept = q.concept;
      if (concept && !state.player.unlockedConcepts.includes(concept)) {
        state.player.unlockedConcepts.push(concept);
      }
      const s = state.srs[q.id] || { box: 0, attempts: 0 };
      s.attempts += 1;
      s.box = correct ? 1 : 0;
      s.due = addDays(todayKey(), correct ? 2 : 1);
      s.lastResult = correct;
      state.srs[q.id] = s;
      state.recentQuestions.push(q.id);
      const cs = state.conceptStats[concept] || { seen: 0, correct: 0 };
      cs.seen += 1;
      if (correct) cs.correct += 1;
      state.conceptStats[concept] = cs;
      state.mastery[concept] = clamp((state.mastery[concept] || 0) + (correct ? 12 : 0), 0, 100);
    });

    TRACKS.forEach(t => {
      const ratio = totals[t] ? scores[t] / totals[t] : 0;
      state.theta[t] = clamp(-1.5 + 3 * ratio, -1.5, 1.5);
      state.diagnostic.totals[t] = totals[t];
      state.diagnostic.scores[t] = scores[t];
    });

    let riskScore = 0;
    (riskAnswers || []).forEach(a => {
      const q = F.riskQuestions.find(x => x.id === a.qid);
      if (q && q.scores[a.choice] !== undefined) riskScore += q.scores[a.choice];
    });
    state.riskType = riskScore <= 2 ? '保守' : riskScore <= 4 ? '稳健' : '进取';
    state.diagnostic.completed = true;
    state.diagnostic.answered = diagQs.length;
    state.player.onboarded = true;

    grantXp(state, 80);
    addCoins(state, 100);
    state.player.freezes = Math.max(state.player.freezes, 1);
    state.player.hints = Math.max(state.player.hints, 1);
    state.recentQuestions = state.recentQuestions.slice(-40);

    refreshDerived(state);
    const unlocked = checkAchievements(state);
    const profile = buildProfile(state);
    return { profile, achievements: unlocked, level: getLevelInfo(state) };
  }

  function skipOnboarding(state) {
    state.player.onboarded = true;
    state.diagnostic.completed = false;
    state.riskType = '稳健';
    TRACKS.forEach(t => { state.theta[t] = 0; });
    grantXp(state, 60);
    addCoins(state, 80);
    state.player.freezes = Math.max(state.player.freezes || 0, 1);
    state.player.hints = Math.max(state.player.hints || 0, 1);
    refreshDerived(state);
    checkAchievements(state);
    return buildProfile(state);
  }

  /* ---------------- 每日计划 ---------------- */
  function weakestTrack(state) {
    return TRACKS.reduce((a, b) => ((state.theta[a] ?? 0) <= (state.theta[b] ?? 0) ? a : b));
  }

  function focusForToday(state, today) {
    const dow = parseKey(today).getDay();
    let focus = dow === 0 ? 'mixed' : dow === 1 || dow === 3 || dow === 5 ? 'wealth' : dow === 2 || dow === 4 ? 'quant' : 'side';
    const weak = weakestTrack(state);
    if (focus !== 'mixed' && (state.theta[focus] ?? 0) - (state.theta[weak] ?? 0) > 0.9) focus = weak;
    return { focus, weak };
  }

  function questionScore(state, q, focus, today) {
    const theta = state.theta[q.track] ?? 0;
    const d = (q.difficulty - 3) * 0.65;
    let s = 3 - Math.abs(d - theta) * 1.7;
    if (q.track === focus) s += 2.2;
    s += (100 - (state.mastery[q.concept] || 0)) / 45;
    const srs = state.srs[q.id];
    if (srs && srs.due <= today) s += 4;
    if ((state.recentQuestions || []).includes(q.id)) s -= 9;
    return s + Math.random() * 0.9;
  }

  function pickWeighted(state, pool, focus, today) {
    let best = pool[0], bestScore = -Infinity;
    for (const q of pool) {
      const s = questionScore(state, q, focus, today);
      if (s > bestScore) { bestScore = s; best = q; }
    }
    return best;
  }

  function pickQuestions(state, count, focus, today) {
    const out = [];
    const used = new Set();
    const recent = new Set(state.recentQuestions || []);
    const all = F.questions;

    const due = Object.keys(state.srs || {})
      .filter(id => state.srs[id] && state.srs[id].due <= today && !recent.has(id) && !used.has(id))
      .map(byId).filter(Boolean)
      .sort((a, b) => (state.srs[a.id].box || 0) - (state.srs[b.id].box || 0));

    if (due.length && out.length < count) {
      out.push(due[0]);
      used.add(due[0].id);
    }

    const focusList = focus === 'mixed'
      ? [weakestTrack(state), 'wealth', 'quant', 'side']
      : [focus, weakestTrack(state), 'quant', 'wealth', 'side'];
    const uniqueFocus = [...new Set(focusList)];

    for (const tr of uniqueFocus) {
      if (out.length >= count) break;
      const node = currentNode(state, tr);
      const nodeConcepts = new Set(node ? node.concepts : []);
      let pool = all.filter(q => q.track === tr && nodeConcepts.has(q.concept) && !used.has(q.id) && !recent.has(q.id));
      if (!pool.length) pool = all.filter(q => q.track === tr && nodeConcepts.has(q.concept) && !used.has(q.id));
      if (!pool.length) pool = all.filter(q => q.track === tr && !used.has(q.id) && !recent.has(q.id));
      if (!pool.length) pool = all.filter(q => q.track === tr && !used.has(q.id));
      if (pool.length) {
        const q = pickWeighted(state, pool, focus, today);
        out.push(q); used.add(q.id);
      }
    }

    while (out.length < count) {
      let pool = all.filter(q => !used.has(q.id) && !recent.has(q.id));
      if (!pool.length) pool = all.filter(q => !used.has(q.id));
      if (!pool.length) break;
      const q = pickWeighted(state, pool, focus, today);
      out.push(q); used.add(q.id);
    }
    return out.slice(0, count);
  }

  function pickCase(state, focus) {
    let pool = F.cases.filter(c => !state.seenCases.includes(c.id));
    if (focus !== 'mixed') {
      const focused = pool.filter(c => c.track === focus);
      if (focused.length) pool = focused;
    }
    if (!pool.length) pool = F.cases.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickEvent(state) {
    let pool = F.events.filter(e => !state.seenEvents.includes(e.id));
    if (!pool.length) pool = F.events.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildDailyPlan(state, today) {
    const wk = weekStartKey(today);
    if (state.weekly.key !== wk) {
      state.weekly = { key: wk, days: [] };
      state.boss = { weekKey: wk, done: false, bestScore: 0, attempts: 0, current: [] };
    }
    const { focus, weak } = focusForToday(state, today);
    const questions = pickQuestions(state, 4, focus, today);
    const c = pickCase(state, focus);
    const ev = pickEvent(state);
    state.seenEvents.push(ev.id);
    const reason = focus === 'mixed'
      ? `周日复盘日 · 混合出题，重点照顾较弱的${F.trackMeta[weak].name}`
      : `今日主攻${F.trackMeta[focus].name}${weak !== focus ? `，顺带补一题${F.trackMeta[weak].name}` : ''}`;
    return {
      focus,
      weak,
      reason,
      questionIds: questions.map(q => q.id),
      caseId: c.id,
      eventId: ev.id
    };
  }

  function ensureDaily(state, force) {
    const today = todayKey();
    if (!force && state.daily && state.daily.date === today) return state.daily;
    const plan = buildDailyPlan(state, today);
    state.daily = {
      date: today,
      stage: 'brief',
      plan,
      quizIndex: 0,
      answers: [],
      hinted: [],
      caseChoice: null,
      caseQuality: null,
      trade: null,
      briefRevealed: false,
      rewards: null,
      startedAt: null,
      completedAt: null
    };
    refreshDerived(state);
    return state.daily;
  }

  function startQuiz(state) {
    const d = ensureDaily(state);
    if (d.stage === 'brief') d.stage = 'quiz';
    if (!d.startedAt) d.startedAt = new Date().toISOString();
    return d;
  }

  function revealBrief(state) {
    const d = ensureDaily(state);
    d.briefRevealed = true;
    return d;
  }

  /* ---------------- 答题 ---------------- */
  function unlockConcept(state, conceptId) {
    if (!conceptId) return;
    if (!state.player.unlockedConcepts.includes(conceptId)) state.player.unlockedConcepts.push(conceptId);
  }

  function answerQuestion(state, qid, choice) {
    const d = ensureDaily(state);
    const q = byId(qid);
    if (!q) throw new Error('题目不存在');
    if (d.answers.some(a => a.qid === qid)) {
      return d.answers.find(a => a.qid === qid);
    }
    const correct = choice === q.answer;
    const theta = state.theta[q.track] ?? 0;
    const difficulty = (q.difficulty - 3) * 0.65;
    const p = 1 / (1 + Math.exp(-(theta - difficulty)));
    state.theta[q.track] = clamp(theta + 0.45 * ((correct ? 1 : 0) - p), -2.5, 2.5);

    const mastery = state.mastery[q.concept] || 0;
    state.mastery[q.concept] = clamp(mastery + (correct ? 22 : -10), 0, 100);

    const cs = state.conceptStats[q.concept] || { seen: 0, correct: 0 };
    cs.seen += 1;
    if (correct) cs.correct += 1;
    state.conceptStats[q.concept] = cs;

    const s = state.srs[qid] || { box: 0, attempts: 0 };
    s.attempts += 1;
    s.box = correct ? Math.min((s.box || 0) + 1, 4) : 0;
    const intervals = [1, 2, 4, 7, 14];
    s.due = addDays(todayKey(), intervals[s.box]);
    s.lastResult = correct;
    state.srs[qid] = s;

    state.recentQuestions.push(qid);
    state.recentQuestions = state.recentQuestions.slice(-40);
    state.stats.quizzes += 1;
    if (correct) state.stats.correct += 1;
    unlockConcept(state, q.concept);

    const xp = correct ? 25 : 10;
    const xpResult = grantXp(state, xp);

    const record = { qid, choice, correct, explain: q.explain, xp, theta: state.theta[q.track], p };
    d.answers.push(record);
    d.quizIndex = d.answers.length;

    if (d.answers.length >= d.plan.questionIds.length) {
      d.stage = 'case';
      if (d.answers.every(a => a.correct)) state.flags.perfectQuiz = true;
    }
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return Object.assign(record, { xpResult, achievements: unlocked, stage: d.stage });
  }

  function getHint(state, qid) {
    const d = ensureDaily(state);
    if ((state.player.hints || 0) <= 0) return { ok: false, msg: '没有提示券了' };
    if (d.hinted.includes(qid)) return { ok: false, msg: '这题已经用过提示' };
    const q = byId(qid);
    if (!q) return { ok: false, msg: '题目不存在' };
    state.player.hints -= 1;
    d.hinted.push(qid);
    const wrong = [0, 1, 2, 3].filter(i => i !== q.answer);
    return { ok: true, hide: wrong[Math.floor(Math.random() * wrong.length)], left: state.player.hints };
  }

  /* ---------------- 剧情副本 ---------------- */
  function chooseCase(state, caseId, choiceIndex) {
    const d = ensureDaily(state);
    const c = caseById(caseId);
    if (!c) throw new Error('副本不存在');
    if (d.caseChoice !== null) return { already: true, quality: d.caseQuality };
    const opt = c.options[choiceIndex];
    if (!opt) throw new Error('选项不存在');
    const quality = opt.quality;
    const xp = quality === 'good' ? 40 : quality === 'ok' ? 25 : 15;
    d.caseChoice = choiceIndex;
    d.caseQuality = quality;
    // 停留在此阶段，让玩家先看复盘，再手动进入调仓

    state.stats.cases += 1;
    if (quality === 'good') state.stats.goodCases += 1;
    unlockConcept(state, c.concept);
    if ((c.id === 'c_hot_tip' || c.id === 'c_ai_fomo') && quality === 'good') state.flags.noFomo = true;
    if (!state.seenCases.includes(c.id)) state.seenCases.push(c.id);

    state.journal.push({
      date: todayKey(), type: 'case', caseId: c.id, title: c.title,
      choice: choiceIndex, choiceText: opt.text, quality, concept: c.concept
    });
    if (state.journal.length > 120) state.journal = state.journal.slice(-120);

    grantXp(state, xp);
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return { opt, quality, xp, achievements: unlocked, stage: d.stage };
  }

  /* ---------------- 模拟盘 ---------------- */
  function applyMarketDay(state) {
    const p = state.portfolio;
    const ev = state.daily && state.daily.plan ? eventById(state.daily.plan.eventId) : null;
    const shock = ev ? ev.shock : {};
    const rng = mulberry32(p.seed || 20261025);

    p.regimeDays = (p.regimeDays || 0) - 1;
    if (p.regimeDays <= 0) {
      const r = rng();
      p.regime = r < 0.38 ? 'bull' : r < 0.72 ? 'chop' : 'bear';
      p.regimeDays = 20 + Math.floor(rng() * 40);
    }
    const regimeAdj = p.regime === 'bull' ? 0.0004 : p.regime === 'bear' ? -0.0007 : 0;
    const prev = p.value;
    const returns = {};
    Object.keys(F.assets).forEach(a => {
      const meta = F.assets[a];
      let r;
      if (a === 'cash') {
        r = meta.drift / 252;
      } else {
        r = meta.drift / 252 + regimeAdj + (meta.vol / Math.sqrt(252)) * gaussian(rng) + (shock[a] || 0);
      }
      returns[a] = r;
      p.positions[a] = (p.positions[a] || 0) * (1 + r);
    });
    p.value = sum(Object.values(p.positions));
    p.maxValue = Math.max(p.maxValue || p.value, p.value);
    const dd = p.maxValue > 0 ? (p.maxValue - p.value) / p.maxValue : 0;
    p.maxDrawdown = Math.max(p.maxDrawdown || 0, dd);
    p.benchmark = (p.benchmark || 10000) * (1 + returns.hs300);
    p.lastReturn = prev > 0 ? p.value / prev - 1 : 0;
    p.day = (p.day || 0) + 1;
    p.seed = Math.floor(rng() * 4294967296);

    p.history.push({
      day: p.day,
      value: rounded(p.value),
      benchmark: rounded(p.benchmark),
      date: todayKey()
    });
    if (p.history.length > 240) p.history = p.history.slice(-240);

    return {
      returns, dayReturn: p.lastReturn, benchmarkReturn: returns.hs300,
      value: p.value, event: ev, regime: p.regime, date: todayKey()
    };
  }

  function rounded(n) { return Math.round(n * 100) / 100; }

  function rebalance(state, target, options) {
    options = options || {};
    const d = ensureDaily(state);
    const p = state.portfolio;
    const hold = !!options.hold;
    let fee = 0, tradeAmount = 0;
    const before = p.value;
    let nextTarget = Object.assign({}, p.target);

    if (!hold) {
      const totalPct = sum(Object.keys(F.assets).map(a => Number(target[a]) || 0));
      if (Math.abs(totalPct - 100) > 0.5) throw new Error('配置比例必须合计 100%');
      const targetVals = {};
      Object.keys(F.assets).forEach(a => {
        const pct = Number(target[a]) || 0;
        if (pct < 0) throw new Error('配置比例不能为负');
        targetVals[a] = before * pct / 100;
      });
      tradeAmount = sum(Object.keys(F.assets).map(a => Math.abs(targetVals[a] - (p.positions[a] || 0)))) / 2;
      fee = tradeAmount * FEE_RATE;
      const afterFee = Math.max(0, before - fee);
      Object.keys(F.assets).forEach(a => {
        p.positions[a] = afterFee * (Number(target[a]) || 0) / 100;
      });
      p.value = afterFee;
      p.feesPaid = (p.feesPaid || 0) + fee;
      nextTarget = {};
      Object.keys(F.assets).forEach(a => { nextTarget[a] = Number(target[a]) || 0; });
      p.target = nextTarget;
      if (tradeAmount > 0.01) state.stats.trades += 1;
    }

    const market = applyMarketDay(state);
    p.trades.push({
      date: todayKey(), day: p.day, hold, fee: rounded(fee), tradeAmount: rounded(tradeAmount),
      target: Object.assign({}, nextTarget), value: rounded(p.value)
    });
    if (p.trades.length > 120) p.trades = p.trades.slice(-120);
    d.trade = {
      hold, fee, tradeAmount, before, target: nextTarget,
      dayReturn: market.dayReturn, value: p.value, event: market.event,
      returns: market.returns, date: todayKey()
    };
    d.stage = 'settle';
    grantXp(state, 20);
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return Object.assign({}, market, { fee, tradeAmount, before, after: p.value, target: nextTarget, achievements: unlocked });
  }

  function getPortfolioMetrics(state) {
    const p = state.portfolio;
    const total = p.value || 1;
    const alloc = {};
    Object.keys(F.assets).forEach(a => { alloc[a] = (p.positions[a] || 0) / total * 100; });
    const hist = p.history || [];
    let vol = 0;
    if (hist.length >= 3) {
      const rets = [];
      for (let i = 1; i < hist.length; i++) {
        if (hist[i - 1].value > 0) rets.push(hist[i].value / hist[i - 1].value - 1);
      }
      if (rets.length) {
        const mean = sum(rets) / rets.length;
        const variance = sum(rets.map(r => (r - mean) ** 2)) / rets.length;
        vol = Math.sqrt(variance) * Math.sqrt(252);
      }
    }
    return {
      value: p.value,
      returnPct: p.value / 10000 - 1,
      benchmarkPct: (p.benchmark || 10000) / 10000 - 1,
      maxDrawdown: p.maxDrawdown || 0,
      volatility: vol,
      feesPaid: p.feesPaid || 0,
      alloc,
      day: p.day || 0,
      regime: p.regime,
      history: hist.slice(-60)
    };
  }

  /* ---------------- 结算 / 周 ---------------- */
  function settleDay(state) {
    const d = ensureDaily(state);
    if (d.stage === 'done' && d.rewards) return d.rewards;
    if (d.stage !== 'settle') return null;

    const today = todayKey();
    const wasDone = state.lastDailyDate === today;
    let usedFreeze = false;
    let streak = state.player.streak || 0;

    if (!wasDone) {
      if (!state.lastDailyDate) {
        streak = 1;
      } else {
        const diff = daysBetween(state.lastDailyDate, today);
        if (diff === 0) {
          streak = Math.max(1, streak);
        } else if (diff === 1) {
          streak += 1;
        } else if (diff === 2 && (state.player.freezes || 0) > 0) {
          state.player.freezes -= 1;
          usedFreeze = true;
          streak += 1;
        } else {
          streak = 1;
        }
      }
      state.player.streak = Math.max(1, streak);
      state.player.bestStreak = Math.max(state.player.bestStreak || 0, state.player.streak);
      state.lastDailyDate = today;
      state.stats.daysCompleted += 1;
    }

    const baseXp = 40 + Math.min((state.player.streak || 1) * 5, 50);
    const baseCoins = 25 + Math.min((state.player.streak || 1) * 2, 30);
    const chest = 5 + Math.floor(Math.random() * 11);
    const xpResult = grantXp(state, baseXp);
    addCoins(state, baseCoins + chest);

    d.stage = 'done';
    d.completedAt = new Date().toISOString();

    const wk = weekStartKey(today);
    if (state.weekly.key !== wk) state.weekly = { key: wk, days: [] };
    if (!state.weekly.days.includes(today)) state.weekly.days.push(today);

    const correct = d.answers.filter(a => a.correct).length;
    const quizXp = sum(d.answers.map(a => a.xp || 0));
    const caseXp = d.caseQuality === 'good' ? 40 : d.caseQuality === 'ok' ? 25 : 15;
    const dayXp = baseXp + quizXp + caseXp + 20;
    state.history.push({
      date: today, xp: dayXp, coins: baseCoins + chest,
      questions: d.answers.length, correct,
      caseQuality: d.caseQuality,
      value: rounded(state.portfolio.value),
      streak: state.player.streak
    });
    if (state.history.length > 180) state.history = state.history.slice(-180);

    d.rewards = {
      xp: baseXp, coins: baseCoins + chest, chest, streak: state.player.streak,
      usedFreeze, level: xpResult.level, leveledUp: xpResult.leveledUp,
      title: xpResult.title, achievements: []
    };
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    d.rewards.achievements = unlocked;
    return d.rewards;
  }

  function getWeekStats(state) {
    const wk = state.weekly.key || weekStartKey(todayKey());
    const entries = (state.history || []).filter(h => weekStartKey(h.date) === wk);
    const questions = sum(entries.map(e => e.questions || 0));
    const correct = sum(entries.map(e => e.correct || 0));
    const good = entries.filter(e => e.caseQuality === 'good').length;
    return {
      weekKey: wk,
      days: entries.length,
      xp: sum(entries.map(e => e.xp || 0)),
      coins: sum(entries.map(e => e.coins || 0)),
      questions, correct,
      accuracy: questions ? correct / questions : 0,
      goodCases: good,
      bossDone: !!(state.boss && state.boss.weekKey === wk && state.boss.done),
      daysToBoss: Math.max(0, 5 - entries.length),
      bestScore: state.boss && state.boss.weekKey === wk ? state.boss.bestScore : 0
    };
  }

  function trackAccuracy(state) {
    const out = {};
    TRACKS.forEach(t => { out[t] = { seen: 0, correct: 0 }; });
    Object.keys(state.conceptStats || {}).forEach(cid => {
      const c = conceptById(cid);
      if (!c) return;
      const s = state.conceptStats[cid];
      out[c.track].seen += s.seen || 0;
      out[c.track].correct += s.correct || 0;
    });
    TRACKS.forEach(t => {
      out[t].accuracy = out[t].seen ? out[t].correct / out[t].seen : 0;
    });
    return out;
  }

  function getInsights(state) {
    const insights = [];
    const acc = trackAccuracy(state);
    const entries = TRACKS.map(t => ({ t, ...acc[t] })).filter(x => x.seen >= 2);
    if (entries.length) {
      const weakest = entries.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b));
      if (weakest.accuracy < 0.7) {
        insights.push({ icon: '🎯', text: `${F.trackMeta[weakest.t].name}正确率 ${Math.round(weakest.accuracy * 100)}%，今天可以多复习这个方向。` });
      }
    }
    const conceptEntries = Object.keys(state.conceptStats || {})
      .filter(cid => state.conceptStats[cid].seen >= 2)
      .map(cid => ({ cid, ...state.conceptStats[cid] }))
      .sort((a, b) => (a.correct / a.seen) - (b.correct / b.seen));
    if (conceptEntries.length) {
      const c = conceptById(conceptEntries[0].cid);
      if (c) insights.push({ icon: c.icon, text: `最该补的概念：${c.title}。去图鉴里看 1 分钟，再做一次加练。` });
    }
    const m = getPortfolioMetrics(state);
    if (m.maxDrawdown >= 0.10) {
      insights.push({ icon: '📉', text: `模拟盘最大回撤 ${Math.round(m.maxDrawdown * 100)}%。这不一定是错，但要确认自己晚上睡得着。` });
    } else if (m.day > 0) {
      insights.push({ icon: '🛡️', text: `模拟盘最大回撤 ${Math.round(m.maxDrawdown * 100)}%，目前还在舒适区。` });
    }
    if ((state.player.streak || 0) >= 3) {
      insights.push({ icon: '🔥', text: `连胜 ${state.player.streak} 天。保持每天 10 分钟，比周末补 2 小时更有效。` });
    }
    return insights.slice(0, 3);
  }

  /* ---------------- Boss ---------------- */
  function getBossQuestions(state) {
    const qs = pickQuestions(state, 6, 'mixed', todayKey());
    state.boss.current = qs.map(q => q.id);
    if (!state.boss.weekKey) state.boss.weekKey = state.weekly.key || weekStartKey(todayKey());
    return qs;
  }

  function submitBoss(state, answers) {
    const qs = (state.boss.current || []).map(byId).filter(Boolean);
    const map = {};
    (answers || []).forEach(a => { map[a.qid] = a.choice; });
    let score = 0;
    qs.forEach(q => { if (map[q.id] === q.answer) score += 1; });
    state.boss.attempts = (state.boss.attempts || 0) + 1;
    state.boss.bestScore = Math.max(state.boss.bestScore || 0, score);
    const passed = score >= 5;
    let rewards = null;
    if (passed && !state.boss.done) {
      state.boss.done = true;
      state.stats.bossClears += 1;
      const xp = grantXp(state, 120);
      addCoins(state, 80);
      refreshDerived(state);
      const unlocked = checkAchievements(state);
      rewards = { xp: 120, coins: 80, achievements: unlocked, level: xp.level };
    }
    return { score, total: qs.length, passed, rewards, bestScore: state.boss.bestScore };
  }

  /* ---------------- 加练 ---------------- */
  function getPracticeQuestions(state, track, count, nodeId) {
    const today = todayKey();
    const hist = state.practiceHistory || [];
    const trackPool = F.questions.filter(q => track === 'mixed' || q.track === track);

    let primary = trackPool;
    let nextPool = [];
    let restPools = [];
    if (nodeId) {
      const node = nodeById(nodeId);
      if (node) {
        const filtered = trackPool.filter(q => node.concepts.includes(q.concept));
        if (filtered.length) primary = filtered;
      }
      const nodes = F.nodes.filter(n => n.track === track);
      const idx = nodes.findIndex(n => n.id === nodeId);
      if (idx >= 0 && nodes[idx + 1]) {
        const nextConcepts = new Set(nodes[idx + 1].concepts);
        nextPool = trackPool.filter(q => nextConcepts.has(q.concept) && !primary.includes(q));
      }
      if (idx >= 0) {
        for (let j = idx + 2; j < nodes.length; j++) {
          const set = new Set(nodes[j].concepts);
          restPools.push(trackPool.filter(q => set.has(q.concept) && !primary.includes(q) && !nextPool.includes(q)));
        }
      }
    }

    const unseen = pool => pool.filter(q => !hist.includes(q.id));
    const seenOldest = pool => pool
      .filter(q => hist.includes(q.id))
      .sort((a, b) => hist.indexOf(a.id) - hist.indexOf(b.id));

    // 先出新题：当前节点 → 下一节点 → 之后的节点按顺序；全练过之后，再按“最久没练”的顺序复习。
    const buckets = [
      unseen(primary),
      unseen(nextPool),
      ...restPools.map(unseen),
      seenOldest(primary),
      seenOldest(nextPool),
      ...restPools.map(seenOldest)
    ];

    const picked = [];
    const used = new Set();
    for (const bucket of buckets) {
      while (picked.length < count) {
        const candidates = bucket.filter(q => !used.has(q.id));
        if (!candidates.length) break;
        const q = pickWeighted(state, candidates, track, today);
        picked.push(q);
        used.add(q.id);
      }
      if (picked.length >= count) break;
    }

    while (picked.length < count) {
      const candidates = trackPool.filter(q => !used.has(q.id));
      if (!candidates.length) break;
      const q = pickWeighted(state, candidates, track, today);
      picked.push(q);
      used.add(q.id);
    }
    return picked;
  }

  function recordPracticeAnswer(state, qid, choice) {
    const q = byId(qid);
    if (!q) throw new Error('题目不存在');
    const today = todayKey();
    if (state.practice.date !== today) state.practice = { date: today, xp: 0 };
    const correct = choice === q.answer;
    const theta = state.theta[q.track] ?? 0;
    const difficulty = (q.difficulty - 3) * 0.65;
    const p = 1 / (1 + Math.exp(-(theta - difficulty)));
    state.theta[q.track] = clamp(theta + 0.3 * ((correct ? 1 : 0) - p), -2.5, 2.5);
    state.mastery[q.concept] = clamp((state.mastery[q.concept] || 0) + (correct ? 12 : -6), 0, 100);
    const s = state.srs[qid] || { box: 0, attempts: 0 };
    s.attempts += 1;
    s.box = correct ? Math.min((s.box || 0) + 1, 4) : 0;
    s.due = addDays(today, [1, 2, 4, 7, 14][s.box]);
    s.lastResult = correct;
    state.srs[qid] = s;
    state.recentQuestions.push(qid);
    state.recentQuestions = state.recentQuestions.slice(-40);
    state.practiceHistory = (state.practiceHistory || []).filter(id => id !== qid);
    state.practiceHistory.push(qid);
    if (state.practiceHistory.length > 200) state.practiceHistory = state.practiceHistory.slice(-200);
    unlockConcept(state, q.concept);
    let xp = 0;
    if (correct && state.practice.xp < 15) {
      xp = Math.min(5, 15 - state.practice.xp);
      state.practice.xp += xp;
      grantXp(state, xp);
    }
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return { correct, explain: q.explain, xp, achievements: unlocked };
  }

  /* ---------------- 每日加练 / 支线 ---------------- */
  function ensureBonus(state) {
    const today = todayKey();
    if (state.bonus && state.bonus.date === today) return state.bonus;
    state.bonus = { date: today, questionIds: [], answers: [], points: 0, correct: 0, caseId: null, caseDone: false };
    return state.bonus;
  }

  function getBonusQuestions(state) {
    const b = ensureBonus(state);
    if (b.questionIds.length) {
      const existing = b.questionIds.map(byId).filter(Boolean);
      if (existing.length) return existing;
    }
    const dailyIds = new Set(state.daily && state.daily.plan ? state.daily.plan.questionIds : []);
    const answered = new Set((b.answers || []).map(a => a.qid));
    let pool = F.questions.filter(q => !dailyIds.has(q.id) && !answered.has(q.id));
    if (pool.length < 3) pool = F.questions.filter(q => !answered.has(q.id));
    const picked = [];
    while (picked.length < 3 && pool.length) {
      const candidates = pool.filter(q => !picked.some(p => p.id === q.id));
      if (!candidates.length) break;
      picked.push(pickWeighted(state, candidates, 'mixed', todayKey()));
    }
    b.questionIds = picked.map(q => q.id);
    return picked;
  }

  function recordBonusAnswer(state, qid, choice) {
    const b = ensureBonus(state);
    const q = byId(qid);
    if (!q) throw new Error('题目不存在');
    const existing = (b.answers || []).find(a => a.qid === qid);
    if (existing) return Object.assign({ explain: q.explain, points: b.points, already: true }, existing);
    const correct = choice === q.answer;
    const xp = correct ? 8 : 3;
    const theta = state.theta[q.track] ?? 0;
    const difficulty = (q.difficulty - 3) * 0.65;
    const p = 1 / (1 + Math.exp(-(theta - difficulty)));
    state.theta[q.track] = clamp(theta + 0.22 * ((correct ? 1 : 0) - p), -2.5, 2.5);
    state.mastery[q.concept] = clamp((state.mastery[q.concept] || 0) + (correct ? 8 : -4), 0, 100);
    const s = state.srs[qid] || { box: 0, attempts: 0 };
    s.attempts += 1;
    s.box = correct ? Math.min((s.box || 0) + 1, 4) : 0;
    s.due = addDays(todayKey(), [1, 2, 4, 7, 14][s.box]);
    s.lastResult = correct;
    state.srs[qid] = s;
    state.recentQuestions.push(qid);
    state.recentQuestions = state.recentQuestions.slice(-40);
    unlockConcept(state, q.concept);

    b.answers.push({ qid, choice, correct, xp });
    b.points = Math.min(3, b.points + 1);
    if (correct) b.correct += 1;
    grantXp(state, xp);

    let caseUnlocked = false;
    if (b.points >= 3 && !b.caseId && !b.caseDone) {
      const c = getBonusCase(state);
      if (c) { b.caseId = c.id; caseUnlocked = true; }
    }
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return { correct, explain: q.explain, xp, points: b.points, caseUnlocked, caseId: b.caseId, achievements: unlocked };
  }

  function getBonusCase(state) {
    const done = state.bonusDone || [];
    const pool = F.bonusCases.filter(c => !done.includes(c.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function chooseBonusCase(state, caseId, choiceIndex) {
    const b = ensureBonus(state);
    if (!Array.isArray(state.bonusDone)) state.bonusDone = [];
    const c = F.bonusCases.find(x => x.id === caseId);
    if (!c) throw new Error('支线副本不存在');
    if (b.caseDone) return { already: true };
    const opt = c.options[choiceIndex];
    if (!opt) throw new Error('选项不存在');
    const quality = opt.quality;
    const xp = quality === 'good' ? 30 : quality === 'ok' ? 20 : 10;
    const coins = quality === 'good' ? 25 : quality === 'ok' ? 15 : 5;
    b.caseDone = true;
    if (!state.bonusDone.includes(c.id)) state.bonusDone.push(c.id);
    state.stats.cases += 1;
    if (quality === 'good') state.stats.goodCases += 1;
    state.journal.push({
      date: todayKey(), type: 'bonus', caseId: c.id, title: c.title,
      choice: choiceIndex, choiceText: opt.text, quality, concept: c.concept
    });
    if (state.journal.length > 140) state.journal = state.journal.slice(-140);
    unlockConcept(state, c.concept);
    grantXp(state, xp);
    addCoins(state, coins);
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return { opt, quality, xp, coins, achievements: unlocked };
  }

  function getCodeChallenge(state) {
    const done = state.codeDone || [];
    const pool = F.codeChallenges.filter(c => !done.includes(c.id));
    return pool.length ? pool[0] : F.codeChallenges[Math.floor(Math.random() * F.codeChallenges.length)];
  }

  function recordCodeAnswer(state, id, choice) {
    const c = F.codeChallenges.find(x => x.id === id);
    if (!c) throw new Error('代码副本不存在');
    const correct = choice === c.answer;
    const first = !(state.codeDone || []).includes(id);
    let xp = 0;
    if (first) {
      xp = correct ? 15 : 6;
      state.codeDone.push(id);
      grantXp(state, xp);
      state.mastery[c.concept] = clamp((state.mastery[c.concept] || 0) + (correct ? 12 : 4), 0, 100);
      unlockConcept(state, c.concept);
    }
    refreshDerived(state);
    const unlocked = checkAchievements(state);
    return { correct, explain: c.explain, xp, first, achievements: unlocked };
  }

  /* ---------------- 成就 / 商店 ---------------- */
  function checkAchievements(state) {
    const unlocked = [];
    (F.achievements || []).forEach(a => {
      if (state.player.achievements.includes(a.id)) return;
      let ok = false;
      try { ok = !!a.check(state); } catch (e) { ok = false; }
      if (ok) {
        state.player.achievements.push(a.id);
        addCoins(state, a.coins || 0);
        unlocked.push(a);
      }
    });
    return unlocked;
  }

  function buyItem(state, itemId) {
    const item = F.shop.find(x => x.id === itemId);
    if (!item) return { ok: false, msg: '商品不存在' };
    if ((state.player.coins || 0) < item.price) return { ok: false, msg: '叶币不够' };
    if (item.type === 'consumable') {
      if (item.id === 'freeze' && (state.player.freezes || 0) >= item.max) return { ok: false, msg: '冻结卡已满' };
      if (item.id === 'hint' && (state.player.hints || 0) >= item.max) return { ok: false, msg: '提示券已满' };
      if (item.id === 'freeze') state.player.freezes += 1;
      if (item.id === 'hint') state.player.hints += 1;
    } else if (item.type === 'cosmetic') {
      if (state.player.cosmetics.includes(item.id)) {
        const idx = state.player.activeCosmetics.indexOf(item.id);
        if (idx >= 0) state.player.activeCosmetics.splice(idx, 1);
        else state.player.activeCosmetics.push(item.id);
        return { ok: true, msg: '已切换装扮', toggled: true };
      }
      state.player.cosmetics.push(item.id);
      state.player.activeCosmetics.push(item.id);
    }
    state.player.coins -= item.price;
    return { ok: true, msg: `已购买：${item.name}` };
  }

  /* ---------------- 进度 ---------------- */
  function getDailyProgress(state) {
    const d = state.daily;
    if (!d) return { pct: 0, label: '未开始', stage: 'brief' };
    const map = { brief: 0, quiz: 1, case: 2, trade: 3, settle: 4, done: 5 };
    const idx = map[d.stage] ?? 0;
    let pct = idx / 5;
    if (d.stage === 'quiz') pct = (1 + (d.answers.length / Math.max(1, d.plan.questionIds.length))) / 5;
    if (d.stage === 'done') pct = 1;
    return { pct, label: d.stage, stage: d.stage, answered: d.answers.length, total: d.plan.questionIds.length };
  }

  const Engine = {
    VERSION, STORAGE_KEY, FEE_RATE,
    defaultState, load, save, reset, exportState, importState,
    todayKey, addDays, daysBetween, weekStartKey, setToday, clearToday,
    getLevelInfo, nodeMastery, nodeStatus, getNodeProgress, refreshDerived, claimNodeRewards,
    buildProfile, onboard,
    skipOnboarding,
    ensureDaily, startQuiz, revealBrief, buildDailyPlan,
    answerQuestion, getHint, chooseCase,
    rebalance, applyMarketDay, getPortfolioMetrics,
    settleDay, getWeekStats, trackAccuracy, getInsights,
    getBossQuestions, submitBoss,
    getPracticeQuestions, recordPracticeAnswer,
    ensureBonus, getBonusQuestions, recordBonusAnswer, getBonusCase, chooseBonusCase,
    getCodeChallenge, recordCodeAnswer,
    checkAchievements, buyItem,
    getDailyProgress
  };

  root.FIN.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
