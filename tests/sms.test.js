import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier, validatePhone } from '../server/sms.js';

test('blank SMS configuration sends no external request', async () => {
  const notifier = createNotifier({});
  assert.equal(notifier.smsEnabled, false);
  assert.equal((await notifier.alertGuardian({ domain: 'example.org' })).sent, false);
  assert.equal((await notifier.alertBackup({ domain: 'example.org' })).sent, false);
});
test('short service codes cannot be family SMS recipients', () => {
  assert.equal(validatePhone('997'), '');
  assert.equal(validatePhone('+997'), '');
  assert.equal(validatePhone('+60123456789'), '+60123456789');
});
