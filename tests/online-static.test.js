'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function file(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

function testRequiredFiles() {
  const required = [
    'online.html',
    'assets/online.css',
    'assets/icon-180.png',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'js/online/config.js',
    'js/online/game.js',
    'js/online/supabase.js',
    'js/online/online.js',
    'js/online/cloud-save.js',
    'js/vendor/supabase.js',
    'manifest.webmanifest',
    'sw.js',
    'supabase/schema.sql',
    'ONLINE_SETUP.md',
    '.github/workflows/pages.yml',
    '.nojekyll'
  ];
  required.forEach(rel => assert(exists(rel), 'missing ' + rel));
  console.log('required files ok');
}

function testOnlineHtmlRefs() {
  const html = file('online.html');
  assert(html.includes('manifest.webmanifest'), 'manifest link');
  assert(html.includes('js/online/online.js'), 'online entry');
  assert(html.includes('js/online/supabase.js'), 'supabase adapter');
  assert(html.includes('js/vendor/supabase.js'), 'vendored supabase');
  assert(html.includes('assets/online.css'), 'online css');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(ref => !/^(https?:|data:|#)/.test(ref));
  refs.forEach(ref => assert(exists(ref), 'broken online.html ref: ' + ref));
  console.log('online.html refs ok');
}

function testManifestAndServiceWorker() {
  const manifest = JSON.parse(file('manifest.webmanifest'));
  assert.strictEqual(manifest.display, 'standalone');
  assert.strictEqual(manifest.start_url, './index.html');
  assert(manifest.icons.some(i => i.sizes === '192x192'));
  assert(manifest.icons.some(i => i.sizes === '512x512'));
  manifest.icons.forEach(icon => assert(exists(icon.src), 'missing icon ' + icon.src));

  const sw = file('sw.js');
  assert(sw.includes('serviceWorker') === false); // sw 里不需要注册代码
  assert(sw.includes('caches.open'));
  const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  assets.forEach(rel => assert(exists(rel), 'sw asset missing: ' + rel));
  console.log('manifest/sw ok');
}

function testSchema() {
  const sql = file('supabase/schema.sql');
  ['profiles', 'rooms', 'room_players', 'activities', 'saves'].forEach(t => {
    assert(sql.includes('create table if not exists public.' + t), 'table ' + t);
    assert(sql.includes('alter table public.' + t + ' enable row level security'), 'rls ' + t);
  });
  assert(sql.includes('rooms insert host'), 'room insert policy');
  assert(sql.includes('rooms update host'), 'room update policy');
  assert(sql.includes('room_players update self'), 'player update policy');
  assert(sql.includes('activities insert own'), 'activity insert policy');
  assert(sql.includes('saves read own'), 'saves read policy');
  assert(sql.includes('saves update own'), 'saves update policy');
  assert(sql.includes('supabase_realtime'), 'realtime publication');
  console.log('schema/RLS ok');
}

function testWorkflowAndDocs() {
  const wf = file('.github/workflows/pages.yml');
  assert(wf.includes('actions/upload-pages-artifact@v3'));
  assert(wf.includes('actions/deploy-pages@v4'));
  assert(wf.includes('path: .'));
  const setup = file('ONLINE_SETUP.md');
  ['Anonymous', 'schema.sql', 'GitHub Pages', 'supabaseUrl', 'anon'].forEach(s => {
    assert(setup.toLowerCase().includes(s.toLowerCase()), 'setup docs missing ' + s);
  });
  const readme = file('README.md');
  assert(readme.includes('ONLINE_SETUP.md'), 'README link');
  assert(readme.includes('online.html'), 'README online entry');
  console.log('workflow/docs ok');
}

function testMainAppEntry() {
  const app = file('js/app.js');
  assert(app.includes("['online', '🌐', '联机'"), 'desktop nav');
  assert(app.includes("case 'open-online'"), 'open handler');
  assert(app.includes("window.location.href = 'online.html'"), 'online href');
  const html = file('index.html');
  assert(html.includes('manifest.webmanifest'), 'index manifest');
  assert(html.includes('sw.js'), 'index sw registration');
  assert(html.includes('js/online/cloud-save.js'), 'index cloud save');
  const appJs = file('js/app.js');
  assert(appJs.includes('LeekCloudSave.queue'), 'app cloud queue');
  assert(appJs.includes('cloud-sync'), 'app cloud sync action');
  console.log('main app entry ok');
}

function testOnlineLogicWiring() {
  const js = file('js/online/online.js');
  ['anonymousLogin', 'subscribePresence', 'subscribeActivities',
    'createRoom', 'joinRoom', 'Game.resolveCoop', 'Game.portfolioDay',
    'beforeinstallprompt', 'matchId'].forEach(s => {
    assert(js.includes(s), 'online.js missing ' + s);
  });
  const adapter = file('js/online/supabase.js');
  ['signInAnonymous', 'subscribePresence', 'subscribeActivities',
    'createRoom', 'joinRoom', 'leaveRoom', 'flattenPresence'].forEach(s => {
    assert(adapter.includes(s), 'supabase adapter missing ' + s);
  });
  const config = file('js/online/config.js');
  assert(config.includes('supabaseUrl'));
  assert(config.includes('supabaseAnonKey'));
  const cloud = file('js/online/cloud-save.js');
  ['LeekCloudSave', "'saves'", 'saved_at', 'signInAnonymous'].forEach(s => {
    assert(cloud.includes(s), 'cloud save missing ' + s);
  });
  console.log('online wiring ok');
}

function testAdapterHelpers() {
  const store = new Map();
  global.localStorage = {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  };
  global.LEEK_ONLINE_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
  delete global.supabase;

  const SB = require('../js/online/supabase.js');
  assert.strictEqual(SB.isConfigured(), false, 'not configured initially');
  SB.saveConfig('https://demo.supabase.co', 'anon-key');
  const cfg = SB.getConfig();
  assert.strictEqual(cfg.supabaseUrl, 'https://demo.supabase.co');
  assert.strictEqual(cfg.supabaseAnonKey, 'anon-key');

  global.supabase = { createClient: () => ({}) };
  assert.strictEqual(SB.isConfigured(), true, 'configured after client exists');

  const svc = new SB.SupabaseService({});
  const flat = svc.flattenPresence({
    u1: [{ user_id: 'u1', nickname: '甲', level: 3, streak: 2 }],
    u2: [
      { user_id: 'u2', nickname: '乙', level: 2, streak: 1 },
      { user_id: 'u2', nickname: '乙', level: 2, streak: 1 }
    ]
  });
  assert.strictEqual(flat.length, 2, 'presence dedupe');
  assert.strictEqual(flat.find(x => x.user_id === 'u1').level, 3);
  assert.strictEqual(flat.find(x => x.user_id === 'u2').streak, 1);

  SB.clearConfig();
  assert.strictEqual(SB.getConfig().supabaseUrl, '', 'clear config');
  delete global.localStorage;
  delete global.LEEK_ONLINE_CONFIG;
  delete global.supabase;
  console.log('adapter helpers ok');
}

testRequiredFiles();
testOnlineHtmlRefs();
testManifestAndServiceWorker();
testSchema();
testWorkflowAndDocs();
testMainAppEntry();
testOnlineLogicWiring();
testAdapterHelpers();
console.log('\nONLINE STATIC TESTS PASSED');
