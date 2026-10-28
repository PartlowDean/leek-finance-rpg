(function (root) {
  'use strict';

  const F = root.FIN;
  const ASSETS = ['cash', 'bond', 'hs300', 'gold', 'tech'];
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const DEFAULT_ALLOC = { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 };

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
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

  function seededShuffle(list, seed) {
    const a = list.slice();
    const rng = mulberry32(seed >>> 0);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeRoomCode(seed) {
    const rng = mulberry32((seed >>> 0) || (Date.now() >>> 0));
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
    return code;
  }

  function assetMeta(key) {
    const meta = (F.assets && F.assets[key]) || {};
    return {
      drift: Number(meta.drift) || 0,
      vol: Number(meta.vol) || 0,
      name: meta.name || key,
      color: meta.color || '#8fa394',
      icon: meta.icon || '•'
    };
  }

  function normalizeAllocation(raw) {
    const out = {};
    ASSETS.forEach(k => { out[k] = Math.max(0, Number(raw && raw[k]) || 0); });
    const total = sum(ASSETS.map(k => out[k]));
    if (total <= 0) return Object.assign({}, DEFAULT_ALLOC);
    if (Math.abs(total - 100) < 0.01) return out;
    // 不静默接受错误配置：调用方应提示“合计 100%”
    return out;
  }

  function allocationValid(raw) {
    const total = sum(ASSETS.map(k => Math.max(0, Number(raw && raw[k]) || 0)));
    return Math.abs(total - 100) < 0.5;
  }

  function qualityScore(q) {
    return q === 'good' ? 2 : q === 'ok' ? 1 : 0;
  }

  function caseById(id) {
    return (F.cases || []).find(c => c.id === id);
  }

  function pickCoopCases(seed, count) {
    count = count || 3;
    const pool = (F.cases || []).filter(c => c.options && c.options.length >= 3);
    const shuffled = seededShuffle(pool, seed >>> 0);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  function createCoopState(seed, playerIds) {
    const cases = pickCoopCases(seed, 3);
    const totals = {};
    playerIds.forEach(id => { totals[id] = 0; });
    return {
      game: 'coop',
      phase: 'choose',
      round: 1,
      totalRounds: cases.length,
      caseIds: cases.map(c => c.id),
      playerIds: playerIds.slice(),
      totals,
      result: null,
      seed: seed >>> 0
    };
  }

  function resolveCoop(state, picks) {
    if (!state || state.game !== 'coop' || state.phase !== 'choose') return null;
    const caseId = state.caseIds[state.round - 1];
    const c = caseById(caseId);
    if (!c) return null;
    const details = {};
    const totals = Object.assign({}, state.totals || {});
    for (const id of state.playerIds) {
      const pick = picks[id];
      if (!pick || Number(pick.round) !== state.round) return null;
      const opt = c.options[Number(pick.index)];
      if (!opt) return null;
      const score = qualityScore(opt.quality);
      details[id] = {
        index: Number(pick.index),
        text: opt.text,
        quality: opt.quality,
        score,
        feedback: opt.feedback
      };
      totals[id] = (totals[id] || 0) + score;
    }
    const teamScore = sum(state.playerIds.map(id => details[id].score));
    return Object.assign({}, state, {
      phase: 'reveal',
      totals,
      result: {
        round: state.round,
        caseId,
        title: c.title,
        details,
        teamScore,
        at: Date.now()
      }
    });
  }

  function nextCoopRound(state) {
    if (!state || state.game !== 'coop') return state;
    if (state.round >= state.totalRounds) {
      return Object.assign({}, state, { phase: 'final', result: state.result });
    }
    return Object.assign({}, state, {
      phase: 'choose',
      round: state.round + 1,
      result: null
    });
  }

  function coopLeaderboard(state) {
    return (state.playerIds || [])
      .map(id => ({ userId: id, score: (state.totals && state.totals[id]) || 0 }))
      .sort((a, b) => b.score - a.score);
  }

  function createPortfolioState(seed, playerIds, totalDays) {
    const values = {};
    const history = {};
    playerIds.forEach(id => { values[id] = 10000; history[id] = [{ day: 0, value: 10000 }]; });
    return {
      game: 'portfolio',
      phase: 'alloc',
      day: 1,
      totalDays: totalDays || 5,
      seed: seed >>> 0,
      playerIds: playerIds.slice(),
      values,
      history,
      allocations: {},
      lastReturns: null,
      lastAllocations: null,
      result: null
    };
  }

  function marketReturns(seed, day) {
    const rng = mulberry32(((seed >>> 0) + Math.imul(day, 2654435761)) >>> 0);
    const regimeRoll = rng();
    const regime = regimeRoll < 0.38 ? 'bull' : regimeRoll < 0.72 ? 'chop' : 'bear';
    const adj = regime === 'bull' ? 0.0004 : regime === 'bear' ? -0.0007 : 0;
    const returns = {};
    ASSETS.forEach(key => {
      const meta = assetMeta(key);
      if (key === 'cash') {
        returns[key] = meta.drift / 252;
      } else {
        const vol = meta.vol / Math.sqrt(252);
        returns[key] = meta.drift / 252 + adj + vol * gaussian(rng);
      }
    });
    return { regime, returns };
  }

  function portfolioDay(state, choices) {
    if (!state || state.game !== 'portfolio' || state.phase !== 'alloc') return null;
    const allocations = {};
    for (const id of state.playerIds) {
      const choice = choices[id];
      if (!choice || Number(choice.day) !== state.day) return null;
      if (!allocationValid(choice.allocation)) return null;
      allocations[id] = normalizeAllocation(choice.allocation);
    }
    const market = marketReturns(state.seed, state.day);
    const values = Object.assign({}, state.values);
    const history = {};
    state.playerIds.forEach(id => { history[id] = (state.history[id] || []).slice(); });
    state.playerIds.forEach(id => {
      const oldValue = Number(state.values[id]) || 10000;
      const alloc = allocations[id];
      const newValue = sum(ASSETS.map(k => oldValue * (alloc[k] / 100) * (1 + market.returns[k])));
      values[id] = Math.round(newValue * 100) / 100;
      history[id].push({ day: state.day, value: values[id] });
    });
    const isFinal = state.day >= state.totalDays;
    return Object.assign({}, state, {
      phase: isFinal ? 'final' : 'result',
      values,
      history,
      allocations: Object.assign({}, state.allocations, { [state.day]: allocations }),
      lastReturns: market.returns,
      lastRegime: market.regime,
      lastAllocations: allocations,
      result: {
        day: state.day,
        returns: market.returns,
        regime: market.regime,
        allocations,
        values: Object.assign({}, values)
      },
      final: isFinal ? portfolioLeaderboard({
        playerIds: state.playerIds,
        values,
        history
      }) : null
    });
  }

  function nextPortfolioDay(state) {
    if (!state || state.game !== 'portfolio') return state;
    if (state.phase === 'final' || state.day >= state.totalDays) {
      return Object.assign({}, state, { phase: 'final' });
    }
    return Object.assign({}, state, { phase: 'alloc', day: state.day + 1 });
  }

  function portfolioLeaderboard(state) {
    return (state.playerIds || []).map(id => {
      const start = 10000;
      const value = Number(state.values && state.values[id]) || start;
      const hist = (state.history && state.history[id]) || [];
      let peak = start, maxDD = 0;
      hist.forEach(h => {
        peak = Math.max(peak, h.value);
        if (peak > 0) maxDD = Math.max(maxDD, (peak - h.value) / peak);
      });
      return {
        userId: id,
        value,
        returnPct: value / start - 1,
        maxDrawdown: maxDD
      };
    }).sort((a, b) => b.value - a.value);
  }

  const Game = {
    ASSETS,
    DEFAULT_ALLOC,
    hashSeed,
    mulberry32,
    makeRoomCode,
    normalizeAllocation,
    allocationValid,
    qualityScore,
    pickCoopCases,
    createCoopState,
    resolveCoop,
    nextCoopRound,
    coopLeaderboard,
    createPortfolioState,
    marketReturns,
    portfolioDay,
    nextPortfolioDay,
    portfolioLeaderboard,
    caseById
  };

  root.FIN = root.FIN || {};
  root.FIN.OnlineGame = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
})(typeof window !== 'undefined' ? window : globalThis);
