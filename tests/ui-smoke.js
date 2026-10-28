'use strict';
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');

const URL = (process.env.TEST_URL || 'http://127.0.0.1:8899') + '/?noCloud=1';
const errors = [];

function tick(ms) { return new Promise(r => setTimeout(r, ms || 30)); }

async function main() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = String(e && e.message || e);
    if (/Not implemented: window.scrollTo/i.test(msg)) return;
    errors.push(msg);
  });
  vc.on('error', (...args) => errors.push(args.join(' ')));

  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.fetch = (...args) => fetch(...args);
      if (typeof Headers !== 'undefined') window.Headers = Headers;
      if (typeof Request !== 'undefined') window.Request = Request;
      if (typeof Response !== 'undefined') window.Response = Response;
    }
  });
  const win = dom.window;
  const doc = win.document;

  await new Promise(resolve => {
    if (doc.readyState === 'complete') resolve();
    else win.addEventListener('load', resolve);
  });
  await tick(120);

  function click(sel) {
    const el = doc.querySelector(sel);
    if (!el) throw new Error('missing element: ' + sel);
    el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  function text(sel) {
    const el = doc.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }

  // 1. onboarding welcome
  assert(doc.querySelector('.onboarding'), 'onboarding should render');
  assert(doc.querySelector('[data-action="start-diag"]'), 'start diag button');
  console.log('welcome ok');

  // 2. diagnostic: pick the first option for all 12 questions
  click('[data-action="start-diag"]');
  await tick();
  for (let i = 0; i < 12; i++) {
    const opt = doc.querySelector('[data-action="diag-option"]');
    assert(opt, 'diag option at ' + i);
    opt.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(10);
    const next = doc.querySelector('[data-action="diag-next"]');
    assert(next && !next.disabled, 'diag next enabled at ' + i);
    next.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(20);
  }
  assert(doc.querySelector('.profile-headline'), 'profile result should render');
  console.log('diagnostic ok:', text('.profile-headline'));

  // 3. enter greenhouse
  click('[data-action="enter-greenhouse"]');
  await tick(80);
  assert(doc.querySelector('.hero'), 'today hero should render');
  assert(doc.querySelector('[data-action="start-quiz"]'), 'start quiz button');
  console.log('enter greenhouse ok');

  // 4. daily quiz: term card can open without answering, then 3 questions
  click('[data-action="start-quiz"]');
  await tick(40);

  const termBtn = doc.querySelector('[data-action="term"]');
  assert(termBtn, 'term card button on quiz');
  termBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(30);
  assert(doc.querySelector('.modal .concept-detail'), 'term card modal opens');
  assert(!doc.querySelector('.feedback'), 'term card does not answer the question');
  click('[data-action="close-modal"]');
  await tick(20);

  const termLink = doc.querySelector('.term-link');
  if (termLink) {
    termLink.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(30);
    assert(doc.querySelector('.modal .concept-detail'), 'inline term modal opens');
    assert(!doc.querySelector('.feedback'), 'inline term click does not answer');
    click('[data-action="close-modal"]');
    await tick(20);
  }
  console.log('term cards ok');

  for (let i = 0; i < 4; i++) {
    const opt = doc.querySelector('[data-action="answer"]');
    assert(opt, 'answer option at ' + i);
    opt.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(30);
    assert(doc.querySelector('.feedback'), 'quiz feedback at ' + i);
    const next = doc.querySelector('[data-action="next-question"]');
    assert(next, 'next question at ' + i);
    next.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(30);
  }
  console.log('quiz ok');

  // 5. case
  const caseOpt = doc.querySelector('[data-action="case-choice"]');
  assert(caseOpt, 'case options');
  caseOpt.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(60);
  if (!doc.querySelector('[data-action="case-continue"]')) {
    console.log('CASE DEBUG');
    console.log('toasts', [...doc.querySelectorAll('.toast')].map(x => x.textContent));
    console.log('daily stage', JSON.parse(win.localStorage.getItem('leek_finance_rpg_v1')).daily.stage);
    console.log('quest', doc.querySelector('.quest-card') ? doc.querySelector('.quest-card').outerHTML.slice(0, 1200) : 'NO QUEST');
    console.log('errors', errors);
  }
  assert(doc.querySelector('[data-action="case-continue"]'), 'case continue');
  click('[data-action="case-continue"]');
  await tick(40);
  console.log('case ok');

  // 6. trade
  const preset = doc.querySelector('[data-action="preset"][data-preset="balanced"]');
  assert(preset, 'balanced preset');
  preset.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(40);
  const confirm = doc.querySelector('[data-action="trade-confirm"]');
  assert(confirm && !confirm.disabled, 'trade confirm enabled');
  confirm.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(60);
  assert(doc.querySelector('[data-action="settle"]'), 'settle button');
  console.log('trade ok');

  // 7. settle
  click('[data-action="settle"]');
  await tick(100);
  assert(doc.querySelector('.result-title'), 'done result');
  console.log('settle ok:', text('.result-title'));

  // 7b. code challenge modal
  click('[data-action="code-open"]');
  await tick(40);
  assert(doc.querySelector('.code-block'), 'code block renders');
  click('[data-action="code-answer"][data-choice="0"]');
  await tick(40);
  assert(doc.querySelector('.modal .feedback'), 'code feedback renders');
  click('[data-action="code-next"]');
  await tick(30);
  click('[data-action="close-modal"]');
  await tick(20);
  console.log('code challenge ok');

  // 7c. bonus questions -> exploration points -> bonus case
  click('[data-action="bonus-open"]');
  await tick(40);
  assert(doc.querySelector('.modal'), 'bonus modal opens');
  for (let i = 0; i < 3; i++) {
    const opt = doc.querySelector('[data-action="bonus-answer"]');
    assert(opt, 'bonus answer at ' + i);
    opt.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(30);
    assert(doc.querySelector('.modal .feedback'), 'bonus feedback at ' + i);
    const next = doc.querySelector('[data-action="bonus-next"]');
    assert(next, 'bonus next at ' + i);
    next.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(30);
  }
  const bonusCase = doc.querySelector('[data-action="bonus-case-choice"]');
  assert(bonusCase, 'bonus case unlocked');
  bonusCase.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(40);
  assert(doc.querySelector('[data-action="bonus-finish"]'), 'bonus finish');
  click('[data-action="bonus-finish"]');
  await tick(40);
  assert(doc.querySelector('[data-action="bonus-close"]'), 'bonus close');
  click('[data-action="bonus-close"]');
  await tick(20);
  console.log('bonus ok');

  const saved = JSON.parse(win.localStorage.getItem('leek_finance_rpg_v1'));
  assert.strictEqual(saved.stats.daysCompleted, 1, 'one day completed');
  assert.strictEqual(saved.daily.stage, 'done', 'daily done');
  assert(saved.player.xp > 0, 'xp earned');
  assert(saved.portfolio.trades.length >= 1, 'trade recorded');
  assert(saved.bonusDone.length >= 1, 'bonus archive recorded');
  assert.strictEqual(saved.bonus.caseDone, true, 'bonus case done');
  console.log('state ok:', { xp: saved.player.xp, coins: saved.player.coins, streak: saved.player.streak, trades: saved.portfolio.trades.length });

  // 8. navigation
  click('[data-action="nav"][data-view="skills"]');
  await tick(40);
  assert(doc.querySelector('.skill-path'), 'skills render');
  console.log('skills ok:', doc.querySelectorAll('.node').length, 'nodes');

  // 8b. practice modal
  click('[data-action="skill-tab"][data-track="quant"]');
  await tick(30);
  const practiceBtn = doc.querySelector('[data-action="practice-node"]');
  assert(practiceBtn, 'practice button');
  practiceBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(40);
  assert(doc.querySelector('.modal'), 'practice modal');
  click('[data-action="practice-answer"][data-choice="0"]');
  await tick(40);
  assert(doc.querySelector('.modal .feedback'), 'practice feedback');
  click('[data-action="close-modal"]');
  await tick(20);
  console.log('practice ok');

  click('[data-action="nav"][data-view="portfolio"]');
  await tick(40);
  assert(doc.querySelector('.chart, .chart-empty'), 'portfolio chart or placeholder');
  console.log('portfolio ok');

  click('[data-action="nav"][data-view="codex"]');
  await tick(40);
  assert(doc.querySelector('.codex-grid'), 'codex grid');
  console.log('codex ok:', doc.querySelectorAll('.codex-card').length, 'cards');

  click('[data-action="nav"][data-view="review"]');
  await tick(40);
  assert(doc.querySelector('.week-grid'), 'review stats');
  console.log('review ok');

  // 9. modals
  click('[data-action="shop-open"]');
  await tick(40);
  assert(doc.querySelector('.modal'), 'shop modal');
  click('[data-action="close-modal"]');
  await tick(20);
  assert(!doc.querySelector('.modal'), 'shop closed');

  click('[data-action="settings-open"]');
  await tick(40);
  assert(doc.querySelector('.modal'), 'settings modal');
  click('[data-action="close-modal"]');
  await tick(20);
  console.log('modals ok');

  // 10. errors
  assert.strictEqual(errors.length, 0, 'console errors: ' + errors.join(' | '));
  console.log('\nUI SMOKE PASSED');
  dom.window.close();
}

main().catch(e => {
  console.error('\nUI SMOKE FAILED');
  console.error(e && e.stack || e);
  if (errors.length) console.error('JS errors:', errors);
  process.exit(1);
});
