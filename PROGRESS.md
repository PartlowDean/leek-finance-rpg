# 进度存档

最后更新：2026-10-28（Asia/Shanghai）

## 当前状态

《韭菜进化论》单机版 + 联机版 + 云存档代码已完成。代码目录：

`C:\Users\lenovo\Documents\deepseek-harness\default-workspace\leek-finance-rpg`

Supabase 项目已创建，`js/online/config.js` 已填 Project URL + Publishable key。

### 单机版（已完成）

- 每日核心小测：4 题
- 每日加练：3 题 → 探索点 → 6 个支线副本
- 22 个成就、48 张概念卡、64 道题、14 个剧情副本、10 个事件、6 个代码副本
- 名词卡、答案位置打乱、加练轮转、模拟盘、周复盘、PWA
- 云存档：每次存档后防抖 1.2 秒上传 Supabase `saves`
- 测试：`engine.test.js`、`ui-smoke.js`、`cloud-save.test.js` 通过

### 联机版 v1

- `online.html` 联机大厅
- 游客账号 + 邮箱 Magic Link 登录
- 全局在线状态 / 好友在线列表
- 实时动态流：创建房间、加入、提交选择、结算
- 合作剧情：3 轮，两人各自选择，双方提交后揭晓
- 模拟盘 PK：同一 seed、5 个模拟交易日
- 房间码、邀请链接、`?room=CODE` 自动加入、刷新自动回房
- 每局 `matchId` 防旧选择串局
- 房主权威结算；客机只提交自己的选择
- 10 秒轮询 + Realtime 兜底
- PWA、GitHub Pages Actions
- Supabase SQL/RLS/Realtime：`supabase/schema.sql`

### 云存档 / 邮箱登录

- `saves` 表：`user_id / data jsonb / updated_at`
- 每次 `persist()` 更新本地时间戳，并 `LeekCloudSave.queue(state)`
- 打开页面时比较本地/云端时间戳；云端新则恢复并刷新，本地新则上传
- 设置 → 云存档：状态 / 立即同步
- 游客云存档只在本设备；邮箱登录后可跨设备
- 邮箱登录入口：`online.html` → 邮箱登录；或设置里的“邮箱登录”
- 注意：如果 Supabase 之前只跑过旧 SQL，需要重新跑整个 `schema.sql`，补 `saves` 表

## 测试

- `node tests/engine.test.js`
- `node tests/online.test.js`
- `node tests/online-static.test.js`
- `node tests/ui-smoke.js`
- `node tests/online-ui.js`
- `node tests/online-auth.js`
- `node tests/online-flow.js`
- `node tests/cloud-save.test.js`

全部通过。UI 测试换端口时用 `TEST_URL`，测试服务器用 `PORT`。

## 还没做 / 下次继续

1. **重新跑 Supabase SQL**
   - 创建 `saves` 表 + RLS，云存档才生效。
2. **推送 GitHub**
   - 仓库已建：`https://github.com/PartlowDean/leek-finance-rpg`
   - 本地目录 push 上去，开启 Pages → GitHub Actions。
3. **GitHub Pages 联调**
   - 更新 Supabase Auth → URL Configuration 的 Site URL / Redirect URLs。
   - 两个浏览器游客/邮箱登录，建房测试。
4. **单机每日进度同步到动态流（可选）**
   - 目前动态流主要是在线状态 + 房间操作 + 等级/连胜；还没发“今天答了几题/调仓/支线”。

## 运行

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
# 或
node tests/serve.js
```

- 单机：`http://127.0.0.1:8899/`
- 联机：`http://127.0.0.1:8899/online.html`
- 云存档设置：单机 → 设置 → 云存档

## 预览参数

- `?demo=1` 单机预览；`?demo=1&noCloud=1` 不触发云存档
- `online.html?demo=home|coop|coop-reveal|portfolio|portfolio-result`

## 重要边界

- 单机版仍以 localStorage 为主，Supabase 可用时才云存档。
- GitHub Pages 只托管前端，不能单独跑实时后端。
- 游客账号没有密码；清浏览器数据会丢失游客账号。
- 云存档不进 Git；Git 只存代码。
- 模拟盘仍是模拟行情，不构成投资建议。
