# nini's workbench — 安装为 PWA（渐进式 Web 应用）

本工作台**已经是一个完整的 PWA**：已配置 `manifest.json`（应用名、图标、启动 URL、主题色、`display: standalone`）、注册了 Service Worker（`sw.js`，离线缓存 + Web Push + 通知点击处理），并针对 iOS 加了 `apple-touch-icon` 等标签。

本文件说明：**如何在手机上把它「添加到主屏幕」像原生 App 一样使用**，以及**为什么必须放在 HTTPS 上**。

---

## 1. 已完成的 PWA 配置

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| `manifest.json` | ✅ | name / short_name / start_url / theme_color / display=standalone / id / categories |
| 图标 | ✅ | 192、512、`maskable` 512（已校正安全区内）、apple-touch 180 |
| `sw.js` | ✅ | 离线缓存（文档走网络优先、资源走缓存优先）、`push` / `notificationclick` 处理 |
| iOS 支持 | ✅ | `apple-mobile-web-app-capable`、状态栏样式、启动图标 |
| 安装引导 | ✅ | 捕获 `beforeinstallprompt`，设置页有「安装到主屏幕」入口 |
| 快捷方式 | ✅ | manifest `shortcuts`：补水啦 / 补剂打卡 / 待产包 / 小红书 |
| 深度链接 | ✅ | `index.html#water` 等可直接跳到对应模块 |

校验：`node tests/verify_pwa.js`（31 项全部 PASS）。

---

## 2. ⚠️ 关键前提：必须用 HTTPS 访问

「添加到主屏幕」和「Web Push 后台通知」**都要求安全上下文（Secure Context）**：

- ✅ `https://` 任意公网地址
- ✅ `http://localhost` 或 `http://127.0.0.1`（仅本机）
- ❌ `http://` 公网 IP / 局域网 IP（手机上无法安装、无法推送）
- ❌ 直接用 `file://` 打开（无 SW、无安装）

> 也就是说：**在手机浏览器里能打开 ≠ 能安装**。必须用 HTTPS 地址打开。

---

## 3. 在手机上安装（以 HTTPS 地址打开后）

**Android（Chrome / Edge）：**
1. 浏览器打开 `https://你的地址`
2. 地址栏右侧出现「安装 / 添加到主屏幕」图标，或
3. 菜单 → 「安装应用」/「添加到主屏幕」
4. 确认后，桌面出现独立图标，全屏打开、离线可用

**iPhone / iPad（Safari）：**
1. Safari 打开 `https://你的地址`
2. 底部工具栏「分享」→「添加到主屏幕」
3. 桌面出现图标（使用 `apple-touch-icon` 作为图标）

安装后：长按图标可见 manifest `shortcuts`（直达补水啦等模块）；离线也能打开（SW 缓存）。

---

## 4. 免费 HTTPS 托管方案（让手机能安装）

### 方案 A：纯静态托管（安装 + 离线，不含后台推送）
把项目根目录（`index.html` / `sw.js` / `manifest.json` / 图标 / `assets/` / `server/`）整体上传到以下任一免费 HTTPS 静态托管：
- **Cloudflare Pages**：拖拽文件夹 / 连 Git，`*.pages.dev` 自带 HTTPS
- **Netlify Drop**：拖拽部署，自带 HTTPS
- **GitHub Pages**：推到仓库，开启 Pages（注意子路径下 `start_url`/scope 仍可用，已用相对路径）

部署即获得 `https://xxxxx` 地址 → 手机打开 → 安装。

### 方案 B：连后台推送一起（推荐，一个进程搞定）
把**整个项目**部署到 **Render**（或其它 Node 主机），它**同时托管 PWA 静态文件和 Web Push 服务器**，自带 HTTPS：
1. 把整个项目推到 Git 仓库（Render 的 **Root Directory 设为 `server`**）
2. Render 新建 Web Service（Build: `npm install`，Start: `npm start`）
3. 得到 `https://nini-push.onrender.com`
4. 手机打开该地址 → 安装；设置里打开「后台推送」并填该地址

详细步骤见 `server/README.md`。

---

## 5. 本地临时测试（HTTPS 隧道，可选）

若想**立刻**在手机上验证、又不想先部署，可用 `cloudflared` 把本机 `:3000` 暴露为临时公网 HTTPS：

```bash
# 本机先启动推送/PWA 服务
cd server && npm install && npm start   # 监听 :3000

# 另开终端，建立临时 HTTPS 隧道（随机地址，重启会变）
cloudflared tunnel --url http://localhost:3000
```

终端会打印 `https://xxxx.trycloudflare.com`，手机用该地址打开即可安装（含推送）。
> 注意：该地址是公网临时地址，仅用于个人测试；长期请用方案 A/B 正式托管。

---

## 6. 排错速查

| 现象 | 原因 / 解决 |
| --- | --- |
| 手机上没有「安装」按钮 | 地址不是 HTTPS；或 manifest 字段缺失（已校验通过，通常是 HTTPS 问题） |
| 安装后图标是默认浏览器图标 | `maskable` 图标缺失/尺寸不对（已生成 `icon-maskable-512.png`） |
| 安装后打开是白屏 | SW 缓存了旧 `index.html`：清掉再装，或改 `sw.js` 的 `CACHE_NAME` 版本号 |
| 关 App 收不到通知 | 未部署后台推送服务器（方案 B），或未在设置里打开「后台推送」并允许通知 |
| 改了代码手机没更新 | SW 更新需等控制权接管；`sw.js` 已含 `controllerchange` 自动刷新 |
