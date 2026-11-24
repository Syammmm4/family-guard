/* Family Guard: browser UI for the local educational prototype (ibu/bapa + anak).
   Every on-screen sentence is given in Bahasa Malaysia (default) and English: L('BM', 'EN'). */
const main = document.querySelector('#main');
const topbar = document.querySelector('#topbar-actions');
const toastEl = document.querySelector('#toast');
const sessionKey = 'familyguard-session';
const pendingKey = 'familyguard-pending-link';
const langKey = 'familyguard-lang';
let session = null;
try { session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { session = null; }
let lang = 'ms';
try { lang = localStorage.getItem(langKey) === 'en' ? 'en' : 'ms'; } catch { lang = 'ms'; }
let selectedRole = 'senior';
let data = null;
let socket = null;
let notificationTimer = null;
let connected = false;
let hadProtectivePause = false;
let busy = false;
let openChatId = null; // null = chat list
let sheet = null; // result card inside the demo phone: { type: 'LOW' | 'SAFE' | 'BLOCKED', url, by }
let pendingLink = null; // a tapped link waiting for anak: { id, url, messageId }
try { pendingLink = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); } catch { pendingLink = null; }

/** Pick the sentence for the current language. */
function L(ms, en) { return lang === 'en' ? en : ms; }
function locale() { return lang === 'en' ? 'en-MY' : 'ms-MY'; }

// Pretend WhatsApp chats. A web page cannot see taps inside the real WhatsApp,
// so these sample chats stand in for it. Every link goes through the same check + anak flow.
const CHATS = [
  {
    id: 'family', name: ['Keluarga Kita', 'Our Family'], initial: 'K', tone: 'tone-family', subtitle: ['Faiz, Aisyah, Mak', 'Faiz, Aisyah, Mak'],
    messages: [
      { id: 'family-1', from: 'Faiz', text: ['Mak, jangan lupa makan ubat ya.', "Mak, don't forget to take your medicine."], time: ['8:02 PG', '8:02 AM'] },
      { id: 'family-2', out: true, text: ['Baik, terima kasih Faiz.', 'OK, thank you Faiz.'], time: ['8:05 PG', '8:05 AM'] },
      { id: 'family-3', from: 'Aisyah', text: ['Mak, ni resepi rendang yang Mak minta semalam.', "Mak, here's the rendang recipe you asked for yesterday."], url: 'https://www.google.com', time: ['9:15 PG', '9:15 AM'] }
    ]
  },
  {
    id: 'bank', name: ['+60 11-5555 0000', '+60 11-5555 0000'], initial: '?', tone: 'tone-unknown', subtitle: ['Bukan dalam kenalan', 'Not in your contacts'], unknown: true, unread: 1,
    messages: [
      { id: 'bank-1', text: ['MAYBANK: Akaun anda akan DIGANTUNG hari ini. Sila sahkan butiran anda segera untuk elak akaun disekat.', 'MAYBANK: Your account will be SUSPENDED today. Please verify your details now to avoid being blocked.'], url: 'https://maybank-secure-verification.example/verify', time: ['9:41 PG', '9:41 AM'] }
    ]
  },
  {
    id: 'pos', name: ['+60 13-222 8080', '+60 13-222 8080'], initial: '?', tone: 'tone-unknown', subtitle: ['Bukan dalam kenalan', 'Not in your contacts'], unknown: true, unread: 1,
    messages: [
      { id: 'pos-1', text: ['POS: Bungkusan anda DITAHAN. Bayar RM2.50 untuk penghantaran semula hari ini.', 'POS: Your parcel is ON HOLD. Pay RM2.50 for redelivery today.'], url: 'http://pos-laju-delivery-update.top/claim', time: ['Semalam', 'Yesterday'] }
    ]
  },
  {
    id: 'tng', name: ['TNG Hadiah', 'TNG Rewards'], initial: 'T', tone: 'tone-promo', subtitle: ['Bukan dalam kenalan', 'Not in your contacts'], unknown: true, unread: 1,
    messages: [
      { id: 'tng-1', text: ['Tahniah! Anda MENANG RM500 dalam eWallet. Tuntut hadiah anda sebelum tengah malam.', 'Congratulations! You WON RM500 in your eWallet. Claim your prize before midnight.'], url: 'https://tng-reward-claim.xyz/prize', time: ['Semalam', 'Yesterday'] }
    ]
  }
];
/** Chat data stores [BM, EN] pairs. */
function P(pair) { return Array.isArray(pair) ? L(pair[0], pair[1]) : pair; }

const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 2 9 4v6c0 6-4 9-9 11-5-2-9-5-9-11V6l9-4Z" stroke="currentColor" stroke-width="1.8"/><path d="m8 12 3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10ZM10 22h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5L20 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 2 10 18H2L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none"><path d="m3 3 4.5 0 2.1 5-2.5 2a16 16 0 0 0 6.9 6.9l2-2.5 5 2.1V21C10 22 2 14 3 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v6l4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M20.5 5.5c-2-2-5-2-7 0L12 7l-1.5-1.5c-2-2-5-2-7 0s-2 5 0 7L12 21l8.5-8.5c2-2 2-5 0-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m5.6 5.6 12.8 12.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fmtTime(date) {
  const d = new Date(date);
  return isNaN(d) ? '—' : d.toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function remaining(until) { return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)); }
function clock(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function durationText(seconds) {
  if (seconds >= 60) { const m = Math.round(seconds / 60); return L(`${m} minit`, `${m} minute${m === 1 ? '' : 's'}`); }
  return L(`${seconds} saat`, `${seconds} seconds`);
}
function callLink(phone) { return /^\+[1-9]\d{7,14}$/.test(phone || '') ? `tel:${phone}` : null; }
// Reasons and tips are stored in both languages on each alert. Older alerts may only have BM.
function reasonsOf(a) { return (lang === 'en' && Array.isArray(a.reasonsEn) && a.reasonsEn.length ? a.reasonsEn : a.reasons) || []; }
function tipsOf(a) { return (lang === 'en' && Array.isArray(a.tipsEn) && a.tipsEn.length ? a.tipsEn : a.tips) || []; }
// Only http(s) links are ever used as an href.
function safeHref(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}
function notify(message, tone = 'default') {
  toastEl.textContent = message;
  toastEl.className = `toast visible ${tone}`;
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => toastEl.classList.remove('visible'), 4200);
}
async function api(route, options = {}) {
  const response = await fetch(route, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Lang': lang, ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) }
  });
  let body = {};
  try { body = await response.json(); } catch { /* no body */ }
  if (response.status === 401 && route !== '/api/auth') { logout(false); throw new Error(L('Sesi tamat. Sila log masuk semula.', 'Your session has expired. Please sign in again.')); }
  if (!response.ok) throw new Error(body.error || L(`Permintaan gagal (${response.status}).`, `Request failed (${response.status}).`));
  return body;
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value));
  else sessionStorage.removeItem(sessionKey);
}
function savePending(value) {
  pendingLink = value;
  if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value));
  else sessionStorage.removeItem(pendingKey);
}
function isDeleted(messageId) { return Boolean(data?.deletedMessages?.includes(messageId)); }
function findMessage(messageId) {
  for (const chat of CHATS) {
    const message = chat.messages.find(m => m.id === messageId);
    if (message) return { chat, message };
  }
  return null;
}
// When anak (or the parent after the timeout) decides, the server clears the active alert.
// Match the decision to the link the parent tapped and show the result inside the phone.
function settlePendingLink() {
  if (!pendingLink || !data || data.active?.id === pendingLink.id) return;
  const done = data.lastResolved;
  if (done?.id !== pendingLink.id) return;
  sheet = { type: done.decision === 'SAFE' ? 'SAFE' : 'BLOCKED', url: pendingLink.url, by: done.decidedBy };
  savePending(null);
}

function closeSocket() { if (socket) socket.disconnect(); socket = null; connected = false; }
function listen() {
  closeSocket();
  if (!session) return;
  socket = window.io({ auth: { token: session.token }, reconnectionAttempts: Infinity, timeout: 7000 });
  socket.on('connect', () => { connected = true; setLiveStatus(); });
  socket.on('disconnect', () => { connected = false; setLiveStatus(); });
  socket.on('state', next => {
    const priorId = data?.active?.id;
    data = next;
    render();
    if (session?.role === 'guardian' && next.active?.id && priorId !== next.active.id) notify(L('Amaran baharu: ibu/bapa anda menekan pautan mencurigakan.', 'New alert: your ibu/bapa tapped a suspicious link.'), 'warn');
  });
  socket.on('connect_error', err => {
    connected = false;
    if (/Authentication required/.test(err.message)) { logout(false); notify(L('Sila log masuk semula.', 'Please sign in again.'), 'warn'); }
    else setLiveStatus();
  });
}
function liveText() { return connected ? L('Bersambung secara langsung', 'Live connected') : L('Menyambung semula…', 'Reconnecting…'); }
function setLiveStatus() {
  document.querySelectorAll('.realtime-indicator').forEach(el => {
    el.textContent = liveText();
    el.classList.toggle('is-offline', !connected);
  });
}
async function refresh() {
  if (!session) { render(); return; }
  try { data = await api('/api/state'); render(); listen(); }
  catch (err) { notify(err.message, 'warn'); }
}
function logout(callServer = true) {
  if (callServer && session) void api('/api/logout', { method: 'POST' }).catch(() => {});
  closeSocket();
  saveSession(null); data = null;
  savePending(null); sheet = null; openChatId = null;
  render();
}

/** Static text in index.html (top bar, footer, page title) follows the language too. */
function renderChrome() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'ms';
  document.title = L('Family Guard — Selamat bersama', 'Family Guard — Safer together');
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('proto-label', L('Mod prototaip', 'Prototype mode'));
  set('footer-left', L('© 2026 Family Guard · Melindungi insan yang anda sayangi.', '© 2026 Family Guard · Protecting the people you love.'));
  set('footer-right', L('Prototaip laman web pendidikan · Malaysia', 'Educational website prototype · Malaysia'));
  document.querySelector('.brand')?.setAttribute('aria-label', L('Laman utama Family Guard', 'Family Guard home'));
  document.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
function renderHeader() {
  topbar.innerHTML = session
    ? `<span class="tiny-role">${session.role === 'senior' ? L('Paparan ibu/bapa', 'Ibu/bapa view') : L('Portal anak', 'Anak portal')}</span><button type="button" class="logout-btn" data-action="logout">${L('Log keluar', 'Sign out')} ${icons.arrow}</button>`
    : `<span class="topbar-help">${L('Membantu keluarga kekal selamat dalam talian.', 'Helping families stay safe online.')}</span>`;
}
function render() {
  renderChrome();
  renderHeader();
  settlePendingLink();
  if (!session) { main.innerHTML = loginMarkup(); return; }
  if (!data) { main.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div><p>${L('Sedang memuatkan…', 'Loading…')}</p></div>`; return; }
  main.innerHTML = session.role === 'senior' ? seniorMarkup() : guardianMarkup();
  updateClocks();
  setLiveStatus();
  manageProtectiveFocus();
}
// Keep keyboard and assistive-technology focus inside the protective pause.
function manageProtectiveFocus() {
  const dialog = document.querySelector('.lock-screen');
  document.querySelectorAll('.topbar, .footer, .senior-layout > :not(.lock-screen)').forEach(el => { el.inert = Boolean(dialog); });
  document.body.classList.toggle('has-protective-pause', Boolean(dialog));
  if (dialog) {
    const heading = dialog.querySelector('h2');
    heading.tabIndex = -1;
    if (!dialog.contains(document.activeElement)) heading.focus({ preventScroll: true });
  } else if (hadProtectivePause) {
    document.querySelector('.wa-sheet button, .wa-sheet a, .phone-screen button')?.focus({ preventScroll: true });
  }
  hadProtectivePause = Boolean(dialog);
}
document.addEventListener('keydown', e => {
  const dialog = document.querySelector('.lock-screen');
  if (!dialog || e.key !== 'Tab') return;
  const items = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
  if (!items.length) { e.preventDefault(); dialog.querySelector('h2').focus(); return; }
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
});

function loginMarkup() {
  return `<section class="entry-layout">
    <div class="entry-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> ${L('KESELAMATAN DIGITAL, DENGAN SENTUHAN KELUARGA', 'DIGITAL SAFETY, WITH A FAMILY TOUCH')}</div>
      <h1>${L('Keselamatan itu<br><em>urusan keluarga.</em>', 'Safety is<br><em>a family thing.</em>')}</h1>
      <p class="entry-subtitle">${L('Tekan pautan seperti biasa. Jika nampak bahaya, anak anda semak dahulu sebelum ia dibuka.', 'Tap links as usual. If one looks dangerous, your anak checks it before it opens.')}</p>
      <div class="hero-proof"><span class="proof-icon">${icons.shield}</span><span><strong>${L('Kekal berhubung. Kekal dilindungi.', 'Stay connected. Stay protected.')}</strong><small>${L('Direka untuk warga emas dan keluarga mereka.', 'Designed for older people and their families.')}</small></span></div>
      <div class="hero-orbit hero-orbit-a"></div><div class="hero-orbit hero-orbit-b"></div>
      <div class="guardian-illustration" aria-hidden="true"><div class="illus-circle one"></div><div class="illus-circle two"></div><div class="illus-card illus-card-left"><span>${icons.heart}</span><strong>${L('Keluarga didahulukan', 'Family comes first')}</strong><small>${L('Prihatin setiap langkah', 'Caring at every step')}</small></div><div class="illus-center"><span class="illus-shield">${icons.shield}</span><strong>familyguard.</strong><small>${L('Selamat, bersama.', 'Safer, together.')}</small></div><div class="illus-card illus-card-right"><span>${icons.check}</span><strong>${L('Anda dilindungi', "You're protected")}</strong><small>${L('Anak bersambung', 'Anak connected')}</small></div></div>
    </div>
    <div class="signin-column"><div class="signin-card"><span class="section-label">${L('MULAKAN', 'GET STARTED')}</span><h2>${L('Selamat datang ke', 'Welcome to')}<br>Family Guard <span class="greeting-dot">✳</span></h2><p>${L('Anda log masuk sebagai siapa hari ini?', 'Who are you signing in as today?')}</p>
      <div class="role-pick" role="group" aria-label="${L('Pilih peranan anda', 'Choose your role')}">
        <button type="button" class="role-choice ${selectedRole === 'senior' ? 'active' : ''}" data-role="senior"><span class="choice-icon">${icons.heart}</span><span><strong>${L('Saya ibu / bapa', "I'm ibu / bapa")}</strong><small>${L('Guna WhatsApp dengan selamat', 'Use WhatsApp safely')}</small></span><span class="radio-ring"></span></button>
        <button type="button" class="role-choice ${selectedRole === 'guardian' ? 'active' : ''}" data-role="guardian"><span class="choice-icon">${icons.shield}</span><span><strong>${L('Saya anak', "I'm anak")}</strong><small>${L('Sahkan pautan untuk ibu/bapa', 'Check links for ibu/bapa')}</small></span><span class="radio-ring"></span></button>
      </div>
      <form id="login-form"><label for="pin">${selectedRole === 'senior' ? L('PIN akses ibu/bapa', 'Ibu/bapa access PIN') : L('PIN akses anak', 'Anak access PIN')}</label><input id="pin" name="pin" type="password" required minlength="4" maxlength="32" inputmode="numeric" autocomplete="off" placeholder="${L('Masukkan PIN akses', 'Enter your access PIN')}" />
        <button type="submit" class="btn btn-primary btn-full">${L('Buka papan pemuka', 'Open dashboard')} ${icons.arrow}</button></form>
      <p class="fine-print">${L('Minta PIN daripada orang yang menyediakan Family Guard.', 'Ask the person who set up Family Guard for the PIN.')}</p>
    </div><div class="signin-bottom">${icons.lock} <span>${L('Butiran pautan kekal dalam demonstrasi ini.', 'Link details stay inside this demonstration.')}</span></div></div>
  </section>`;
}

/* ---------- Parent (ibu/bapa) view: demo WhatsApp-style phone ---------- */
function lastPreview(chat) {
  const m = chat.messages.at(-1);
  if (isDeleted(m.id)) return { text: L('Mesej ini telah dipadam', 'This message was deleted'), deleted: true, time: P(m.time) };
  return { text: `${m.out ? L('Anda: ', 'You: ') : m.from ? `${m.from}: ` : ''}${P(m.text)}`, deleted: false, time: P(m.time) };
}
function chatListMarkup() {
  const rows = CHATS.map(chat => {
    const p = lastPreview(chat);
    const unread = chat.unread && !chat.messages.every(m => isDeleted(m.id)) ? `<span class="wa-unread" aria-label="${L(`${chat.unread} mesej belum dibaca`, `${chat.unread} unread message`)}">${chat.unread}</span>` : '';
    return `<li><button type="button" class="wa-row" data-action="open-chat" data-chat="${esc(chat.id)}"><span class="wa-avatar ${esc(chat.tone)}" aria-hidden="true">${esc(chat.initial)}</span><span class="wa-row-main"><span class="wa-row-top"><strong>${esc(P(chat.name))}</strong><small>${esc(p.time)}</small></span><span class="wa-preview ${p.deleted ? 'deleted' : ''}">${p.deleted ? icons.ban : ''}${esc(p.text)}</span></span>${unread}</button></li>`;
  }).join('');
  return `<div class="wa-top"><div class="wa-top-title"><strong>${L('Sembang', 'Chats')}</strong><small>${icons.shield} ${L('Dilindungi Family Guard', 'Protected by Family Guard')}</small></div></div>
    <ul class="wa-list" aria-label="${L('Senarai sembang', 'Chat list')}">${rows}</ul>`;
}
function bubbleMarkup(m) {
  if (isDeleted(m.id)) {
    return `<li class="wa-bubble in deleted">${icons.ban}<span><em>${L('Mesej ini telah dipadam oleh Family Guard kerana disahkan scam.', 'This message was deleted by Family Guard because it was confirmed as a scam.')}</em><span class="wa-time">${esc(P(m.time))}</span></span></li>`;
  }
  const link = m.url ? `<button type="button" class="wa-link" data-action="tap-link" data-msg="${esc(m.id)}">${esc(m.url)}</button>` : '';
  return `<li class="wa-bubble ${m.out ? 'out' : 'in'}">${m.from ? `<span class="wa-from">${esc(m.from)}</span>` : ''}<p>${esc(P(m.text))}</p>${link}<span class="wa-time">${esc(P(m.time))}</span></li>`;
}
function chatMarkup(chat) {
  const name = P(chat.name);
  return `<div class="wa-top wa-chat-top"><button type="button" class="wa-back" data-action="close-chat" aria-label="${L('Kembali ke senarai sembang', 'Back to chat list')}">${icons.back}</button><span class="wa-avatar small ${esc(chat.tone)}" aria-hidden="true">${esc(chat.initial)}</span><span class="wa-chat-name"><strong>${esc(name)}</strong><small>${esc(P(chat.subtitle))}</small></span></div>
    ${chat.unknown ? `<div class="wa-unknown">${icons.warning} ${L('Pengirim ini tiada dalam kenalan anda. Berhati-hati dengan pautan.', 'This sender is not in your contacts. Be careful with links.')}</div>` : ''}
    <div class="wa-body"><ol class="wa-msgs" aria-label="${esc(L(`Mesej daripada ${name}`, `Messages from ${name}`))}">${chat.messages.map(bubbleMarkup).join('')}</ol></div>
    <div class="wa-input" aria-hidden="true"><span>${L('Taip mesej', 'Type a message')}</span></div>`;
}
function sheetMarkup() {
  if (!sheet) return '';
  const href = safeHref(sheet.url);
  const open = href ? `<a class="btn btn-primary btn-full" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icons.link} ${L('Buka pautan', 'Open link')}</a>` : '';
  const moneyNote = `<p class="sheet-note">${L('Jika anda sudah beri maklumat bank atau pindah wang, hubungi bank anda dan NSRC 997 segera.', 'If you have already given bank details or sent money, contact your bank and NSRC 997 immediately.')}</p>`;
  let body;
  if (sheet.type === 'BLOCKED' && sheet.by === 'IBU_BAPA') {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.trash}</span><h3>${L('Pautan telah disekat. Mesej dipadam.', 'The link is blocked. The message was deleted.')}</h3><p>${L('Anda memilih untuk tidak membuka pautan ini. Pilihan yang selamat.', 'You chose not to open this link. That was the safe choice.')}</p>${moneyNote}<div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">${L('Faham, teruskan', 'Got it, continue')}</button></div></div>`;
  } else if (sheet.type === 'BLOCKED' && sheet.remembered) {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.ban}</span><h3>${L('Pautan ini telah disekat.', 'This link is blocked.')}</h3><p>${L('Anak anda sudah sahkan laman ini sebagai scam sebelum ini. Jangan buka pautan ini.', 'Your anak already confirmed this site as a scam. Do not open this link.')}</p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">${L('Faham', 'Got it')}</button></div></div>`;
  } else if (sheet.type === 'BLOCKED') {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.trash}</span><h3>${L('Ini SCAM. Mesej telah dipadam.', 'This is a SCAM. The message was deleted.')}</h3><p>${L('Anak anda telah sahkan pautan ini sebagai scam. Mesej itu sudah dipadam dari sembang anda. Telefon anda boleh digunakan seperti biasa.', 'Your anak confirmed this link is a scam. The message has been deleted from your chat. You can use your phone as usual.')}</p>${moneyNote}<div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">${L('Faham, teruskan', 'Got it, continue')}</button></div></div>`;
  } else if (sheet.type === 'SAFE') {
    body = `<div class="wa-sheet sheet-safe" role="status"><span class="outcome-icon">${icons.check}</span><h3>${L('Anak anda kata pautan ini selamat.', 'Your anak says this link is safe.')}</h3><p>${L('Anda boleh buka pautan ini sekarang.', 'You can open this link now.')}</p><div class="sheet-actions">${open}<button type="button" class="btn btn-outline btn-full" data-action="dismiss-sheet">${L('Tutup', 'Close')}</button></div></div>`;
  } else {
    body = `<div class="wa-sheet sheet-safe" role="status"><span class="outcome-icon">${icons.check}</span><h3>${L('Tiada tanda bahaya ditemui.', 'No warning signs found.')}</h3><p>${L('Semakan asas ini tidak menjamin pautan selamat. Buka hanya jika anda memang menjangkakannya.', 'This basic check cannot promise a link is safe. Only open it if you were expecting it.')}</p><div class="sheet-actions">${open}<button type="button" class="btn btn-outline btn-full" data-action="dismiss-sheet">${L('Tutup', 'Close')}</button></div></div>`;
  }
  return `<div class="wa-sheet-backdrop">${body}</div>`;
}
function phoneMarkup() {
  const chat = CHATS.find(c => c.id === openChatId);
  const now = new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return `<div class="phone" role="region" aria-label="${L('Telefon demo ibu/bapa', 'Ibu/bapa demo phone')}"><div class="phone-screen">
    <div class="wa-status" aria-hidden="true"><span>${esc(now)}</span><span>4G ▮▮▮ 85%</span></div>
    ${chat ? chatMarkup(chat) : chatListMarkup()}
    ${sheetMarkup()}
  </div></div>`;
}
function guideMarkup() {
  const wait = esc(durationText(data.timeoutSeconds));
  return `<aside class="wa-guide">
    <div class="guide-card"><span class="card-eyebrow">${L('CARA GUNA', 'HOW TO USE')}</span><h2>${L('Guna WhatsApp seperti biasa.', 'Use WhatsApp as usual.')}</h2>
      <ol class="guide-steps">
        <li><span class="step-number">01</span><div><strong>${L('Tekan pautan', 'Tap a link')}</strong><p>${L('Buka mana-mana sembang dan tekan pautan dalam mesej.', 'Open any chat and tap a link in a message.')}</p></div></li>
        <li><span class="step-number">02</span><div><strong>${L('Anak semak dahulu', 'Anak checks first')}</strong><p>${L('Jika pautan nampak bahaya, skrin akan berhenti dan anak anda akan sahkan sama ada ia scam.', 'If the link looks dangerous, the screen pauses and your anak confirms whether it is a scam.')}</p></div></li>
        <li><span class="step-number">03</span><div><strong>${L('Scam dipadam', 'Scams are deleted')}</strong><p>${L('Jika anak kata scam, mesej itu dipadam. Telefon anda boleh digunakan seperti biasa.', 'If anak says it is a scam, the message is deleted. You can use your phone as usual.')}</p></div></li>
        <li><span class="step-number">04</span><div><strong>${L('Tiada jawapan? Jangan buka', "No answer? Don't open it")}</strong><p>${L(`Jika anak tidak menjawab dalam ${wait}, jangan buka pautan itu. Jika wang sudah hilang, hubungi bank dan 997.`, `If anak does not answer within ${wait}, do not open the link. If money has already been lost, contact your bank and 997.`)}</p></div></li>
      </ol>
    </div>
    <details class="guide-card manual-check"><summary>${L('Semak pautan lain secara manual', 'Check another link manually')}</summary>
      <form id="scan-form"><label for="url">${L('Pautan laman web', 'Website link')}</label><input id="url" name="url" type="text" placeholder="${L('Tampal pautan di sini (cth. https://...)', 'Paste a link here (e.g. https://...)')}" maxlength="2048" autocomplete="off" required /><button type="submit" class="btn btn-primary btn-full">${icons.shield} ${L('Semak pautan ini', 'Check this link')}</button></form>
    </details>
    <div class="guide-card demo-tools"><span class="card-eyebrow">${L('UNTUK DEMO', 'FOR THE DEMO')}</span><p>${L('Pulihkan mesej yang telah dipadam supaya demo boleh diulang.', 'Restore deleted messages so the demo can be repeated.')}</p><button type="button" class="btn btn-outline btn-full" data-action="reset-demo">${icons.refresh} ${L('Pulihkan mesej demo', 'Restore demo messages')}</button></div>
    <div class="disclaimer"><strong>${L('Tentang demo ini:', 'About this demo:')}</strong> ${L('Ini telefon olok-olok dalam laman web. Laman web tidak boleh membaca atau memadam mesej dalam WhatsApp sebenar, dan tidak boleh mengunci telefon.', 'This is a pretend phone inside a website. A website cannot read or delete messages in the real WhatsApp, and cannot lock a phone.')}</div>
  </aside>`;
}
function seniorMarkup() {
  const active = data.active;
  return `<div class="senior-layout">
    <section class="senior-hello"><div><div class="eyebrow light"><span class="eyebrow-line"></span> ${L('RUANG KESELAMATAN KELUARGA ANDA', 'YOUR FAMILY SAFETY SPACE')}</div><h1>${L('Selamat datang', 'Welcome')}, ${esc(data.seniorName)} <span class="wave" aria-hidden="true">${icons.heart}</span></h1><p>${L('Anda tidak keseorangan dalam talian.', 'You are not alone online.')} ${esc(data.guardianName)} ${L('sentiasa membantu.', 'is always here to help.')}</p></div><div class="peace-badge">${icons.shield}<span><strong>${L('Perlindungan pautan aktif', 'Link protection on')}</strong><small class="realtime-indicator">${liveText()}</small></span></div></section>
    <section class="wa-stage">${phoneMarkup()}${guideMarkup()}</section>
    ${active ? lockMarkup(active) : ''}
  </div>`;
}
// Up to 2 plain-language reasons, so the parent learns why the link looks dangerous.
function tipsMarkup(a) {
  const tips = tipsOf(a).filter(Boolean);
  if (!tips.length) return '';
  return `<div class="lock-tips"><strong>${L('Kenapa pautan ini bahaya?', 'Why is this link dangerous?')}</strong><ul>${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}
function lockMarkup(a) {
  const escalated = a.status === 'ESCALATED';
  const anak = esc(data.guardianName);
  const wait = esc(durationText(data.timeoutSeconds));
  const anakTel = callLink(data.guardianPhone);
  const callAnak = anakTel ? `<a class="lock-action ${escalated ? 'secondary' : ''}" href="${anakTel}">${icons.phone} ${L('Hubungi', 'Call')} ${anak}</a>` : '';
  const where = a.source ? ` · ${esc(a.source)}` : '';
  if (!escalated) {
    return `<div class="lock-screen" role="alertdialog" aria-modal="true" aria-labelledby="lock-title">
      <div class="lock-glow lock-glow-one"></div><div class="lock-glow lock-glow-two"></div>
      <div class="lock-inner"><div class="lock-logo">${icons.shield}<span>familyguard.</span></div>
      <span class="lock-icon">${icons.lock}</span>
      <div class="lock-topline">${L('TUNGGU SEKEJAP', 'PLEASE WAIT')}</div>
      <h2 id="lock-title">${L('Biar anak anda sahkan pautan ini dulu.', 'Let your anak check this link first.')}</h2>
      <p class="lock-desc">${L(`Pautan ini menunjukkan tanda-tanda scam. Kami sudah hantar kepada ${anak} untuk disemak. Jangan buka pautan ini sementara menunggu.`, `This link shows signs of a scam. We have sent it to ${anak} to check. Please do not open it while you wait.`)}</p>
      <div class="lock-alert"><span>${icons.warning}</span><div><strong>${L('Pautan mencurigakan', 'Suspicious link')}</strong><small>${esc(a.domain)}${where}</small></div></div>
      ${tipsMarkup(a)}
      <div class="lock-countdown"><div class="countdown-label">${L('Menunggu jawapan anak', 'Waiting for anak to answer')}</div><div class="countdown-number" data-countdown="${esc(a.expiresAt)}">${clock(remaining(a.expiresAt))}</div><div class="progress-track"><div class="progress-bar" data-progress="${esc(a.expiresAt)}" data-start="${esc(a.createdAt)}"></div></div><p>${L(`Jika ${anak} tidak menjawab dalam ${wait}, kami akan tunjukkan apa yang perlu dibuat.`, `If ${anak} does not answer within ${wait}, we will show you what to do.`)}</p></div>
      ${callAnak ? `<div class="lock-actions">${callAnak}</div>` : ''}
      <p class="lock-footnote">${L('Skrin perlindungan ini hanya menutup Family Guard, bukan aplikasi lain dalam telefon anda.', 'This protective screen only covers Family Guard, not the other apps on your phone.')}</p></div>
    </div>`;
  }
  return `<div class="lock-screen lock-escalated" role="alertdialog" aria-modal="true" aria-labelledby="lock-title">
    <div class="lock-glow lock-glow-one"></div><div class="lock-glow lock-glow-two"></div>
    <div class="lock-inner"><div class="lock-logo">${icons.shield}<span>familyguard.</span></div>
    <span class="lock-icon">${icons.ban}</span>
    <div class="lock-topline">${L('ANAK ANDA BELUM MENJAWAB', 'YOUR ANAK HAS NOT ANSWERED YET')}</div>
    <h2 id="lock-title">${L('Jangan buka pautan ini.', 'Do not open this link.')}</h2>
    <p class="lock-desc">${L(`${anak} belum menjawab dalam ${wait}. Hubungi ${anak} atau ahli keluarga lain untuk bertanya dahulu.`, `${anak} has not answered within ${wait}. Call ${anak} or another family member to ask first.`)}</p>
    <div class="lock-alert"><span>${icons.warning}</span><div><strong>${L('Pautan mencurigakan', 'Suspicious link')}</strong><small>${esc(a.displayUrl || a.domain)}${where}</small></div></div>
    ${tipsMarkup(a)}
    <div class="lock-actions">${callAnak}<button type="button" class="lock-btn danger" data-action="block-myself">${icons.trash} ${L('Saya tidak akan buka. Sekat pautan ini.', "I won't open it. Block this link.")}</button></div>
    <div class="lock-report"><strong>${L('Sudah beri maklumat bank, OTP atau pindah wang?', 'Already gave bank details, an OTP or sent money?')}</strong>
      <p>${L('Hubungi bank anda dan Pusat Respons Scam Kebangsaan (NSRC) 997 dengan segera.', 'Contact your bank and the National Scam Response Centre (NSRC) on 997 immediately.')}</p>
      <div class="lock-report-actions"><a class="lock-action urgent" href="tel:997">${icons.phone} ${L('Hubungi 997 sekarang', 'Call 997 now')}</a></div></div>
    <p class="lock-footnote">${L(`Hanya ${anak} boleh membenarkan pautan ini dibuka. Panggilan hanya dibuat apabila anda menekan butang.`, `Only ${anak} can allow this link to open. A call is only made when you press the button.`)}</p></div>
  </div>`;
}

/* ---------- Anak (guardian) view ---------- */
function decidedByText(item) {
  if (item.decidedBy === 'IBU_BAPA') return L(' (oleh ibu/bapa)', ' (by ibu/bapa)');
  return item.decidedBy === 'NSRC_997' ? L(' (melalui 997)', ' (via 997)') : ''; // older records
}
function riskText(risk) { return risk === 'HIGH' ? L('TINGGI', 'HIGH') : L('SEDERHANA', 'MEDIUM'); }
function incidentMarkup(a) {
  const senior = esc(data.seniorName);
  if (!a) return `<div class="no-alert"><span>${icons.shield}</span><h3>${L('Semua selamat. Tiada amaran aktif.', 'All clear. No active alerts.')}</h3><p>${L(`Apabila ${senior} menekan pautan mencurigakan, ia akan muncul di sini dan anda boleh terus membuat keputusan.`, `When ${senior} taps a suspicious link, it will appear here and you can decide straight away.`)}</p><div class="calm-line"><span class="status-circle"></span> ${L('Sedang memantau', 'Watching')}</div></div>`;
  const isLate = a.status === 'ESCALATED';
  const found = a.messageId ? findMessage(a.messageId) : null;
  const tapped = a.source
    ? L(`${senior} menekan pautan dalam mesej daripada <strong>${esc(a.source)}</strong>.`, `${senior} tapped a link in a message from <strong>${esc(a.source)}</strong>.`)
    : L(`${senior} menyemak pautan ini.`, `${senior} checked this link.`);
  return `<div class="alert-head"><span class="risk-icon">${icons.warning}</span><div><span class="alert-kicker">${isLate ? L('MASA TAMAT · IBU/BAPA MASIH MENUNGGU', 'TIME IS UP · IBU/BAPA IS STILL WAITING') : L('TINDAKAN DIPERLUKAN · PAUTAN DITEKAN', 'ACTION NEEDED · LINK TAPPED')}</span><h3>${isLate ? L('Masa menjawab telah tamat', 'The time to answer has ended') : L('Sahkan pautan ini: scam atau tidak?', 'Check this link: scam or not?')}</h3><p>${tapped} ${L('Semakan asas menemui tanda-tanda bahaya.', 'The basic check found warning signs.')}</p></div><span class="risk-tag">${L('RISIKO', 'RISK')} ${riskText(a.risk)}</span></div>
    ${found ? `<div class="msg-quote"><small>${L('MESEJ YANG DITERIMA', 'MESSAGE RECEIVED')}</small><p>${esc(P(found.message.text))}</p></div>` : ''}
    <div class="alert-info"><div><small>${L('PAUTAN', 'LINK')}</small><strong title="${esc(a.displayUrl)}">${esc(a.domain)}</strong></div><div><small>${L('DITEKAN PADA', 'TAPPED AT')}</small><strong>${fmtTime(a.createdAt)}</strong></div><div><small>${L('IBU/BAPA', 'IBU/BAPA')}</small><strong>${senior}</strong></div></div>
    <div class="flag-box"><strong>${icons.eye} ${L('Kenapa pautan ini ditanda', 'Why this link was flagged')}</strong><ul>${reasonsOf(a).map(r => `<li>${esc(r)}</li>`).join('')}</ul>${a.simulated ? `<p class="sim-note">${L('Amaran ini dicipta oleh mod demo.', 'This alert was created by demo mode.')}</p>` : ''}</div>
    <div class="guardian-time"><div><strong>${isLate ? L('Ibu/bapa dinasihatkan jangan buka pautan ini', 'Ibu/bapa has been told not to open this link') : L('Masa untuk menjawab', 'Time to answer')}</strong><p>${isLate ? L('Anda masih boleh membuat keputusan sekarang.', 'You can still decide now.') : L('Skrin ibu/bapa anda berhenti sehingga anda membuat keputusan.', "Your ibu/bapa's screen is paused until you decide.")}</p></div><span class="timer-value" data-countdown="${esc(a.expiresAt)}">${isLate ? '00:00' : clock(remaining(a.expiresAt))}</span></div>
    <div class="decision-actions"><button class="btn btn-safe" data-action="resolve" data-decision="SAFE">${icons.check} ${L('Selamat, benarkan', 'Safe, allow it')}</button><button class="btn btn-danger" data-action="resolve" data-decision="BLOCKED">${icons.trash} ${L('Scam, padam mesej', 'Scam, delete message')}</button></div>
    <div class="decision-tip">${L('Pilih "Selamat" hanya selepas anda sahkan alamat rasmi laman tersebut. Pilih "Scam" untuk memadam mesej itu dari WhatsApp ibu/bapa anda.', `Choose "Safe" only after you have checked the site's official address. Choose "Scam" to delete the message from your ibu/bapa's WhatsApp.`)}</div>`;
}
function historyStatus(item) {
  if (item.status === 'RESOLVED') return item.decision === 'SAFE' ? `${L('Selamat', 'Safe')}${decidedByText(item)}` : `${L('Scam, dipadam', 'Scam, deleted')}${decidedByText(item)}`;
  return item.status === 'WAITING' ? L('Perlu disemak', 'Needs review') : L('Masa tamat', 'Time is up');
}
function guardianMarkup() {
  const a = data.active;
  const stats = data.stats;
  const recent = data.history ?? [];
  const day = new Date().toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const rows = recent.length ? recent.map(item => `<tr><td><span class="table-domain">${icons.link} ${esc(item.domain)}</span>${item.source ? `<small class="table-source">${esc(item.source)}</small>` : ''}${item.simulated ? '<span class="mini-demo">DEMO</span>' : ''}</td><td>${fmtTime(item.createdAt)}</td><td><span class="table-status ${esc(item.status.toLowerCase())}">${esc(historyStatus(item))}</span></td><td><span class="table-risk">${riskText(item.risk)}</span></td></tr>`).join('') : `<tr><td colspan="4" class="empty-row">${L('Belum ada amaran. Cuba tekan pautan dalam telefon demo ibu/bapa.', 'No alerts yet. Try tapping a link on the ibu/bapa demo phone.')}</td></tr>`;
  return `<section class="guardian-dashboard"><div class="dashboard-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> ${L('GAMBARAN KESELAMATAN KELUARGA', 'FAMILY SAFETY OVERVIEW')}</div><h1>${L('Papan pemuka anak', 'Anak dashboard')} <span class="tiny-spark">✳</span></h1><p>${L('Ketenangan fikiran, di satu tempat.', 'Peace of mind, all in one place.')} <span class="muted">${esc(day)}</span></p></div><div class="live-chip"><span class="status-circle"></span><span class="realtime-indicator">${liveText()}</span></div></div>
    <div class="stat-grid"><div class="stat-card"><span class="stat-icon mint">${icons.shield}</span><span class="stat-title">${L('Ahli keluarga dipantau', 'Family member protected')}</span><strong>01</strong><small>${esc(data.seniorName)}</small></div><div class="stat-card"><span class="stat-icon violet">${icons.link}</span><span class="stat-title">${L('Pautan ditanda', 'Flagged links')}</span><strong>${stats.scannedThreats}</strong><small>${L('Jumlah amaran dalam demo', 'Total alerts in this demo')}</small></div><div class="stat-card"><span class="stat-icon blue">${icons.check}</span><span class="stat-title">${L('Amaran selesai', 'Alerts settled')}</span><strong>${stats.resolved}</strong><small>${L('Telah diputuskan', 'Decided')}</small></div><div class="stat-card"><span class="stat-icon coral">${icons.bell}</span><span class="stat-title">${L('Masa tamat', 'Timed out')}</span><strong>${stats.escalated}</strong><small>${L('Masa menjawab tamat', 'Time to answer ran out')}</small></div></div>
    <div class="dashboard-main-grid"><section class="incident-card"><div class="panel-heading"><div><h2>${L('Pemantauan pautan', 'Link monitoring')}</h2><p>${L('Sahkan pautan yang ditekan oleh ibu/bapa anda.', 'Check the links your ibu/bapa taps.')}</p></div><span class="monitoring-pill"><span class="pulse-dot"></span> ${a ? L('Amaran aktif', 'Alert active') : L('Memantau', 'Watching')}</span></div>${incidentMarkup(a)}</section>
    <aside class="guardian-aside"><div class="family-card"><div class="family-top"><span>${icons.heart}</span><span class="online-status"><span></span> ${L('Berdaftar', 'Registered')}</span></div><h3>${L('Keluarga anda', 'Your family')}</h3><p>${L('Seorang dalam jagaan anda.', 'One person in your care.')}</p><div class="family-member"><span class="avatar">${esc((data.seniorName || 'I').trim().charAt(0).toUpperCase())}</span><div><strong>${esc(data.seniorName)}</strong><small>${L('Ibu/bapa · Dilindungi', 'Ibu/bapa · Protected')}</small></div></div><div class="family-divider"></div><div class="family-meta"><span>${L('Anak', 'Anak')}</span><strong>${esc(data.guardianName)}</strong></div><div class="family-meta"><span>${L('Status SMS', 'SMS status')}</span><strong>${data.smsEnabled ? L('Dikonfigurasi', 'Set up') : L('Demo sahaja', 'Demo only')}</strong></div><div class="family-meta"><span>${L('Mesej scam dipadam', 'Scam messages deleted')}</span><strong>${(data.deletedMessages || []).length}</strong></div><button type="button" class="btn btn-outline btn-full" data-action="reset-demo">${icons.refresh} ${L('Pulihkan mesej demo', 'Restore demo messages')}</button></div>
    <div class="help-card"><span class="help-symbol">${icons.phone}</span><h3>${L('Tahu apa perlu dibuat.', 'Know what to do.')}</h3><p>${L('Jika scam sudah melibatkan wang, hubungi bank dan NSRC 997 dengan segera.', 'If money is already involved in a scam, contact the bank and NSRC 997 immediately.')}</p><a href="tel:997" class="help-call">${L('Hubungi NSRC 997', 'Call NSRC 997')} ${icons.arrow}</a><small>${L('Laman web tidak boleh membuat panggilan secara automatik.', 'A website cannot place calls automatically.')}</small></div></aside></div>
    <section class="history-card"><div class="panel-heading"><div><h2>${L('Aktiviti terkini', 'Recent activity')}</h2><p>${L('Rekod pautan yang ditanda dan keputusan yang dibuat.', 'A record of flagged links and the decisions made.')}</p></div><span class="history-counter">${L(`${recent.length} rekod`, `${recent.length} records`)}</span></div><div class="table-wrap"><table><thead><tr><th>${L('LAMAN WEB', 'WEBSITE')}</th><th>${L('TARIKH & MASA', 'DATE & TIME')}</th><th>STATUS</th><th>${L('RISIKO', 'RISK')}</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="disclaimer guardian-disclaimer"><strong>${L('Had prototaip:', 'Prototype limits:')}</strong> ${L('Laman web tidak boleh membaca atau memadam mesej WhatsApp sebenar, mengunci telefon, atau menghubungi 997 secara automatik. Penyemak menggunakan heuristik, bukan maklumat ancaman yang disahkan.', 'A website cannot read or delete real WhatsApp messages, lock a phone, or call 997 automatically. The checker uses simple rules, not verified threat intelligence.')}</div></section>`;
}

function updateClocks() {
  document.querySelectorAll('[data-countdown]').forEach(el => { el.textContent = clock(remaining(el.dataset.countdown)); });
  document.querySelectorAll('[data-progress]').forEach(el => {
    const total = new Date(el.dataset.progress).getTime() - new Date(el.dataset.start).getTime();
    const left = new Date(el.dataset.progress).getTime() - Date.now();
    el.style.width = `${Math.max(0, Math.min(100, 100 * left / Math.max(1, total)))}%`;
  });
}
setInterval(updateClocks, 250);

/* ---------- Actions ---------- */
// The parent taps a link: check it, and ask anak if it looks risky.
async function checkLink(url, { messageId = '', source = '' } = {}) {
  if (busy) return;
  busy = true;
  sheet = null;
  try {
    const result = await api('/api/scan', { method: 'POST', body: JSON.stringify({ url, simulate: false, source, messageId }) });
    if (result.remembered) {
      sheet = { type: result.remembered === 'SAFE' ? 'SAFE' : 'BLOCKED', url, by: 'ANAK', remembered: true };
      render();
    } else if (result.triggered) {
      savePending({ id: result.incident.id, url, messageId });
      data = await api('/api/state');
      render();
      notify(L('Pautan ini dihantar kepada anak anda untuk disemak.', 'This link has been sent to your anak to check.'), 'warn');
    } else {
      sheet = { type: 'LOW', url };
      render();
    }
  } catch (err) { notify(err.message, 'warn'); }
  finally { busy = false; }
}

document.addEventListener('click', async e => {
  const roleButton = e.target.closest('[data-role]');
  if (roleButton) { selectedRole = roleButton.dataset.role; render(); return; }
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const type = action.dataset.action;
  if (type === 'lang') {
    lang = action.dataset.lang === 'en' ? 'en' : 'ms';
    try { localStorage.setItem(langKey, lang); } catch { /* private mode */ }
    render();
    return;
  }
  if (type === 'logout') return logout();
  if (type === 'open-chat') { openChatId = action.dataset.chat; sheet = null; render(); document.querySelector('.wa-back')?.focus(); return; }
  if (type === 'close-chat') { openChatId = null; sheet = null; render(); return; }
  if (type === 'dismiss-sheet') { sheet = null; render(); return; }
  if (type === 'tap-link') {
    const found = findMessage(action.dataset.msg);
    if (!found || isDeleted(found.message.id)) return;
    return checkLink(found.message.url, { messageId: found.message.id, source: `${P(found.chat.name)} (WhatsApp)` });
  }
  if (type === 'reset-demo') {
    if (!confirm(L('Pulihkan semua mesej demo yang telah dipadam?', 'Restore all deleted demo messages?'))) return;
    try {
      await api('/api/demo/reset', { method: 'POST' });
      sheet = null;
      data = await api('/api/state');
      render();
      notify(L('Mesej demo telah dipulihkan.', 'Demo messages restored.'), 'success');
    } catch (err) { notify(err.message, 'warn'); }
    return;
  }
  if (type === 'block-myself') {
    const id = data?.active?.id;
    if (!id) return;
    if (!confirm(L('Sekat pautan ini? Ia tidak akan dibuka dan mesej itu akan dipadam.', 'Block this link? It will not open and the message will be deleted.'))) return;
    action.disabled = true;
    try {
      // After the timeout the parent may block the link. Only anak can allow it.
      await api(`/api/incidents/${encodeURIComponent(id)}/report-997`, { method: 'POST', body: JSON.stringify({ decision: 'BLOCKED' }) });
      data = await api('/api/state');
      render();
    } catch (err) { action.disabled = false; notify(err.message, 'warn'); }
    return;
  }
  if (type === 'resolve') {
    const id = data?.active?.id;
    if (!id) return;
    const decision = action.dataset.decision;
    if (decision === 'SAFE' && !confirm(L('Adakah anda sudah sahkan pautan ini sah dan selamat?', 'Have you checked that this link is genuine and safe?'))) return;
    if (decision === 'BLOCKED' && !confirm(L('Tandakan sebagai scam dan padam mesej ini dari WhatsApp ibu/bapa anda?', "Mark as a scam and delete this message from your ibu/bapa's WhatsApp?"))) return;
    action.disabled = true;
    try {
      await api(`/api/incidents/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify({ decision }) });
      data = await api('/api/state');
      render();
      notify(decision === 'SAFE'
        ? L('Pautan disahkan selamat. Skrin ibu/bapa dibuka semula.', "Link confirmed safe. Ibu/bapa's screen is unlocked.")
        : L('Scam disahkan. Mesej dipadam dan skrin ibu/bapa dibuka semula.', "Scam confirmed. The message was deleted and ibu/bapa's screen is unlocked."), 'success');
    } catch (err) { action.disabled = false; notify(err.message, 'warn'); }
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id === 'login-form') {
    e.preventDefault();
    const button = e.target.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const value = await api('/api/auth', { method: 'POST', body: JSON.stringify({ role: selectedRole, pin: e.target.elements.namedItem('pin').value }) });
      saveSession(value); data = null; sheet = null; openChatId = null;
      render(); await refresh();
    } catch (err) { button.disabled = false; notify(err.message, 'warn'); }
  }
  if (e.target.id === 'scan-form') {
    e.preventDefault();
    const value = e.target.elements.namedItem('url').value.trim();
    await checkLink(value, { source: L('Semakan manual', 'Manual check') });
  }
});

render();
if (session) refresh();
