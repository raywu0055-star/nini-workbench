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

## 备注
- 本推送服务器**无鉴权**（个人自用），请勿暴露给不信任人群；如需可加 token 校验。
- 打卡 / 水量等数据存在**手机 localStorage**，不在服务器；服务器只负责转发 Web Push。
- 接口总览：`GET /vapid`、`GET /status`、`POST /subscribe`、`POST /schedule`、`POST /notify`，并同时静态托管 PWA。
