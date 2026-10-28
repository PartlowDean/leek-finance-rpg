// 联机配置。
// 方式 A：把 Supabase 项目的 URL 和公开 key 填在这里，部署后所有访问者共用。
// 方式 B：留空，首次打开 online.html 时在页面里填，只保存在当前浏览器。
//
// key 用 Supabase 的 Publishable key（sb_publishable_...）或旧版 anon public key（eyJ...）。
// 两者都是公开 key，可以放前端；不要把 secret key / service_role key 放进来。
window.LEEK_ONLINE_CONFIG = {
  supabaseUrl: 'https://jmftpjjzwbvdbhitqdto.supabase.co',
  supabaseAnonKey: 'sb_publishable_XGjAXzeXLlYtlvOam2qYmA_GBebLs1-'
};
