# nini 工作台 — Windows 迁移指南

> 适用场景：将本项目从 macOS 完整迁移到一台新的 Windows 10/11（64 位）电脑继续开发。
> 所有路径与命令均使用 **Windows 兼容格式**。

---

## 0. 备份包说明

已生成的备份包：

- 位置（macOS 本机）：`/Users/nini/Downloads/nini-workbench-migration-2026-08-01.zip`（约 5.7 MB）
- 传输方式：拷贝到 U 盘 / 网盘 / 邮件附件，再到新 Windows 电脑解压即可
- 已包含：
  - 源码：`index.html`、`sw.js`、`manifest.json`
  - 服务端：`server/index.js`、`server/package.json`、`server/package-lock.json`、`server/README.md`
  - 推送密钥与运行态：`server/vapid.json`、`server/subs.json`、`server/jobs.json`
  - 图标资源：`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png`、`favicon.png`
  - 历史素材：`assets/kitty/*`、根目录各 png/jpg（非运行必需，但整体保留）
  - 测试：`tests/*`
  - 隐藏配置文件：`.gitignore`
- **已排除**（不要手挖出来塞回去）：
  - `node_modules/`、`server/node_modules/` —— macOS 的原生二进制在 Windows 不兼容，**必须**在新电脑用 `npm install` 重新安装（见步骤 3）
  - `.workbuddy/` —— WorkBuddy 工具的运行/记忆数据，新电脑重新生成即可，迁移无意义

---

## 1. 目标环境（新 Windows 电脑需具备）

| 项目 | 版本 / 说明 |
|------|------------|
| 操作系统 | Windows 10 或 11（64 位） |
| 运行时 | **Node.js LTS v18 及以上**（本项目开发基于 v22.22.2；`web-push` 依赖 Node 18+ 内置的 WebCrypto） |
| 包管理器 | npm（随 Node.js 安装包自带，无需单独装） |
| 项目依赖 | `express ^4.19.2`、`web-push ^3.6.6`（均为纯 JavaScript 包，**无原生编译**，`npm install` 即可） |
| 全局工具 | 无强制全局依赖（git 非运行必需，可用 GitHub Desktop 替代） |
| 浏览器 | Chrome 或 Edge（用于测试 PWA 与推送） |
| 可选 | 若要跑 `tests/check_syntax.sh`：安装 Git for Windows（自带 Git Bash）；或忽略该脚本（非运行必需） |

> 环境还原要点：**只需装 Node.js（含 npm）**，其余依赖用 `npm install` 从 `package-lock.json` 精确还原。

---

## 2. 新 Windows 电脑上的执行步骤

### 步骤 1 — 安装 Node.js

方式 A（推荐，图形界面）：
1. 打开 https://nodejs.org ，下载 **LTS** 版本的 `.msi` 安装包
2. 双击安装，一路 Next（默认会勾选 "Add to PATH"），装完重启一次终端

方式 B（PowerShell 一行安装，需系统已启用 winget）：
```powershell
winget install OpenJS.NodeJS.LTS
```

安装后验证（CMD 或 PowerShell 均可）：
```powershell
node --version
npm --version
```
能正常打印版本号即成功。

### 步骤 2 — 拷贝并解压备份

1. 把 `nini-workbench-migration-2026-08-01.zip` 拷到新电脑
2. 解压到目标目录，例如：
   ```
   C:\Users\你的用户名\Projects\nini-workbench\
   ```
   （用 7-Zip 或资源管理器右键"解压到此处"均可）

### 步骤 3 — 还原依赖（关键，必须做）

```powershell
cd C:\Users\你的用户名\Projects\nini-workbench\server
npm install
```

- `npm install` 会读取同目录的 `package-lock.json`，安装与开发机**完全一致**的 `express` / `web-push` 版本
- 这一步会在 `server\` 下重新生成 `node_modules\`，耗时约十几秒到一分钟（取决于网速）
- **不要**把 macOS 的 `node_modules` 直接拷过来——里面可能有平台专属二进制，在 Windows 上会报错

### 步骤 4 — 启动服务

CMD：
```cmd
cd C:\Users\你的用户名\Projects\nini-workbench\server
npm start
```

PowerShell：
```powershell
cd C:\Users\你的用户名\Projects\nini-workbench\server
npm start
```

- 默认监听 **3000 端口**
- 如需更换端口（例如 3000 被占用），在启动前设置环境变量：
  - CMD：`set PORT=8080`，然后 `npm start`
  - PowerShell：`$env:PORT=8080`，然后 `npm start`

### 步骤 5 — 验证项目可运行

1. 浏览器打开 `http://localhost:3000/` —— 应看到工作台首页
2. 健康检查接口，PowerShell 测试：
   ```powershell
   (Invoke-WebRequest http://localhost:3000/status).Content
   ```
   CMD 下可用：
   ```cmd
   curl http://localhost:3000/status
   ```
   正常返回类似：`{"ok":true,"subs":0,"jobs":0,"vapid":true}`
3. 查看 VAPID 公钥：`http://localhost:3000/vapid` 应返回公钥 JSON
4. 静态资源：`http://localhost:3000/manifest.json`、`http://localhost:3000/sw.js` 应可访问

### 步骤 6（可选）— 手机 PWA 安装与后台推送

- **本地 `http://localhost` 无法"添加到主屏幕"**（PWA 安装与 Web Push 都要求 HTTPS 安全上下文）
- 仅做桌面开发测试：`http://localhost:3000/` 即可作为单页应用使用
- 若要让手机安装并接收后台推送：把项目部署到带 HTTPS 的 Node 主机（如 Render），详细步骤见 `server\README.md`

---

## 3. 平台相关配置调整（迁移后请逐项核对）

| # | 位置 | 现状 | Windows 需调整 |
|---|------|------|----------------|
| 1 | `tests\check_syntax.sh` 第 11 行 | 硬编码 macOS 路径 `/Users/nini/.workbuddy/binaries/node/versions/22.22.2/bin/node` | 该脚本是 bash 测试包装，**运行时无关**。Windows 下：把第 11 行改为 `NODE=node`，并用 **Git Bash** 运行；或直接忽略本脚本。 |
| 2 | `index.html`（约第 1754、5477 行） | 推送服务器默认 `http://localhost:3000` | 这是 URL 非本地文件路径，Windows 本机跑 server 时**仍可用**。若部署到公网，需在 App "设置" 里把"推送服务器地址"改为公网 HTTPS 地址。 |
| 3 | `server\vapid.json` | 存放 VAPID 公钥/私钥（已包含在备份） | **保留此文件**即可让旧推送订阅继续有效。若删除，server 启动会自动重新生成新密钥，但旧订阅会失效需重新订阅（部署到 Render 时更推荐用环境变量 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`）。 |
| 4 | `server\index.js` 第 29 行 | `const PORT = process.env.PORT \|\| 3000;` | 跨平台安全。端口冲突时用步骤 4 的环境变量方式改端口即可。 |
| 5 | `server\index.js` 路径处理 | 全部用 Node `path` 模块（`path.resolve/join(__dirname, ...)`） | ✅ 跨平台安全，无 `C:\` / `/` 分隔符硬编码问题，Windows 原生可用。 |
| 6 | 源码中是否含 `C:\`、`D:\` 等 Windows 路径 | 无 | ✅ 未发现任何 Windows 盘符硬编码，迁移无需改代码路径。 |

**结论**：除测试脚本 `check_syntax.sh` 里的 macOS 绝对路径（非运行必需）外，**源码本身无需改动即可在 Windows 运行**。

---

## 4. 文件职责清单（哪些必需、哪些可选）

**运行必需：**
- `index.html`（主应用，图标已 base64 内联）
- `sw.js`（Service Worker：离线缓存 + 推送 + 通知）
- `manifest.json`（PWA 清单）
- `server/index.js`、`server/package.json`、`server/package-lock.json`（推送服务）
- `icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png`、`favicon.png`（清单与图标）

**配置：**
- `server/vapid.json`（保留推送订阅有效）
- `.gitignore`

**可选素材（运行时不需要，保留作历史/再编辑用）：**
- `assets/kitty/*`（9 张 Kitty 图标源图；`index.html` 内是 base64，运行时并不读取此目录）
- 根目录大图：`avatar-nini.png`、`A_cute_kawaii_style_avatar_ill_*.png`、`avatar.jpg`、`Cute_Hello_Kitty_character_wit_*.png`（部分已被撤销引用，非必需）

**测试（可选）：**
- `tests/check_syntax.sh`（bash，需 Git Bash；非运行必需）
- `tests/verify_pwa.js`、`tests/verify_modules.js`（需 `jsdom`：`npm install jsdom` 后 `node tests/verify_pwa.js`）

**文档：**
- `PWA_GUIDE.md`（PWA 安装与排错）
- `server/README.md`（Render 部署与推送完整步骤）

---

## 5. 常见坑与注意

1. **务必在新电脑执行 `npm install`** —— 备份包不含 `node_modules`，直接 `npm start` 会报 "Cannot find module 'express'"。
2. **不要迁移 `.workbuddy/`** —— 那是 WorkBuddy 工具的运行数据，新电脑的 WorkBuddy 会自行重建。
3. **手机推送必须 HTTPS 公网** —— 本地 Windows 跑的 `http://localhost:3000` 仅用于桌面开发；手机安装见 `server/README.md` 的 Render 部署流程。
4. **端口占用** —— 若 3000 被 Skype/其他程序占用，用 `set PORT=8080`（CMD）或 `$env:PORT=8080`（PowerShell）后重启。
5. **VAPID 一致性** —— 想保留旧订阅就带走 `server/vapid.json`；想用新密钥就删掉它让 server 重新生成（但旧订阅失效）。

---

## 6. 一句话速查（Windows PowerShell）

```powershell
# 1) 安装 Node（若用 winget）
winget install OpenJS.NodeJS.LTS

# 2) 解压后进入服务端目录并还原依赖
cd C:\Users\你的用户名\Projects\nini-workbench\server
npm install

# 3) 启动
npm start

# 4) 验证
(Invoke-WebRequest http://localhost:3000/status).Content
```

完成以上四步，项目即可在 Windows 上直接运行。
