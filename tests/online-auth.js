'use strict';
const assert = require('assert');
const { JSDOM } = require('jsdom');

const URL = (process.env.TEST_URL || 'http://127.0.0.1:8899') + '/online.html';
const tick = ms => new Promise(r => setTimeout(r, ms));

class FakeAuthService {
  async signInAnonymous() { return { user: { id: 'u1' } }; }
  async getSession() { return { user: { id: 'u1' } }; }
  async getProfile() { return null; }
  async upsertProfile(id, patch) {
    return { id, nickname: patch.nickname || '一号', avatar: '🌱', level: 1, streak: 0, xp: 0 };
  }
  async listActivities() { return []; }
  subscribeActivities() { return { id: 'activities' }; }
  subscribePresence(name, profile, cb) {
    cb([{ user_id: 'u1', nickname: profile.nickname, level: 1, streak: 0 }]);
    return { id: 'presence' };
  }
  removeChannel() { /* no-op */ }
  async signOut() { /* no-op */ }
  async getRoom() { return null; }
  async listPlayers() { return []; }
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
  S.service = new FakeAuthService();
  S.session = null;
  S.profile = null;
  S.view = 'auth';
  S.busy = false;
  S.ui.nickname = '一号';
  UI.render();
  assert(doc.querySelector('[data-action="anonymous-login"]'), 'auth screen');

  doc.querySelector('[data-action="anonymous-login"]').dispatchEvent(
    new win.MouseEvent('click', { bubbles: true, cancelable: true })
  );
  await tick(180);
  assert(S.profile && S.profile.nickname === '一号', 'profile created');
  assert.strictEqual(S.view, 'home', 'entered home after auth');
  assert(doc.body.textContent.includes('和朋友，来一局'), 'home after auth');
  assert(doc.body.textContent.includes('1 在线'), 'presence count after auth');

  win.close();
  console.log('\nONLINE AUTH FLOW PASSED');
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
