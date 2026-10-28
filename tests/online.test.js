'use strict';
const assert = require('assert');
require('../js/concepts.js');
require('../js/questions.js');
require('../js/cases.js');
const Game = require('../js/online/game.js');

function testRoomCode() {
  for (let i = 0; i < 20; i++) {
    const code = Game.makeRoomCode(i + 1);
    assert.strictEqual(code.length, 5);
    assert(/^[A-HJ-NP-Z2-9]{5}$/.test(code), 'valid code: ' + code);
  }
  console.log('room code ok');
}

function testCoop() {
  const state = Game.createCoopState(123, ['a', 'b']);
  assert.strictEqual(state.phase, 'choose');
  assert.strictEqual(state.caseIds.length, 3);
  assert.strictEqual(state.playerIds.length, 2);

  const c1 = Game.caseById(state.caseIds[0]);
  const good = c1.options.findIndex(o => o.quality === 'good');
  const bad = c1.options.findIndex(o => o.quality === 'bad');
  let next = Game.resolveCoop(state, {
    a: { round: 1, index: good },
    b: { round: 1, index: bad }
  });
  assert(next, 'resolved round 1');
  assert.strictEqual(next.phase, 'reveal');
  assert.strictEqual(next.result.details.a.score, 2);
  assert.strictEqual(next.result.details.b.score, 0);
  assert.strictEqual(next.result.teamScore, 2);
  assert.strictEqual(next.totals.a, 2);

  next = Game.nextCoopRound(next);
  assert.strictEqual(next.phase, 'choose');
  assert.strictEqual(next.round, 2);
  assert.strictEqual(next.result, null);

  const c2 = Game.caseById(next.caseIds[1]);
  const g2 = c2.options.findIndex(o => o.quality === 'good');
  next = Game.resolveCoop(next, {
    a: { round: 2, index: g2 },
    b: { round: 2, index: g2 }
  });
  assert.strictEqual(next.result.teamScore, 4);
  next = Game.nextCoopRound(next);

  const c3 = Game.caseById(next.caseIds[2]);
  const g3 = c3.options.findIndex(o => o.quality === 'good');
  next = Game.resolveCoop(next, {
    a: { round: 3, index: g3 },
    b: { round: 3, index: g3 }
  });
  next = Game.nextCoopRound(next);
  assert.strictEqual(next.phase, 'final');
  assert.strictEqual(next.totals.a, 6);
  assert.strictEqual(next.totals.b, 4);

  assert.strictEqual(Game.resolveCoop(state, { a: { round: 1, index: 0 } }), null, 'missing player blocks resolve');
  console.log('coop ok');
}

function testPortfolio() {
  assert.strictEqual(Game.allocationValid({ cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 }), true);
  assert.strictEqual(Game.allocationValid({ cash: 10, bond: 30, hs300: 35, gold: 15, tech: 20 }), false);

  const a1 = Game.marketReturns(42, 1);
  const a2 = Game.marketReturns(42, 1);
  assert.deepStrictEqual(a1, a2, 'market deterministic');

  const state = Game.createPortfolioState(42, ['a', 'b'], 3);
  assert.strictEqual(state.phase, 'alloc');
  assert.strictEqual(state.day, 1);
  assert.strictEqual(state.values.a, 10000);

  const allocation = { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 };
  let next = Game.portfolioDay(state, {
    a: { day: 1, allocation },
    b: { day: 1, allocation }
  });
  assert(next, 'portfolio day 1');
  assert.strictEqual(next.phase, 'result');
  assert.strictEqual(next.values.a, next.values.b, 'same allocation same value');
  assert(next.history.a.length === 2, 'history appended');
  assert(next.lastReturns.hs300 !== undefined, 'asset returns');

  next = Game.nextPortfolioDay(next);
  assert.strictEqual(next.day, 2);
  assert.strictEqual(next.phase, 'alloc');

  next = Game.portfolioDay(next, {
    a: { day: 2, allocation: { cash: 100, bond: 0, hs300: 0, gold: 0, tech: 0 } },
    b: { day: 2, allocation: { cash: 0, bond: 0, hs300: 100, gold: 0, tech: 0 } }
  });
  assert(next, 'portfolio day 2');
  assert(next.values.a !== next.values.b, 'different allocations diverge');

  next = Game.nextPortfolioDay(next);
  next = Game.portfolioDay(next, {
    a: { day: 3, allocation },
    b: { day: 3, allocation }
  });
  assert.strictEqual(next.phase, 'final');
  assert.strictEqual(next.final.length, 2);
  assert(next.final[0].value >= next.final[1].value, 'leaderboard sorted');
  console.log('portfolio ok', next.final);
}

function testInvalid() {
  const state = Game.createCoopState(1, ['a', 'b']);
  assert.strictEqual(Game.resolveCoop(state, {}), null);
  assert.strictEqual(Game.portfolioDay(Game.createPortfolioState(1, ['a', 'b']), {}), null);
  console.log('invalid state ok');
}

testRoomCode();
testCoop();
testPortfolio();
testInvalid();
console.log('\nONLINE GAME TESTS PASSED');
