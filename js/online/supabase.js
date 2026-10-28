(function (root) {
  'use strict';

  const CONFIG_KEY = 'leek_online_supabase';
  const DEFAULT_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };

  function readStoredConfig() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getConfig() {
    const fromFile = root.LEEK_ONLINE_CONFIG || {};
    const stored = readStoredConfig() || {};
    const url = String(fromFile.supabaseUrl || stored.supabaseUrl || '').trim();
    const key = String(fromFile.supabaseAnonKey || stored.supabaseAnonKey || '').trim();
    return { supabaseUrl: url, supabaseAnonKey: key };
  }

  function saveConfig(url, key) {
    const next = { supabaseUrl: String(url || '').trim(), supabaseAnonKey: String(key || '').trim() };
    if (!next.supabaseUrl || !next.supabaseAnonKey) throw new Error('Supabase URL 和公开 key 都要填');
    root.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  function clearConfig() {
    try { root.localStorage.removeItem(CONFIG_KEY); } catch (e) { /* ignore */ }
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.supabaseUrl && c.supabaseAnonKey && root.supabase && root.supabase.createClient);
  }

  function fail(error) {
    if (!error) throw new Error('未知错误');
    throw new Error(error.message || String(error));
  }

  function createService() {
    const c = getConfig();
    if (!c.supabaseUrl || !c.supabaseAnonKey) throw new Error('还没有配置 Supabase URL / anon key');
    if (!root.supabase || !root.supabase.createClient) throw new Error('Supabase JS 没有加载，请检查 js/vendor/supabase.js');
    const client = root.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return new SupabaseService(client);
  }

  class SupabaseService {
    constructor(client) {
      this.client = client;
      this.uid = null;
    }

    async getSession() {
      const { data, error } = await this.client.auth.getSession();
      if (error) fail(error);
      this.uid = data && data.session ? data.session.user.id : null;
      return data ? data.session : null;
    }

    onAuthStateChange(cb) {
      return this.client.auth.onAuthStateChange((event, session) => {
        this.uid = session && session.user ? session.user.id : null;
        cb(session, event);
      });
    }

    async signInAnonymous() {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) fail(error);
      this.uid = data && data.user ? data.user.id : null;
      return data;
    }

    async signInWithOtp(email) {
      const redirect = root.location ? root.location.href.split('#')[0] : undefined;
      const { data, error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect }
      });
      if (error) fail(error);
      return data;
    }

    async signOut() {
      const { error } = await this.client.auth.signOut();
      if (error) fail(error);
      this.uid = null;
    }

    async getProfile(userId) {
      const { data, error } = await this.client.from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) fail(error);
      return data;
    }

    async upsertProfile(userId, patch) {
      const existing = await this.getProfile(userId);
      const row = Object.assign({
        id: userId,
        nickname: '韭菜同学',
        avatar: '🌱'
      }, existing || {}, patch || {});
      const { data, error } = await this.client.from('profiles')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();
      if (error) fail(error);
      return data;
    }

    async insertActivity(profile, text, kind, roomId) {
      const row = {
        user_id: profile.id,
        nickname: profile.nickname || '韭菜同学',
        kind: kind || 'activity',
        text,
        room_id: roomId || null
      };
      const { data, error } = await this.client.from('activities').insert(row).select().single();
      if (error) fail(error);
      return data;
    }

    async listActivities(limit) {
      const { data, error } = await this.client.from('activities')
        .select('id,user_id,nickname,kind,text,room_id,created_at')
        .order('created_at', { ascending: false })
        .limit(limit || 30);
      if (error) fail(error);
      return data || [];
    }

    subscribeActivities(onInsert, onStatus) {
      const channel = this.client.channel('leek:activities')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        }, payload => onInsert(payload.new))
        .subscribe(status => { if (onStatus) onStatus(status); });
      return channel;
    }

    async createRoom(game, profile) {
      let lastError = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = root.FIN.OnlineGame.makeRoomCode((Date.now() + attempt * 7919) >>> 0);
        const { data: existing, error: e1 } = await this.client.from('rooms')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (e1) fail(e1);
        if (existing) continue;
        const { data, error } = await this.client.from('rooms')
          .insert({ code, game, status: 'lobby', host_id: profile.id, state: {} })
          .select()
          .single();
        if (error) { lastError = error; continue; }
        await this.upsertPlayer(data.id, profile);
        try {
          await this.insertActivity(profile, `创建了${game === 'coop' ? '合作剧情' : '模拟盘 PK'}房间 ${code}`, 'room', data.id);
        } catch (e) { /* 动态流失败不影响房间 */ }
        return data;
      }
      fail(lastError || { message: '生成房间码失败，请重试' });
    }

    async joinRoom(code, profile) {
      const normalized = String(code || '').trim().toUpperCase();
      if (!normalized) throw new Error('请输入房间码');
      const { data: room, error } = await this.client.from('rooms')
        .select('*')
        .eq('code', normalized)
        .maybeSingle();
      if (error) fail(error);
      if (!room) throw new Error('没有找到这个房间，检查一下房间码');
      const players = await this.listPlayers(room.id);
      const existing = players.find(p => p.user_id === profile.id);
      if (!existing && room.status !== 'lobby') {
        throw new Error(room.status === 'finished' ? '这局已经结束了' : '这局已经开始，等下一局再加入');
      }
      if (!existing && players.length >= 2) {
        throw new Error('房间已满（最多 2 人）');
      }
      await this.upsertPlayer(room.id, profile);
      try {
        await this.insertActivity(profile, `加入了房间 ${normalized}`, 'room', room.id);
      } catch (e) { /* 动态流失败不影响加入 */ }
      return room;
    }

    async upsertPlayer(roomId, profile) {
      const { data: existing, error: e1 } = await this.client.from('room_players')
        .select('room_id,user_id')
        .eq('room_id', roomId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (e1) fail(e1);
      if (existing) {
        const { error } = await this.client.from('room_players')
          .update({ nickname: profile.nickname, last_seen: new Date().toISOString() })
          .eq('room_id', roomId)
          .eq('user_id', profile.id);
        if (error) fail(error);
        return;
      }
      const { error } = await this.client.from('room_players').insert({
        room_id: roomId,
        user_id: profile.id,
        nickname: profile.nickname || '韭菜同学',
        choice: null,
        last_seen: new Date().toISOString()
      });
      if (error) fail(error);
    }

    async getRoom(roomId) {
      const { data, error } = await this.client.from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
      if (error) fail(error);
      return data;
    }

    async listPlayers(roomId) {
      const { data, error } = await this.client.from('room_players')
        .select('room_id,user_id,nickname,choice,joined_at,last_seen')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      if (error) fail(error);
      return data || [];
    }

    async updateRoom(roomId, patch) {
      const { data, error } = await this.client.from('rooms')
        .update(patch)
        .eq('id', roomId)
        .select()
        .single();
      if (error) fail(error);
      return data;
    }

    async updateChoice(roomId, userId, choice) {
      const { data, error } = await this.client.from('room_players')
        .update({ choice, last_seen: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) fail(error);
      return data;
    }

    async leaveRoom(roomId, userId, isHost) {
      if (isHost) {
        const { error } = await this.client.from('rooms').delete().eq('id', roomId);
        if (error) fail(error);
        return;
      }
      const { error } = await this.client.from('room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);
      if (error) fail(error);
    }

    subscribeRoom(roomId, onRoom, onPlayers, onStatus) {
      return this.client.channel(`leek:room:${roomId}:db`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
        }, payload => onRoom(payload))
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}`
        }, payload => onPlayers(payload))
        .subscribe(status => { if (onStatus) onStatus(status); });
    }

    subscribePresence(channelName, profile, onSync) {
      const channel = this.client.channel(channelName, {
        config: { presence: { key: profile.id } }
      });
      channel.on('presence', { event: 'sync' }, () => {
        onSync(this.flattenPresence(channel.presenceState()));
      });
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: profile.id,
            nickname: profile.nickname || '韭菜同学',
            avatar: profile.avatar || '🌱',
            level: Number(profile.level) || 1,
            streak: Number(profile.streak) || 0,
            online_at: new Date().toISOString()
          });
        }
      });
      return channel;
    }

    flattenPresence(state) {
      const out = [];
      const seen = new Set();
      Object.keys(state || {}).forEach(key => {
        (state[key] || []).forEach(item => {
          if (!item || !item.user_id || seen.has(item.user_id)) return;
          seen.add(item.user_id);
          out.push({
            user_id: item.user_id,
            nickname: item.nickname || '韭菜同学',
            avatar: item.avatar || '🌱',
            level: Number(item.level) || 1,
            streak: Number(item.streak) || 0,
            online_at: item.online_at || null
          });
        });
      });
      return out;
    }

    async removeChannel(channel) {
      if (!channel) return;
      try { await this.client.removeChannel(channel); } catch (e) { /* ignore */ }
    }
  }

  root.LeekSupabase = {
    CONFIG_KEY,
    DEFAULT_CONFIG,
    getConfig,
    saveConfig,
    clearConfig,
    isConfigured,
    createService,
    SupabaseService
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LeekSupabase;
})(typeof window !== 'undefined' ? window : globalThis);
