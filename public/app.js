/* Family Guard: antara muka pelayar untuk prototaip pendidikan tempatan (ibu/bapa + anak). */
const main = document.querySelector('#main');
const topbar = document.querySelector('#topbar-actions');
const toastEl = document.querySelector('#toast');
const sessionKey = 'familyguard-session';
const pendingKey = 'familyguard-pending-link';
let session = null;
try { session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { session = null; }
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

// Pretend WhatsApp chats. A web page cannot see taps inside the real WhatsApp,
// so these sample chats stand in for it. Every link goes through the same check + anak flow.
const CHATS = [
  {
    id: 'family', name: 'Keluarga Kita', initial: 'K', tone: 'tone-family', subtitle: 'Faiz, Aisyah, Mak',
    messages: [
      { id: 'family-1', from: 'Faiz', text: 'Mak, jangan lupa makan ubat ya.', time: '8:02 PG' },
      { id: 'family-2', out: true, text: 'Baik, terima kasih Faiz.', time: '8:05 PG' },
      { id: 'family-3', from: 'Aisyah', text: 'Mak, ni resepi rendang yang Mak minta semalam.', url: 'https://www.google.com', time: '9:15 PG' }
    ]
  },
  {
    id: 'bank', name: '+60 11-5555 0000', initial: '?', tone: 'tone-unknown', subtitle: 'Bukan dalam kenalan', unknown: true, unread: 1,
    messages: [
      { id: 'bank-1', text: 'MAYBANK: Akaun anda akan DIGANTUNG hari ini. Sila sahkan butiran anda segera untuk elak akaun disekat.', url: 'https://maybank-secure-verification.example/verify', time: '9:41 PG' }
    ]
  },
  {
    id: 'pos', name: '+60 13-222 8080', initial: '?', tone: 'tone-unknown', subtitle: 'Bukan dalam kenalan', unknown: true, unread: 1,
    messages: [
      { id: 'pos-1', text: 'POS: Bungkusan anda DITAHAN. Bayar RM2.50 untuk penghantaran semula hari ini.', url: 'http://pos-laju-delivery-update.top/claim', time: 'Semalam' }
    ]
  },
  {
    id: 'tng', name: 'TNG Hadiah', initial: 'T', tone: 'tone-promo', subtitle: 'Bukan dalam kenalan', unknown: true, unread: 1,
    messages: [
      { id: 'tng-1', text: 'Tahniah! Anda MENANG RM500 dalam eWallet. Tuntut hadiah anda sebelum tengah malam.', url: 'https://tng-reward-claim.xyz/prize', time: 'Semalam' }
    ]
  }
];

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
  return isNaN(d) ? '—' : d.toLocaleString('ms-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function remaining(until) { return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)); }
function clock(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function durationText(seconds) { return seconds >= 60 ? `${Math.round(seconds / 60)} minit` : `${seconds} saat`; }
function callLink(phone) { return /^\+[1-9]\d{7,14}$/.test(phone || '') ? `tel:${phone}` : null; }
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
    headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) }
  });
  let body = {};
  try { body = await response.json(); } catch { /* no body */ }
  if (response.status === 401 && route !== '/api/auth') { logout(false); throw new Error('Sesi tamat. Sila log masuk semula.'); }
  if (!response.ok) throw new Error(body.error || `Permintaan gagal (${response.status}).`);
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
// When anak (or the 997 report) decides, the server clears the active alert.
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
    if (session?.role === 'guardian' && next.active?.id && priorId !== next.active.id) notify('Amaran baharu: ibu/bapa anda menekan pautan mencurigakan.', 'warn');
  });
  socket.on('connect_error', err => {
    connected = false;
    if (/Authentication required/.test(err.message)) { logout(false); notify('Sila log masuk semula.', 'warn'); }
    else setLiveStatus();
  });
}
function setLiveStatus() {
  document.querySelectorAll('.realtime-indicator').forEach(el => {
    el.textContent = connected ? 'Bersambung secara langsung' : 'Menyambung semula…';
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

function renderHeader() {
  topbar.innerHTML = session
    ? `<span class="tiny-role">${session.role === 'senior' ? 'Paparan ibu/bapa' : 'Portal anak'}</span><button type="button" class="logout-btn" data-action="logout">Log keluar ${icons.arrow}</button>`
    : `<span class="topbar-help">Membantu keluarga kekal selamat dalam talian.</span>`;
}
function render() {
  renderHeader();
  settlePendingLink();
  if (!session) { main.innerHTML = loginMarkup(); return; }
  if (!data) { main.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div><p>Sedang memuatkan…</p></div>`; return; }
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
      <div class="eyebrow"><span class="eyebrow-line"></span> KESELAMATAN DIGITAL, DENGAN SENTUHAN KELUARGA</div>
      <h1>Keselamatan itu<br><em>urusan keluarga.</em></h1>
      <p class="entry-subtitle">Tekan pautan seperti biasa. Jika nampak bahaya, anak anda semak dahulu sebelum ia dibuka.</p>
      <div class="hero-proof"><span class="proof-icon">${icons.shield}</span><span><strong>Kekal berhubung. Kekal dilindungi.</strong><small>Direka untuk warga emas dan keluarga mereka.</small></span></div>
      <div class="hero-orbit hero-orbit-a"></div><div class="hero-orbit hero-orbit-b"></div>
      <div class="guardian-illustration" aria-hidden="true"><div class="illus-circle one"></div><div class="illus-circle two"></div><div class="illus-card illus-card-left"><span>${icons.heart}</span><strong>Keluarga didahulukan</strong><small>Prihatin setiap langkah</small></div><div class="illus-center"><span class="illus-shield">${icons.shield}</span><strong>familyguard.</strong><small>Selamat, bersama.</small></div><div class="illus-card illus-card-right"><span>${icons.check}</span><strong>Anda dilindungi</strong><small>Anak bersambung</small></div></div>
    </div>
    <div class="signin-column"><div class="signin-card"><span class="section-label">MULAKAN</span><h2>Selamat datang ke<br>Family Guard <span class="greeting-dot">✳</span></h2><p>Anda log masuk sebagai siapa hari ini?</p>
      <div class="role-pick" role="group" aria-label="Pilih peranan anda">
        <button type="button" class="role-choice ${selectedRole === 'senior' ? 'active' : ''}" data-role="senior"><span class="choice-icon">${icons.heart}</span><span><strong>Saya ibu / bapa</strong><small>Guna WhatsApp dengan selamat</small></span><span class="radio-ring"></span></button>
        <button type="button" class="role-choice ${selectedRole === 'guardian' ? 'active' : ''}" data-role="guardian"><span class="choice-icon">${icons.shield}</span><span><strong>Saya anak</strong><small>Sahkan pautan untuk ibu/bapa</small></span><span class="radio-ring"></span></button>
      </div>
      <form id="login-form"><label for="pin">PIN akses ${selectedRole === 'senior' ? 'ibu/bapa' : 'anak'}</label><input id="pin" name="pin" type="password" required minlength="4" maxlength="32" inputmode="numeric" autocomplete="off" placeholder="Masukkan PIN akses" />
        <button type="submit" class="btn btn-primary btn-full">Buka papan pemuka ${icons.arrow}</button></form>
      <p class="fine-print">Demo tempatan sahaja. Contoh PIN ada dalam fail <code>.env.example</code> projek anda.</p>
    </div><div class="signin-bottom">${icons.lock} <span>Butiran pautan kekal dalam demonstrasi tempatan ini.</span></div></div>
  </section>`;
}

/* ---------- Parent (ibu/bapa) view: demo WhatsApp-style phone ---------- */
function lastPreview(chat) {
  const m = chat.messages.at(-1);
  if (isDeleted(m.id)) return { text: 'Mesej ini telah dipadam', deleted: true, time: m.time };
  return { text: `${m.out ? 'Anda: ' : m.from ? `${m.from}: ` : ''}${m.text}`, deleted: false, time: m.time };
}
function chatListMarkup() {
  const rows = CHATS.map(chat => {
    const p = lastPreview(chat);
    const unread = chat.unread && !chat.messages.every(m => isDeleted(m.id)) ? `<span class="wa-unread" aria-label="${chat.unread} mesej belum dibaca">${chat.unread}</span>` : '';
    return `<li><button type="button" class="wa-row" data-action="open-chat" data-chat="${esc(chat.id)}"><span class="wa-avatar ${esc(chat.tone)}" aria-hidden="true">${esc(chat.initial)}</span><span class="wa-row-main"><span class="wa-row-top"><strong>${esc(chat.name)}</strong><small>${esc(p.time)}</small></span><span class="wa-preview ${p.deleted ? 'deleted' : ''}">${p.deleted ? icons.ban : ''}${esc(p.text)}</span></span>${unread}</button></li>`;
  }).join('');
  return `<div class="wa-top"><div class="wa-top-title"><strong>Sembang</strong><small>${icons.shield} Dilindungi Family Guard</small></div></div>
    <ul class="wa-list" aria-label="Senarai sembang">${rows}</ul>`;
}
function bubbleMarkup(m) {
  if (isDeleted(m.id)) {
    return `<li class="wa-bubble in deleted">${icons.ban}<span><em>Mesej ini telah dipadam oleh Family Guard kerana disahkan scam.</em><span class="wa-time">${esc(m.time)}</span></span></li>`;
  }
  const link = m.url ? `<button type="button" class="wa-link" data-action="tap-link" data-msg="${esc(m.id)}">${esc(m.url)}</button>` : '';
  return `<li class="wa-bubble ${m.out ? 'out' : 'in'}">${m.from ? `<span class="wa-from">${esc(m.from)}</span>` : ''}<p>${esc(m.text)}</p>${link}<span class="wa-time">${esc(m.time)}</span></li>`;
}
function chatMarkup(chat) {
  return `<div class="wa-top wa-chat-top"><button type="button" class="wa-back" data-action="close-chat" aria-label="Kembali ke senarai sembang">${icons.back}</button><span class="wa-avatar small ${esc(chat.tone)}" aria-hidden="true">${esc(chat.initial)}</span><span class="wa-chat-name"><strong>${esc(chat.name)}</strong><small>${esc(chat.subtitle)}</small></span></div>
    ${chat.unknown ? `<div class="wa-unknown">${icons.warning} Pengirim ini tiada dalam kenalan anda. Berhati-hati dengan pautan.</div>` : ''}
    <div class="wa-body"><ol class="wa-msgs" aria-label="Mesej daripada ${esc(chat.name)}">${chat.messages.map(bubbleMarkup).join('')}</ol></div>
    <div class="wa-input" aria-hidden="true"><span>Taip mesej</span></div>`;
}
function sheetMarkup() {
  if (!sheet) return '';
  const href = safeHref(sheet.url);
  const open = href ? `<a class="btn btn-primary btn-full" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icons.link} Buka pautan</a>` : '';
  const who = 'Anak anda';
  let body;
  if (sheet.type === 'BLOCKED' && sheet.by === 'IBU_BAPA') {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.trash}</span><h3>Pautan telah disekat. Mesej dipadam.</h3><p>Anda memilih untuk tidak membuka pautan ini. Pilihan yang selamat.</p><p class="sheet-note">Jika anda sudah beri maklumat bank atau pindah wang, hubungi bank anda dan NSRC 997 segera.</p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">Faham, teruskan</button></div></div>`;
  } else if (sheet.type === 'BLOCKED' && sheet.remembered) {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.ban}</span><h3>Pautan ini telah disekat.</h3><p>Anak anda sudah sahkan laman ini sebagai scam sebelum ini. Jangan buka pautan ini.</p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">Faham</button></div></div>`;
  } else if (sheet.type === 'BLOCKED') {
    body = `<div class="wa-sheet sheet-blocked" role="status"><span class="outcome-icon">${icons.trash}</span><h3>Ini SCAM. Mesej telah dipadam.</h3><p>${who} telah sahkan pautan ini sebagai scam. Mesej itu sudah dipadam dari sembang anda. Telefon anda boleh digunakan seperti biasa.</p><p class="sheet-note">Jika anda sudah beri maklumat bank atau pindah wang, hubungi bank anda dan NSRC 997 segera.</p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-full" data-action="dismiss-sheet">Faham, teruskan</button></div></div>`;
  } else if (sheet.type === 'SAFE') {
    body = `<div class="wa-sheet sheet-safe" role="status"><span class="outcome-icon">${icons.check}</span><h3>${who} kata pautan ini selamat.</h3><p>Anda boleh buka pautan ini sekarang.</p><div class="sheet-actions">${open}<button type="button" class="btn btn-outline btn-full" data-action="dismiss-sheet">Tutup</button></div></div>`;
  } else {
    body = `<div class="wa-sheet sheet-safe" role="status"><span class="outcome-icon">${icons.check}</span><h3>Tiada tanda bahaya ditemui.</h3><p>Semakan asas ini tidak menjamin pautan selamat. Buka hanya jika anda memang menjangkakannya.</p><div class="sheet-actions">${open}<button type="button" class="btn btn-outline btn-full" data-action="dismiss-sheet">Tutup</button></div></div>`;
  }
  return `<div class="wa-sheet-backdrop">${body}</div>`;
}
function phoneMarkup() {
  const chat = CHATS.find(c => c.id === openChatId);
  const now = new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
  return `<div class="phone" role="region" aria-label="Telefon demo ibu/bapa"><div class="phone-screen">
    <div class="wa-status" aria-hidden="true"><span>${esc(now)}</span><span>4G ▮▮▮ 85%</span></div>
    ${chat ? chatMarkup(chat) : chatListMarkup()}
    ${sheetMarkup()}
  </div></div>`;
}
function guideMarkup() {
  return `<aside class="wa-guide">
    <div class="guide-card"><span class="card-eyebrow">CARA GUNA</span><h2>Guna WhatsApp seperti biasa.</h2>
      <ol class="guide-steps">
        <li><span class="step-number">01</span><div><strong>Tekan pautan</strong><p>Buka mana-mana sembang dan tekan pautan dalam mesej.</p></div></li>
        <li><span class="step-number">02</span><div><strong>Anak semak dahulu</strong><p>Jika pautan nampak bahaya, skrin akan berhenti dan anak anda akan sahkan sama ada ia scam.</p></div></li>
        <li><span class="step-number">03</span><div><strong>Scam dipadam</strong><p>Jika anak kata scam, mesej itu dipadam. Telefon anda boleh digunakan seperti biasa.</p></div></li>
        <li><span class="step-number">04</span><div><strong>Tiada jawapan? Jangan buka</strong><p>Jika anak tidak menjawab dalam ${esc(durationText(data.timeoutSeconds))}, jangan buka pautan itu. Jika wang sudah hilang, hubungi bank dan 997.</p></div></li>
      </ol>
    </div>
    <details class="guide-card manual-check"><summary>Semak pautan lain secara manual</summary>
      <form id="scan-form"><label for="url">Pautan laman web</label><input id="url" name="url" type="text" placeholder="Tampal pautan di sini (cth. https://...)" maxlength="2048" autocomplete="off" required /><button type="submit" class="btn btn-primary btn-full">${icons.shield} Semak pautan ini</button></form>
    </details>
    <div class="guide-card demo-tools"><span class="card-eyebrow">UNTUK DEMO</span><p>Pulihkan mesej yang telah dipadam supaya demo boleh diulang.</p><button type="button" class="btn btn-outline btn-full" data-action="reset-demo">${icons.refresh} Pulihkan mesej demo</button></div>
    <div class="disclaimer"><strong>Tentang demo ini:</strong> Ini telefon olok-olok dalam laman web. Laman web tidak boleh membaca atau memadam mesej dalam WhatsApp sebenar, dan tidak boleh mengunci telefon.</div>
  </aside>`;
}
function seniorMarkup() {
  const active = data.active;
  return `<div class="senior-layout">
    <section class="senior-hello"><div><div class="eyebrow light"><span class="eyebrow-line"></span> RUANG KESELAMATAN KELUARGA ANDA</div><h1>Selamat datang, ${esc(data.seniorName)} <span class="wave" aria-hidden="true">${icons.heart}</span></h1><p>Anda tidak keseorangan dalam talian. ${esc(data.guardianName)} sentiasa membantu.</p></div><div class="peace-badge">${icons.shield}<span><strong>Perlindungan pautan aktif</strong><small class="realtime-indicator">${connected ? 'Bersambung secara langsung' : 'Menyambung semula…'}</small></span></div></section>
    <section class="wa-stage">${phoneMarkup()}${guideMarkup()}</section>
    ${active ? lockMarkup(active) : ''}
  </div>`;
}
// Up to 2 plain-language reasons, so the parent learns why the link looks dangerous.
function tipsMarkup(a) {
  const tips = Array.isArray(a.tips) ? a.tips.filter(Boolean) : [];
  if (!tips.length) return '';
  return `<div class="lock-tips"><strong>Kenapa pautan ini bahaya?</strong><ul>${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}
function lockMarkup(a) {
  const escalated = a.status === 'ESCALATED';
  const anakTel = callLink(data.guardianPhone);
  const callAnak = anakTel ? `<a class="lock-action ${escalated ? 'secondary' : ''}" href="${anakTel}">${icons.phone} Hubungi ${esc(data.guardianName)}</a>` : '';
  const where = a.source ? ` · ${esc(a.source)}` : '';
  if (!escalated) {
    return `<div class="lock-screen" role="alertdialog" aria-modal="true" aria-labelledby="lock-title">
      <div class="lock-glow lock-glow-one"></div><div class="lock-glow lock-glow-two"></div>
      <div class="lock-inner"><div class="lock-logo">${icons.shield}<span>familyguard.</span></div>
      <span class="lock-icon">${icons.lock}</span>
      <div class="lock-topline">TUNGGU SEKEJAP</div>
      <h2 id="lock-title">Biar anak anda sahkan pautan ini dulu.</h2>
      <p class="lock-desc">Pautan ini menunjukkan tanda-tanda scam. Kami sudah hantar kepada ${esc(data.guardianName)} untuk disemak. Jangan buka pautan ini sementara menunggu.</p>
      <div class="lock-alert"><span>${icons.warning}</span><div><strong>Pautan mencurigakan</strong><small>${esc(a.domain)}${where}</small></div></div>
      ${tipsMarkup(a)}
      <div class="lock-countdown"><div class="countdown-label">Menunggu jawapan anak</div><div class="countdown-number" data-countdown="${esc(a.expiresAt)}">${clock(remaining(a.expiresAt))}</div><div class="progress-track"><div class="progress-bar" data-progress="${esc(a.expiresAt)}" data-start="${esc(a.createdAt)}"></div></div><p>Jika ${esc(data.guardianName)} tidak menjawab dalam ${esc(durationText(data.timeoutSeconds))}, kami akan tunjukkan apa yang perlu dibuat.</p></div>
      ${callAnak ? `<div class="lock-actions">${callAnak}</div>` : ''}
      <p class="lock-footnote">Skrin perlindungan ini hanya menutup Family Guard, bukan aplikasi lain dalam telefon anda.</p></div>
    </div>`;
  }
  return `<div class="lock-screen lock-escalated" role="alertdialog" aria-modal="true" aria-labelledby="lock-title">
    <div class="lock-glow lock-glow-one"></div><div class="lock-glow lock-glow-two"></div>
    <div class="lock-inner"><div class="lock-logo">${icons.shield}<span>familyguard.</span></div>
    <span class="lock-icon">${icons.ban}</span>
    <div class="lock-topline">ANAK ANDA BELUM MENJAWAB</div>
    <h2 id="lock-title">Jangan buka pautan ini.</h2>
    <p class="lock-desc">${esc(data.guardianName)} belum menjawab dalam ${esc(durationText(data.timeoutSeconds))}. Hubungi ${esc(data.guardianName)} atau ahli keluarga lain untuk bertanya dahulu.</p>
    <div class="lock-alert"><span>${icons.warning}</span><div><strong>Pautan mencurigakan</strong><small>${esc(a.displayUrl || a.domain)}${where}</small></div></div>
    ${tipsMarkup(a)}
    <div class="lock-actions">${callAnak}<button type="button" class="lock-btn danger" data-action="block-myself">${icons.trash} Saya tidak akan buka. Sekat pautan ini.</button></div>
    <div class="lock-report"><strong>Sudah beri maklumat bank, OTP atau pindah wang?</strong>
      <p>Hubungi bank anda dan Pusat Respons Scam Kebangsaan (NSRC) 997 dengan segera.</p>
      <div class="lock-report-actions"><a class="lock-action urgent" href="tel:997">${icons.phone} Hubungi 997 sekarang</a></div></div>
    <p class="lock-footnote">Hanya ${esc(data.guardianName)} boleh membenarkan pautan ini dibuka. Panggilan hanya dibuat apabila anda menekan butang.</p></div>
  </div>`;
}

/* ---------- Anak (guardian) view ---------- */
function decidedByText(item) {
  if (item.decidedBy === 'IBU_BAPA') return ' (oleh ibu/bapa)';
  return item.decidedBy === 'NSRC_997' ? ' (melalui 997)' : ''; // older records
}
function incidentMarkup(a) {
  if (!a) return `<div class="no-alert"><span>${icons.shield}</span><h3>Semua selamat. Tiada amaran aktif.</h3><p>Apabila ${esc(data.seniorName)} menekan pautan mencurigakan, ia akan muncul di sini dan anda boleh terus membuat keputusan.</p><div class="calm-line"><span class="status-circle"></span> Sedang memantau</div></div>`;
  const isLate = a.status === 'ESCALATED';
  const found = a.messageId ? findMessage(a.messageId) : null;
  return `<div class="alert-head"><span class="risk-icon">${icons.warning}</span><div><span class="alert-kicker">${isLate ? 'MASA TAMAT · IBU/BAPA MASIH MENUNGGU' : 'TINDAKAN DIPERLUKAN · PAUTAN DITEKAN'}</span><h3>${isLate ? 'Masa menjawab telah tamat' : 'Sahkan pautan ini: scam atau tidak?'}</h3><p>${a.source ? `${esc(data.seniorName)} menekan pautan dalam mesej daripada <strong>${esc(a.source)}</strong>.` : `${esc(data.seniorName)} menyemak pautan ini.`} Semakan asas menemui tanda-tanda bahaya.</p></div><span class="risk-tag">RISIKO ${a.risk === 'HIGH' ? 'TINGGI' : 'SEDERHANA'}</span></div>
    ${found ? `<div class="msg-quote"><small>MESEJ YANG DITERIMA</small><p>${esc(found.message.text)}</p></div>` : ''}
    <div class="alert-info"><div><small>PAUTAN</small><strong title="${esc(a.displayUrl)}">${esc(a.domain)}</strong></div><div><small>DITEKAN PADA</small><strong>${fmtTime(a.createdAt)}</strong></div><div><small>IBU/BAPA</small><strong>${esc(data.seniorName)}</strong></div></div>
    <div class="flag-box"><strong>${icons.eye} Kenapa pautan ini ditanda</strong><ul>${a.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>${a.simulated ? `<p class="sim-note">Amaran ini dicipta oleh mod demo.</p>` : ''}</div>
    <div class="guardian-time"><div><strong>${isLate ? 'Ibu/bapa dinasihatkan jangan buka pautan ini' : 'Masa untuk menjawab'}</strong><p>${isLate ? 'Anda masih boleh membuat keputusan sekarang.' : 'Skrin ibu/bapa anda berhenti sehingga anda membuat keputusan.'}</p></div><span class="timer-value" data-countdown="${esc(a.expiresAt)}">${isLate ? '00:00' : clock(remaining(a.expiresAt))}</span></div>
    <div class="decision-actions"><button class="btn btn-safe" data-action="resolve" data-decision="SAFE">${icons.check} Selamat, benarkan</button><button class="btn btn-danger" data-action="resolve" data-decision="BLOCKED">${icons.trash} Scam, padam mesej</button></div>
    <div class="decision-tip">Pilih "Selamat" hanya selepas anda sahkan alamat rasmi laman tersebut. Pilih "Scam" untuk memadam mesej itu dari WhatsApp ibu/bapa anda.</div>`;
}
function historyStatus(item) {
  if (item.status === 'RESOLVED') return item.decision === 'SAFE' ? `Selamat${decidedByText(item)}` : `Scam, dipadam${decidedByText(item)}`;
  return item.status === 'WAITING' ? 'Perlu disemak' : 'Masa tamat';
}
function guardianMarkup() {
  const a = data.active;
  const stats = data.stats;
  const recent = data.history ?? [];
  const day = new Date().toLocaleDateString('ms-MY', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const rows = recent.length ? recent.map(item => `<tr><td><span class="table-domain">${icons.link} ${esc(item.domain)}</span>${item.source ? `<small class="table-source">${esc(item.source)}</small>` : ''}${item.simulated ? '<span class="mini-demo">DEMO</span>' : ''}</td><td>${fmtTime(item.createdAt)}</td><td><span class="table-status ${esc(item.status.toLowerCase())}">${esc(historyStatus(item))}</span></td><td><span class="table-risk">${item.risk === 'HIGH' ? 'TINGGI' : 'SEDERHANA'}</span></td></tr>`).join('') : '<tr><td colspan="4" class="empty-row">Belum ada amaran. Cuba tekan pautan dalam telefon demo ibu/bapa.</td></tr>';
  return `<section class="guardian-dashboard"><div class="dashboard-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span> GAMBARAN KESELAMATAN KELUARGA</div><h1>Papan pemuka anak <span class="tiny-spark">✳</span></h1><p>Ketenangan fikiran, di satu tempat. <span class="muted">${esc(day)}</span></p></div><div class="live-chip"><span class="status-circle"></span><span class="realtime-indicator">${connected ? 'Bersambung secara langsung' : 'Menyambung semula…'}</span></div></div>
    <div class="stat-grid"><div class="stat-card"><span class="stat-icon mint">${icons.shield}</span><span class="stat-title">Ahli keluarga dipantau</span><strong>01</strong><small>${esc(data.seniorName)}</small></div><div class="stat-card"><span class="stat-icon violet">${icons.link}</span><span class="stat-title">Pautan ditanda</span><strong>${stats.scannedThreats}</strong><small>Jumlah amaran dalam demo</small></div><div class="stat-card"><span class="stat-icon blue">${icons.check}</span><span class="stat-title">Amaran selesai</span><strong>${stats.resolved}</strong><small>Telah diputuskan</small></div><div class="stat-card"><span class="stat-icon coral">${icons.bell}</span><span class="stat-title">Masa tamat</span><strong>${stats.escalated}</strong><small>Masa menjawab tamat</small></div></div>
    <div class="dashboard-main-grid"><section class="incident-card"><div class="panel-heading"><div><h2>Pemantauan pautan</h2><p>Sahkan pautan yang ditekan oleh ibu/bapa anda.</p></div><span class="monitoring-pill"><span class="pulse-dot"></span> ${a ? 'Amaran aktif' : 'Memantau'}</span></div>${incidentMarkup(a)}</section>
    <aside class="guardian-aside"><div class="family-card"><div class="family-top"><span>${icons.heart}</span><span class="online-status"><span></span> Berdaftar</span></div><h3>Keluarga anda</h3><p>Seorang dalam jagaan anda.</p><div class="family-member"><span class="avatar">${esc((data.seniorName || 'I').trim().charAt(0).toUpperCase())}</span><div><strong>${esc(data.seniorName)}</strong><small>Ibu/bapa · Dilindungi</small></div></div><div class="family-divider"></div><div class="family-meta"><span>Anak</span><strong>${esc(data.guardianName)}</strong></div><div class="family-meta"><span>Status SMS</span><strong>${data.smsEnabled ? 'Dikonfigurasi' : 'Demo sahaja'}</strong></div><div class="family-meta"><span>Mesej scam dipadam</span><strong>${(data.deletedMessages || []).length}</strong></div><button type="button" class="btn btn-outline btn-full" data-action="reset-demo">${icons.refresh} Pulihkan mesej demo</button></div>
    <div class="help-card"><span class="help-symbol">${icons.phone}</span><h3>Tahu apa perlu dibuat.</h3><p>Jika scam sudah melibatkan wang, hubungi bank dan NSRC 997 dengan segera.</p><a href="tel:997" class="help-call">Hubungi NSRC 997 ${icons.arrow}</a><small>Laman web tidak boleh membuat panggilan secara automatik.</small></div></aside></div>
    <section class="history-card"><div class="panel-heading"><div><h2>Aktiviti terkini</h2><p>Rekod pautan yang ditanda dan keputusan yang dibuat.</p></div><span class="history-counter">${recent.length} rekod</span></div><div class="table-wrap"><table><thead><tr><th>LAMAN WEB</th><th>TARIKH & MASA</th><th>STATUS</th><th>RISIKO</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <div class="disclaimer guardian-disclaimer"><strong>Had prototaip:</strong> Sesi laman web tempatan sahaja. Laman web tidak boleh membaca atau memadam mesej WhatsApp sebenar, mengunci telefon, atau menghubungi 997 secara automatik. Penyemak menggunakan heuristik, bukan maklumat ancaman yang disahkan.</div></section>`;
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
      notify('Pautan ini dihantar kepada anak anda untuk disemak.', 'warn');
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
  if (type === 'logout') return logout();
  if (type === 'open-chat') { openChatId = action.dataset.chat; sheet = null; render(); document.querySelector('.wa-back')?.focus(); return; }
  if (type === 'close-chat') { openChatId = null; sheet = null; render(); return; }
  if (type === 'dismiss-sheet') { sheet = null; render(); return; }
  if (type === 'tap-link') {
    const found = findMessage(action.dataset.msg);
    if (!found || isDeleted(found.message.id)) return;
    return checkLink(found.message.url, { messageId: found.message.id, source: `${found.chat.name} (WhatsApp)` });
  }
  if (type === 'reset-demo') {
    if (!confirm('Pulihkan semua mesej demo yang telah dipadam?')) return;
    try {
      await api('/api/demo/reset', { method: 'POST' });
      sheet = null;
      data = await api('/api/state');
      render();
      notify('Mesej demo telah dipulihkan.', 'success');
    } catch (err) { notify(err.message, 'warn'); }
    return;
  }
  if (type === 'block-myself') {
    const id = data?.active?.id;
    if (!id) return;
    if (!confirm('Sekat pautan ini? Ia tidak akan dibuka dan mesej itu akan dipadam.')) return;
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
    if (decision === 'SAFE' && !confirm('Adakah anda sudah sahkan pautan ini sah dan selamat?')) return;
    if (decision === 'BLOCKED' && !confirm('Tandakan sebagai scam dan padam mesej ini dari WhatsApp ibu/bapa anda?')) return;
    action.disabled = true;
    try {
      await api(`/api/incidents/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify({ decision }) });
      data = await api('/api/state');
      render();
      notify(decision === 'SAFE' ? 'Pautan disahkan selamat. Skrin ibu/bapa dibuka semula.' : 'Scam disahkan. Mesej dipadam dan skrin ibu/bapa dibuka semula.', 'success');
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
    await checkLink(value, { source: 'Semakan manual' });
  }
});

render();
if (session) refresh();
