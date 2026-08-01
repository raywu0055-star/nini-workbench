// Headless PWA installability validator.
// Checks the criteria Chrome/Android/iOS use to show "Add to Home Screen"
// and to enable offline + push. Pure Node, no deps.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function pngSize(p) {
  const b = fs.readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not png: ' + p);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  return { w, h, bytes: b.length };
}

const checks = [];
function check(name, ok, detail) { checks.push({ name, ok, detail: detail || '' }); }

// 1) manifest.json
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  check('manifest.json parses as JSON', true);
} catch (e) {
  check('manifest.json parses as JSON', false, e.message);
  report(); process.exit(1);
}

check('has name', !!manifest.name, manifest.name || '');
check('has short_name', !!manifest.short_name, manifest.short_name || '');
check('has start_url', !!manifest.start_url, manifest.start_url || '');
check('display is standalone', manifest.display === 'standalone', manifest.display || '');
check('has id (prevents dup installs)', !!manifest.id, manifest.id || '');
check('has theme_color', !!manifest.theme_color, manifest.theme_color || '');
check('has background_color', !!manifest.background_color, manifest.background_color || '');

// icons
const icons = manifest.icons || [];
const has192 = icons.some(i => /192/.test(i.sizes));
const has512 = icons.some(i => /512/.test(i.sizes));
const hasMaskable = icons.some(i => (i.purpose || '').split(' ').indexOf('maskable') !== -1);
check('icons include 192px', has192);
check('icons include 512px', has512);
check('has maskable icon (Android safe)', hasMaskable);

// icon files exist & correct size
for (const ic of icons) {
  const fp = path.join(ROOT, ic.src);
  if (!fs.existsSync(fp)) { check('icon file exists: ' + ic.src, false); continue; }
  try {
    const s = pngSize(fp);
    const [ew, eh] = ic.sizes.split('x').map(Number);
    check('icon ' + ic.src + ' is ' + ic.sizes, s.w === ew && s.h === eh, s.w + 'x' + s.h);
  } catch (e) { check('icon ' + ic.src + ' readable', false, e.message); }
}

// shortcuts
if (manifest.shortcuts && manifest.shortcuts.length) {
  const allHttp = manifest.shortcuts.every(s => /^(\.\/|\/)/.test(s.url || ''));
  check('shortcuts present (' + manifest.shortcuts.length + ') & use relative urls', allHttp);
} else {
  check('shortcuts present', false, 'none defined');
}

// 2) index.html wiring
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check('html links manifest.json', html.indexOf('rel="manifest" href="manifest.json"') !== -1);
check('html has theme-color meta', html.indexOf('name="theme-color"') !== -1);
check('html has apple-touch-icon meta', html.indexOf('apple-touch-icon') !== -1);
check('html registers service worker', html.indexOf("serviceWorker.register('sw.js')") !== -1 || html.indexOf('serviceWorker.register("sw.js")') !== -1);
check('html captures beforeinstallprompt', html.indexOf('beforeinstallprompt') !== -1);
check('html has appinstalled handler', html.indexOf('appinstalled') !== -1);
check('html has PWA deep-link handler', html.indexOf('handlePwaDeepLink') !== -1);

// 3) sw.js
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check('sw.js has install handler', sw.indexOf("addEventListener('install'") !== -1);
check('sw.js has activate handler', sw.indexOf("addEventListener('activate'") !== -1);
check('sw.js has fetch handler', sw.indexOf("addEventListener('fetch'") !== -1);
check('sw.js caches app shell', sw.indexOf('./index.html') !== -1);
check('sw.js handles push', sw.indexOf("addEventListener('push'") !== -1);
check('sw.js handles notificationclick', sw.indexOf("addEventListener('notificationclick'") !== -1);
check('sw.js precaches maskable icon', sw.indexOf('icon-maskable-512.png') !== -1);

// 4) server serves PWA statically (optional but good)
const serverSrc = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
check('push server also serves static PWA', serverSrc.indexOf('express.static') !== -1);

function report() {
  let pass = 0, fail = 0;
  console.log('\n=== PWA Installability Checks ===');
  for (const c of checks) {
    console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.name + (c.detail ? '  [' + c.detail + ']' : ''));
    c.ok ? pass++ : fail++;
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
report();
