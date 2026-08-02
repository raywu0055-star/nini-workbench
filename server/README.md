# nini's workbench — 部署到 Render（PWA + 后台推送，一个进程）

把**整个项目**部署到 Render，得到一个公网 `https://xxxx.onrender.com` 地址：

- 浏览器 / 手机打开即**安装为 PWA**（离线可用、全屏、独立图标、深度链接）
- 同一个进程同时跑 **Web Push**，实现「App 完全关闭也弹系统通知」

> 本项目 `server/index.js` 用 `PUBLIC_DIR` 自动查找 `index.html`：
> 只要仓库根目录有 `index.html`，把 Render 的 **Root Directory 设为 `server`** 即可。

---

## 0. 前置条件
- 一个 **GitHub** 账号（免费）
- 一个 **Render** 账号（免费，可用 GitHub 直接登录）
- 本项目已在本机 `git init` 并完成首次提交（见第 1 步连远程即可）

---

## 1. 推到 GitHub（只需一次）

本机已经 `git init` + 首次提交，你只需连接远程仓库并推送：

```bash
cd <项目目录>
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

> 如果你更想自己来：在项目根目录 `git init`，再
> `git add -A && git commit -m "nini workbench"`，然后 `git remote add` + `git push`。
> `.gitignore` 已排除 `node_modules`、运行态文件（`subs.json`/`jobs.json`/`vapid.json`）和未用到的 1MB 素材，仓库保持精简。

---

## 2. 在 Render 创建 Web Service

1. 打开 https://dashboard.render.com → **New** → **Web Service**
2. 连接你的 GitHub 仓库（首次会请求授权，允许即可）
3. 配置：
   - **Name**：`nini-workbench`（随意）
   - **Root Directory**：填 **`server`** ← 关键！`package.json` 在 `server/` 里
   - **Runtime**：`Node`
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Plan**：`Free`
4. 展开 **Advanced → Add Environment Variable**，添加 **VAPID 密钥**（让推送订阅在重新部署后依然有效）：
   - 本地先生成一次（任选其一）：
     ```bash
     npx web-push generate-vapid-keys
     ```
     会输出 `publicKey` / `privateKey`。
   - 在 Render 添加两条环境变量：
     - `VAPID_PUBLIC_KEY` = 上面的 publicKey
     - `VAPID_PRIVATE_KEY` = 上面的 privateKey
   - 不设置也能跑，但每次重新部署会换新密钥、旧订阅失效，手机会提示重新订阅。
5. 点 **Create Web Service**，等待构建完成（约 1–2 分钟）。

---

## 3. 拿到地址 & 手机安装

1. 打开 Render 给的地址，如 `https://nini-workbench.onrender.com`
2. **手机浏览器**打开该地址（安卓 Chrome / iPhone Safari）
3. 安装：
   - **安卓**：地址栏「安装」图标，或菜单 → 「安装应用」
   - **iPhone**：底部「分享」→「添加到主屏幕」
4. 桌面也可访问，打开后允许通知。

---

## 4. 开启「关 App 也提醒」

1. 打开 App → **设置**
2. 「后台推送（关 App 也提醒）」开关 → 打开
3. 「推送服务器地址」→ 填 Render 地址（如 `https://nini-workbench.onrender.com`）；
   默认是 `http://localhost:3000`，**必须改成公网 https 地址**
4. 允许通知权限
5. 点「测试服务器推送」，系统通知栏应弹出一条来自服务器的提醒（证明后台推送链路已通）

---

---

## 4.5 防止 Render 免费版休眠（保活）★ 关键

Render **免费版**在闲置约 **15 分钟**后会自动休眠（进程挂起）。这会直接导致两个问题：

1. **首次打开变慢**：服务休眠后下一次请求要先「冷启动」约 30 秒。
2. **关 App 收不到提醒**：定时提醒由服务器到点发 push，服务器休眠时计时器不走动，到点了也没人发推送。

> 本项目已把 App 启动改为「缓存优先」（打开即显示界面，不再白屏等待 30 秒），
> 但**定时推送要真正发出，服务器到点时必须醒着**——这就是保活的意义。

**解决办法：用一个外部监控定时 ping 服务器，让它始终处于活跃状态（< 15 分钟一次）。**

### 方法一：UptimeRobot（推荐，免费）
1. 打开 https://uptimerobot.com 注册/登录（免费）。
2. **Add New Monitor** → Monitor Type 选 **HTTP(s)**。
3. Friendly Name：`nini-workbench`
4. URL：`https://你的地址/status`（如 `https://nini-workbench.onrender.com/status`）
5. Monitoring Interval：选 **5 minutes**（免费档最小间隔；小于 15 分钟即可阻止休眠）。
6. 点 **Create Monitor** 即可。

> 想更稳可再加一个 Monitor 指向首页 `https://你的地址/`（双保险）。

### 方法二：cron-job.org（免费备选）
1. 打开 https://cron-job.org 注册/登录。
2. **Create cronjob** → URL 填 `https://你的地址/status`。
3. Schedule 设为每 **10 分钟**执行一次（Simple → Every 10 minutes）。
4. 保存。

### 方法三：升级 Render 付费
升级到 Starter 套餐（约 $7/月）进程**常驻不休眠**，最省心但不是免费。

### ⚠️ 部署 / 改配置后必做：重开 App 重新订阅
只要**重新部署过**或**改了 VAPID 环境变量**，Render 会重新生成推送密钥，手机上**旧的订阅立即失效**——
表现为：设置页推送状态看似正常，但提醒不再弹出。请务必：

1. **手机上把 App 彻底关闭（多任务划掉），再重新打开一次** —— 它会自动用新密钥重新订阅。
2. 打开后到 **设置** 确认「后台推送」已开启、服务器地址为公网 https 地址。
3. 点「测试服务器推送」或「1分钟后推送测试」验证链路恢复。

> 若已按第 2 步设置 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` 固定密钥，则**只有首次部署需要重订阅**，
> 之后单纯改代码重新部署不会失效，更稳定。UptimeRobot 保活本身不会触发密钥变更，无需重订阅。

---

## 5. 排错

| 现象 | 解决 |
| --- | --- |
| 构建失败 / 找不到 package.json | **Root Directory 必须填 `server`** |
| 打开地址空白 / 404 | 确认仓库根目录有 `index.html`；`PUBLIC_DIR` 会自动回退查找 |
| 没有「安装」按钮 | 地址必须是 **https**（Render 默认就是）；manifest 字段已校验完整 |
| 推送订阅失败 | 服务器地址填的是 https 的 Render 地址，且已允许通知权限 |
| 重新部署后收不到旧提醒 | 免费版每次部署后订阅可能失效，重开 App 设置开关重新订阅即可；设置了 VAPID 环境变量则更稳定 |
| 免费版睡眠导致首次慢 / 收不到 | 配置保活：用 [UptimeRobot](https://uptimerobot.com) 每 5 分钟 ping 一次 `/status`（见 4.5 节） |

---

## 6. 安全加固（部署前必读）

代码已内置以下防护，**重新部署后自动生效**：

1. **禁止静态访问 `server/` 目录**（关键）
   旧版 `express.static` 会把整个项目根对外提供，导致 `server/vapid.json`（含 VAPID 私钥）、
   `server/subs.json`（设备推送 token）、`server/index.js`（源码）可被任何人直接下载。
   现已在处理静态资源前拦截所有 `/server` 路径与 `..` 穿越，这些文件一律返回 404。

2. **推送接口加同源校验 + 限流**
   `POST /subscribe`、`/schedule`、`/notify` 现在要求请求**同源**（Origin 的 host 与本站一致，
   自动适配 localhost / Render / 自定义域名），或携带 `PUSH_SECRET` 共享密钥；否则返回 401。
   匿名扫描器 / curl 无法再伪造通知或注册垃圾订阅。另加了按 IP 的简易限流（60 次/分钟）。

3. **隐藏技术栈**：关闭 `X-Powered-By: Express` 响应头。

4. **密钥不在磁盘落库（推荐）**：在 Render **Environment** 里设置
   `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`（见第 2 步），私钥只存于环境变量，永不写入磁盘、永不对外提供。

### ⚠️ 本轮必须做的「密钥轮换」
在修复**之前**，`/server/vapid.json` 的 VAPID 私钥已公开泄露。泄露的私钥等同于「他人可冒充本服务器
向你的设备推送伪造通知」。请务必**重新部署一次**让服务生成新密钥（Render 免费版磁盘随部署重置，
`vapid.json` 会被重新生成；如已按上文设置了 VAPID 环境变量则直接用你自己的密钥）。
重新部署后旧订阅失效，重开 App 会自动重新订阅。

### 可选：设置更强的 PUSH_SECRET
Render **Environment** 添加 `PUSH_SECRET` = 一串随机字符串（如 `openssl rand -hex 16`）。
不设置时默认 `nini-workbench-dev`（仅挡匿名请求，足够个人使用）。

---

## 备注
- 打卡 / 水量等数据存在**手机 localStorage**，不在服务器；服务器只负责转发 Web Push。
- 接口总览：`GET /vapid`、`GET /status`、`POST /subscribe`、`POST /schedule`、`POST /notify`（后三个已加同源校验 + 限流），并同时静态托管 PWA（已禁止访问 `server/` 目录）。
- 个人自用应用仍建议按上文设置 `VAPID_*` 与 `PUSH_SECRET` 环境变量，并避免把地址公开给不信任人群。
