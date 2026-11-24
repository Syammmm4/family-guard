import { isIP } from 'node:net';

// Heuristics only: this is NOT a reputation service or a malware scanner.
// Scores are designed to make a scam-awareness prototype easy to demonstrate.
// Every message is given in Bahasa Malaysia (default) and English, because both are stored on
// the incident: ibu/bapa and anak may be using different languages.
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

/** An input error with a message in both languages. `message` is BM, `en` is English. */
export class LinkError extends Error {
  constructor(ms, en) {
    super(ms);
    this.en = en;
  }
}

function isSameOrSubdomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function checkUrl(input, { simulate = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw new LinkError('Sila tampal pautan laman web.', 'Please paste a website link.');
  if (input.length > 2048) throw new LinkError('Pautan ini terlalu panjang.', 'This link is too long.');
  const raw = input.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new LinkError('Pautan ini bukan alamat laman web yang sah.', 'This link is not a valid website address.');
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new LinkError('Hanya pautan https:// dan http:// boleh disemak.', 'Only https:// and http:// links can be checked.');
  }
  if (!url.hostname || url.hostname === 'localhost') {
    throw new LinkError('Sila masukkan pautan laman web awam.', 'Please enter a public website link.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const reasons = [];
  // Simple, plain-language tips for the parent, with a priority (lower number is shown first).
  const tips = [];
  let score = 0;
  function mark(points, reason, tip, priority) {
    score += points;
    reasons.push(reason);
    if (tip && !tips.some(t => t.ms === tip.ms)) tips.push({ ...tip, priority });
  }

  if (url.protocol !== 'https:') {
    mark(20,
      { ms: 'Pautan ini tidak menggunakan penyulitan HTTPS.', en: 'This link does not use HTTPS encryption.' },
      { ms: 'Laman ini tidak menggunakan sambungan selamat.', en: 'This site does not use a secure connection.' }, 6);
  }
  if (isIP(host)) {
    mark(35,
      { ms: 'Alamat ini menggunakan nombor IP, bukan nama domain yang dikenali.', en: 'The address uses a numeric IP instead of a recognisable domain name.' },
      { ms: 'Alamat laman ini pelik, cuma nombor sahaja.', en: 'This address looks strange: it is only numbers.' }, 4);
  }
  if (host.includes('xn--')) {
    mark(35,
      { ms: 'Alamat ini menggunakan aksara khas yang boleh menyamar nama sebenar.', en: 'The address uses special characters that can disguise the real name.' },
      { ms: 'Nama laman ini menyamar seperti laman lain.', en: 'This site is pretending to be another site.' }, 2);
  }
  if (url.username || url.password || raw.includes('@')) {
    mark(35,
      { ms: 'Pautan ini mengandungi tanda @ atau maklumat log masuk yang boleh menyembunyikan destinasi sebenar.', en: 'The link contains an @ sign or login details, which can hide the real destination.' },
      { ms: 'Pautan ini menyembunyikan laman sebenar.', en: 'This link hides the real website.' }, 4);
  }
  if (SHORTENERS.has(host)) {
    mark(30,
      { ms: 'Ini pautan pendek; destinasi sebenar disembunyikan.', en: 'This is a shortened link; the real destination is hidden.' },
      { ms: 'Pautan ini menyembunyikan laman sebenar.', en: 'This link hides the real website.' }, 4);
  }
  if (host.split('.').length >= 5) {
    mark(15,
      { ms: 'Alamat ini mempunyai terlalu banyak subdomain.', en: 'The address has an unusually long chain of subdomains.' },
      { ms: 'Alamat laman ini panjang dan pelik.', en: 'This address is long and strange.' }, 7);
  }

  const hostParts = host.split('.');
  const tld = hostParts.at(-1);
  if (RISKY_TLDS.has(tld)) {
    mark(12,
      { ms: 'Domain ini menggunakan sambungan yang kerap disalah guna (bukan bukti penipuan).', en: 'The domain uses an ending that is often abused (this is not proof of fraud).' },
      { ms: 'Laman jenis ini kerap digunakan oleh penipu.', en: 'Scammers often use this kind of site.' }, 8);
  }
  if (/login|verify|urgent|claim|prize|reward|secure|suspend|update|otp/i.test(host)) {
    mark(18,
      { ms: 'Nama laman web mengandungi perkataan desakan atau pengesahan akaun.', en: 'The website name contains urgent or account-verification words.' },
      { ms: 'Mesej ini cuba membuat anda tergesa-gesa.', en: 'This message is trying to rush you.' }, 5);
  }
  if (/\/(verify|otp|password|claim|reset|prize)(\/|$|\?|-)/i.test(url.pathname)) {
    mark(10,
      { ms: 'Pautan ini meminta pengesahan akaun atau tindakan sensitif.', en: 'The link asks for account verification or a sensitive action.' },
      { ms: 'Laman ini mungkin akan minta kod OTP, TAC atau kata laluan anda.', en: 'This site may ask for your OTP, TAC or password.' }, 3);
  }
  for (const brand of BRANDS) {
    if (host.includes(brand.word) && !brand.allowed.some(domain => isSameOrSubdomain(host, domain))) {
      const label = BRAND_LABELS[brand.word] || brand.word;
      mark(50,
        { ms: `Alamat ini menyebut ${brand.word} tetapi bukan domain rasmi yang disenaraikan.`, en: `The address mentions ${brand.word} but is not one of its listed official domains.` },
        { ms: `Ini bukan laman rasmi ${label}.`, en: `This is not the official ${label} website.` }, 1);
      break;
    }
  }
  if (simulate) {
    score = Math.max(score, 100);
    reasons.unshift({ ms: 'Mod demo: amaran scam disimulasikan untuk pembentangan.', en: 'Demo mode: a scam alert was simulated for the presentation.' });
  }
  score = Math.min(score, 100);
  const risk = score >= 60 ? 'HIGH' : score >= 30 ? 'SUSPICIOUS' : 'LOW';
  const finalReasons = reasons.length ? reasons : [{ ms: 'Semakan asas ini tidak menemui tanda scam yang jelas.', en: 'This basic check found no obvious scam signs.' }];
  // Up to 2 plain-language tips for the parent, most important first.
  const topTips = tips.sort((a, b) => a.priority - b.priority).slice(0, 2);
  return {
    risk,
    score,
    // Deliberately discard query parameters and fragments to avoid recording tokens / private data.
    displayUrl: `${url.protocol}//${url.host}${url.pathname.slice(0, 100)}`,
    domain: host,
    reasons: finalReasons.map(r => r.ms),
    reasonsEn: finalReasons.map(r => r.en),
    tips: topTips.map(t => t.ms),
    tipsEn: topTips.map(t => t.en),
    simulated: Boolean(simulate)
  };
}
