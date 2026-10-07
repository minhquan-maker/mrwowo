/*
 * mrwowo — landing.js
 * Header shadow, a live "lot record" card in the hero (price steps down, stops at the floor,
 * orders post to one ledger), portfolio figures computed by the engine, the contact form
 * (stored locally) and EN/VI switching.
 */
(function () {
  'use strict';

  var M = window.Mrwowo || {};
  var D = M.data, E = M.engine, U = M.ui, I = M.i18n;
  if (!D || !E || !U || !I) return;
  var t = I.t, L = I.L, esc = U.esc;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  /* ---------- Static setup ---------- */
  $$('[data-logo]').forEach(function (el) { el.outerHTML = U.logo(28); });
  $$('[data-lang-switch]').forEach(function (el) { el.outerHTML = I.switcher(); });
  U.hydrateIcons();
  I.applyDom();

  function syncCopyright() { $('#copyright').textContent = t('lp.f.copy', { year: new Date().getFullYear() }); }
  syncCopyright();

  var hdr = $('#hdr');
  function onScroll() { hdr.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Hero: one lot record, played forward ---------- */
  var card = (function () {
    var lot = E.lotById('L01');
    var rules = D.DEFAULT_RULES;
    var safety = E.safetyDays(lot, rules);
    var MAX = lot.daysLeft - safety + 3;
    var rec = E.recommend(lot, lot.daysLeft, rules);
    var plan = { action: rec.action, allocations: E.defaultAllocation(lot, rec.action, rules) };
    var full = E.simulateLot(lot, plan, rules, {});
    var base = E.baseline(lot, rules).net;
    var floor = E.minPrice(lot.base, rules).price;
    var root = $('#lotCard');
    var day = 0;

    function chColor(id) { var c = E.channelById(id); return c ? c.color : '#A1A1AA'; }
    function chName(id) { var c = E.channelById(id); return c ? L(c.label) : id; }

    function paint(d) {
      day = d;
      var left = lot.daysLeft - d;
      var off = left <= safety;
      var p = E.priceAt(lot, left, rules, { channel: 'minimart' });
      var sim = E.simulateLot(lot, plan, rules, { until: d });
      var led = E.ledger(lot, sim).slice(-3).reverse();
      var sold = lot.qty - sim.units.stock;
      var pricePct = off ? 0 : p.price / lot.base * 100;
      var flag = off
        ? t('lp.card.pulled', { action: L(D.ACTIONS[E.postSafetyAction(lot, safety, rules).action].label) })
        : (p.atFloor ? t('lp.card.atFloor') : t('lp.card.approved', { action: L(D.ACTIONS[rec.action].label) }));
      var split = Object.keys(sim.byChannel).filter(function (c) { return sim.byChannel[c].units > 0; });

      root.innerHTML =
        '<div class="lcard">' +
          '<div class="lcard__head"><span class="label">' + esc(t('lp.card.title')) + '</span><span class="mono lcard__day">' + esc(I.dayLabel(d)) + '</span></div>' +
          '<div class="lcard__lot"><span class="pack pack--lg">' + U.packArt(lot.art, lot.c1, lot.c2, 'hero') + '</span>' +
            '<div><b>' + esc(L(lot.name)) + '</b><span class="mono">' + esc(lot.brand + ' · ' + lot.lotNo) + '</span></div>' +
            '<span class="lcard__left' + (off ? ' is-off' : '') + '">' + esc(t('days.left', { n: left })) + '</span></div>' +
          '<div class="lcard__price"><b class="mono">' + esc(off ? '—' : I.money(p.price)) + '</b>' +
            (!off && p.cutPct ? '<s class="mono">' + esc(I.money(lot.base)) + '</s><span class="lcard__cut mono">−' + Math.round(p.cutPct) + '%</span>' : '') + '</div>' +
          '<div class="lcard__track"><span class="lcard__fill" style="width:' + pricePct + '%"></span>' +
            '<span class="lcard__floor" style="left:' + (floor / lot.base * 100) + '%"><em class="mono">' + esc(t('lp.card.floor', { price: I.money(floor) })) + '</em></span></div>' +
          '<p class="lcard__flag' + (off ? ' is-off' : (p.atFloor ? ' is-floor' : '')) + '">' + esc(flag) + '</p>' +
          '<div class="lcard__split">' + (split.length ? split.map(function (c) {
            return '<span style="flex:' + sim.byChannel[c].units + ';background:' + chColor(c) + '" title="' + esc(chName(c)) + '"></span>';
          }).join('') : '<span style="flex:1;background:var(--surface-3)"></span>') + '</div>' +
          '<div class="lcard__sold small muted"><span>' + esc(t('lp.card.sold', { n: I.num(sold), total: I.num(lot.qty) })) + '</span><span>' +
            split.slice(0, 3).map(function (c) { return '<i style="background:' + chColor(c) + '"></i>' + esc(chName(c)); }).join(' ') + '</span></div>' +
          '<ul class="lcard__ledger">' + (led.length ? led.map(function (r) {
            return '<li><span class="mono">' + esc(r.id) + '</span><span>' + esc(chName(r.channel)) + '</span><span class="mono">' + esc(r.units + ' × ' + I.money(r.price)) + '</span></li>';
          }).join('') : '<li class="muted">' + esc(t('lp.card.none')) + '</li>') + '</ul>' +
          '<div class="lcard__foot"><div><span>' + esc(t('lp.card.net')) + '</span><b class="mono" id="lcNet"></b></div>' +
            '<div><span>' + esc(t('lp.card.base')) + '</span><b class="mono">' + esc(I.short(base)) + '</b></div>' +
            '<div><span>' + esc(t('lp.card.end')) + '</span><b class="mono">' + esc(I.short(full.money.net)) + '</b></div></div>' +
          '<p class="lcard__note">' + esc(t('common.sample')) + '</p>' +
        '</div>';
      $('#lcNet').textContent = I.short(sim.money.net);
    }

    if (U.reduced) paint(14);
    else {
      paint(0);
      setInterval(function () {
        if (document.hidden) return;
        paint(day >= MAX ? 0 : day + 1);
      }, 900);
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
    var targets = { net: [net, I.short], base: [base, I.short], uplift: [net - base, I.signedShort], saved: [saved, I.num] };
    var started = false;

    function labels() {
      $('[data-stat="ratio"]').textContent = base > 0 ? t('lp.n.ratio', { x: I.dec(net / base, 1) }) : '';
      $('[data-stat="co2"]').textContent = t('lp.n.co2', { n: I.num(co2) });
      if (started) Object.keys(targets).forEach(function (k) { $('[data-stat="' + k + '"]').textContent = targets[k][1](targets[k][0]); });
    }
    function run() {
      if (started) return;
      started = true;
      Object.keys(targets).forEach(function (k) {
        U.animateNumber($('[data-stat="' + k + '"]'), targets[k][0], targets[k][1], { duration: 1200 });
      });
    }
    labels();
    if (!('IntersectionObserver' in window)) run();
    else {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { run(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe($('#numbers'));
    }
    return { relabel: labels };
  })();

  /* ---------- Contact form (kept in this browser only) ---------- */
  (function leadForm() {
    var f = $('#leadForm'), msg = $('#leadMsg');
    var REQUIRED = ['name', 'company', 'contact'];
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = String(v).trim(); });
      var missing = REQUIRED.filter(function (k) { return !data[k]; });
      REQUIRED.forEach(function (k) { f.elements[k].setAttribute('aria-invalid', String(missing.indexOf(k) !== -1)); });
      if (missing.length) {
        msg.className = 'contact__msg small neg';
        msg.textContent = t('lp.c.err');
        f.elements[missing[0]].focus();
        return;
      }
      var list = U.storage.get('mrwowo.leads', []);
      if (!Array.isArray(list)) list = [];
      list.push(Object.assign({ at: new Date().toISOString(), lang: I.lang() }, data));
      U.storage.set('mrwowo.leads', list);
      msg.className = 'contact__msg small pos';
      msg.textContent = t('lp.c.ok', { name: data.name });
      f.reset();
    });
  })();

  I.onChange(function () {
    syncCopyright();
    card.repaint();
    stats.relabel();
    $('#leadMsg').textContent = '';
  });
})();
