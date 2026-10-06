/*
 * mrwowo — business engine (pure functions, no DOM, no language).
 *
 *  priceAt()      price step by days left, clamped between the floor and list price
 *  recommend()    proposed action for a lot + structured reasons
 *  guard()        checks a proposal/decision against the owner's rules
 *  simulateLot()  day-by-day sell / donate / return / dispose → the lot record
 *  baseline()     what the owner's current practice would recover (comparison)
 *
 * Human-readable text is NOT produced here. Reasons and checks are returned as
 * { key, vars } messages that the UI translates (see i18n.js), so the engine is
 * language-neutral and fully testable in Node.
 */
(function (root, factory) {
  var data = (typeof module === 'object' && module.exports)
    ? require('./data.js')
    : root.Mrwowo && root.Mrwowo.data;
  var api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Mrwowo = root.Mrwowo || {}).engine = api;
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var ELASTICITY = 2.5;   // every 10% off → +25% sell-through (estimate)
  var EXEC_DAYS = 2;      // processing days for donate / return / dispose
  var POST_SAFETY = ['tra_ncc', 'quyen_gop', 'huy'];

  /* ---------- helpers ---------- */

  function msg(key, vars) { return { key: key, vars: vars || {} }; }
  function ceil500(n) { return Math.ceil(n / 500) * 500; }
  function round500(n) { return Math.round(n / 500) * 500; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function channelById(id) { return find(D.CHANNELS, id); }
  function lotById(id) { return find(D.LOTS, id); }
  function saleChannels() { return D.CHANNELS.filter(function (c) { return c.kind === 'sale'; }); }
  function isSale(action) { return !!D.ACTIONS[action] && D.ACTIONS[action].kind === 'sell'; }

  function safetyDays(lot, rules) {
    var s = rules.safetyDays || {};
    return s[lot.storage] != null ? s[lot.storage] : 30;
  }

  /* Colour zone by days left, relative to the safety line. */
  function zone(daysLeft, safety) {
    if (daysLeft <= 0) return 'expired';
    if (daysLeft <= safety) return 'removed';
    if (daysLeft <= safety + 15) return 'urgent';
    if (daysLeft <= safety + 30) return 'act';
    if (daysLeft <= safety + 60) return 'watch';
    return 'ok';
  }

  /* ---------- rules: channels, regions, brand ---------- */

  function channelAccess(channel, rules) {
    var excluded = rules.excludedRegions || [];
    var open = channel.regions.filter(function (r) { return excluded.indexOf(r) === -1; });
    var hidden = channel.regions.filter(function (r) { return excluded.indexOf(r) !== -1; });
    return { blocked: open.length === 0, openRegions: open, hiddenRegions: hidden };
  }

  function brandVisible(channelId, rules) {
    var o = rules.brandByChannel || {};
    if (o[channelId] === true || o[channelId] === false) return o[channelId];
    return !!rules.showBrand;
  }

  /* ---------- price ---------- */

  function stepFor(daysLeft, ladder) {
    var steps = ladder.slice().sort(function (a, b) { return b.minDays - a.minDays; });
    for (var i = 0; i < steps.length; i++) {
      if (daysLeft >= steps[i].minDays) return { index: i, cut: steps[i].cut, minDays: steps[i].minDays };
    }
    var last = steps[steps.length - 1];
    return { index: steps.length - 1, cut: last.cut, minDays: last.minDays };
  }

  /* Lowest allowed price: max(floor, list × (1 − cap)), rounded UP to 500 VND. */
  function minPrice(base, rules) {
    var byFloor = Math.min(base, ceil500(base * rules.floorPct / 100));
    var byCap = Math.min(base, ceil500(base * (1 - rules.maxDiscountPct / 100)));
    return { price: Math.max(byFloor, byCap), binding: byFloor >= byCap ? 'floor' : 'cap', floor: byFloor, capPrice: byCap };
  }

  /*
   * Price on a given day. opts.extraCut: manual extra discount (percentage points);
   * opts.channel: channel id (adds the channel's extraCutPct). Always within [minPrice, base].
   */
  function priceAt(lot, daysLeft, rules, opts) {
    opts = opts || {};
    var ch = opts.channel ? channelById(opts.channel) : null;
    var step = stepFor(daysLeft, rules.ladder || D.DEFAULT_LADDER);
    var requested = step.cut + (opts.extraCut || 0) + (ch ? ch.extraCutPct : 0);
    var min = minPrice(lot.base, rules);
    var raw = round500(lot.base * (1 - requested / 100));
    var price = clamp(raw, min.price, lot.base);
    return {
      price: price,
      cutPct: Math.round((1 - price / lot.base) * 1000) / 10,
      requestedCut: requested,
      step: step,
      min: min,
      atFloor: requested > 0 && raw <= min.price,
      clamped: raw < min.price
    };
  }

  /* ---------- sell-through ---------- */

  function capFactor(rules) { return 0.75 + 0.25 * Math.min(rules.perBuyerCap || 1, 6) / 6; }

  function openSaleChannels(rules) {
    return saleChannels().filter(function (c) { return !channelAccess(c, rules).blocked; });
  }

  function fullPriceVelocity(lot, rules) {
    var reach = openSaleChannels(rules).reduce(function (s, c) { return s + c.reach; }, 0);
    return lot.demand * reach * capFactor(rules);
  }

  /* ---------- recommendation ---------- */

  /* What happens to stock at/after the safety line: return → donate → dispose. */
  function postSafetyAction(lot, daysLeft, rules) {
    var charityBlocked = channelAccess(channelById('charity'), rules).blocked;
    var r = lot.supplierReturn;
    if (r && daysLeft >= r.minDaysLeft) {
      return { action: 'tra_ncc', reasons: [msg('r.return', { partner: r.partner, min: r.minDaysLeft, pct: r.pct })] };
    }
    if (lot.charityOk && daysLeft >= rules.donationMinDays && !charityBlocked) {
      return { action: 'quyen_gop', reasons: [msg('r.donate', { min: rules.donationMinDays })] };
    }
    var why = [msg(r ? 'r.returnClosed' : 'r.noReturn')];
    if (!lot.charityOk) why.push(msg('r.charityCategory'));
    else if (daysLeft < rules.donationMinDays) why.push(msg('r.charityTooLate', { min: rules.donationMinDays }));
    else if (charityBlocked) why.push(msg('r.charityBlocked'));
    return { action: 'huy', reasons: [msg('r.destroy')].concat(why) };
  }

  function recommend(lot, daysLeft, rules) {
    var safety = safetyDays(lot, rules);
    if (daysLeft <= 0) return { action: 'huy', reasons: [msg('r.expired')], needDays: null, window: 0 };
    if (daysLeft <= safety) {
      var p = postSafetyAction(lot, daysLeft, rules);
      return { action: p.action, needDays: null, window: 0,
        reasons: [msg('r.removed', { left: daysLeft, safety: safety })].concat(p.reasons) };
    }
    var v = fullPriceVelocity(lot, rules);
    var need = v > 0 ? Math.ceil(lot.qty / v) : Infinity;
    var win = daysLeft - safety;
    var speed = msg('r.speed', { qty: lot.qty, unit: lot.unit, v: Math.round(v), need: isFinite(need) ? need : '∞', win: win });
    function out(action, reason) { return { action: action, needDays: need, window: win, reasons: [speed, reason] }; }

    if (lot.transfer && win >= 45) return out('chuyen_kho', msg('r.transfer', { wh: lot.transfer.to, why: lot.transfer.reason }));
    if (need <= win * 0.85) return out('theo_doi', msg('r.hold'));
    if (lot.bundleWith && win >= 20) return out('bundle', msg('r.bundle', { partnerLot: lot.bundleWith }));
    if (daysLeft > safety + 30) return out('ban_kenh', msg('r.channels'));
    return out('giam_gia', msg('r.markdown'));
  }

  /* ---------- default channel split ---------- */

  function defaultAllocation(lot, action, rules) {
    var alloc = {};
    D.CHANNELS.forEach(function (c) { alloc[c.id] = 0; });
    var kind = D.ACTIONS[action] && D.ACTIONS[action].kind;
    if (kind === 'donate') { alloc.charity = lot.qty; return alloc; }
    if (kind !== 'sell') return alloc;
    var open = openSaleChannels(rules);
    var total = open.reduce(function (s, c) { return s + c.reach; }, 0);
    if (!total) return alloc;
    var given = 0;
    open.forEach(function (c, i) {
      var q = i === open.length - 1 ? lot.qty - given : Math.floor(lot.qty * c.reach / total);
      alloc[c.id] = q;
      given += q;
    });
    return alloc;
  }

  /* Sums channel quantities only — ignores helper keys such as __action. */
  function allocTotal(alloc) {
    var s = 0;
    alloc = alloc || {};
    D.CHANNELS.forEach(function (c) { var v = +alloc[c.id]; if (v > 0) s += Math.floor(v); });
    return s;
  }

  /* ---------- guard: nothing gets past the owner's rules ---------- */

  function guard(lot, proposal, daysLeft, rules) {
    var checks = [];
    var safety = safetyDays(lot, rules);
    var action = proposal.action;
    var sale = isSale(action);
    var extra = Math.max(0, proposal.extraCut || 0);
    var alloc = proposal.allocations || defaultAllocation(lot, action, rules);
    function add(id, ok, label, detail, info) { checks.push({ id: id, ok: ok, info: !!info, label: label, detail: detail }); }

    var st = D.STORAGE[lot.storage] || {};
    var inScope = lot.sealed && st.accepted && lot.storage === 'kho';
    add('scope', inScope, msg('g.scope'), msg(inScope ? 'g.scope.ok' : 'g.scope.no', { lotNo: lot.lotNo }));
    add('expiry', daysLeft > 0, msg('g.expiry'), msg(daysLeft > 0 ? 'g.daysLeft' : 'g.expired', { n: daysLeft }));

    if (sale) {
      add('safety', daysLeft > safety, msg('g.safety', { safety: safety }),
        daysLeft > safety ? msg('g.safety.ok', { n: daysLeft - safety }) : msg('g.safety.no', { n: daysLeft, safety: safety }));

      // Manual discount is checked on the reference price step; channel extras are always clamped.
      var step = stepFor(daysLeft, rules.ladder || D.DEFAULT_LADDER);
      var reqCut = step.cut + extra;
      var reqPrice = round500(lot.base * (1 - reqCut / 100));
      var min = minPrice(lot.base, rules);
      var floorOk = extra === 0 || reqPrice >= min.floor;
      add('floor', floorOk, msg('g.floor', { pct: rules.floorPct, price: min.floor }),
        extra === 0 ? msg('g.floor.auto') : msg(floorOk ? 'g.floor.ok' : 'g.floor.no', { price: reqPrice, floor: min.floor }));
      var capOk = extra === 0 || reqCut <= rules.maxDiscountPct;
      add('maxcut', capOk, msg('g.cap', { pct: rules.maxDiscountPct }),
        extra === 0 ? msg('g.cap.auto') : msg(capOk ? 'g.cap.ok' : 'g.cap.no', { pct: reqCut, cap: rules.maxDiscountPct }));

      var blocked = D.CHANNELS.filter(function (c) { return (alloc[c.id] || 0) > 0 && channelAccess(c, rules).blocked; })
        .map(function (c) { return c.id; });
      var excl = (rules.excludedRegions || []).length;
      add('regions', blocked.length === 0, msg('g.regions'),
        blocked.length ? msg('g.regions.no', { channels: blocked }) : msg(excl ? 'g.regions.hidden' : 'g.regions.none', { n: excl }));
      add('cap', rules.perBuyerCap >= 1, msg('g.buyer', { n: rules.perBuyerCap, unit: lot.unit }), msg('g.buyer.d'), true);
      var hiddenAt = saleChannels().filter(function (c) { return !brandVisible(c.id, rules); }).map(function (c) { return c.id; });
      add('brand', true, msg('g.brand'), msg(hiddenAt.length ? 'g.brand.hidden' : 'g.brand.all', { channels: hiddenAt }), true);
      var t = allocTotal(alloc);
      add('alloc', t <= lot.qty, msg('g.alloc'), msg('g.alloc.d', { total: t, qty: lot.qty, unit: lot.unit }));
    }

    if (action === 'bundle') add('bundle', !!lot.bundleWith, msg('g.bundle'), msg(lot.bundleWith ? 'g.bundle.ok' : 'g.bundle.no', { partnerLot: lot.bundleWith }));
    if (action === 'chuyen_kho') add('transfer', !!lot.transfer, msg('g.transfer'), msg(lot.transfer ? 'g.transfer.ok' : 'g.transfer.no', { wh: lot.transfer && lot.transfer.to }));
    if (action === 'tra_ncc') {
      var r = lot.supplierReturn;
      var rOk = !!r && daysLeft >= r.minDaysLeft;
      add('return', rOk, msg('g.return'), msg(!r ? 'g.return.none' : (rOk ? 'g.return.ok' : 'g.return.late'), { pct: r && r.pct, min: r && r.minDaysLeft }));
    }
    if (action === 'quyen_gop') {
      var chBlocked = channelAccess(channelById('charity'), rules).blocked;
      var key = !lot.charityOk ? 'g.donate.category' : (daysLeft < rules.donationMinDays ? 'g.donate.late' : (chBlocked ? 'g.donate.blocked' : 'g.donate.ok'));
      add('donate', key === 'g.donate.ok', msg('g.donate'), msg(key, { min: rules.donationMinDays }));
    }
    if (action === 'huy') add('destroy', true, msg('g.destroy'), msg('g.destroy.d'), true);

    var failed = checks.filter(function (c) { return !c.ok; });
    return { ok: failed.length === 0, checks: checks, failed: failed };
  }

  /* ---------- simulation ---------- */

  /*
   * plan = { action, allocations, extraCut }
   * opts.until = simulated day (0 = today). Omitted/Infinity = project to the end of the lot.
   * Returns money, units, per-channel totals, events, price steps, documents.
   */
  function simulateLot(lot, plan, rules, opts) {
    opts = opts || {};
    var until = opts.until == null ? Infinity : opts.until;
    var meta = D.ACTIONS[plan.action];
    var safety = safetyDays(lot, rules);
    var m = { revenue: 0, fees: 0, shipping: 0, handling: 0, transfer: 0, destroy: 0, refund: 0, net: 0 };
    var units = { sold: 0, donated: 0, returned: 0, destroyed: 0, stock: lot.qty };
    var byChannel = {};
    D.CHANNELS.forEach(function (c) {
      byChannel[c.id] = { units: 0, revenue: 0, fees: 0, shipping: 0, handling: 0, allocated: 0, blocked: channelAccess(c, rules).blocked };
    });
    var events = [];
    var priceSteps = {};
    var res = { lotId: lot.id, action: plan.action, money: m, units: units, byChannel: byChannel, events: events,
      removedDay: null, floorDay: null, endDay: null, disposition: null, docs: [], until: until };

    function dispose(kind, n, day) {
      if (n <= 0) return;
      if (kind === 'quyen_gop') {
        var ch = channelById('charity');
        var ship = n * ch.shipPerUnit * lot.bulk, hand = n * rules.handlingPerUnit;
        units.donated += n;
        m.shipping += ship; m.handling += hand;
        byChannel.charity.units += n; byChannel.charity.shipping += ship; byChannel.charity.handling += hand;
        events.push({ day: day, kind: 'donate', channel: 'charity', units: n, price: 0 });
        res.docs.push({ type: 'donation', no: 'QG-' + lot.lotNo, day: day, units: n });
      } else if (kind === 'tra_ncc') {
        var r = lot.supplierReturn;
        units.returned += n;
        m.refund += n * lot.base * r.pct / 100;
        m.shipping += n * rules.returnShipPerUnit * lot.bulk;
        events.push({ day: day, kind: 'return', channel: null, units: n, price: Math.round(lot.base * r.pct / 100) });
        res.docs.push({ type: 'return', no: 'TH-' + lot.lotNo, day: day, units: n });
      } else {
        units.destroyed += n;
        m.destroy += n * rules.destroyCostPerUnit * lot.bulk;
        events.push({ day: day, kind: 'destroy', channel: null, units: n, price: 0 });
        res.docs.push({ type: 'disposal', no: 'HB-' + lot.lotNo, day: day, units: n });
      }
      units.stock -= n;
    }

    var removeDay = Math.max(0, lot.daysLeft - safety);

    if (meta.kind === 'sell') {
      var alloc = plan.allocations || defaultAllocation(lot, plan.action, rules);
      var rem = {}, acc = {};
      var transfer = plan.action === 'chuyen_kho' && lot.transfer ? lot.transfer : null;
      var transit = transfer ? transfer.transitDays : 0;
      var factor = transfer ? transfer.demandFactor : 1;
      var boost = meta.boost || 1;
      var extraHandling = meta.extraHandling || 0;
      var saleAllocated = 0;
      D.CHANNELS.forEach(function (c) {
        var q = Math.max(0, Math.floor(alloc[c.id] || 0));
        byChannel[c.id].allocated = q;
        if (c.kind === 'sale') { rem[c.id] = q; acc[c.id] = 0; saleAllocated += q; }
      });
      saleAllocated = Math.min(saleAllocated, lot.qty);

      if (transfer) {
        m.transfer += saleAllocated * transfer.costPerUnit;
        events.push({ day: 0, kind: 'transfer', channel: null, units: saleAllocated, price: 0 });
        res.docs.push({ type: 'transfer', no: 'DC-' + lot.lotNo, day: 0, units: saleAllocated, from: lot.warehouse, to: transfer.to });
      }
      // The charity share of a sales plan is handed over straight away (if eligible).
      if ((alloc.charity || 0) > 0 && until >= EXEC_DAYS && lot.charityOk && lot.daysLeft - EXEC_DAYS >= rules.donationMinDays) {
        dispose('quyen_gop', Math.min(alloc.charity, units.stock), EXEC_DAYS);
      }

      var cf = capFactor(rules);
      var lastSaleDay = Math.min(removeDay, until);
      for (var d = 0; d < lastSaleDay; d++) {
        if (d < transit) continue;
        var dl = lot.daysLeft - d;
        var any = false;
        saleChannels().forEach(function (c) {
          if (!rem[c.id] || byChannel[c.id].blocked || units.stock <= 0) return;
          any = true;
          var pr = priceAt(lot, dl, rules, { extraCut: plan.extraCut || 0, channel: c.id });
          if (pr.atFloor && res.floorDay == null) res.floorDay = d;
          acc[c.id] += lot.demand * c.reach * (1 + ELASTICITY * pr.cutPct / 100) * boost * factor * cf;
          var n = Math.min(rem[c.id], Math.floor(acc[c.id]), units.stock);
          if (n <= 0) return;
          acc[c.id] -= n; rem[c.id] -= n;
          var rev = n * pr.price, fee = rev * c.feePct / 100, ship = n * c.shipPerUnit * lot.bulk, hand = n * (rules.handlingPerUnit + extraHandling);
          m.revenue += rev; m.fees += fee; m.shipping += ship; m.handling += hand;
          var b = byChannel[c.id];
          b.units += n; b.revenue += rev; b.fees += fee; b.shipping += ship; b.handling += hand;
          units.sold += n; units.stock -= n;
          events.push({ day: d, kind: 'sale', channel: c.id, units: n, price: pr.price });
          var key = c.id + '|' + pr.price;
          if (!priceSteps[key]) priceSteps[key] = { channel: c.id, price: pr.price, units: 0, revenue: 0 };
          priceSteps[key].units += n;
          priceSteps[key].revenue += rev;
        });
        if (units.stock <= 0) { res.endDay = d; break; }
        if (!any) break;
      }
      // Safety line reached: auto-removed from sale; the remainder follows the rules.
      if (units.stock > 0 && until >= removeDay) {
        res.removedDay = removeDay;
        res.disposition = postSafetyAction(lot, safety, rules);
        if (until >= removeDay + EXEC_DAYS) dispose(res.disposition.action, units.stock, removeDay + EXEC_DAYS);
      }
      if (res.endDay == null && units.stock <= 0) res.endDay = removeDay;
    } else {
      if (lot.daysLeft <= safety) res.removedDay = 0;
      if (until >= EXEC_DAYS) dispose(plan.action, units.stock, EXEC_DAYS);
    }

    m.net = m.revenue + m.refund - m.fees - m.shipping - m.handling - m.transfer - m.destroy;
    D.CHANNELS.forEach(function (c) {
      var b = byChannel[c.id];
      b.net = b.revenue - b.fees - b.shipping - b.handling;
    });
    res.priceSteps = Object.keys(priceSteps).map(function (k) { return priceSteps[k]; })
      .sort(function (a, b) { return b.price - a.price || a.channel.localeCompare(b.channel); });
    res.co2Kg = (units.sold + units.donated + units.returned) * (D.CATEGORIES[lot.cat].co2PerUnit || 0) * lot.bulk;
    return res;
  }

  /* Baseline: the owner's current practice. */
  function baseline(lot, rules) {
    if (lot.practice === 'huy') {
      var cost = lot.qty * rules.destroyCostPerUnit * lot.bulk;
      return { practice: 'huy', revenue: 0, cost: cost, net: -cost };
    }
    var rev = lot.qty * lot.base * rules.liquidationPct / 100;
    var c = lot.qty * 400 * lot.bulk; // loading & hand-over to jobbers
    return { practice: 'thanh_ly', revenue: rev, cost: c, net: rev - c };
  }

  /* Unified ledger — every channel posts to the one lot record. */
  var PREFIX = { minimart: 'MM', zalo: 'ZL', partner: 'AP', charity: 'TT' };
  function ledger(lot, sim, avgOrder) {
    avgOrder = avgOrder || 3;
    var rows = [], seq = 0;
    sim.events.forEach(function (e) {
      if (e.kind !== 'sale' && e.kind !== 'donate') return;
      seq++;
      rows.push({
        id: (PREFIX[e.channel] || 'XX') + '-' + lot.id + '-' + String(seq).padStart(4, '0'),
        day: e.day, channel: e.channel, units: e.units, price: e.price, kind: e.kind,
        orders: e.kind === 'sale' ? Math.max(1, Math.ceil(e.units / avgOrder)) : 1
      });
    });
    return rows;
  }

  return {
    ELASTICITY: ELASTICITY,
    EXEC_DAYS: EXEC_DAYS,
    POST_SAFETY: POST_SAFETY,
    ceil500: ceil500,
    round500: round500,
    channelById: channelById,
    lotById: lotById,
    saleChannels: saleChannels,
    isSale: isSale,
    safetyDays: safetyDays,
    zone: zone,
    channelAccess: channelAccess,
    brandVisible: brandVisible,
    stepFor: stepFor,
    minPrice: minPrice,
    priceAt: priceAt,
    capFactor: capFactor,
    fullPriceVelocity: fullPriceVelocity,
    postSafetyAction: postSafetyAction,
    recommend: recommend,
    defaultAllocation: defaultAllocation,
    allocTotal: allocTotal,
    guard: guard,
    simulateLot: simulateLot,
    baseline: baseline,
    ledger: ledger
  };
});
