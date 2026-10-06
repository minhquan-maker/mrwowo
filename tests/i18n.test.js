/*
 * mrwowo i18n tests — run with: node tests/i18n.test.js
 * Checks that EN and VI dictionaries match, that every key used in the code and HTML exists,
 * and that every engine message renders without leftover {placeholders} in both languages.
 */
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var D = require('../assets/js/data.js');
var E = require('../assets/js/engine.js');
var I = require('../assets/js/i18n.js');
I.bind(D, E);

var root = path.join(__dirname, '..');
var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (err) { failed++; console.log('  ✗ ' + name + '\n    ' + err.message); }
}
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function rules() { return JSON.parse(JSON.stringify(D.DEFAULT_RULES)); }

console.log('\ni18n');

test('EN and VI have the same keys', function () {
  var en = Object.keys(I.DICT.en), vi = Object.keys(I.DICT.vi);
  var missingVi = en.filter(function (k) { return !(k in I.DICT.vi); });
  var missingEn = vi.filter(function (k) { return !(k in I.DICT.en); });
  assert.deepEqual(missingVi, [], 'missing in VI: ' + missingVi.join(', '));
  assert.deepEqual(missingEn, [], 'missing in EN: ' + missingEn.join(', '));
});

test('EN and VI use the same {placeholders}', function () {
  Object.keys(I.DICT.en).forEach(function (k) {
    var a = (I.DICT.en[k].match(/\{\w+\}/g) || []).sort().join();
    var b = (I.DICT.vi[k].match(/\{\w+\}/g) || []).sort().join();
    assert.equal(a, b, k);
  });
});

test('every key used in HTML (data-i18n*) exists', function () {
  ['index.html', 'app.html'].forEach(function (f) {
    var html = read(f), re = /data-i18n(?:-html)?="([^"]+)"|data-i18n-attr="([^"]+)"/g, m;
    while ((m = re.exec(html))) {
      var keys = m[1] ? [m[1]] : m[2].split(';').map(function (p) { return p.split(':')[1].trim(); });
      keys.forEach(function (k) { assert.ok(k in I.DICT.en, f + ': ' + k); });
    }
  });
});

test('every static t(\'…\') key in JS exists', function () {
  ['assets/js/app.js', 'assets/js/landing.js'].forEach(function (f) {
    var js = read(f), re = /\bt\('([a-zA-Z0-9.\-]+)'/g, m;
    while ((m = re.exec(js))) {
      if (/[.\-]$/.test(m[1])) continue; // dynamic prefix, e.g. t('status.' + s) — covered below
      assert.ok(m[1] in I.DICT.en, f + ': ' + m[1]);
    }
  });
});

test('dynamic keys (page.*, status.*, zone.*, lt.*, doc.*, u.*, tour.*) exist', function () {
  var need = [];
  ['luat', 'lo-hang', 'duyet', 'kenh', 'bao-cao'].forEach(function (r) { need.push('page.' + r, 'page.' + r + '.sub'); });
  ['pending', 'approved', 'rejected'].forEach(function (s) { need.push('status.' + s, 'ap.tab.' + s); });
  ['approved', 'rejected'].forEach(function (s) { need.push('verb.' + s); });
  ['all', 'ok', 'watch', 'act', 'urgent', 'removed', 'expired'].forEach(function (z) { need.push('zone.' + z); });
  ['approve', 'reject', 'blocked', 'undo', 'rules', 'allocation', 'export', 'system'].forEach(function (x) { need.push('lt.' + x); });
  ['donation', 'return', 'disposal', 'transfer'].forEach(function (x) { need.push('doc.' + x); });
  ['sold', 'donated', 'returned', 'destroyed', 'stock'].forEach(function (x) { need.push('u.' + x); });
  ['sale', 'donate', 'return', 'destroy', 'transfer'].forEach(function (x) { need.push('ev.' + x); });
  ['floorPct', 'maxDiscountPct', 'perBuyerCap', 'showBrand', 'donationMinDays', 'handlingPerUnit', 'destroyCostPerUnit', 'liquidationPct', 'returnShipPerUnit', 'safetyKho', 'safetyLanh', 'regions', 'brand'].forEach(function (x) { need.push('rc.' + x); });
  for (var i = 1; i <= 7; i++) need.push('tour.' + i + '.t', 'tour.' + i + '.x');
  need.forEach(function (k) { assert.ok(k in I.DICT.en, k); });
});

test('every engine message renders fully in both languages (no leftover {…})', function () {
  var msgs = [];
  var variants = [rules(), Object.assign(rules(), { excludedRegions: ['hcm', 'hn', 'dn', 'mt', 'mb'] })];
  variants.forEach(function (r) {
    D.LOTS.forEach(function (l) {
      for (var d = l.daysLeft; d >= -1; d -= 3) msgs = msgs.concat(E.recommend(l, d, r).reasons);
      Object.keys(D.ACTIONS).forEach(function (a) {
        [0, 25].forEach(function (x) {
          E.guard(l, { action: a, extraCut: x, allocations: { minimart: 9999 } }, l.daysLeft, r).checks
            .forEach(function (c) { msgs.push(c.label, c.detail); });
        });
      });
    });
  });
  ['en', 'vi'].forEach(function (lang) {
    I.setLang(lang);
    msgs.forEach(function (m) {
      assert.ok(m.key in I.DICT.en, 'missing key: ' + m.key);
      var s = I.tm(m);
      assert.ok(!/\{\w+\}/.test(s), lang + ' ' + m.key + ' → ' + s);
      assert.ok(!/undefined|NaN|\[object/.test(s), lang + ' ' + m.key + ' → ' + s);
    });
  });
  I.setLang('en');
});

test('money / number formatting per language', function () {
  I.setLang('en');
  assert.equal(I.money(8500), '8,500 ₫');
  assert.equal(I.short(343800000), '343.8M ₫');
  I.setLang('vi');
  assert.equal(I.money(8500), '8.500 đ');
  assert.equal(I.short(343800000), '343,8 tr đ');
  assert.equal(I.short(-1250000), '−1,3 tr đ');
  I.setLang('en');
});

test('English is the default', function () {
  assert.equal(I.lang(), 'en');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
