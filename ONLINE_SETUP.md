# 联机版部署：Supabase + GitHub Pages

这套联机版仍然是**纯前端**，但把账号、实时状态和房间数据放在 Supabase。  
GitHub Pages 负责托管页面；Supabase 负责后端。两者都是免费额度，两个朋友玩足够。

> GitHub Pages 本身不能跑数据库/实时服务，所以不能只用 GitHub Pages 实现联机。

---

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com>，注册/登录。
2. **New project**：
   - 名字随意，例如 `leek-finance`
   - 数据库密码自己保存好
   - Region 选离你近的（例如 Singapore / Tokyo）
3. 等项目初始化完成（约 1–2 分钟）。

## 2. 运行数据库 SQL

1. Supabase 左侧 **SQL Editor** → **New query**。
2. 把本项目的 [`supabase/schema.sql`](supabase/schema.sql) 全部复制进去。
3. 点 **Run**。
4. 到 **Table Editor** 确认有 5 张表：
   - `profiles`
   - `rooms`
   - `room_players`
   - `activities`
   - `saves`（单机云存档）

> 如果你之前已经跑过旧版 SQL，**重新把整个 schema.sql 跑一遍**即可；脚本是幂等的，会补上 `saves` 表和新策略。

如果 SQL 中途报错，先把错误信息发我；不要只运行一半。

## 3. 开启登录方式

### 3.1 匿名登录（游客）

1. Supabase 左侧 **Authentication** → **Providers**。
2. 找到 **Anonymous**，打开 **Enable**，保存。

### 3.2 邮箱登录（跨设备云存档，可选但推荐）

1. **Authentication → Providers → Email**，确认 **Enable Email provider** 已开启（默认开启）。
2. 免费项目用 Supabase 自带邮件服务即可；邮件可能进垃圾箱。
3. 到 **Authentication** → **URL Configuration**：
   - 本地测试时 **Site URL** 填 `http://127.0.0.1:8899`
   - **Redirect URLs** 加：
     ```text
     http://127.0.0.1:8899/*
     http://localhost:8899/*
     ```
   - 部署后再加上：
     ```text
     https://你的用户名.github.io/leek-finance-rpg/*
     ```
4. 不需要自己配 SMTP；除非你要给很多人用，再考虑自定义 SMTP。

## 4. 填 Supabase 配置

Supabase 左侧 **Project Settings** → **API Keys**（新版在 **Settings → API Keys**；旧版可能叫 **API**），复制：

- **Project URL**（`https://xxxx.supabase.co`）
- **Publishable key**（`sb_publishable_...`，推荐）
  - 如果你的项目只有旧版 key，就用 **anon public**（一长串 `eyJ...`）
  - **不要**用 **Secret key** / `service_role`，它会绕过 RLS

当前项目内置的 Supabase JS 已升级到 2.118.0，两种 key 都兼容。

然后二选一：

### 方式 A：写进配置文件（推荐，部署后所有人共用）

编辑 [`js/online/config.js`](js/online/config.js)：

```js
window.LEEK_ONLINE_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'sb_publishable_...'
};
```

> 旧版 anon key 也填在 `supabaseAnonKey` 这个字段里，例如 `eyJ...`。

### 方式 B：页面里填（只保存在当前浏览器）

打开 `online.html`，在设置页填入 URL 和公开 key，点“保存并连接”。  
这种方式适合先测试；部署给朋友时建议用方式 A。

> Publishable key / anon key 都是公开 key，可以放前端；**不要**把 Secret key / `service_role` key 放进来。

## 4.5 云存档怎么工作

- 单机版每次存档后，会**防抖约 1.2 秒**自动上传到 Supabase `saves` 表。
- 打开页面时会比较本地和云端时间戳：云端更新就恢复云端，本地更新就上传本地。
- 设置 → 云存档 可以看到状态，也可以点“立即同步”。
- **游客账号只在本设备有效**；清浏览器数据后游客账号也会丢。
- 想跨设备：在联机版点 **邮箱登录**，邮件里点登录链接，再回单机版；之后云存档会跟着邮箱账号走。
- 云存档是 Supabase 数据，不会写进 Git 仓库，也不会公开在 GitHub。

## 5. 上传 GitHub 并开 Pages

1. 在 GitHub 新建仓库，例如 `leek-finance-rpg`。
2. 把 **`leek-finance-rpg` 文件夹里的内容**推到仓库根目录（不是把外层文件夹再套一层）。
3. 仓库 **Settings → Pages → Build and deployment**：
   - Source 选 **GitHub Actions**
4. 推送到 `main` 分支后，Actions 里的 `Deploy static app to GitHub Pages` 会自动运行。
5. 部署完成后，Pages 地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

6. 打开：

```text
https://你的用户名.github.io/仓库名/online.html
```

> 如果 Pages 没有自动部署：检查仓库 Settings → Actions → General 是否允许 Actions；以及 Pages 的 Source 是否为 GitHub Actions。
>
> 如果仓库根目录不是本文件夹（例如外层还套了一层 `leek-finance-rpg/`），把 `.github/workflows/pages.yml` 里的 `path: .` 改成 `path: leek-finance-rpg`，并相应调整访问路径。

## 6. 两个人怎么玩

1. 两个人在各自设备/浏览器打开同一个 `online.html`。
2. 各填一个昵称，点“游客进入”（两个独立游客账号）；也可以点“邮箱登录”用邮箱账号。
3. 一个人创建房间（合作剧情 / 模拟盘 PK），把邀请链接或 5 位房间码发给另一个人。
4. 另一个人输入房间码加入；房主点“开始游戏”。
5. 房间页会实时显示双方在线状态、选择和结算结果。

同一个浏览器想开两个账号：普通窗口 + InPrivate/无痕窗口即可（存储隔离）。

> 云存档要跨设备，用**邮箱登录**；游客账号只在本设备有效。

## 7. 手机安装成 App

部署到 GitHub Pages 后是 HTTPS，可以：

- **Android Chrome/Edge**：菜单 → “安装应用/添加到主屏幕”
- **iPhone Safari**：分享 → “添加到主屏幕”

安装后从桌面图标启动，仍然是同一个联机后端。

## 8. 常见问题

### `Anonymous sign-ins are disabled`

去 **Authentication → Providers**（或 **Sign In / Providers**）→ **Anonymous**，打开 **Enable** / **Allow anonymous sign-ins**，保存。改完等几秒再试。

### `new row violates row-level security policy`

说明 SQL 没跑完整，或 `profiles` 行没建出来。  
重新运行 `supabase/schema.sql`，确认 5 张表和策略都在。

### 云存档显示“云存档不可用”/`saves` 表不存在

你之前可能只跑过旧版 SQL。重新运行整个 `supabase/schema.sql`，它会补上：

```text
public.saves
```

然后刷新页面；设置 → 云存档里点“立即同步”。

### 邮箱登录收不到链接

1. 检查垃圾箱；
2. Supabase → Authentication → URL Configuration 的 **Site URL / Redirect URLs** 是否包含当前地址；
3. 免费邮件服务有频率限制，等几分钟再试；
4. 也可以先用“游客进入”，云存档在本设备仍然可用。

### 房间能创建，但对方看不到实时变化

1. 确认 `schema.sql` 最后的 Realtime 部分执行成功。
2. Supabase **Database → Replication** 里确认 `rooms`、`room_players`、`activities` 在 publication 中。
3. 刷新页面；Realtime 断线后重新订阅需要刷新。

### 加入房间提示“这局已经开始”

房间开始后不再允许第三人加入。等下一局，或让房主重新建房。

### 页面能打开，但点“游客进入”报错

- 检查 URL/公开 key 是否复制完整（Publishable key 或 anon key，不要填 Secret key）；
- 检查 Supabase 项目是否暂停（免费项目长期不用会暂停）；
- 看浏览器 Console 的红色错误，把第一条发我。

## 9. 安全边界

- 这是给朋友玩的轻量联机，不是生产级账号系统。
- 匿名账号没有密码；清浏览器数据会丢失该游客账号。
- 所有登录用户可以看到全局动态和房间列表；房间码不是密码。
- 不要在里面放真实姓名、学校、住址等敏感信息。
- 模拟盘仍是模拟行情，不构成投资建议。
