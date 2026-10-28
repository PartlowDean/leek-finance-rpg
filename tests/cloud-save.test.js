'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const tick = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="cloud-save-desc"></div></body></html>', {
    url: 'http://127.0.0.1:8899/?cloudtest=1',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const win = dom.window;
  const local = JSON.stringify({ version: 1, player: { xp: 10, level: 1 } });
  win.localStorage.setItem('leek_finance_rpg_v1', local);
  win.localStorage.setItem('leek_finance_rpg_v1_saved_at', String(Date.now()));

  let saved = null;
  let tableName = '';
  const chain = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
    async upsert(row) { saved = row; return { error: null }; }
  };
  const client = {
    from(table) { tableName = table; return chain; }
  };
  const service = {
    async getSession() { return { user: { id: 'u1', email: null } }; },
    async signInAnonymous() { /* not needed */ },
    client
  };
  win.LeekSupabase = {
    isConfigured: () => true,
    createService: () => service
  };

  win.eval(fs.readFileSync(path.join(__dirname, '..', 'js/online/cloud-save.js'), 'utf8'));
  assert(win.LeekCloudSave, 'cloud save hook');
  await tick(700);

  assert.strictEqual(tableName, 'saves', 'uses saves table');
  assert(saved && saved.user_id === 'u1', 'saved under user');
  assert.strictEqual(saved.data.player.xp, 10, 'uploaded local state');
  assert(win.LeekCloudSave.statusText().includes('游客云存档'), 'guest status');

  win.LeekCloudSave.queue({ version: 1, player: { xp: 20, level: 1 } });
  await tick(1500);
  assert.strictEqual(saved.data.player.xp, 20, 'debounced real-time save');

  win.close();
  console.log('\nCLOUD SAVE TEST PASSED');
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
