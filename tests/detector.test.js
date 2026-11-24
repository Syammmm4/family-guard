import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUrl } from '../server/detector.js';

test('recognizable HTTPS host has no obvious indicators', () => {
  const x = checkUrl('https://www.google.com');
  assert.equal(x.risk, 'LOW');
  assert.equal(x.score, 0);
});

test('lookalike banking link triggers high-risk warning', () => {
  const x = checkUrl('https://maybank-secure-verification.example/verify');
  assert.equal(x.risk, 'HIGH');
  assert.ok(x.reasons.some(r => r.includes('maybank')));
});

test('queries containing private data are not saved', () => {
  const x = checkUrl('https://example.org/test?token=private123#secret');
  assert.ok(!x.displayUrl.includes('private123'));
  assert.ok(!x.displayUrl.includes('secret'));
});

test('demo simulation clearly marked and flagged', () => {
  const x = checkUrl('https://example.org', { simulate: true });
  assert.equal(x.risk, 'HIGH');
  assert.equal(x.simulated, true);
});

test('rejects inappropriate URL schemes', () => {
  assert.throws(() => checkUrl('javascript://alert(1)'));
});

test('lookalike bank link gives the parent at most 2 simple tips, brand first', () => {
  const x = checkUrl('https://maybank-secure-verification.example/verify');
  assert.ok(x.tips.length >= 1 && x.tips.length <= 2);
  assert.equal(x.tips[0], 'Ini bukan laman rasmi Maybank.');
});

test('genuine site has no tips', () => {
  assert.deepEqual(checkUrl('https://www.maybank2u.com.my').tips, []);
});

test('every reason and tip also has an English version', () => {
  const x = checkUrl('http://maybank-secure-verification.top/verify');
  assert.equal(x.reasonsEn.length, x.reasons.length);
  assert.equal(x.tipsEn.length, x.tips.length);
  assert.equal(x.tipsEn[0], 'This is not the official Maybank website.');
  assert.ok(x.reasonsEn.every(r => typeof r === 'string' && r.length > 0));
});

test('input errors carry an English message', () => {
  assert.throws(() => checkUrl('javascript://alert(1)'), err => err.en === 'Only https:// and http:// links can be checked.');
});
