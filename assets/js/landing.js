/*
 * mrwowo — landing.js
 * Header, two-level drawer, channel rail arrows, live hero preview, figures computed
 * by the engine, booking form (stored locally), high contrast and EN/VI switching.
 */
(function () {
  'use strict';

  var M = window.Mrwowo || {};
  var D = M.data, E = M.engine, U = M.ui, I = M.i18n;
  if (!D || !E || !U || !I) return;
  var t = I.t, L = I.L;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  /* ---------- Static setup ---------- */
  $$('[data-logo]').forEach(function (el) { el.outerHTML = U.logo(30); });
  $$('[data-lang-switch]').forEach(function (el) { el.outerHTML = I.switcher(); });
  U.hydrateIcons();
  I.applyDom();

  function syncCopyright() { $('#copyright').textContent = t('l.f.copy', { year: new Date().getFullYear() }); }
  syncCopyright();

  /* ---------- Header shadow on scroll ---------- */
  var hdr = $('#hdr');
  function onScroll() { hdr.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Two-level drawer ---------- */
  (function drawer() {
    var dr = $('#drawer'), openBtn = $('#menuOpen');
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      dr.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var first = $('[role="tab"][aria-selected="true"]', dr);
      if (first) first.focus();
    }
    function close() {
      dr.hidden = true;
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }
    function select(group) {
      $$('[data-group]', dr).forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.group === group)); });
      $$('[data-panel]', dr).forEach(function (p) { p.hidden = p.dataset.panel !== group; });
    }

    openBtn.addEventListener('click', open);
    dr.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      var g = e.target.closest('[data-group]');
      if (g) { select(g.dataset.group); return; }
      if (e.target.closest('a')) close();
    });
    $$('[data-group]', dr).forEach(function (b) {
      b.addEventListener('mouseenter', function () { if (window.matchMedia('(min-width: 901px)').matches) select(b.dataset.group); });
    });
    document.addEventListener('keydown', function (e) {
      if (dr.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        var f = $$('a, button', dr).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  })();

  /* ---------- Channel rail arrows ---------- */
  (function rail() {
    var r = $('#channelRail');
    var prev = $('[data-rail="prev"]'), next = $('[data-rail="next"]');
    function sync() {
      prev.disabled = r.scrollLeft <= 2;
      next.disabled = r.scrollLeft + r.clientWidth >= r.scrollWidth - 2;
    }
    function go(dir) { r.scrollBy({ left: dir * r.clientWidth * 0.8, behavior: U.reduced ? 'auto' : 'smooth' }); }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    r.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  })();

  /* ---------- Hero preview: steps down, stops at the floor, pulls itself ---------- */
  var mock = (function () {
    var lot = E.lotById('L01');
    var rules = D.DEFAULT_RULES;
    var safety = E.safetyDays(lot, rules);
    var MAX = lot.daysLeft - safety + 4;
    var rec = E.recommend(lot, lot.daysLeft, rules);
    var plan = { action: rec.action, allocations: E.defaultAllocation(lot, rec.action, rules) };
    var base = E.baseline(lot, rules).net;
    var min = E.minPrice(lot.base, rules).price;
    var el = {
      card: $('#mockLot'), day: $('#mockDay'), fill: $('#mockFill'), zone: $('#mockZone'), name: $('#mockName'),
      price: $('#mockPrice'), list: $('#mockList'), cut: $('#mockCut'), floor: $('#mockFloor'), pin: $('#mockPin'),
      flag: $('#mockFlag'), net: $('#mockNet'), base: $('#mockBase')
    };
    el.floor.style.left = (min / lot.base * 100) + '%';
    var day = 0, lastZone = '';

    function paint(d) {
      day = d;
      var left = lot.daysLeft - d;
      var z = E.zone(left, safety);
      var p = E.priceAt(lot, left, rules, { channel: 'minimart' });
      var net = E.simulateLot(lot, plan, rules, { until: d }).money.net;
      el.name.textContent = L(lot.name);
      el.base.textContent = I.short(base);
      el.day.textContent = I.dayLabel(d);
      el.fill.style.width = (d / MAX * 100) + '%';
      el.zone.textContent = t('days.left', { n: left });
      el.card.className = 'mock-lot z-' + (z === 'urgent' || z === 'removed' ? z : 'act');
      if (lastZone && z !== lastZone) el.card.classList.add('is-pulse');
      lastZone = z;
      el.list.textContent = I.money(lot.base);
      if (left <= safety) {
        el.price.textContent = t('card.pulled');
        el.cut.textContent = '';
        el.pin.style.left = '0%';
        el.flag.textContent = t('l.mock.pulled', { action: L(D.ACTIONS[E.postSafetyAction(lot, safety, rules).action].label).toLowerCase() });
      } else {
        el.price.textContent = I.money(p.price);
        el.cut.textContent = p.cutPct ? '−' + Math.round(p.cutPct) + '%' : t('l.mock.list');
        el.pin.style.left = (p.price / lot.base * 100) + '%';
        el.flag.textContent = p.atFloor ? t('l.mock.floor') : t('l.mock.approved', { action: L(D.ACTIONS[rec.action].label) });
      }
      U.animateNumber(el.net, net, I.short, { duration: 500 });
    }

    if (U.reduced) paint(12);
    else {
      paint(0);
      setInterval(function () {
        var d = day >= MAX ? 0 : day + 1;
        if (d === 0) el.net.__val = 0;
        paint(d);
      }, 650);
    }
    return { repaint: function () { paint(day); } };
  })();

  /* ---------- Figures: run the engine over every sample lot ---------- */
  var stats = (function () {
    var rules = D.DEFAULT_RULES;
    var net = 0, base = 0, saved = 0, co2 = 0;
    D.LOTS.forEach(function (lot) {
      var a = E.recommend(lot, lot.daysLeft, rules).action;
      var sim = E.simulateLot(lot, { action: a, allocations: E.defaultAllocation(lot, a, rules) }, rules, {});
      var b = E.baseline(lot, rules);
      net += sim.money.net;
      base += b.net;
      var s = Math.max(0, (b.practice === 'huy' ? lot.qty : 0) - sim.units.destroyed);
      saved += s;
      co2 += s * (D.CATEGORIES[lot.cat].co2PerUnit || 0) * lot.bulk;
    });
    var targets = {
      net: [net, I.short], base: [base, I.short],
      uplift: [net - base, I.signedShort],
      saved: [saved, I.num]
    };
    var started = false;

    function labels() {
      $('[data-stat="ratio"]').textContent = base > 0 ? t('l.st.ratio', { x: I.dec(net / base, 1) }) : '';
      $('[data-stat="co2"]').textContent = t('l.st.co2', { n: I.num(co2) });
      if (started) Object.keys(targets).forEach(function (k) { $('[data-stat="' + k + '"]').textContent = targets[k][1](targets[k][0]); });
    }
    function run() {
      if (started) return;
      started = true;
      Object.keys(targets).forEach(function (k) {
        U.animateNumber($('[data-stat="' + k + '"]'), targets[k][0], targets[k][1], { duration: 1400 });
      });
    }
    labels();
    var band = $('.statband');
    if (!('IntersectionObserver' in window)) run();
    else {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { run(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(band);
    }
    return { relabel: labels };
  })();

  /* ---------- High contrast ---------- */
  var ct = $('#contrastToggle');
  ct.checked = U.getContrast();
  ct.addEventListener('change', function () {
    U.setContrast(ct.checked);
    U.toast(t(ct.checked ? 'toast.contrastOn' : 'toast.contrastOff'));
  });

  /* ---------- Booking form (stored locally) ---------- */
  (function leadForm() {
    var f = $('#leadForm'), err = $('#leadError');
    var REQUIRED = ['name', 'company', 'contact'];
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = String(v).trim(); });
      var missing = REQUIRED.filter(function (k) { return !data[k]; });
      REQUIRED.forEach(function (k) { f.elements[k].setAttribute('aria-invalid', String(missing.indexOf(k) !== -1)); });
      var contactOk = /@/.test(data.contact || '') || /^[0-9 +().-]{8,}$/.test(data.contact || '');
      if (missing.length || !contactOk) {
        err.hidden = false;
        err.textContent = t(missing.length ? 'l.form.missing' : 'l.form.badContact');
        if (!missing.length) f.elements.contact.setAttribute('aria-invalid', 'true');
        return;
      }
      err.hidden = true;
      data.at = new Date().toISOString();
      data.lang = I.lang();
      var leads = U.storage.get('mrwowo.leads.v1', []);
      leads.push(data);
      U.storage.set('mrwowo.leads.v1', leads);
      f.reset();
      U.toast(t('l.form.thanks', { name: data.name }));
    });
  })();

  /* ---------- Language switch ---------- */
  I.onChange(function () {
    syncCopyright();
    mock.repaint();
    stats.relabel();
    var err = $('#leadError');
    if (!err.hidden) err.hidden = true;
    U.toast(t('toast.lang'));
  });
})();
