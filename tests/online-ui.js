'use strict';
const assert = require('assert');
const { JSDOM } = require('jsdom');

const URL = (process.env.TEST_URL || 'http://127.0.0.1:8899') + '/online.html';
const tick = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // jsdom 没有 fetch；Supabase UMD 在加载时会绑定它。浏览器里原生存在。
      window.fetch = (...args) => fetch(...args);
      if (typeof Headers !== 'undefined') window.Headers = Headers;
      if (typeof Request !== 'undefined') window.Request = Request;
      if (typeof Response !== 'undefined') window.Response = Response;
    }
  });
  const win = dom.window;
  const doc = win.document;
  await new Promise(resolve => win.addEventListener('load', resolve));
  await tick(150);

  assert(win.LeekOnlineUI, 'online UI hook exists');
  assert(doc.querySelector('[data-action="anonymous-login"]'), 'auth screen renders');
  assert(doc.body.textContent.includes('两个人'), 'auth copy');
  console.log('online auth screen ok');

  const S = win.LeekOnlineUI.state;
  const G = win.FIN.OnlineGame;
  const profile = { id: 'u1', nickname: '韭菜一号', avatar: '🌱' };
  const other = { id: 'u2', nickname: '韭菜二号', avatar: '🌿' };

  S.profile = profile;
  S.online = [profile, other];
  S.activities = [
    { id: 1, nickname: '韭菜一号', text: '创建了合作剧情房间 ABC12', created_at: new Date().toISOString() },
    { id: 2, nickname: '韭菜二号', text: '加入了房间 ABC12', created_at: new Date().toISOString() }
  ];
  S.room = null;
  S.view = 'home';
  win.LeekOnlineUI.render();
  assert(doc.body.textContent.includes('和朋友，来一局'), 'home renders');
  assert(doc.body.textContent.includes('合作剧情'), 'coop card');
  assert(doc.body.textContent.includes('模拟盘 PK'), 'portfolio card');
  assert(doc.body.textContent.includes('创建了合作剧情房间'), 'activity feed');
  console.log('online home ok');

  const coop = G.createCoopState(123, ['u1', 'u2']);
  S.view = 'room';
  S.room = {
    id: 'r1', code: 'ABC12', game: 'coop', status: 'playing',
    host_id: 'u1', state: coop
  };
  S.players = [
    { user_id: 'u1', nickname: '韭菜一号', choice: null },
    { user_id: 'u2', nickname: '韭菜二号', choice: null }
  ];
  S.roomOnline = [profile, other];
  win.LeekOnlineUI.render();
  assert(doc.querySelectorAll('[data-action="coop-pick"]').length >= 3, 'coop options render');
  assert(doc.body.textContent.includes('合作剧情'), 'coop heading');

  const c1 = G.caseById(coop.caseIds[0]);
  const good = c1.options.findIndex(o => o.quality === 'good');
  const bad = c1.options.findIndex(o => o.quality === 'bad');
  S.room.state = G.resolveCoop(coop, {
    u1: { round: 1, index: good },
    u2: { round: 1, index: bad }
  });
  win.LeekOnlineUI.render();
  assert(doc.body.textContent.includes('双方选择已揭晓'), 'coop reveal');
  assert(doc.body.textContent.includes('优质决策'), 'coop quality');
  assert(doc.body.textContent.includes('高风险决策'), 'coop bad quality');
  console.log('online coop ok');

  const port = G.createPortfolioState(42, ['u1', 'u2'], 5);
  S.room = {
    id: 'r2', code: 'PK123', game: 'portfolio', status: 'playing',
    host_id: 'u1', state: port
  };
  S.players = [
    { user_id: 'u1', nickname: '韭菜一号', choice: null },
    { user_id: 'u2', nickname: '韭菜二号', choice: null }
  ];
  win.LeekOnlineUI.render();
  assert(doc.querySelectorAll('[data-online-alloc]').length === 4, 'portfolio sliders');
  assert(doc.body.textContent.includes('提交第 1 天配置'), 'portfolio submit');
  assert(doc.body.textContent.includes('现金'), 'portfolio cash');

  const allocation = { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 };
  S.room.state = G.portfolioDay(port, {
    u1: { day: 1, allocation },
    u2: { day: 1, allocation }
  });
  win.LeekOnlineUI.render();
  assert(doc.body.textContent.includes('第 1 天结算'), 'portfolio result');
  assert(doc.body.textContent.includes('净值'), 'portfolio values');
  console.log('online portfolio ok');

  win.close();
  console.log('\nONLINE UI SMOKE PASSED');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
