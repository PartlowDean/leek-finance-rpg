(function (root) {
  'use strict';

  const SB = root.LeekSupabase;
  const KEY = 'leek_finance_rpg_v1';
  const SAVED_AT = 'leek_finance_rpg_v1_saved_at';
  const RESTORE_FLAG = 'leek_cloud_restore_pending';

  let service = null;
  let session = null;
  let initPromise = null;
  let ready = false;
  let pending = null;
  let timer = null;
  let state = 'off';
  let message = '';
  let lastSync = 0;
  let disabled = false;

  function allowed() {
    if (disabled) return false;
    try {
      const q = new URLSearchParams(root.location.search);
      if (q.get('noCloud') === '1' || q.get('demo') === '1') return false;
    } catch (e) { /* ignore */ }
    if (!SB || !SB.isConfigured()) return false;
    return true;
  }

  function readRaw() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function readState() {
    try {
      const raw = readRaw();
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setLocalState(data) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(data));
      root.localStorage.setItem(SAVED_AT, String(Date.now()));
      return true;
    } catch (e) { return false; }
  }
  function getSessionFlag() {
    try { return root.sessionStorage.getItem(RESTORE_FLAG) === '1'; } catch (e) { return false; }
  }
  function setSessionFlag() {
    try { root.sessionStorage.setItem(RESTORE_FLAG, '1'); } catch (e) { /* ignore */ }
  }

  function setStatus(next, msg) {
    state = next;
    message = msg || '';
    if (next === 'on') lastSync = Date.now();
    const el = root.document && root.document.getElementById('cloud-save-desc');
    if (el) el.textContent = statusText();
    try {
      root.dispatchEvent(new CustomEvent('leek-cloud-status', {
        detail: { status: state, message: message, text: statusText() }
      }));
    } catch (e) { /* ignore */ }
  }

  function statusText() {
    if (state === 'off') return '未配置 Supabase，仅本地存档';
    if (state === 'auth') return '正在创建云存档账号…';
    if (state === 'pull') return '正在检查云存档…';
    if (state === 'saving') return '保存中…';
    if (state === 'restored') return '已恢复云存档，正在刷新…';
    if (state === 'error') return '云存档不可用：' + (message || '未知错误');
    if (state === 'on') {
      const who = session && session.user.email ? '邮箱云存档' : '游客云存档（仅本设备）';
      const t = lastSync ? new Date(lastSync).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
      return `${who} · ${t ? '最近同步 ' + t : '已连接'}`;
    }
    return '本地存档';
  }

  async function ensureSession() {
    if (session) return session;
    if (!service) throw new Error('云存档未初始化');
    session = await service.getSession();
    if (!session) {
      await service.signInAnonymous();
      session = await service.getSession();
    }
    if (!session) throw new Error('无法建立云存档账号');
    return session;
  }

  async function doPush(data) {
    await ensureSession();
    const { error } = await service.client.from('saves').upsert({
      user_id: session.user.id,
      data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
    try { root.localStorage.setItem(SAVED_AT, String(Date.now())); } catch (e) { /* ignore */ }
    setStatus('on');
  }

  async function init() {
    if (initPromise) return initPromise;
    if (!allowed()) {
      disabled = true;
      setStatus('off', '当前为本地/预览模式');
      initPromise = Promise.resolve();
      return initPromise;
    }
    initPromise = (async () => {
      if (!SB || !SB.isConfigured()) {
        setStatus('off');
        return;
      }
      service = SB.createService();
      setStatus('pull');
      session = await service.getSession();
      if (!session) {
        setStatus('auth');
        await service.signInAnonymous();
        session = await service.getSession();
      }
      if (!session) throw new Error('无法建立云存档账号');

      const { data, error } = await service.client.from('saves')
        .select('data,updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;

      const localRaw = readRaw();
      let localAt = 0;
      try { localAt = Number(root.localStorage.getItem(SAVED_AT)) || 0; } catch (e) { /* ignore */ }

      // 老版本第一次启用云存档：本地已有进度但没有时间戳，优先保留本地。
      if (localRaw && !localAt) {
        localAt = Date.now();
        try { root.localStorage.setItem(SAVED_AT, String(localAt)); } catch (e) { /* ignore */ }
      }

      if (data && data.data) {
        const cloudAt = Date.parse(data.updated_at) || 0;
        const shouldRestore = !localRaw || (cloudAt > localAt + 1200 && !getSessionFlag());
        if (shouldRestore) {
          if (setLocalState(data.data)) {
            setSessionFlag();
            setStatus('restored');
            setTimeout(() => root.location.reload(), 180);
            ready = true;
            return;
          }
        }
      }

      const localState = readState();
      if (localState) await doPush(localState);
      ready = true;
      setStatus('on');
    })().catch(err => {
      console.warn('cloud save init', err);
      state = 'error';
      message = err && err.message ? err.message : String(err);
      initPromise = null;
      ready = false;
      setStatus('error', message);
    });
    return initPromise;
  }

  function queue(data) {
    if (!allowed()) return;
    pending = data;
    setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, 1200);
    if (!initPromise) init();
  }

  async function flush() {
    if (!pending) return;
    const data = pending;
    pending = null;
    try {
      await init();
      await doPush(data);
    } catch (e) {
      console.warn('cloud save push', e);
      setStatus('error', e.message || String(e));
    }
  }

  async function syncNow() {
    if (!allowed()) return statusText();
    pending = null;
    clearTimeout(timer);
    await init();
    const localState = readState();
    if (localState) await doPush(localState);
    return statusText();
  }

  root.LeekCloudSave = {
    init,
    queue,
    syncNow,
    statusText,
    getStatus: () => state,
    isReady: () => ready
  };

  if (root.document) {
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.visibilityState === 'hidden' && pending) {
        const data = pending;
        pending = null;
        clearTimeout(timer);
        doPush(data).catch(e => console.warn('cloud save pagehide', e));
      }
    });
  }

  if (SB && SB.isConfigured()) {
    setTimeout(() => { init(); }, 350);
  }
})(typeof window !== 'undefined' ? window : globalThis);
