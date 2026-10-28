'use strict';
const assert = require('assert');
require('../js/concepts.js');
require('../js/questions.js');
require('../js/cases.js');
const Engine = require('../js/engine.js');
const F = globalThis.FIN;

function answerDay(state, opts) {
  opts = opts || {};
  const d = Engine.ensureDaily(state);
  for (const qid of d.plan.questionIds) {
    const q = F.questions.find(x => x.id === qid);
    assert(q, 'missing question ' + qid);
    const choice = opts.wrong ? (q.answer + 1) % 4 : q.answer;
    Engine.answerQuestion(state, qid, choice);
  }
  const c = F.cases.find(x => x.id === d.plan.caseId);
  assert(c, 'missing case ' + d.plan.caseId);
  const good = c.options.findIndex(o => o.quality === 'good');
  Engine.chooseCase(state, c.id, good >= 0 ? good : 0);
  if (opts.hold) Engine.rebalance(state, null, { hold: true });
  else Engine.rebalance(state, { cash: 10, bond: 30, hs300: 40, gold: 10, tech: 10 });
  return Engine.settleDay(state);
}

function testOnboard() {
  Engine.setToday('2026-10-25');
  const s = Engine.defaultState();
  assert.strictEqual(s.player.onboarded, false);
  const answers = F.diagnosticIds.map(id => {
    const q = F.questions.find(x => x.id === id);
    return { qid: id, choice: q.answer };
  });
  const out = Engine.onboard(s, answers, [
    { qid: 'risk_loss', choice: 2 },
    { qid: 'risk_horizon', choice: 3 }
  ]);
  assert.strictEqual(s.player.onboarded, true);
  assert(out.profile.wealthLevel >= 3, 'wealth level should be decent');
  assert(out.profile.quantLevel >= 3, 'quant level should be decent');
  assert.strictEqual(s.riskType, '进取');
  assert(s.player.coins >= 150, 'onboarding coins');
  assert(s.player.xp >= 80, 'onboarding xp');
  console.log('onboard ok', out.profile.headline, out.profile.wealthLevel, out.profile.quantLevel, out.profile.sideLevel);
  return s;
}

function testOneDay(s) {
  const d = Engine.ensureDaily(s);
  console.log('plan', d.plan.focus, d.plan.questionIds, d.plan.caseId, d.plan.eventId);
  assert.strictEqual(d.plan.questionIds.length, 4);
  const r = answerDay(s);
  assert(r, 'settle rewards');
  assert.strictEqual(s.daily.stage, 'done');
  assert.strictEqual(s.player.streak, 1);
  assert.strictEqual(s.stats.daysCompleted, 1);
  assert(s.player.level >= 2, 'should level up');
  console.log('day1 ok', { xp: s.player.xp, coins: s.player.coins, level: s.player.level, title: s.player.title, rewards: r, value: s.portfolio.value });
}

function testThirtyDays(s) {
  let date = '2026-10-25';
  for (let i = 1; i < 30; i++) {
    date = Engine.addDays(date, 1);
    Engine.setToday(date);
    answerDay(s);
  }
  assert.strictEqual(s.stats.daysCompleted, 30, '30 days completed');
  assert.strictEqual(s.player.streak, 30, '30 day streak');
  assert(s.player.xp > 3000, 'xp accumulates');
  assert(s.player.level >= 10, 'level should be >= 10');
  assert(s.claimedNodes.length >= 1, 'node rewards claimed');
  const acc = Engine.trackAccuracy(s);
  console.log('30 days ok', {
    xp: s.player.xp, level: s.player.level, title: s.player.title,
    coins: s.player.coins, streak: s.player.streak,
    portfolio: s.portfolio.value, maxDD: s.portfolio.maxDrawdown,
    accuracy: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v.accuracy * 100) + '%'])),
    achievements: s.player.achievements.length,
    nodes: F.nodes.map(n => n.id + ':' + Engine.nodeStatus(s, n)).join(' ')
  });
  return date;
}

function testBoss(s) {
  const qs = Engine.getBossQuestions(s);
  assert.strictEqual(qs.length, 6);
  const answers = qs.map(q => ({ qid: q.id, choice: q.answer }));
  const r = Engine.submitBoss(s, answers);
  assert.strictEqual(r.score, 6);
  assert.strictEqual(r.passed, true);
  assert(r.rewards, 'boss rewards');
  console.log('boss ok', r);
}

function testExportImport(s) {
  const json = Engine.exportState(s);
  const s2 = Engine.importState(json);
  assert.strictEqual(s2.player.xp, s.player.xp);
  assert.strictEqual(s2.stats.daysCompleted, s.stats.daysCompleted);
  console.log('export/import ok', json.length, 'chars');
}

function testMissedDayWithFreeze(s) {
  // Buy a freeze if possible, then skip two calendar days and settle.
  if ((s.player.freezes || 0) < 1) {
    s.player.coins += 200;
    Engine.buyItem(s, 'freeze');
  }
  const freezesBefore = s.player.freezes;
  const streakBefore = s.player.streak;
  let date = s.lastDailyDate;
  date = Engine.addDays(date, 2);
  Engine.setToday(date);
  answerDay(s);
  assert.strictEqual(s.player.freezes, freezesBefore - 1, 'freeze consumed');
  assert.strictEqual(s.player.streak, streakBefore + 1, 'streak preserved with freeze');
  console.log('freeze ok', { freezesBefore, freezesAfter: s.player.freezes, streak: s.player.streak });
}

function testPractice(s) {
  const qs = Engine.getPracticeQuestions(s, 'quant', 3);
  assert.strictEqual(qs.length, 3);
  let xp = 0;
  qs.forEach(q => { xp += Engine.recordPracticeAnswer(s, q.id, q.answer).xp; });
  assert(xp <= 15, 'practice xp cap');
  console.log('practice ok', { xp });
}

function testPracticeRotation() {
  Engine.setToday('2026-10-26');
  const p = Engine.defaultState();
  Engine.skipOnboarding(p);
  const seen = [];
  for (let r = 0; r < 3; r++) {
    const qs = Engine.getPracticeQuestions(p, 'quant', 3, 'q_n1');
    assert.strictEqual(qs.length, 3);
    assert.strictEqual(new Set(qs.map(q => q.id)).size, 3, 'unique within session');
    const repeats = qs.filter(q => seen.includes(q.id));
    assert.strictEqual(repeats.length, 0, 'no immediate repeat: ' + repeats.map(q => q.id).join(','));
    qs.forEach(q => { seen.push(q.id); Engine.recordPracticeAnswer(p, q.id, q.answer); });
  }
  console.log('practice rotation ok', { unique: seen.length });
}

function testCode(s) {
  const c = Engine.getCodeChallenge(s);
  assert(c, 'code challenge exists');
  const r = Engine.recordCodeAnswer(s, c.id, c.answer);
  assert.strictEqual(r.correct, true);
  assert(s.codeDone.includes(c.id), 'code challenge recorded');
  const again = Engine.recordCodeAnswer(s, c.id, c.answer);
  assert.strictEqual(again.xp, 0, 'no duplicate code xp');
  console.log('code ok', { id: c.id, xp: r.xp, total: s.codeDone.length });
}

function testBonus(s) {
  const b = Engine.ensureBonus(s);
  assert.strictEqual(b.points, 0);
  const qs = Engine.getBonusQuestions(s);
  assert.strictEqual(qs.length, 3);
  qs.forEach(q => Engine.recordBonusAnswer(s, q.id, q.answer));
  assert.strictEqual(s.bonus.points, 3, 'bonus points');
  assert(s.bonus.caseId, 'bonus case unlocked');
  const c = F.bonusCases.find(x => x.id === s.bonus.caseId);
  assert(c, 'bonus case exists');
  const good = c.options.findIndex(o => o.quality === 'good');
  const r = Engine.chooseBonusCase(s, c.id, good >= 0 ? good : 0);
  assert.strictEqual(s.bonus.caseDone, true, 'bonus case done');
  assert(s.bonusDone.includes(c.id), 'bonus archive');
  assert(r.xp > 0 && r.coins > 0, 'bonus rewards');
  console.log('bonus ok', { case: c.id, xp: r.xp, coins: r.coins, archive: s.bonusDone.length });
}

function testHold(s) {
  const d = Engine.ensureDaily(s);
  if (d.stage === 'done') {
    Engine.setToday(Engine.addDays(Engine.todayKey(), 1));
    Engine.ensureDaily(s);
  }
  const dd = Engine.ensureDaily(s);
  for (const qid of dd.plan.questionIds) {
    const q = F.questions.find(x => x.id === qid);
    Engine.answerQuestion(s, qid, q.answer);
  }
  const c = F.cases.find(x => x.id === dd.plan.caseId);
  Engine.chooseCase(s, c.id, c.options.findIndex(o => o.quality === 'good'));
  const before = s.portfolio.value;
  const r = Engine.rebalance(s, null, { hold: true });
  assert.strictEqual(r.fee, 0);
  assert(s.portfolio.value !== before || r.dayReturn !== 0);
  Engine.settleDay(s);
  console.log('hold ok', { before, after: s.portfolio.value, dayReturn: r.dayReturn });
}

const s = testOnboard();
testOneDay(s);
testThirtyDays(s);
testBoss(s);
testExportImport(s);
testMissedDayWithFreeze(s);
testPractice(s);
testPracticeRotation();
testCode(s);
testBonus(s);
testHold(s);
console.log('\nALL TESTS PASSED');
