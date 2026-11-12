/** Optional outbound SMS to consenting family contacts; never sends to emergency services. */
export function createNotifier(env) {
  const enabled = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
  const guardianPhone = validatePhone(env.GUARDIAN_PHONE);
  const backupPhone = validatePhone(env.BACKUP_GUARDIAN_PHONE);

  async function sms(to, message) {
    if (!to || !enabled) return { sent: false, reason: 'SMS integration not configured' };
    try {
      const body = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: message });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        },
        body,
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`Twilio returned HTTP ${response.status}`);
      return { sent: true };
    } catch (err) {
      console.error('Family SMS failed:', err.message);
      return { sent: false, reason: err.message };
    }
  }

  function alertGuardian(incident) {
    return sms(guardianPhone,
      `Family Guard: Ibu/bapa anda menekan pautan mencurigakan (${incident.domain}). Buka papan pemuka anak untuk sahkan dalam masa 3 minit.`);
  }

  function alertBackup(incident) {
    return sms(backupPhone,
      `Family Guard: Amaran untuk ${incident.domain} belum dijawab. Sila hubungi ibu/bapa anda segera. Jika wang telah dipindahkan, hubungi bank dan NSRC 997.`);
  }

  return { alertGuardian, alertBackup, guardianPhone, backupPhone, smsEnabled: enabled };
}

export function validatePhone(value = '') {
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : '';
}