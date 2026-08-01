/**
 * nini's workbench — optional Web Push server
 * -------------------------------------------------
 * Why this exists:
 *   A PWA timer (setTimeout) only fires while the app page is alive.
 *   To deliver reminders even when the app is FULLY CLOSED, we need a
 *   real Web Push: the server holds the subscription and pushes at the
 *   scheduled time, and the Service Worker shows the OS notification.
 *
 * Endpoints used by the app (index.html):
 *   GET  /vapid            -> { publicKey }   (client needs it to subscribe)
 *   GET  /status           -> { subs, jobs }  (health / debug)
 *   POST /subscribe        -> store a PushSubscription
 *   POST /schedule         -> { triggerAt, payload }  schedule a future push
 *   POST /notify           -> { payload }  push to all subscribers now
 *
 * Persistence:
 *   subscriptions and scheduled jobs are written to disk (subs.json /
 *   jobs.json) so a server restart does NOT silently drop pending reminders.
 *
 * Deploy: see README.md (e.g. Render free tier). Set PORT via env if needed.
 */

const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// Resolve the folder that holds index.html / manifest.json.
// Supports either layout so deployment "just works":
//   - whole-project deploy (Render Root Directory = server): parent has index.html
//   - PWA copied into server/public, or PWA files placed directly in server
function resolvePublicDir() {
  const candidates = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, 'public'),
    __dirname
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return candidates[0];
}
const PUBLIC_DIR = resolvePublicDir();

// ----- VAPID keys (generate + persist once) -----
let vapidKeys = null;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
} else {
  const stored = path.join(__dirname, 'vapid.json');
  if (fs.existsSync(stored)) {
    try { vapidKeys = JSON.parse(fs.readFileSync(stored, 'utf8')); } catch (e) {}
  }
  if (!vapidKeys) {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(stored, JSON.stringify(vapidKeys));
    console.log('Generated new VAPID keys ->', stored);
  }
}
webpush.setVapidDetails('mailto:nini@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// ----- Subscriptions (persisted to disk) -----
const SUBS_FILE = path.join(__dirname, 'subs.json');
let subs = new Set();
function loadSubs() {
  try {
    const arr = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    if (Array.isArray(arr)) subs = new Set(arr.map(s => JSON.stringify(s)));
  } catch (e) { /* none yet */ }
  console.log('Loaded', subs.size, 'subscription(s)');
}
function saveSubs() {
  try { fs.writeFileSync(SUBS_FILE, JSON.stringify(Array.from(subs).map(s => JSON.parse(s)), null, 2)); } catch (e) {}
}
loadSubs();

// ----- Scheduled jobs (persisted to disk) -----
const JOBS_FILE = path.join(__dirname, 'jobs.json');
let jobs = [];
function loadJobs() {
  try { jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); if (!Array.isArray(jobs)) jobs = []; } catch (e) { jobs = []; }
}
function saveJobs() {
  try { fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs)); } catch (e) {}
}
// Re-arm future jobs on startup (drop anything already past)
loadJobs();
jobs = jobs.filter(j => j && j.triggerAt > Date.now());
jobs.forEach(armJob);
saveJobs();

function armJob(job) {
  const delay = Math.max(0, job.triggerAt - Date.now());
  setTimeout(() => {
    broadcast(job.payload);
    jobs = jobs.filter(j => j.id !== job.id);
    saveJobs();
  }, delay);
}

const app = express();
app.use(express.json());

app.get('/vapid', (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.get('/status', (req, res) => res.json({ ok: true, subs: subs.size, jobs: jobs.length, vapid: !!vapidKeys }));

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'invalid subscription' });
  subs.add(JSON.stringify(sub));
  saveSubs();
  res.json({ ok: true });
});

app.post('/notify', async (req, res) => {
  const payload = (req.body && req.body.payload) ? req.body.payload : { title: 'nini 提醒', body: '' };
  const n = await broadcast(payload);
  res.json({ ok: true, sent: n });
});

app.post('/schedule', (req, res) => {
  const body = req.body || {};
  const payload = body.payload || { title: 'nini 提醒', body: '' };
  const triggerAt = body.triggerAt || Date.now();
  const job = { id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), triggerAt, payload };
  jobs.push(job);
  saveJobs();
  armJob(job);
  res.json({ ok: true, triggerAt, delay: Math.max(0, triggerAt - Date.now()) });
});

async function broadcast(payload) {
  const list = Array.from(subs).map(s => JSON.parse(s));
  if (!list.length) return 0;
  await Promise.allSettled(list.map(sub =>
    webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        subs.delete(JSON.stringify(sub)); // expired/revoked -> drop
        saveSubs();
      }
    })
  ));
  return list.length;
}

// Optionally serve the static PWA too, so one process can host everything
// (handy for local testing: open http://localhost:3000/).
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log('nini push server listening on', PORT);
  console.log('Serving PWA from', PUBLIC_DIR);
  console.log('VAPID public key:', vapidKeys.publicKey);
});
