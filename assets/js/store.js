/*
 * mrwowo — store.js
 * Demo state shared by the seller dashboard and the shop, persisted in localStorage
 * (no backend). Both pages read the same state, and a `storage` event keeps open tabs
 * in sync: an order placed in the shop appears in the seller's lot record immediately.
 *
 *   rules        owner rules
 *   decisions    approve / reject per lot
 *   allocations  channel split per lot
 *   orders       real buyer orders from the shop → booked into the lot record
 *   log          decision log — messages stored as { key, vars }
 *   day          simulated day (0 = today), shared by both sides
 *   shop         buyer-side state: basket, saved items, delivery choice
 */
(function (root) {
  'use strict';

  var M = root.Mrwowo;
  var D = M.data, E = M.engine, U = M.ui;
  var KEY = 'mrwowo.demo.v1';
  var VERSION = 5;
  var SCENARIO = {
    approve: ['L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L11', 'L12', 'L13'],
    reject: 'L15'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isoDate(d) {
    var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Empty state: nothing approved yet. */
  function blank() {
    return {
      v: VERSION,
      anchor: isoDate(new Date()),
      day: 0,
      persona: 'ha',
      rules: clone(D.DEFAULT_RULES),
      decisions: {},
      allocations: {},
      orders: [],
      log: [{
        id: uid(), at: new Date().toISOString(), persona: null, type: 'system', lotId: null,
        msg: { key: 'lm.system', vars: { n: D.LOTS.length, owner: D.OWNER.short } }
      }],
      ui: { view: 'table', filter: 'all', cat: '', q: '', sort: { key: 'days', dir: 'asc' }, approvalTab: 'pending',
        channelLot: null, reportLot: null, reportTab: 'cash' },
      shop: { cart: {}, saved: {}, region: 'hcm', method: 'delivery', cat: 'all', sort: 'featured', q: '' },
      tour: { open: false, step: 0 }
    };
  }

  /* Default state: a ready-to-demo scenario — most lots approved, a few left to approve. */
  function scenario() {
    var s = blank();
    var t0 = Date.now() - 1000 * 60 * 60 * 26;
    SCENARIO.approve.forEach(function (id, i) {
      var lot = E.lotById(id);
      var rec = E.recommend(lot, lot.daysLeft, s.rules);
      var who = D.PERSONAS[i % 2].id;
      var at = new Date(t0 + i * 1000 * 60 * 23).toISOString();
      s.decisions[id] = { status: 'approved', action: rec.action, extraCut: 0, note: '', persona: who, at: at };
      s.log.unshift({ id: uid(), at: at, persona: who, type: 'approve', lotId: id, action: rec.action,
        msg: { key: 'lm.approve', vars: { action: rec.action, lot: lot.lotNo } } });
    });
    var atR = new Date(t0 + SCENARIO.approve.length * 1000 * 60 * 23).toISOString();
    var note = { en: 'Waiting for legal to confirm donation categories', vi: 'Chờ pháp chế xác nhận danh mục quyên góp' };
    s.decisions[SCENARIO.reject] = { status: 'rejected', action: 'huy', extraCut: 0, note: note, persona: 'duc', at: atR };
    s.log.unshift({ id: uid(), at: atR, persona: 'duc', type: 'reject', lotId: SCENARIO.reject, action: 'huy',
      msg: { key: 'lm.reject', vars: { action: 'huy', lot: E.lotById(SCENARIO.reject).lotNo, note: note } } });
    return s;
  }

  var state = load();
  var saveTimer = null;
  var listeners = [];

  function merge(s, d) {
    Object.keys(d).forEach(function (k) {
      if (s[k] == null) s[k] = d[k];
      else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && k !== 'decisions' && k !== 'allocations') {
        Object.keys(d[k]).forEach(function (kk) { if (s[k][kk] == null) s[k][kk] = d[k][kk]; });
      }
    });
    return s;
  }

  function load() {
    var s = U.storage.get(KEY, null);
    if (!s || s.v !== VERSION) return scenario();
    return merge(s, blank());
  }

  function persist() { clearTimeout(saveTimer); U.storage.set(KEY, state); }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 80);
  }

  /* Another tab changed the demo → reload and notify this page. */
  root.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    state = load();
    listeners.forEach(function (fn) { fn('external'); });
  });
  function onExternal(fn) { listeners.push(fn); }

  function personaById(id) {
    for (var i = 0; i < D.PERSONAS.length; i++) if (D.PERSONAS[i].id === id) return D.PERSONAS[i];
    return null;
  }
  function persona() { return personaById(state.persona) || D.PERSONAS[0]; }

  /* entry: { type, lotId, action?, msg: { key, vars } } */
  function addLog(entry) {
    state.log.unshift(Object.assign({ id: uid(), at: new Date().toISOString(), persona: state.persona }, entry));
    if (state.log.length > 400) state.log.length = 400;
  }

  function dateAt(offset) {
    var p = state.anchor.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + offset);
    return d;
  }
  function expiryOf(lot) { return dateAt(lot.daysLeft); }

  /* ---------- effective plan for a lot ---------- */

  function allocationFor(lot, action) {
    var a = state.allocations[lot.id];
    if (a && a.__action === action) return a;
    return E.defaultAllocation(lot, action, state.rules);
  }

  function setAllocation(lotId, alloc, action) {
    state.allocations[lotId] = Object.assign({}, alloc, { __action: action });
  }

  /* Real orders for a lot, in the engine's { day, channel, units, price, id } shape. */
  function ordersFor(lotId) {
    var out = [];
    state.orders.forEach(function (o) {
      o.lines.forEach(function (l) {
        if (l.lotId === lotId) out.push({ id: o.id, day: o.day, channel: 'shop', units: l.qty, price: l.price });
      });
    });
    return out;
  }

  /*
   * { status, action, plan, rec, decision }
   *   approved → the approved plan (with real shop orders)
   *   rejected → current practice (plan kept for reference)
   *   pending  → today's proposal
   */
  function planFor(lot) {
    var dec = state.decisions[lot.id];
    var rec = E.recommend(lot, lot.daysLeft, state.rules);
    if (dec && dec.status === 'approved') {
      return { status: 'approved', action: dec.action, decision: dec, rec: rec,
        plan: { action: dec.action, extraCut: dec.extraCut || 0, allocations: allocationFor(lot, dec.action), orders: ordersFor(lot.id) } };
    }
    return { status: dec ? 'rejected' : 'pending', action: rec.action, decision: dec || null, rec: rec,
      plan: { action: rec.action, extraCut: 0, allocations: allocationFor(lot, rec.action), orders: [] } };
  }

  /* Storefront offer for a lot on the current simulated day (approved sell plans only). */
  function offer(lot) {
    var pf = planFor(lot);
    if (pf.status !== 'approved') return { listed: false, reason: 'notApproved', left: lot.daysLeft - state.day };
    var o = E.storefront(lot, pf.plan, state.rules, state.day, 'shop');
    o.cap = state.rules.perBuyerCap;
    o.brandVisible = E.brandVisible('shop', state.rules);
    return o;
  }

  function placeOrder(buyer, lines) {
    var id = 'MW-' + String(state.orders.length + 1001);
    var order = { id: id, at: new Date().toISOString(), day: state.day, buyer: buyer, lines: lines };
    state.orders.unshift(order);
    persist();
    return order;
  }

  function resetTo(kind) {
    var keep = { tour: state.tour, persona: state.persona };
    state = kind === 'blank' ? blank() : scenario();
    state.tour = keep.tour;
    state.persona = keep.persona;
    persist();
  }

  M.store = {
    get state() { return state; },
    save: save,
    persist: persist,
    onExternal: onExternal,
    persona: persona,
    personaById: personaById,
    addLog: addLog,
    dateAt: dateAt,
    expiryOf: expiryOf,
    planFor: planFor,
    ordersFor: ordersFor,
    allocationFor: allocationFor,
    setAllocation: setAllocation,
    offer: offer,
    placeOrder: placeOrder,
    resetTo: resetTo,
    clone: clone
  };
})(typeof self !== 'undefined' ? self : this);
