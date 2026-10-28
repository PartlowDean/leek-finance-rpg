'use strict';
const assert = require('assert');
const { JSDOM } = require('jsdom');

const URL = (process.env.TEST_URL || 'http://127.0.0.1:8899') + '/online.html';
const tick = ms => new Promise(r => setTimeout(r, ms));

class FakeService {
  constructor() {
    this.room = null;
    this.players = [];
    this.playerCb = null;
  }
  async createRoom(game, profile) {
    this.room = {
      id: 'r1', code: 'ABC12', game, status: 'lobby',
      host_id: profile.id, state: {}
    };
    this.players = [{ user_id: profile.id, nickname: profile.nickname, choice: null }];
    return this.room;
  }
  async getRoom() { return this.room; }
  async listPlayers() { return this.players; }
  async insertActivity() { /* no-op */ }
  async updateRoom(id, patch) { Object.assign(this.room, patch); return this.room; }
  async updateChoice(id, userId, choice) {
    const p = this.players.find(x => x.user_id === userId);
    if (p) p.choice = choice;
  }
  async leaveRoom() { /* no-op */ }
  async signOut() { /* no-op */ }
  subscribeRoom(id, onRoom, onPlayers) {
    this.roomCb = onRoom;
    this.playerCb = onPlayers;
    return { id: 'room-channel' };
  }
  subscribeActivities() { return { id: 'activities' }; }
  subscribePresence(name, profile, cb) {
    cb([
      { user_id: 'u1', nickname: '一号', level: 2, streak: 1 },
      { user_id: 'u2', nickname: '二号', level: 1, streak: 0 }
    ]);
    return { id: 'presence' };
  }
  removeChannel() { /* no-op */ }
}

function click(doc, selector) {
  const el = doc.querySelector(selector);
  assert(el, 'missing click target: ' + selector);
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', {
    bubbles: true, cancelable: true
  }));
}

(async () => {
  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (...args) => fetch(...args);
      if (typeof Headers !== 'undefined') window.Headers = Headers;
      if (typeof Request !== 'undefined') window.Request = Request;
      if (typeof Response !== 'undefined') window.Response = Response;
    }
  });
  const win = dom.window;
  const doc = win.document;
  await new Promise(resolve => win.addEventListener('load', resolve));
  await tick(120);

  const UI = win.LeekOnlineUI;
  const S = UI.state;
  const Game = win.FIN.OnlineGame;
  const fake = new FakeService();

  S.service = fake;
  S.session = { user: { id: 'u1' } };
  S.profile = { id: 'u1', nickname: '一号', level: 2, streak: 1 };
  S.online = [
    { user_id: 'u1', nickname: '一号', level: 2, streak: 1 },
    { user_id: 'u2', nickname: '二号', level: 1, streak: 0 }
  ];
  S.activities = [];
  S.room = null;
  S.view = 'home';
  S.busy = false;
  UI.render();

  click(doc, '[data-action="create-room"][data-game="coop"]');
  await tick(100);
  assert.strictEqual(S.view, 'room', 'entered room');
  assert(S.room && S.room.game === 'coop', 'coop room created');
  assert(doc.querySelector('.online-room-code'), 'room code rendered');
  assert(doc.body.textContent.includes('1/2 等待'), 'waiting for second player');

  fake.players.push({ user_id: 'u2', nickname: '二号', choice: null });
  fake.playerCb({ eventType: 'INSERT' });
  await tick(100);
  assert(doc.querySelector('[data-action="start-game"]'), 'host start appears');

  click(doc, '[data-action="start-game"]');
  await tick(140);
  assert.strictEqual(S.room.state.game, 'coop', 'coop started');
  assert(S.room.state.matchId, 'matchId assigned');
  assert(doc.querySelectorAll('[data-action="coop-pick"]').length >= 3, 'coop options');

  const c = Game.caseById(S.room.state.caseIds[0]);
  const good = c.options.findIndex(o => o.quality === 'good');
  click(doc, `[data-action="coop-pick"][data-index="${good}"]`);
  await tick(100);
  const hostChoice = fake.players.find(p => p.user_id === 'u1').choice;
  assert(hostChoice && hostChoice.matchId === S.room.state.matchId, 'host choice recorded');

  const bad = c.options.findIndex(o => o.quality === 'bad');
  fake.players.find(p => p.user_id === 'u2').choice = {
    matchId: S.room.state.matchId,
    round: 1,
    index: bad
  };
  fake.playerCb({ eventType: 'UPDATE' });
  await tick(180);
  assert.strictEqual(S.room.state.phase, 'reveal', 'host resolved coop');
  assert(doc.body.textContent.includes('双方选择已揭晓'), 'coop reveal render');

  // Portfolio flow from a fresh room
  S.room = null;
  S.view = 'home';
  UI.render();
  click(doc, '[data-action="create-room"][data-game="portfolio"]');
  await tick(100);
  fake.players.push({ user_id: 'u2', nickname: '二号', choice: null });
  fake.playerCb({ eventType: 'INSERT' });
  await tick(100);
  click(doc, '[data-action="start-game"]');
  await tick(140);
  assert.strictEqual(S.room.state.game, 'portfolio', 'portfolio started');
  assert(doc.querySelectorAll('[data-online-alloc]').length === 4, 'allocation sliders');

  click(doc, '[data-action="portfolio-submit"]');
  await tick(120);
  const ph = fake.players.find(p => p.user_id === 'u1').choice;
  assert(ph && ph.matchId === S.room.state.matchId, 'host portfolio choice');

  fake.players.find(p => p.user_id === 'u2').choice = {
    matchId: S.room.state.matchId,
    day: 1,
    allocation: { cash: 10, bond: 30, hs300: 35, gold: 15, tech: 10 }
  };
  fake.playerCb({ eventType: 'UPDATE' });
  await tick(180);
  assert.strictEqual(S.room.state.phase, 'result', 'host resolved portfolio');
  assert(doc.body.textContent.includes('第 1 天结算'), 'portfolio result render');

  win.close();
  console.log('\nONLINE UI FLOW PASSED');
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
