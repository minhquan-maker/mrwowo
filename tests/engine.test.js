/*
 * mrwowo engine tests — run with: node tests/engine.test.js
 * No dependencies (node:assert).
 */
'use strict';

var assert = require('node:assert/strict');
var D = require('../assets/js/data.js');
var E = require('../assets/js/engine.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (err) { failed++; console.log('  ✗ ' + name + '\n    ' + err.message); }
}
function rules(patch) { return Object.assign(JSON.parse(JSON.stringify(D.DEFAULT_RULES)), patch || {}); }
function lot(id) { return E.lotById(id); }
function plan(l, r) {
  var rec = E.recommend(l, l.daysLeft, r);
  return { action: rec.action, extraCut: 0, allocations: E.defaultAllocation(l, rec.action, r) };
}

/* Seeded pseudo-random generator so the test is repeatable. */
var seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function pick(lo, hi) { return Math.round(lo + rnd() * (hi - lo)); }

console.log('\nSample data');

test('dry, sealed, unexpired goods only; 12–15 lots', function () {
  assert.ok(D.LOTS.length >= 12 && D.LOTS.length <= 15);
  D.LOTS.forEach(function (l) {
    assert.equal(l.storage, 'kho', l.id + ' is not dry goods');
    assert.equal(l.sealed, true, l.id + ' is not sealed');
    assert.ok(l.daysLeft > 0, l.id + ' has expired');
  });
});

test('days left span ~25 → ~120, with lots just past the safety line', function () {
  var days = D.LOTS.map(function (l) { return l.daysLeft; });
  assert.ok(Math.min.apply(null, days) <= 25 && Math.max.apply(null, days) >= 120);
  assert.ok(days.some(function (d) { return d <= 30 && d >= 27; }));
});

test('no commercial app named as a partner; the app channel is labelled illustrative', function () {
  var text = JSON.stringify(D.CHANNELS).toLowerCase();
  ['momo', 'shopee', 'tiktok', 'grab', 'lazada'].forEach(function (n) { assert.ok(text.indexOf(n) === -1, 'mentions ' + n); });
  var p = E.channelById('partner').label;
  assert.ok(/illustrative/.test(p.en) && /minh họa/.test(p.vi));
});

test('no "first in Vietnam" / "the only" / "up to 70% off" claims (EN or VI)', function () {
  var I = require('../assets/js/i18n.js');
  var text = (JSON.stringify(D) + JSON.stringify(I.DICT)).toLowerCase();
  ['đầu tiên ở việt nam', 'duy nhất', 'first in vietnam', 'the only', 'giảm đến 70%', 'up to 70% off'].forEach(function (w) {
    assert.ok(text.indexOf(w) === -1, 'contains "' + w + '"');
  });
});

console.log('\nPrice');

test('price step: L01 at 52 days → 8,500 (30% off, 500 rounding)', function () {
  assert.equal(E.priceAt(lot('L01'), 52, rules()).price, 8500);
});

test('more than 90 days left → list price held', function () {
  assert.equal(E.priceAt(lot('L07'), 120, rules()).price, lot('L07').base);
});

test('price always within [lowest allowed, list] for random rules, channels and manual cuts', function () {
  for (var i = 0; i < 4000; i++) {
    var r = rules({ floorPct: pick(20, 90), maxDiscountPct: pick(0, 80) });
    var l = D.LOTS[pick(0, D.LOTS.length - 1)];
    var ch = [null, 'minimart', 'zalo', 'partner'][pick(0, 3)];
    var p = E.priceAt(l, pick(0, 150), r, { extraCut: pick(0, 60), channel: ch });
    assert.ok(p.price <= l.base, 'above list price');
    assert.ok(p.price >= l.base * r.floorPct / 100 - 1e-9, 'below floor ' + JSON.stringify({ id: l.id, r: r.floorPct, p: p.price }));
    assert.ok(p.price >= l.base * (1 - r.maxDiscountPct / 100) - 1e-9, 'beyond discount cap');
  }
});

test('price never rises as days left fall (monotonic)', function () {
  D.LOTS.forEach(function (l) {
    var prev = Infinity;
    for (var d = l.daysLeft; d >= 0; d--) {
      var p = E.priceAt(l, d, rules()).price;
      assert.ok(p <= prev, l.id + ' price rose at ' + d);
      prev = p;
    }
  });
});

test('floor rounds UP to 500 (never below the true floor)', function () {
  var m = E.minPrice(12345, rules({ floorPct: 61, maxDiscountPct: 80 }));
  assert.ok(m.price >= 12345 * 0.61 && m.price % 500 === 0);
});

console.log('\nRecommendations & rules');

test('sample lots cover all 8 actions', function () {
  var seen = {};
  D.LOTS.forEach(function (l) { seen[E.recommend(l, l.daysLeft, rules()).action] = true; });
  Object.keys(D.ACTIONS).forEach(function (a) { assert.ok(seen[a], 'missing ' + a); });
});

test('lots at/below the safety line can only be returned, donated or disposed', function () {
  D.LOTS.forEach(function (l) {
    for (var d = 1; d <= 30; d++) {
      var a = E.recommend(l, d, rules()).action;
      assert.ok(E.POST_SAFETY.indexOf(a) !== -1, l.id + ' @' + d + ' → ' + a);
    }
  });
});

test('guard blocks a manual cut below the floor', function () {
  var l = lot('L06');
  var g = E.guard(l, { action: 'giam_gia', extraCut: 20 }, l.daysLeft, rules());
  assert.equal(g.ok, false);
  assert.ok(g.failed.some(function (c) { return c.id === 'floor'; }));
});

test('guard blocks selling a lot past the safety line', function () {
  var l = lot('L04');
  var g = E.guard(l, { action: 'giam_gia', extraCut: 0 }, l.daysLeft, rules());
  assert.equal(g.ok, false);
  assert.ok(g.failed.some(function (c) { return c.id === 'safety'; }));
});

test('guard blocks allocation to a channel in excluded regions', function () {
  var l = lot('L01'), r = rules({ excludedRegions: ['hcm', 'mt'] });
  var alloc = { minimart: 100, zalo: 0, partner: 0, charity: 0 };
  var g = E.guard(l, { action: 'giam_gia', extraCut: 0, allocations: alloc }, l.daysLeft, r);
  assert.ok(g.failed.some(function (c) { return c.id === 'regions'; }));
});

test('every default proposal passes the default rules', function () {
  D.LOTS.forEach(function (l) {
    var g = E.guard(l, plan(l, rules()), l.daysLeft, rules());
    assert.ok(g.ok, l.id + ': ' + g.failed.map(function (c) { return c.id; }).join(','));
  });
});

test('CO2e is always labelled as an estimate', function () {
  var I = require('../assets/js/i18n.js');
  ['en', 'vi'].forEach(function (lang) {
    Object.keys(I.DICT[lang]).forEach(function (k) {
      var v = I.DICT[lang][k];
      if (!/CO2e/.test(v) || k === 'rp.co2') return; // rp.co2 is a label; rp.co2Sub carries "estimate"
      assert.ok(/estimat|ước tính/i.test(v), lang + ':' + k + ' → ' + v);
    });
  });
  assert.ok(/estimat/i.test(I.DICT.en['rp.co2Sub']) && /ước tính/i.test(I.DICT.vi['rp.co2Sub']));
});

test('brand visibility per channel', function () {
  var r = rules();
  assert.equal(E.brandVisible('zalo', r), false);
  assert.equal(E.brandVisible('minimart', r), true);
  assert.equal(E.brandVisible('zalo', rules({ brandByChannel: {} })), true);
});

console.log('\nSimulation & lot record');

test('unit conservation: sold + donated + returned + disposed + stock = starting stock', function () {
  D.LOTS.forEach(function (l) {
    [0, 10, 30, Infinity].forEach(function (until) {
      var s = E.simulateLot(l, plan(l, rules()), rules(), { until: until });
      var u = s.units;
      assert.equal(u.sold + u.donated + u.returned + u.destroyed + u.stock, l.qty, l.id + ' @' + until);
    });
  });
});

test('projection to end of lot leaves no stock', function () {
  D.LOTS.forEach(function (l) {
    assert.equal(E.simulateLot(l, plan(l, rules()), rules(), {}).units.stock, 0, l.id);
  });
});

test('no sale at/below the safety line, and none below the floor', function () {
  D.LOTS.forEach(function (l) {
    var r = rules(), s = E.simulateLot(l, plan(l, r), r, {});
    var min = E.minPrice(l.base, r).price;
    s.events.filter(function (e) { return e.kind === 'sale'; }).forEach(function (e) {
      assert.ok(l.daysLeft - e.day > E.safetyDays(l, r), l.id + ' sold on day ' + e.day);
      assert.ok(e.price >= min && e.price <= l.base, l.id + ' price ' + e.price);
    });
  });
});

test('net recovery = revenue + refund − costs', function () {
  D.LOTS.forEach(function (l) {
    var m = E.simulateLot(l, plan(l, rules()), rules(), {}).money;
    var calc = m.revenue + m.refund - m.fees - m.shipping - m.handling - m.transfer - m.destroy;
    assert.ok(Math.abs(calc - m.net) < 1e-6, l.id);
  });
});

test('baseline: disposal is negative, liquidation is positive', function () {
  assert.ok(E.baseline(lot('L15'), rules()).net < 0);
  assert.ok(E.baseline(lot('L01'), rules()).net > 0);
});

test('portfolio: approving every proposal beats current practice', function () {
  var net = 0, base = 0;
  D.LOTS.forEach(function (l) {
    net += E.simulateLot(l, plan(l, rules()), rules(), {}).money.net;
    base += E.baseline(l, rules()).net;
  });
  assert.ok(net > base, net + ' ≤ ' + base);
});

test('unified ledger: entry ids are unique and all post to one lot', function () {
  var l = lot('L01'), s = E.simulateLot(l, plan(l, rules()), rules(), {});
  var rows = E.ledger(l, s);
  var ids = rows.map(function (r) { return r.id; });
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(function (id) { return id.indexOf('-' + l.id + '-') !== -1; }));
});

test('allocation total ignores helper keys; guard blocks over-allocation', function () {
  var l = lot('L01');
  var alloc = { minimart: 0, zalo: 900, partner: 1680, charity: 0, __action: 'bundle' };
  assert.equal(E.allocTotal(alloc), 2580);
  var g = E.guard(l, { action: 'bundle', extraCut: 0, allocations: alloc }, l.daysLeft, rules());
  assert.ok(g.failed.some(function (c) { return c.id === 'alloc'; }));
});

test('an excluded channel produces no sales', function () {
  var l = lot('L01'), r = rules({ excludedRegions: ['hcm', 'mt'] });
  var alloc = { minimart: 1000, zalo: 700, partner: 700, charity: 0 };
  var s = E.simulateLot(l, { action: 'giam_gia', allocations: alloc }, r, {});
  assert.equal(s.byChannel.minimart.units, 0);
});

console.log('\nShop channel & real orders');

function shopPlan(l, r, orders) {
  var a = 'giam_gia';
  return { action: a, allocations: E.defaultAllocation(l, a, r), orders: orders || [] };
}

test('the shop channel gets a share of every sale allocation', function () {
  var l = lot('L01'), a = E.defaultAllocation(l, 'giam_gia', rules());
  assert.ok(a.shop > 0, 'shop allocation ' + a.shop);
  assert.ok(E.allocTotal(a) <= l.qty);
});

test('a real order is booked on its day, at its price, and shows in the ledger', function () {
  var l = lot('L01'), r = rules();
  var price = E.priceAt(l, l.daysLeft - 3, r, { channel: 'shop' }).price;
  var p = shopPlan(l, r, [{ id: 'MW-1001', day: 3, channel: 'shop', units: 4, price: price }]);
  var s = E.simulateLot(l, p, r, {});
  var ev = s.events.filter(function (e) { return e.orderId === 'MW-1001'; });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].day, 3);
  assert.equal(ev[0].units, 4);
  assert.equal(ev[0].price, price);
  assert.ok(E.ledger(l, s).some(function (row) { return row.orderId === 'MW-1001' && row.id.indexOf('SH-') === 0; }));
});

test('storefront: listed within the shop allocation, priced at or above the floor', function () {
  var l = lot('L01'), r = rules(), p = shopPlan(l, r);
  var floor = E.minPrice(l.base, r).price;
  for (var d = 0; d <= 60; d += 4) {
    var o = E.storefront(l, p, r, d, 'shop');
    if (!o.listed) continue;
    assert.ok(o.price >= floor && o.price <= l.base, 'day ' + d + ' price ' + o.price);
    assert.ok(o.available <= p.allocations.shop);
    if (o.next) assert.ok(o.next.price < o.price && o.next.price >= floor);
  }
});

test('storefront: delisted at the safety line and for non-sale actions', function () {
  var l = lot('L01'), r = rules(), p = shopPlan(l, r);
  var atLine = l.daysLeft - E.safetyDays(l, r);
  assert.equal(E.storefront(l, p, r, atLine, 'shop').reason, 'removed');
  assert.equal(E.storefront(l, { action: 'quyen_gop', allocations: { charity: l.qty } }, r, 0, 'shop').reason, 'notSale');
});

test('storefront: an order reduces what is available and is never double-booked', function () {
  var l = lot('L01'), r = rules();
  var before = E.storefront(l, shopPlan(l, r), r, 2, 'shop').available;
  var price = E.storefront(l, shopPlan(l, r), r, 2, 'shop').price;
  var p = shopPlan(l, r, [{ id: 'MW-1', day: 2, channel: 'shop', units: 5, price: price }]);
  assert.equal(E.storefront(l, p, r, 2, 'shop').available, before - 5);
  var s = E.simulateLot(l, p, r, {});
  assert.equal(s.units.sold + s.units.donated + s.units.returned + s.units.destroyed + s.units.stock, l.qty);
});

test('units promised to a later order are not sold to simulated demand first', function () {
  var l = lot('L01'), r = rules();
  var p0 = shopPlan(l, r);
  var cap = p0.allocations.shop;
  var price = E.priceAt(l, l.daysLeft - 10, r, { channel: 'shop' }).price;
  var p = shopPlan(l, r, [{ id: 'MW-9', day: 10, channel: 'shop', units: cap, price: price }]);
  var s = E.simulateLot(l, p, r, {});
  var booked = s.events.filter(function (e) { return e.orderId === 'MW-9'; }).reduce(function (n, e) { return n + e.units; }, 0);
  assert.equal(booked, cap);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
