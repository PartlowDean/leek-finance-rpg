# vendor

- `supabase.js`: Supabase JS `2.118.0` UMD build, downloaded from jsDelivr:
  `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js`
- License: MIT (Supabase).
- 保留在仓库里是为了 GitHub Pages 离线/弱网也能加载，避免依赖运行时 CDN。
- 2.118.0 支持新的 `sb_publishable_...` key，也兼容旧版 `anon` JWT key。

升级步骤：换版本号下载同名文件，更新本说明，然后测试 `online.html` 的设置页和游客登录。
