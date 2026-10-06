/*
 * mrwowo — store.js
 * Demo state persisted in localStorage (no backend).
 *   rules        owner rules
 *   decisions    approve / reject per lot
 *   allocations  channel split per lot
 *   log          decision log (who, when, what) — messages stored as { key, vars }
 *   day          simulated day (0 = today)
 */
(function (root) {
  'use strict';

  var M = root.Mrwowo;
  var D = M.data, E = M.engine, U = M.ui;
  var KEY = 'mrwowo.demo.v1';
  var VERSION = 4;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isoDate(d) {
    var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaults() {
    return {
      v: VERSION,
      anchor: isoDate(new Date()),
      day: 0,
      persona: 'ha',
      rules: clone(D.DEFAULT_RULES),
      decisions: {},
      allocations: {},
      log: [{
        id: uid(), at: new Date().toISOString(), persona: null, type: 'system', lotId: null,
        msg: { key: 'lm.system', vars: { n: D.LOTS.length, owner: D.OWNER.short } }
      }],
      ui: { view: 'grid', filter: 'all', cat: '', wh: '', sort: 'days', q: '', approvalTab: 'pending',
        channelLot: null, reportLot: null },
      tour: { open: false, step: 0 }
    };
  }

  var state = load();
  var saveTimer = null;

  function load() {
    var s = U.storage.get(KEY, null);
    if (!s || s.v !== VERSION) return defaults();
    var d = defaults();
    // Shallow merge so new keys appear after an upgrade without losing data.
    Object.keys(d).forEach(function (k) { if (s[k] == null) s[k] = d[k]; });
    Object.keys(d.ui).forEach(function (k) { if (s.ui[k] == null) s.ui[k] = d.ui[k]; });
    Object.keys(d.rules).forEach(function (k) { if (s.rules[k] == null) s.rules[k] = d.rules[k]; });
    return s;
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { U.storage.set(KEY, state); }, 120);
  }

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

  /* Demo date: anchor + offset (days). */
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

  /*
   * { status, action, plan, rec, decision }
   *   approved → the approved plan
   *   rejected → current practice (plan kept for reference)
   *   pending  → today's proposal
   */
  function planFor(lot) {
    var dec = state.decisions[lot.id];
    var rec = E.recommend(lot, lot.daysLeft, state.rules);
    if (dec && dec.status === 'approved') {
      return { status: 'approved', action: dec.action, decision: dec, rec: rec,
        plan: { action: dec.action, extraCut: dec.extraCut || 0, allocations: allocationFor(lot, dec.action) } };
    }
    return { status: dec ? 'rejected' : 'pending', action: rec.action, decision: dec || null, rec: rec,
      plan: { action: rec.action, extraCut: 0, allocations: allocationFor(lot, rec.action) } };
  }

  /* ---------- pre-approved scenario ---------- */

  function seedScenario() {
    var s = defaults();
    s.tour = state.tour;
    s.ui = state.ui;
    s.persona = state.persona;
    state = s;
    var t0 = Date.now() - 1000 * 60 * 60 * 26;
    ['L03', 'L04', 'L05', 'L06', 'L09', 'L10', 'L11', 'L13'].forEach(function (id, i) {
      var lot = E.lotById(id);
      var rec = E.recommend(lot, lot.daysLeft, state.rules);
      var who = D.PERSONAS[i % 2].id;
      var at = new Date(t0 + i * 1000 * 60 * 37).toISOString();
      state.decisions[id] = { status: 'approved', action: rec.action, extraCut: 0, note: '', persona: who, at: at };
      state.log.unshift({ id: uid(), at: at, persona: who, type: 'approve', lotId: id, action: rec.action,
        msg: { key: 'lm.approve', vars: { action: rec.action, lot: lot.lotNo } } });
    });
    var atR = new Date(t0 + 9 * 1000 * 60 * 37).toISOString();
    var note = { en: 'Waiting for legal to confirm donation categories', vi: 'Chờ pháp chế xác nhận danh mục quyên góp' };
    state.decisions.L15 = { status: 'rejected', action: 'huy', extraCut: 0, note: note, persona: 'duc', at: atR };
    state.log.unshift({ id: uid(), at: atR, persona: 'duc', type: 'reject', lotId: 'L15', action: 'huy',
      msg: { key: 'lm.reject', vars: { action: 'huy', lot: E.lotById('L15').lotNo, note: note } } });
    save();
  }

  function reset() {
    var keepTour = state.tour;
    state = defaults();
    state.tour = keepTour;
    save();
  }

  M.store = {
    get state() { return state; },
    save: save,
    persona: persona,
    personaById: personaById,
    addLog: addLog,
    dateAt: dateAt,
    expiryOf: expiryOf,
    planFor: planFor,
    allocationFor: allocationFor,
    setAllocation: setAllocation,
    seedScenario: seedScenario,
    reset: reset,
    clone: clone
  };
})(typeof self !== 'undefined' ? self : this);
