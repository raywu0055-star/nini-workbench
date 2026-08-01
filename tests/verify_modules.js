// ============================================================================
// 端到端渲染冒烟测试（防回归）
// 场景：验证「补水啦」等全部页面模块能正常渲染与交互，
//      防止再次出现「脚本语法错误导致整段不执行、所有模块丢失」的事故。
// 依赖：jsdom  （安装：在 /Users/nini/.workbuddy/binaries/node/workspace 下
//        /Users/nini/.workbuddy/binaries/node/versions/22.22.2/bin/npm install jsdom@24）
// 用法：NODE_PATH=/Users/nini/.workbuddy/binaries/node/workspace/node_modules \
//        /Users/nini/.workbuddy/binaries/node/versions/22.22.2/bin/node tests/verify_modules.js
// ============================================================================
const HARD = setTimeout(() => { console.log("⏱ HARD TIMEOUT - 进程强制退出"); process.exit(2); }, 20000);

const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = __dirname + "/..";
const html = fs.readFileSync(ROOT + "/index.html", "utf8");
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail && e.detail.stack ? e.detail.stack.split("\n")[0] : e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

let dom;
try {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.AudioContext = class { constructor() { this.state = "running"; } createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } }; } createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; } resume() {} };
      w.Notification = function () {}; w.Notification.permission = "default"; w.Notification.requestPermission = () => Promise.resolve("default");
      w.requestAnimationFrame = () => 0; // no-op，避免 headless 下递归动画忙循环拖垮事件循环
      w.cancelAnimationFrame = () => {};
      w.scrollTo = () => {};
      try { Object.defineProperty(w.navigator, "serviceWorker", { value: { register() { return Promise.resolve(); }, addEventListener() {} }, configurable: true }); } catch (e) {}
      w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      w.confirm = () => true; w.alert = () => {};
    },
  });
} catch (e) {
  console.log("❌ JSDOM 构造失败:", e.message);
  process.exit(1);
}

const { window } = dom;
const { document } = window;

setTimeout(() => {
  const results = [];
  const ok = (name, cond, extra = "") => results.push(`${cond ? "✅" : "❌"} ${name}${extra ? "  (" + extra + ")" : ""}`);

  // 1) 启动无错（整段脚本必须成功解析并执行）
  ok("脚本初始化无报错", errors.length === 0, errors.join(" | "));

  // 2) 导航入口：主区域 5 个 nav-item + 独立设置按钮 = 6 模块
  const navItems = document.querySelectorAll("#navItems .nav-item");
  ok("导航栏主区域渲染 5 个 nav-item", navItems.length === 5, "count=" + navItems.length);
  ok("设置入口按钮存在", !!document.querySelector(".nav-settings[data-section='settings']"));

  // 3) 6 个模块 section 均在 DOM 中存在
  const sections = ["welcome", "iron", "bag", "xhs", "water", "settings"];
  let allSec = true;
  sections.forEach(s => { const el = document.getElementById("section-" + s) || document.querySelector("[data-section='" + s + "']"); if (!el) allSec = false; });
  ok("6 个模块 section 在 DOM 中存在", allSec, sections.join(","));

  // 4) 每个模块内容已渲染（非空白）
  const check = (sel, label) => { const el = document.querySelector(sel); ok(label + " 已渲染", !!el && (el.children.length > 0 || (el.textContent || "").trim().length > 0)); };
  check("#section-welcome, [data-section='welcome']", "首页模块");
  check("#section-iron, [data-section='iron']", "每日补剂模块");
  check("#section-bag, [data-section='bag']", "待产包模块");
  check("#section-xhs, [data-section='xhs']", "小红书模块");
  check("#section-water, [data-section='water']", "补水啦模块");
  check("#section-settings, [data-section='settings']", "设置模块");

  // 5) 补水啦导航图标已绑定图片（data URI）
  const waterNavItem = document.querySelector("#navItems .nav-item[data-section='water']");
  const waterImg = waterNavItem && waterNavItem.querySelector("img.ni-img");
  ok("补水啦导航图标已绑定图片", !!(waterImg && (waterImg.getAttribute("src") || "").startsWith("data:image/png;base64,")),
     waterImg ? "src=" + waterImg.getAttribute("src").slice(0, 24) + "..." : "no img");

  // 6) 交互：补水按钮点击累加
  try {
    const before = document.getElementById("waterTotalMl") ? document.getElementById("waterTotalMl").textContent : null;
    const btn = document.querySelector("#waterBtns .water-btn[data-ml='150']");
    if (btn) btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const after = document.getElementById("waterTotalMl") ? document.getElementById("waterTotalMl").textContent : null;
    ok("补水按钮点击可累加", !!btn && before !== null && after === "150", `before=${before} after=${after}`);
  } catch (e) { ok("补水按钮点击可累加", false, e.message); }

  console.log("\n===== 模块渲染验证结果 =====");
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith("❌")).length;
  console.log(`\n总计: ${results.length} 项, 失败 ${failed} 项`);
  console.log("boot errors:", errors.length ? errors : "none");
  clearTimeout(HARD);
  process.exit(failed > 0 ? 1 : 0);
}, 1500);
