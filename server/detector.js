import { isIP } from 'node:net';

// Heuristics only: this is NOT a reputation service or a malware scanner.
// Scores are designed to make a scam-awareness prototype easy to demonstrate.
// Messages are in Bahasa Malaysia because they are shown to the family in the UI.
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rebrand.ly', 'shorturl.at']);
const RISKY_TLDS = new Set(['zip', 'click', 'top', 'xyz', 'work', 'support']);
const BRANDS = [
  { word: 'maybank', allowed: ['maybank2u.com.my', 'maybank.com', 'maybank.com.my'] },
  { word: 'cimb', allowed: ['cimb.com', 'cimb.com.my', 'cimbclicks.com.my'] },
  { word: 'tng', allowed: ['tngdigital.com.my', 'touchngo.com.my'] },
  { word: 'paypal', allowed: ['paypal.com'] },
  { word: 'google', allowed: ['google.com', 'google.com.my'] },
  { word: 'microsoft', allowed: ['microsoft.com', 'live.com', 'office.com'] },
  { word: 'whatsapp', allowed: ['whatsapp.com', 'whatsapp.net'] }
];

// Brand names as the parent knows them, for the simple tips.
const BRAND_LABELS = { maybank: 'Maybank', cimb: 'CIMB', tng: "Touch 'n Go", paypal: 'PayPal', google: 'Google', microsoft: 'Microsoft', whatsapp: 'WhatsApp' };

function isSameOrSubdomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function checkUrl(input, { simulate = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Sila tampal pautan laman web.');
  if (input.length > 2048) throw new Error('Pautan ini terlalu panjang.');
  const raw = input.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Pautan ini bukan alamat laman web yang sah.');
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Hanya pautan https:// dan http:// boleh disemak.');
  }
  if (!url.hostname || url.hostname === 'localhost') {
    throw new Error('Sila masukkan pautan laman web awam.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const reasons = [];
  // Simple, plain-language tips for the parent, with a priority (lower number is shown first).
  const tips = [];
  let score = 0;
  function mark(points, message, tip, priority) {
    score += points;
    reasons.push(message);
    if (tip && !tips.some(t => t.text === tip)) tips.push({ text: tip, priority });
  }

  if (url.protocol !== 'https:') mark(20, 'Pautan ini tidak menggunakan penyulitan HTTPS.', 'Laman ini tidak menggunakan sambungan selamat.', 6);
  if (isIP(host)) mark(35, 'Alamat ini menggunakan nombor IP, bukan nama domain yang dikenali.', 'Alamat laman ini pelik, cuma nombor sahaja.', 4);
  if (host.includes('xn--')) mark(35, 'Alamat ini menggunakan aksara khas yang boleh menyamar nama sebenar.', 'Nama laman ini menyamar seperti laman lain.', 2);
  if (url.username || url.password || raw.includes('@')) mark(35, 'Pautan ini mengandungi tanda @ atau maklumat log masuk yang boleh menyembunyikan destinasi sebenar.', 'Pautan ini menyembunyikan laman sebenar.', 4);
  if (SHORTENERS.has(host)) mark(30, 'Ini pautan pendek; destinasi sebenar disembunyikan.', 'Pautan ini menyembunyikan laman sebenar.', 4);
  if (host.split('.').length >= 5) mark(15, 'Alamat ini mempunyai terlalu banyak subdomain.', 'Alamat laman ini panjang dan pelik.', 7);

  const hostParts = host.split('.');
  const tld = hostParts.at(-1);
  if (RISKY_TLDS.has(tld)) mark(12, 'Domain ini menggunakan sambungan yang kerap disalah guna (bukan bukti penipuan).', 'Laman jenis ini kerap digunakan oleh penipu.', 8);
  if (/login|verify|urgent|claim|prize|reward|secure|suspend|update|otp/i.test(host)) {
    mark(18, 'Nama laman web mengandungi perkataan desakan atau pengesahan akaun.', 'Mesej ini cuba membuat anda tergesa-gesa.', 5);
  }
  if (/\/(verify|otp|password|claim|reset|prize)(\/|$|\?|-)/i.test(url.pathname)) {
    mark(10, 'Pautan ini meminta pengesahan akaun atau tindakan sensitif.', 'Laman ini mungkin akan minta kod OTP, TAC atau kata laluan anda.', 3);
  }
  for (const brand of BRANDS) {
    if (host.includes(brand.word) && !brand.allowed.some(domain => isSameOrSubdomain(host, domain))) {
      const label = BRAND_LABELS[brand.word] || brand.word;
      mark(50, `Alamat ini menyebut ${brand.word} tetapi bukan domain rasmi yang disenaraikan.`, `Ini bukan laman rasmi ${label}.`, 1);
      break;
    }
  }
  if (simulate) {
    score = Math.max(score, 100);
    reasons.unshift('Mod demo: amaran scam disimulasikan untuk pembentangan.');
  }
  score = Math.min(score, 100);
  const risk = score >= 60 ? 'HIGH' : score >= 30 ? 'SUSPICIOUS' : 'LOW';
  return {
    risk,
    score,
    // Deliberately discard query parameters and fragments to avoid recording tokens / private data.
    displayUrl: `${url.protocol}//${url.host}${url.pathname.slice(0, 100)}`,
    domain: host,
    reasons: reasons.length ? reasons : ['Semakan asas ini tidak menemui tanda scam yang jelas.'],
    // Up to 2 plain-language tips for the parent, most important first.
    tips: tips.sort((a, b) => a.priority - b.priority).slice(0, 2).map(t => t.text),
    simulated: Boolean(simulate)
  };
}
