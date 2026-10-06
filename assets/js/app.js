/*
 * mrwowo — app.js
 * The 5-screen dashboard, hash-routed:
 *   #/luat          1. Owner rules
 *   #/lo-hang       2. Lot board + time simulation
 *   #/duyet         3. Approvals
 *   #/kenh/:lot     4. Channel split
 *   #/bao-cao/:lot  5. Lot report
 *
 * Business logic lives in engine.js and every string in i18n.js;
 * this file only builds the interface.
 */
(function () {
  'use strict';

  var M = window.Mrwowo;
  if (!M || !M.data || !M.engine || !M.ui || !M.store || !M.i18n) return;
  var D = M.data, E = M.engine, U = M.ui, S = M.store, I = M.i18n;
  var t = I.t, L = I.L, tm = I.tm, esc = U.esc, icon = U.icon;
  var money = I.money, short = I.short, num = I.num, signed = I.signedShort;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  var view = $('#view');

  function R() { return S.state.rules; }
  function st() { return S.state; }

  /* ---------- labels ---------- */
  function lotName(lot) { return L(lot.name); }
  function unit(lot) { return L(lot.unit); }
  function actLabel(a) { return D.ACTIONS[a] ? L(D.ACTIONS[a].label) : a; }
  function chLabel(id) { var c = E.channelById(id); return c ? L(c.label) : id; }
  function whLabel(id) { return D.WAREHOUSES[id] ? L(D.WAREHOUSES[id].label) : id; }
  function practiceLabel(p) { return L(D.PRACTICES[p].label); }
  function regionLabel(id) {
    for (var i = 0; i < D.REGIONS.length; i++) if (D.REGIONS[i].id === id) return L(D.REGIONS[i].label);
    return id;
  }
  function who(personaId) {
    var p = personaId ? S.personaById(personaId) : null;
    return p ? { name: p.name, role: L(p.role) } : { name: 'mrwowo', role: t('lt.system') };
  }
  function units(lot, n) { return num(n) + ' ' + unit(lot); }

  /* ======================================================================
     Projection cache — recomputed when rules / decisions / splits change.
     ====================================================================== */
  var rev = 0;
  var cache = { rev: -1, lots: {} };
  function touch() { rev++; S.save(); syncBadges(); }

  function projected(lot) {
    if (cache.rev !== rev) cache = { rev: rev, lots: {} };
    var c = cache.lots[lot.id];
    if (!c) {
      var pf = S.planFor(lot);
      c = cache.lots[lot.id] = { pf: pf, sim: E.simulateLot(lot, pf.plan, R(), {}), base: E.baseline(lot, R()) };
    }
    return c;
  }

  function lotVM(lot, day) {
    var rules = R();
    var safety = E.safetyDays(lot, rules);
    var left = lot.daysLeft - day;
    var p = projected(lot);
    var removed = left <= safety;
    return {
      lot: lot, left: left, safety: safety, removed: removed,
      zone: E.zone(left, safety),
      price: removed ? null : E.priceAt(lot, left, rules, { extraCut: p.pf.plan.extraCut || 0 }),
      pf: p.pf, proj: p.sim, base: p.base,
      recNow: E.recommend(lot, left, rules),
      simDay: p.pf.status === 'approved' ? E.simulateLot(lot, p.pf.plan, rules, { until: day }) : null
    };
  }

  /* Portfolio: approved lots on the mrwowo plan, the rest at current practice. */
  function portfolio(day) {
    var tt = { net: 0, base: 0, potential: 0, toDay: 0, approved: 0, pending: 0, rejected: 0, value: 0,
      units: { sold: 0, donated: 0, returned: 0, destroyed: 0 }, co2: 0 };
    D.LOTS.forEach(function (lot) {
      var p = projected(lot);
      tt.base += p.base.net;
      tt.value += lot.qty * lot.base;
      if (p.pf.status === 'approved') {
        tt.approved++;
        tt.net += p.sim.money.net;
        Object.keys(tt.units).forEach(function (k) { tt.units[k] += p.sim.units[k]; });
        tt.co2 += p.sim.co2Kg;
        if (day != null) tt.toDay += E.simulateLot(lot, p.pf.plan, R(), { until: day }).money.net;
      } else {
        tt.net += p.base.net;
        if (p.pf.status === 'pending') { tt.pending++; tt.potential += p.sim.money.net - p.base.net; } else tt.rejected++;
      }
    });
    return tt;
  }

  /* Count-up between renders (remembers the previous value per key). */
  var lastVals = {};
  var FMT = { num: num, signed: signed, money: money, short: short };
  function countUp(el, key, value, fmt) {
    if (!el) return;
    el.__val = lastVals[key] != null ? lastVals[key] : 0;
    lastVals[key] = value;
    U.animateNumber(el, value, fmt);
  }
  function countAll(scope) {
    $$('[data-count]', scope).forEach(function (el) {
      countUp(el, el.dataset.count, +el.dataset.value, FMT[el.dataset.fmt] || short);
    });
  }
  function counter(key, value, fmt, cls) {
    return '<b class="' + (cls || '') + '" data-count="' + key + '" data-value="' + value + '" data-fmt="' + (fmt || 'short') + '">' + (FMT[fmt] || short)(value) + '</b>';
  }

  /* ======================================================================
     Shared pieces
     ====================================================================== */
  var STATUS_ICON = { pending: 'clock', approved: 'check', rejected: 'x' };
  function statusPill(s) {
    return '<span class="spill spill--' + s + '">' + icon(STATUS_ICON[s]) + esc(t('status.' + s)) + '</span>';
  }
  function zonePill(left) {
    return '<span class="zpill">' + esc(left <= 0 ? t('days.expired') : t('days.left', { n: left })) + '</span>';
  }
  function actionChip(a) {
    var m = D.ACTIONS[a] || { icon: 'tag' };
    return '<span class="achip achip--' + a + '">' + icon(m.icon) + esc(actLabel(a)) + '</span>';
  }
  function channelDot(id) { var c = E.channelById(id); return '<i class="cdot" style="--c:' + (c ? c.color : '#888') + '"></i>'; }
  function emptyState(ico, title, text, cta) {
    return '<div class="empty">' + icon(ico, 'ico--lg') + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (cta || '') + '</div>';
  }
  function listingName(lot, channelId) {
    return E.brandVisible(channelId, R()) ? lot.brand + ' · ' + lotName(lot) : t('ch.listingHidden', { name: lotName(lot) });
  }
  function decisionNote(dec) { return dec && dec.note ? L(dec.note) : ''; }
  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function logText(e) {
    var v = Object.assign({}, e.msg.vars);
    if (v.action) v.action = actLabel(v.action);
    v.extra = v.extra ? t('lm.extra', { n: v.extra }) : '';
    v.note = v.note ? ' — ' + L(v.note) : '';
    if (v.why) v.why = v.why.map(tm).join('; ');
    if (v.changes) v.changes = v.changes.length ? v.changes.map(changeText).join('; ') : t('rc.none');
    if (v.split) v.split = v.split.map(function (s) { return chLabel(s.ch) + ' ' + num(s.n); }).join(', ');
    if (v.owner) v.owner = L(v.owner);
    if (typeof v.n === 'number') v.n = num(v.n);
    return t(e.msg.key, v);
  }
  function changeText(c) {
    if (c.k === 'regions') return t('rc.regions', { list: I.list(c.list.map(regionLabel)) });
    if (c.k === 'brand') return t('rc.brand');
    return t('rc.' + c.k) + ' ' + c.from + ' → ' + c.to;
  }

  /* ======================================================================
     Price chart (SVG, single series — the caption names it, no legend needed)
     ====================================================================== */
  var chartMeta = {};
  var chartSeq = 0;
  function priceChart(lot, plan, rules, day, caption) {
    var W = 640, H = 236, pl = 64, pr = 16, pt = 24, pb = 34;
    var safety = E.safetyDays(lot, rules);
    var removeDay = Math.max(0, lot.daysLeft - safety);
    var maxX = Math.max(12, Math.min(lot.daysLeft, removeDay + 8));
    var min = E.minPrice(lot.base, rules);
    var yLo = Math.max(0, Math.floor(min.price * 0.82 / 1000) * 1000), yHi = lot.base * 1.07;
    function x(d) { return pl + (d / maxX) * (W - pl - pr); }
    function y(v) { return pt + (1 - (v - yLo) / (yHi - yLo)) * (H - pt - pb); }

    var pts = [];
    var end = Math.min(removeDay, maxX);
    for (var d = 0; d <= end; d++) pts.push({ d: d, p: E.priceAt(lot, lot.daysLeft - d, rules, { extraCut: plan.extraCut || 0 }).price });
    var path = '', area = '';
    if (pts.length) {
      path = 'M' + x(0) + ' ' + y(pts[0].p);
      for (var i = 1; i < pts.length; i++) path += ' H' + x(pts[i].d) + ' V' + y(pts[i].p);
      path += ' H' + x(end);
      area = path + ' V' + y(yLo) + ' H' + x(0) + ' Z';
    }
    var id = 'c' + (++chartSeq);
    chartMeta[id] = { lot: lot, plan: plan, rules: rules, maxX: maxX, pl: pl, pr: pr, W: W, removeDay: removeDay };

    var g = '';
    [lot.base, min.price].forEach(function (v) {
      g += '<line class="ch-grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      g += '<text class="ch-ax" x="' + (pl - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(short(v)) + '</text>';
    });
    var stepX = maxX > 60 ? 20 : (maxX > 30 ? 10 : 5);
    for (var tk = 0; tk <= maxX; tk += stepX) {
      g += '<text class="ch-ax" x="' + x(tk) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(tk === 0 ? t('time.today') : '+' + tk) + '</text>';
    }
    g += '<line class="ch-base" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(yLo) + '" y2="' + y(yLo) + '"/>';
    g += '<line class="ch-floor" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(min.price) + '" y2="' + y(min.price) + '"/>';
    g += '<text class="ch-lab" x="' + (W - pr) + '" y="' + (y(min.price) + 15) + '" text-anchor="end">' +
      esc(min.binding === 'floor' ? t('chart.floor', { pct: rules.floorPct, price: money(min.price) }) : t('chart.capLine', { pct: rules.maxDiscountPct, price: money(min.price) })) + '</text>';
    g += '<text class="ch-lab ch-lab--muted" x="' + (W - pr) + '" y="' + (y(lot.base) - 7) + '" text-anchor="end">' + esc(t('chart.list', { price: money(lot.base) })) + '</text>';
    if (removeDay <= maxX) {
      g += '<line class="ch-safety" x1="' + x(removeDay) + '" x2="' + x(removeDay) + '" y1="' + pt + '" y2="' + y(yLo) + '"/>';
      g += '<text class="ch-lab ch-lab--safety" x="' + (x(removeDay) - 6) + '" y="' + (pt + 10) + '" text-anchor="end">' + esc(t('chart.safety', { n: safety })) + '</text>';
    }
    g += '<path class="ch-area" d="' + area + '"/><path class="ch-line" d="' + path + '"/>';
    if (day != null && day <= maxX) {
      var cur = day <= end ? pts[Math.min(day, pts.length - 1)] : null;
      g += '<line class="ch-now" x1="' + x(day) + '" x2="' + x(day) + '" y1="' + pt + '" y2="' + y(yLo) + '"/>';
      if (cur) g += '<circle class="ch-dot" cx="' + x(day) + '" cy="' + y(cur.p) + '" r="5"/>';
    }
    g += '<line class="ch-cross" id="' + id + '-x" x1="0" x2="0" y1="' + pt + '" y2="' + y(yLo) + '" visibility="hidden"/>';
    g += '<rect class="ch-hit" data-chart="' + id + '" x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '"/>';
    return '<figure class="chart"><figcaption>' + esc(caption || t('chart.caption')) + '</figcaption>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('chart.aria', { name: lotName(lot), price: money(min.price), n: removeDay })) + '">' + g + '</svg></figure>';
  }

  /* Chart crosshair + bar tooltips */
  var tip = $('#tip');
  function showTip(html, cx, cy) {
    tip.innerHTML = html;
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, cx + 14));
    var top = cy - h - 12 < 8 ? cy + 16 : cy - h - 12;
    tip.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }
  function hideTip() {
    if (tip.hidden) return;
    tip.hidden = true;
    $$('.ch-cross').forEach(function (l) { l.setAttribute('visibility', 'hidden'); });
  }
  document.addEventListener('mousemove', function (e) {
    var hit = e.target.closest && e.target.closest('.ch-hit');
    var bar = e.target.closest && e.target.closest('[data-tip]');
    if (hit) {
      var meta = chartMeta[hit.dataset.chart];
      if (!meta) return;
      var r = hit.ownerSVGElement.getBoundingClientRect();
      var px = (e.clientX - r.left) / (r.width / meta.W);
      var d = Math.max(0, Math.min(meta.maxX, Math.round((px - meta.pl) / (meta.W - meta.pl - meta.pr) * meta.maxX)));
      var line = document.getElementById(hit.dataset.chart + '-x');
      var cx = meta.pl + d / meta.maxX * (meta.W - meta.pl - meta.pr);
      if (line) { line.setAttribute('x1', cx); line.setAttribute('x2', cx); line.setAttribute('visibility', 'visible'); }
      var left = meta.lot.daysLeft - d;
      var body = '<b>' + esc(t('chart.tipDay', { when: I.dayLabel(d), n: left })) + '</b>';
      if (d >= meta.removeDay) body += '<span>' + esc(t('chart.tipPulled')) + '</span>';
      else {
        var p = E.priceAt(meta.lot, left, meta.rules, { extraCut: meta.plan.extraCut || 0 });
        body += '<span>' + esc(t('chart.tipPrice', { price: money(p.price), pct: Math.round(p.cutPct) }) + (p.atFloor ? t('chart.tipFloor') : '')) + '</span>';
      }
      showTip(body, e.clientX, e.clientY);
      return;
    }
    if (bar) { showTip(bar.getAttribute('data-tip'), e.clientX, e.clientY); return; }
    hideTip();
  });

  /* ======================================================================
     Routing
     ====================================================================== */
  var ROUTES = {
    'luat': { render: renderRules },
    'lo-hang': { render: renderBoard, update: updateBoard, time: true },
    'duyet': { render: renderApprovals },
    'kenh': { render: renderChannels, update: updateChannels, time: true },
    'bao-cao': { render: renderReport, update: updateReport, time: true }
  };
  var route = { name: 'lo-hang', param: null };

  function parseHash() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return { name: ROUTES[parts[0]] ? parts[0] : 'lo-hang', param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  function syncChrome() {
    $('#pageTitle').textContent = t('page.' + route.name);
    $('#pageSub').textContent = t('page.' + route.name + '.sub');
    document.title = t('meta.appTitle', { page: t('page.' + route.name) });
    $('#timebar').hidden = !ROUTES[route.name].time;
    $$('.side__nav a').forEach(function (a) {
      var on = a.dataset.route === route.name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function go() {
    route = parseHash();
    syncChrome();
    closeNav();
    closeDrawer(true);
    render();
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    renderTour();
  }

  function render() {
    chartMeta = {};
    ROUTES[route.name].render();
    U.hydrateIcons(view);
  }

  /* ======================================================================
     Time simulation
     ====================================================================== */
  var dayRange = $('#dayRange');
  var playTimer = null;

  function syncTimebar() {
    var d = st().day;
    dayRange.value = d;
    U.paintRange(dayRange);
    $('#dayOut').innerHTML = '<b>' + esc(I.dayLabel(d)) + '</b> · ' + esc(I.date(S.dateAt(d)));
    $('#playIcon').innerHTML = icon(playTimer ? 'pause' : 'play');
    $('[data-action="play"]').setAttribute('aria-label', t(playTimer ? 'time.pause' : 'time.play'));
  }

  function setDay(d) {
    d = Math.max(0, Math.min(60, d | 0));
    if (d === st().day) { syncTimebar(); return; }
    st().day = d;
    S.save();
    syncTimebar();
    var r = ROUTES[route.name];
    if (r.update) r.update(); else render();
    if (drawerLot) renderDrawer(drawerLot);
  }

  function togglePlay(force) {
    var on = force != null ? force : !playTimer;
    if (!on) { clearInterval(playTimer); playTimer = null; syncTimebar(); return; }
    if (st().day >= 60) setDay(0);
    playTimer = setInterval(function () {
      if (st().day >= 60) { togglePlay(false); renderTour(); return; }
      setDay(st().day + 1);
    }, U.reduced ? 900 : 420);
    syncTimebar();
  }

  dayRange.addEventListener('input', function () { setDay(+dayRange.value); });

  /* ======================================================================
     SCREEN 2 — LOT BOARD
     ====================================================================== */
  var ZONES = ['all', 'ok', 'watch', 'act', 'urgent', 'removed'];
  var renderedIds = '';
  var prevCard = {};

  function zoneKey(z) { return z === 'expired' ? 'removed' : z; }

  function boardLots(day) {
    var ui = st().ui;
    var q = (ui.q || '').trim().toLowerCase();
    var all = D.LOTS.map(function (l) { return lotVM(l, day); });
    var counts = { all: all.length };
    ZONES.forEach(function (z) { if (z !== 'all') counts[z] = 0; });
    all.forEach(function (vm) { counts[zoneKey(vm.zone)]++; });
    var list = all.filter(function (vm) {
      if (ui.filter !== 'all' && zoneKey(vm.zone) !== ui.filter) return false;
      if (ui.cat && vm.lot.cat !== ui.cat) return false;
      if (ui.wh && vm.lot.warehouse !== ui.wh) return false;
      if (q && [lotName(vm.lot), vm.lot.brand, vm.lot.sku, vm.lot.lotNo].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (ui.sort === 'value') return b.lot.qty * b.lot.base - a.lot.qty * a.lot.base;
      if (ui.sort === 'status') return (a.pf.status === 'pending' ? 0 : 1) - (b.pf.status === 'pending' ? 0 : 1) || a.left - b.left;
      return a.left - b.left;
    });
    return { list: list, counts: counts, all: all };
  }

  function boardKpis(day, all) {
    var tt = portfolio(day);
    var needs = all.filter(function (vm) { return vm.zone === 'act' || vm.zone === 'urgent'; }).length;
    var removed = all.filter(function (vm) { return vm.removed; }).length;
    var floor = all.filter(function (vm) { return vm.price && vm.price.atFloor; }).length;
    return [
      { key: 'k-value', label: t('kpi.value'), sub: t('kpi.value.sub', { n: D.LOTS.length }), value: tt.value, fmt: 'short', ico: 'box' },
      { key: 'k-needs', label: t('kpi.needs'), sub: t('kpi.needs.sub'), value: needs, fmt: 'num', ico: 'alert', tone: needs ? 'warn' : '' },
      { key: 'k-floor', label: t('kpi.floor'), sub: t('kpi.floor.sub'), value: floor, fmt: 'num', ico: 'shield' },
      { key: 'k-removed', label: t('kpi.removed'), sub: t('kpi.removed.sub'), value: removed, fmt: 'num', ico: 'lock', tone: removed ? 'danger' : '' },
      { key: 'k-net', label: t('kpi.net', { when: I.when(day) }), sub: tt.approved ? t('kpi.net.sub', { n: tt.approved }) : t('kpi.net.none'), value: tt.toDay, fmt: 'short', ico: 'coins', tone: 'hero' }
    ];
  }

  function kpiHTML(k) {
    return '<div class="kpi' + (k.tone ? ' kpi--' + k.tone : '') + '">' +
      '<span class="kpi__ico">' + icon(k.ico) + '</span>' +
      '<div><span class="kpi__label">' + esc(k.label) + '</span>' + counter(k.key, k.value, k.fmt, 'kpi__val') +
      '<span class="kpi__sub">' + esc(k.sub) + '</span></div></div>';
  }

  function renderBoard() {
    var ui = st().ui, day = st().day, safety = R().safetyDays.kho;
    var b = boardLots(day);
    var cats = option('', t('board.allCats'), !ui.cat) + Object.keys(D.CATEGORIES).map(function (k) { return option(k, L(D.CATEGORIES[k].label), ui.cat === k); }).join('');
    var whs = option('', t('board.allWh'), !ui.wh) + Object.keys(D.WAREHOUSES).map(function (k) { return option(k, whLabel(k), ui.wh === k); }).join('');
    var sorts = ['days', 'value', 'status'].map(function (k) { return option(k, t('sort.' + k), ui.sort === k); }).join('');

    view.innerHTML =
      '<div class="kpis" id="boardKpis">' + boardKpis(day, b.all).map(kpiHTML).join('') + '</div>' +
      '<div class="toolbar">' +
        '<div class="chips" role="group" aria-label="' + esc(t('board.filter')) + '" id="zoneChips">' + zoneChips(b.counts) + '</div>' +
        '<div class="toolbar__right">' +
          '<label class="search">' + icon('search', 'ico--sm') + '<span class="sr-only">' + esc(t('board.search')) + '</span><input class="input" id="boardSearch" type="search" placeholder="' + esc(t('board.search')) + '" value="' + esc(ui.q) + '"></label>' +
          '<select class="select select--sm" id="boardCat" aria-label="' + esc(t('board.allCats')) + '">' + cats + '</select>' +
          '<select class="select select--sm" id="boardWh" aria-label="' + esc(t('board.allWh')) + '">' + whs + '</select>' +
          '<select class="select select--sm" id="boardSort" aria-label="' + esc(t('board.sort')) + '">' + sorts + '</select>' +
          '<div class="seg" role="group" aria-label="' + esc(t('view.label')) + '">' +
            '<button data-action="view" data-v="grid" aria-pressed="' + (ui.view === 'grid') + '" title="' + esc(t('view.grid')) + '">' + icon('grid', 'ico--sm') + '<span class="sr-only">' + esc(t('view.grid')) + '</span></button>' +
            '<button data-action="view" data-v="table" aria-pressed="' + (ui.view === 'table') + '" title="' + esc(t('view.table')) + '">' + icon('list', 'ico--sm') + '<span class="sr-only">' + esc(t('view.table')) + '</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="boardList"></div>' +
      '<div class="legend">' +
        '<span class="legend__t">' + esc(t('legend.title', { n: safety })) + '</span>' +
        legendZone('ok', '> ' + (safety + 60)) + legendZone('watch', (safety + 31) + '–' + (safety + 60)) +
        legendZone('act', (safety + 16) + '–' + (safety + 30)) + legendZone('urgent', (safety + 1) + '–' + (safety + 15)) +
        legendZone('removed', t('legend.removed', { n: safety })) +
        '<span class="sample-note">' + esc(t('common.sample')) + '</span>' +
      '</div>';

    renderedIds = '';
    paintBoardList(b);
    countAll($('#boardKpis'));

    function refilter() { S.save(); paintBoardList(boardLots(st().day), true); }
    $('#boardSearch').addEventListener('input', function (e) { ui.q = e.target.value; refilter(); });
    $('#boardCat').addEventListener('change', function (e) { ui.cat = e.target.value; refilter(); });
    $('#boardWh').addEventListener('change', function (e) { ui.wh = e.target.value; refilter(); });
    $('#boardSort').addEventListener('change', function (e) { ui.sort = e.target.value; refilter(); });
  }

  function legendZone(z, txt) { return '<span class="legend__i z-' + z + '"><i></i>' + esc(txt) + '</span>'; }

  function zoneChips(counts) {
    var ui = st().ui;
    return ZONES.map(function (z) {
      return '<button class="chip chip--' + z + '" data-action="zone" data-z="' + z + '" aria-pressed="' + (ui.filter === z) + '">' +
        (z !== 'all' ? '<i class="chip__dot"></i>' : '') + esc(t('zone.' + z)) + ' <span class="chip__n">' + (counts[z] || 0) + '</span></button>';
    }).join('');
  }

  function paintBoardList(b, force) {
    var ui = st().ui;
    var wrap = $('#boardList');
    if (!wrap) return;
    var ids = ui.view + ':' + I.lang() + ':' + b.list.map(function (vm) { return vm.lot.id; }).join(',');
    if (!b.list.length) {
      wrap.innerHTML = emptyState('search', t('empty.board'), t('empty.board.text'),
        '<button class="btn btn--outline btn--sm" data-action="clear-filters">' + esc(t('empty.clear')) + '</button>');
      renderedIds = ids;
      return;
    }
    if (ui.view === 'table') {
      wrap.innerHTML = boardTable(b.list);
      renderedIds = ids;
      return;
    }
    if (force || ids !== renderedIds) {
      wrap.innerHTML = '<div class="lots">' + b.list.map(function (vm) {
        return '<article class="lot z-' + vm.zone + '" data-lot="' + vm.lot.id + '" tabindex="0" aria-label="' + esc(lotName(vm.lot)) + '">' + cardInner(vm, false) + '</article>';
      }).join('') + '</div>';
      renderedIds = ids;
      b.list.forEach(function (vm) { prevCard[vm.lot.id] = { price: vm.price && vm.price.price, zone: vm.zone }; });
      return;
    }
    // Patch each card in place so colours transition and the price "ticks" down.
    b.list.forEach(function (vm) {
      var el = wrap.querySelector('[data-lot="' + vm.lot.id + '"]');
      if (!el) return;
      var prev = prevCard[vm.lot.id] || {};
      var priceNow = vm.price && vm.price.price;
      var changed = prev.price != null && priceNow != null && priceNow !== prev.price;
      var justRemoved = prev.zone && prev.zone !== 'removed' && prev.zone !== 'expired' && vm.removed;
      el.className = 'lot z-' + vm.zone + (justRemoved ? ' is-just-removed' : '');
      el.innerHTML = cardInner(vm, changed);
      prevCard[vm.lot.id] = { price: priceNow, zone: vm.zone };
    });
  }

  function cardInner(vm, tick) {
    var lot = vm.lot, pf = vm.pf;
    var floorPos = E.minPrice(lot.base, R()).price / lot.base * 100;
    var price;
    if (vm.removed) {
      price = '<div class="lot__price is-off"><strong>' + esc(t('card.pulled')) + '</strong><s>' + esc(money(lot.base)) + '</s></div>' +
        '<div class="rail rail--off"><i class="rail__floor" data-label="' + esc(t('card.floor')) + '" style="left:' + floorPos + '%"></i></div>';
    } else {
      var p = vm.price;
      price = '<div class="lot__price"><strong class="' + (tick ? 'is-tick' : '') + '">' + esc(money(p.price)) + '</strong>' +
        (p.cutPct ? '<s>' + esc(money(lot.base)) + '</s><span class="lot__cut">−' + Math.round(p.cutPct) + '%</span>' : '<span class="lot__list">' + esc(t('card.list')) + '</span>') + '</div>' +
        '<div class="rail" title="' + esc(t('card.railTitle')) + '"><i class="rail__floor" data-label="' + esc(t('card.floor')) + '" style="left:' + floorPos + '%"></i>' +
        '<i class="rail__pin" style="left:' + (p.price / lot.base * 100) + '%"></i></div>';
    }

    var foot;
    if (pf.status === 'approved') {
      var s = vm.simDay;
      var done = s.units.sold + s.units.donated + s.units.returned + s.units.destroyed;
      foot = '<div class="lot__foot">' + actionChip(pf.action) + '</div>' +
        '<div class="prog"><i style="width:' + Math.round(done / lot.qty * 100) + '%"></i></div>' +
        '<p class="lot__progress">' + esc(t('card.handled', { done: num(done), qty: units(lot, lot.qty), net: short(s.money.net) })) + '</p>';
    } else {
      foot = '<div class="lot__foot">' + actionChip(vm.recNow.action) + '</div>';
    }

    var flags = '';
    if (vm.removed) flags += '<span class="flag flag--danger">' + icon('lock') + esc(t('flag.removed')) + '</span>';
    else if (vm.price && vm.price.atFloor) flags += '<span class="flag flag--floor">' + icon('shield') + esc(t('flag.floor')) + '</span>';
    if (pf.status === 'approved' && vm.simDay.units.stock <= 0) flags += '<span class="flag flag--ok">' + icon('check') + esc(t('flag.done')) + '</span>';

    return '<div class="lot__top">' + zonePill(vm.left) + statusPill(pf.status) + '</div>' +
      '<h3 class="lot__name">' + esc(lotName(lot)) + '</h3>' +
      '<p class="lot__meta">' + esc(lot.brand) + ' · <span class="mono">' + esc(lot.lotNo) + '</span></p>' +
      '<p class="lot__meta">' + esc(units(lot, lot.qty)) + ' · ' + esc(t('card.exp')) + ' ' + esc(I.date(S.expiryOf(lot))) + ' · ' + esc(whLabel(lot.warehouse)) + '</p>' +
      price + foot + (flags ? '<div class="lot__flags">' + flags + '</div>' : '');
  }

  function boardTable(list) {
    return '<div class="tablewrap"><table class="tbl tbl--board"><thead><tr>' +
      ['col.product', 'col.exp', 'col.left', 'col.stock', 'col.list', 'col.now', 'col.action', 'col.status'].map(function (k, i) {
        return '<th' + (i >= 2 && i <= 5 ? ' class="num"' : '') + '>' + esc(t(k)) + '</th>';
      }).join('') + '</tr></thead><tbody>' + list.map(function (vm) {
        var lot = vm.lot;
        return '<tr class="z-' + vm.zone + '" data-lot="' + lot.id + '" tabindex="0">' +
          '<td><div class="cell-lot"><i class="zbar"></i><div><b>' + esc(lotName(lot)) + '</b><span class="muted">' + esc(lot.brand) + ' · ' + esc(lot.lotNo) + '</span></div></div></td>' +
          '<td>' + esc(I.date(S.expiryOf(lot))) + '</td>' +
          '<td class="num"><span class="zpill">' + esc(t('days.n', { n: vm.left })) + '</span></td>' +
          '<td class="num">' + esc(units(lot, lot.qty)) + '</td>' +
          '<td class="num">' + esc(money(lot.base)) + '</td>' +
          '<td class="num"><b>' + esc(vm.removed ? t('card.pulled') : money(vm.price.price)) + '</b>' + (vm.price && vm.price.atFloor ? '<br><small class="muted">' + esc(t('flag.floor')) + '</small>' : '') + '</td>' +
          '<td>' + actionChip(vm.pf.status === 'approved' ? vm.pf.action : vm.recNow.action) + '</td>' +
          '<td>' + statusPill(vm.pf.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function updateBoard() {
    var day = st().day;
    var b = boardLots(day);
    var k = $('#boardKpis');
    if (k) {
      var ks = boardKpis(day, b.all);
      $$('.kpi', k).forEach(function (node, i) {
        var kp = ks[i];
        node.className = 'kpi' + (kp.tone ? ' kpi--' + kp.tone : '');
        $('.kpi__label', node).textContent = kp.label;
        $('.kpi__sub', node).textContent = kp.sub;
        countUp($('.kpi__val', node), kp.key, kp.value, FMT[kp.fmt]);
      });
    }
    var chips = $('#zoneChips');
    if (chips) chips.innerHTML = zoneChips(b.counts);
    paintBoardList(b, false);
  }

  /* ======================================================================
     Lot drawer
     ====================================================================== */
  var drawerLot = null, drawerReturn = null;
  function openDrawer(id) {
    var lot = E.lotById(id);
    if (!lot) return;
    drawerLot = lot;
    drawerReturn = document.activeElement;
    renderDrawer(lot);
    $('#lotDrawer').hidden = false;
    document.body.classList.add('is-locked');
    var c = $('#lotDrawer .ld__top .icon-btn');
    if (c) c.focus();
  }
  function closeDrawer(silent) {
    var d = $('#lotDrawer');
    if (d.hidden) return;
    d.hidden = true;
    drawerLot = null;
    document.body.classList.remove('is-locked');
    if (!silent && drawerReturn && drawerReturn.focus) drawerReturn.focus();
  }
  function fact(k, v) { return '<div><dt>' + esc(t(k)) + '</dt><dd>' + esc(v) + '</dd></div>'; }

  function renderDrawer(lot) {
    var day = st().day, vm = lotVM(lot, day), pf = vm.pf;
    var g = E.guard(lot, pf.plan, lot.daysLeft, R());
    var rec = vm.recNow;
    var dec = pf.decision;
    var diff = vm.proj.money.net - vm.base.net;
    $('#lotDrawerBody').innerHTML =
      '<header class="ld__head z-' + vm.zone + '">' +
        '<div class="ld__top">' + zonePill(vm.left) + statusPill(pf.status) +
        '<button class="icon-btn icon-btn--sm" data-action="drawer-close" aria-label="' + esc(t('common.close')) + '">' + icon('x') + '</button></div>' +
        '<h2 id="lotDrawerTitle">' + esc(lotName(lot)) + '</h2>' +
        '<p class="muted">' + esc(lot.brand) + ' · ' + esc(L(D.CATEGORIES[lot.cat].label)) + ' · ' + esc(L(D.STORAGE[lot.storage].label)) + '</p>' +
      '</header>' +
      '<div class="ld__body">' +
        '<dl class="facts">' +
          fact('fact.sku', lot.sku) + fact('fact.lot', lot.lotNo) + fact('fact.exp', I.date(S.expiryOf(lot))) +
          fact('fact.left', t('fact.leftVal', { n: vm.left, when: I.when(day) })) + fact('fact.stock', units(lot, lot.qty)) +
          fact('fact.wh', whLabel(lot.warehouse)) + fact('fact.list', money(lot.base)) +
          fact('fact.now', vm.removed ? t('fact.pulled') : money(vm.price.price) + (vm.price.cutPct ? ' (−' + Math.round(vm.price.cutPct) + '%)' : '')) +
        '</dl>' +
        '<p class="ld__story">' + icon('info', 'ico--sm') + '<span>' + esc(L(lot.story)) + '</span></p>' +
        priceChart(lot, pf.plan, R(), day) +
        '<section class="ld__sec"><h3>' + esc(pf.status === 'approved' ? t('dr.approved') : t('dr.proposal', { when: I.when(day) })) + '</h3>' +
          '<div class="ld__act">' + actionChip(pf.status === 'approved' ? pf.action : rec.action) + '</div>' +
          '<ul class="reasons">' + rec.reasons.map(function (r) { return '<li>' + esc(tm(r)) + '</li>'; }).join('') + '</ul>' +
          (dec ? '<p class="muted small">' + esc(t('dr.decided', { verb: t('verb.' + dec.status), name: who(dec.persona).name, time: I.dateTime(dec.at) })) + (decisionNote(dec) ? ' — “' + esc(decisionNote(dec)) + '”' : '') + '</p>' : '') +
        '</section>' +
        '<section class="ld__sec"><h3>' + esc(t('dr.checks')) + '</h3>' + guardList(g) + '</section>' +
        '<section class="ld__money">' +
          '<div><span>' + esc(t('dr.net')) + '</span><b>' + esc(short(vm.proj.money.net)) + '</b></div>' +
          '<div><span>' + esc(t('dr.base')) + '</span><b>' + esc(short(vm.base.net)) + '</b></div>' +
          '<div><span>' + esc(t('dr.diff')) + '</span><b class="' + (diff >= 0 ? 'pos' : 'neg') + '">' + esc(signed(diff)) + '</b></div>' +
        '</section>' +
      '</div>' +
      '<footer class="ld__foot">' +
        (pf.status === 'pending' ? '<a class="btn btn--primary btn--sm" href="#/duyet" data-focus-lot="' + lot.id + '">' + icon('approve', 'ico--sm') + esc(t('dr.goApprove')) + '</a>' : '') +
        '<a class="btn btn--outline btn--sm" href="#/kenh/' + lot.id + '">' + icon('split', 'ico--sm') + esc(t('dr.channels')) + '</a>' +
        '<a class="btn btn--outline btn--sm" href="#/bao-cao/' + lot.id + '">' + icon('report', 'ico--sm') + esc(t('dr.record')) + '</a>' +
      '</footer>';
  }

  function guardList(g, compact) {
    return '<ul class="guard' + (compact ? ' guard--compact' : '') + '">' + g.checks.map(function (c) {
      var detail = tm(c.detail);
      return '<li class="guard__i ' + (c.ok ? (c.info ? 'is-info' : 'is-ok') : 'is-fail') + '" title="' + esc(detail) + '">' +
        icon(c.ok ? (c.info ? 'info' : 'check-circle') : 'x-circle') +
        '<div><b>' + esc(tm(c.label)) + '</b><span>' + esc(detail) + '</span></div></li>';
    }).join('') + '</ul>';
  }

  /* ======================================================================
     SCREEN 3 — APPROVALS
     ====================================================================== */
  var drafts = {};
  var focusLot = null;

  function draftFor(lot) {
    if (!drafts[lot.id]) drafts[lot.id] = { action: E.recommend(lot, lot.daysLeft, R()).action, extraCut: 0, note: '' };
    return drafts[lot.id];
  }
  function proposalOf(lot, dr) {
    return { action: dr.action, extraCut: dr.extraCut, allocations: S.allocationFor(lot, dr.action) };
  }
  function validPendingCount() {
    return D.LOTS.filter(function (l) {
      if (S.planFor(l).status !== 'pending') return false;
      var a = E.recommend(l, l.daysLeft, R()).action;
      return E.guard(l, { action: a, extraCut: 0, allocations: S.allocationFor(l, a) }, l.daysLeft, R()).ok;
    }).length;
  }

  function renderApprovals() {
    var ui = st().ui;
    var groups = { pending: [], approved: [], rejected: [] };
    D.LOTS.forEach(function (l) { groups[S.planFor(l).status].push(l); });
    groups.pending.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    var tab = ui.approvalTab;
    var p = S.persona();
    var valid = validPendingCount();
    var tt = portfolio(null);

    var empty = tab === 'pending'
      ? emptyState('check-circle', t('ap.empty.pending'), t('ap.empty.pending.text'), '<a class="btn btn--primary btn--sm" href="#/bao-cao">' + esc(t('ap.empty.pending.cta')) + '</a>')
      : emptyState('file', t('ap.empty.other'), t('ap.empty.other.text'));

    view.innerHTML =
      '<div class="appr-head">' +
        '<div class="tabs" role="tablist">' +
          ['pending', 'approved', 'rejected'].map(function (k) {
            return '<button role="tab" class="tab" data-action="appr-tab" data-tab="' + k + '" aria-selected="' + (tab === k) + '">' + esc(t('ap.tab.' + k)) + ' <span class="tab__n">' + groups[k].length + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="appr-head__right">' +
          '<div class="mini-kpi"><span>' + esc(t('ap.kpi.net')) + '</span>' + counter('ap-net', tt.net, 'short') + '</div>' +
          '<div class="mini-kpi"><span>' + esc(t('ap.kpi.pot')) + '</span>' + counter('ap-pot', tt.potential, 'signed', 'pos') + '</div>' +
          (tab === 'pending' && groups.pending.length ? '<button class="btn btn--primary btn--sm" data-action="approve-all"' + (p.canApprove && valid ? '' : ' aria-disabled="true"') + '>' + icon('approve', 'ico--sm') + esc(t('ap.approveAll', { n: valid })) + '</button>' : '') +
        '</div>' +
      '</div>' +
      (!p.canApprove ? '<div class="banner banner--info">' + icon('lock') + '<p>' + esc(t('ap.viewOnly', { name: p.name, role: L(p.role) })) + '</p></div>' : '') +
      (tab === 'pending' && groups.pending.length ? '<div class="banner">' + icon('shield') + '<p>' + esc(t('ap.banner')) + '</p></div>' : '') +
      '<div class="appr-list">' + (groups[tab].length ? groups[tab].map(function (l) { return apprItem(l, tab); }).join('') : empty) + '</div>';
    countAll(view);
    if (focusLot) {
      var el = view.querySelector('[data-appr="' + focusLot + '"]');
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('is-focus'); }
      focusLot = null;
    }
  }

  function apprHead(lot, vm) {
    return '<div class="appr__lot">' +
      '<div class="appr__pills">' + zonePill(vm.left) + statusPill(vm.pf.status) + '</div>' +
      '<h3>' + esc(lotName(lot)) + '</h3>' +
      '<p class="muted small">' + esc(lot.brand) + ' · <span class="mono">' + esc(lot.lotNo) + '</span> · ' + esc(I.date(S.expiryOf(lot))) + '</p>' +
      '<p class="small">' + esc(units(lot, lot.qty)) + ' · ' + esc(whLabel(lot.warehouse)) + ' · ' + esc(money(lot.base)) + '</p>' +
      '<button class="linkbtn" data-action="open-lot" data-id="' + lot.id + '">' + esc(t('ap.viewLot')) + icon('chevron-right', 'ico--sm') + '</button>' +
    '</div>';
  }

  function apprItem(lot, tab) {
    var vm = lotVM(lot, 0);
    var pf = vm.pf;
    var head = apprHead(lot, vm);

    if (tab !== 'pending') {
      var dec = pf.decision, pr = projected(lot), w = who(dec.persona);
      return '<article class="appr appr--done z-' + vm.zone + '" data-appr="' + lot.id + '">' + head +
        '<div class="appr__plan">' +
          '<div>' + actionChip(dec.action) + '</div>' +
          '<p class="small"><b>' + esc(t('ap.decided', { verb: t('verb.' + dec.status), name: w.name })) + '</b><br><span class="muted">' + esc(t('ap.at', { role: w.role, time: I.dateTime(dec.at) })) + '</span></p>' +
          (dec.extraCut ? '<p class="small">' + esc(t('ap.extraApplied', { n: dec.extraCut })) + '</p>' : '') +
          (decisionNote(dec) ? '<p class="small note">“' + esc(decisionNote(dec)) + '”</p>' : '') +
        '</div>' +
        '<div class="appr__money">' +
          '<div><span>' + esc(dec.status === 'approved' ? t('ap.proj') : t('ap.counted')) + '</span><b>' + esc(short(dec.status === 'approved' ? pr.sim.money.net : pr.base.net)) + '</b></div>' +
          '<div><span>' + esc(t('dr.base')) + '</span><b>' + esc(short(pr.base.net)) + '</b></div>' +
        '</div>' +
        '<div class="appr__foot">' +
          '<button class="btn btn--ghost btn--sm" data-action="undo" data-id="' + lot.id + '">' + icon('undo', 'ico--sm') + esc(t('ap.undo')) + '</button>' +
          '<a class="btn btn--outline btn--sm" href="#/bao-cao/' + lot.id + '">' + icon('report', 'ico--sm') + esc(t('ap.record')) + '</a>' +
        '</div>' +
      '</article>';
    }

    var dr = draftFor(lot);
    var rec = pf.rec;
    var sale = E.isSale(dr.action);
    var g = E.guard(lot, proposalOf(lot, dr), lot.daysLeft, R());
    var sim = E.simulateLot(lot, { action: dr.action, extraCut: dr.extraCut, allocations: S.allocationFor(lot, dr.action) }, R(), {});
    var diff = sim.money.net - vm.base.net;
    var p = S.persona();
    var stepPrice = sale && !vm.removed ? E.priceAt(lot, lot.daysLeft, R()) : null;
    var reqPrice = stepPrice ? E.round500(lot.base * (1 - (stepPrice.step.cut + dr.extraCut) / 100)) : null;

    var options = Object.keys(D.ACTIONS).map(function (a) {
      return option(a, (a === rec.action ? '★ ' : '') + actLabel(a) + (a === rec.action ? ' ' + t('ap.recommended') : ''), a === dr.action);
    }).join('');

    return '<article class="appr z-' + vm.zone + (g.ok ? '' : ' is-blocked') + '" data-appr="' + lot.id + '">' + head +
      '<div class="appr__plan">' +
        '<label class="field"><span class="field__label">' + esc(t('ap.action')) + '</span><select class="select" data-field="action" data-id="' + lot.id + '">' + options + '</select></label>' +
        (dr.action === rec.action
          ? '<p class="small muted">' + esc(tm(rec.reasons[rec.reasons.length - 1])) + '</p>'
          : '<p class="small muted">' + esc(t('ap.different', { action: actLabel(rec.action) })) + '</p>') +
        (sale ? '<label class="field"><span class="field__label">' + esc(t('ap.extra')) + ' <output>' + esc(t('ap.pts', { n: dr.extraCut })) + '</output></span>' +
          '<input type="range" class="range" min="0" max="40" step="5" value="' + dr.extraCut + '" data-field="extra" data-id="' + lot.id + '" style="--pct:' + (dr.extraCut / 40 * 100) + '%">' +
          (stepPrice ? '<span class="field__hint">' + esc(t('ap.priceHint', { step: money(stepPrice.price), req: money(reqPrice), floor: money(stepPrice.min.floor) })) + '</span>' : '') +
          '</label>' : '') +
        '<label class="field"><span class="field__label">' + esc(t('ap.note')) + '</span><input class="input" data-field="note" data-id="' + lot.id + '" value="' + esc(dr.note) + '" placeholder="' + esc(t('ap.notePh')) + '"></label>' +
      '</div>' +
      '<div class="appr__guard"><h4>' + (g.ok ? icon('shield', 'ico--sm') + esc(t('ap.valid')) : icon('lock', 'ico--sm') + esc(t('ap.blocked'))) +
        ' <span class="muted small">' + (g.checks.length - g.failed.length) + '/' + g.checks.length + '</span></h4>' + guardList(g, true) + '</div>' +
      '<div class="appr__foot">' +
        '<div class="appr__proj"><span>' + esc(t('ap.proj')) + '</span><b>' + esc(short(sim.money.net)) + '</b>' +
          '<small>' + esc(t('ap.vs', { base: short(vm.base.net), practice: practiceLabel(lot.practice).toLowerCase() })) +
            (Math.abs(diff) >= 1000 ? ' · <span class="' + (diff >= 0 ? 'pos' : 'neg') + '">' + esc(signed(diff)) + '</span>' : '') + '</small></div>' +
        '<div class="appr__btns">' +
          '<button class="btn btn--danger btn--sm" data-action="reject" data-id="' + lot.id + '"' + (p.canApprove ? '' : ' aria-disabled="true"') + '>' + icon('x', 'ico--sm') + esc(t('ap.reject')) + '</button>' +
          '<button class="btn btn--primary btn--sm" data-action="approve" data-id="' + lot.id + '"' + (g.ok && p.canApprove ? '' : ' aria-disabled="true"') + '>' + icon('check', 'ico--sm') + esc(t('ap.approve')) + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function refreshApprItem(id) {
    var el = view.querySelector('[data-appr="' + id + '"]');
    if (!el) return;
    var active = document.activeElement;
    var field = active && active.dataset ? active.dataset.field : null;
    var tmp = document.createElement('div');
    tmp.innerHTML = apprItem(E.lotById(id), 'pending');
    el.replaceWith(tmp.firstChild);
    if (field) {
      var again = view.querySelector('[data-appr="' + id + '"] [data-field="' + field + '"]');
      if (again) again.focus();
    }
  }

  function approve(id, silent) {
    var lot = E.lotById(id), p = S.persona();
    var dr = draftFor(lot);
    var proposal = proposalOf(lot, dr);
    var g = E.guard(lot, proposal, lot.daysLeft, R());
    if (!p.canApprove) {
      if (!silent) U.toast(t('toast.noRight', { role: L(p.role) }), 'error');
      return false;
    }
    if (!g.ok) {
      S.addLog({ type: 'blocked', lotId: id, action: dr.action,
        msg: { key: 'lm.blocked', vars: { action: dr.action, lot: lot.lotNo, why: g.failed.map(function (c) { return c.detail; }) } } });
      touch();
      if (!silent) {
        U.toast(t('toast.blocked', { why: tm(g.failed[0].detail) }), 'error');
        var el = view.querySelector('[data-appr="' + id + '"]');
        if (el) { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); }
      }
      return false;
    }
    st().decisions[id] = { status: 'approved', action: dr.action, extraCut: dr.extraCut, note: dr.note, persona: p.id, at: new Date().toISOString() };
    S.setAllocation(id, proposal.allocations, dr.action);
    S.addLog({ type: 'approve', lotId: id, action: dr.action,
      msg: { key: 'lm.approve', vars: { action: dr.action, lot: lot.lotNo, extra: dr.extraCut, note: dr.note } } });
    delete drafts[id];
    touch();
    if (!silent) U.toast(t('toast.approved', { lot: lot.lotNo, net: short(projected(lot).sim.money.net) }));
    return true;
  }

  function reject(id) {
    var lot = E.lotById(id), p = S.persona();
    if (!p.canApprove) { U.toast(t('toast.noRight', { role: L(p.role) }), 'error'); return; }
    var dr = draftFor(lot);
    st().decisions[id] = { status: 'rejected', action: dr.action, extraCut: 0, note: dr.note, persona: p.id, at: new Date().toISOString() };
    S.addLog({ type: 'reject', lotId: id, action: dr.action, msg: { key: 'lm.reject', vars: { action: dr.action, lot: lot.lotNo, note: dr.note } } });
    delete drafts[id];
    touch();
    U.toast(t('toast.rejected', { lot: lot.lotNo }));
  }

  function undo(id) {
    var lot = E.lotById(id), p = S.persona();
    if (!p.canApprove) { U.toast(t('toast.noRight', { role: L(p.role) }), 'error'); return; }
    var prev = st().decisions[id];
    delete st().decisions[id];
    S.addLog({ type: 'undo', lotId: id, action: prev && prev.action, msg: { key: 'lm.undo', vars: { lot: lot.lotNo } } });
    touch();
    U.toast(t('toast.undo', { lot: lot.lotNo }));
  }

  function approveAll() {
    var p = S.persona();
    if (!p.canApprove) { U.toast(t('toast.noRight', { role: L(p.role) }), 'error'); return; }
    var before = portfolio(null).net, n = 0;
    D.LOTS.forEach(function (l) {
      if (S.planFor(l).status !== 'pending') return;
      var a = E.recommend(l, l.daysLeft, R()).action;
      if (!drafts[l.id] || drafts[l.id].action !== a) drafts[l.id] = { action: a, extraCut: 0, note: '' };
      if (E.guard(l, proposalOf(l, drafts[l.id]), l.daysLeft, R()).ok && approve(l.id, true)) n++;
    });
    render();
    U.toast(t('toast.approvedAll', { n: n, delta: signed(portfolio(null).net - before) }));
  }

  /* ======================================================================
     SCREEN 4 — CHANNEL SPLIT
     ====================================================================== */
  var allocDraft = {};
  var allocTimer = null;

  function channelLotId() {
    var id = route.param || st().ui.channelLot;
    if (id && E.lotById(id)) return id;
    var first = D.LOTS.filter(function (l) { var pf = S.planFor(l); return pf.status === 'approved' && E.isSale(pf.action); })[0];
    return first ? first.id : 'L01';
  }
  function channelAction(lot) { var pf = S.planFor(lot); return pf.status === 'approved' ? pf.action : pf.rec.action; }
  function currentAlloc(lot, action) {
    var d = allocDraft[lot.id];
    if (d && d.__action === action) return d;
    return Object.assign({}, S.allocationFor(lot, action), { __action: action });
  }

  function renderChannels() {
    var id = channelLotId();
    st().ui.channelLot = id;
    view.innerHTML =
      '<div class="pick"><label class="field"><span class="field__label">' + esc(t('ch.pick')) + '</span><select class="select" id="chLot">' +
        D.LOTS.map(function (l) { return option(l.id, l.lotNo + ' · ' + lotName(l) + ' — ' + t('status.' + S.planFor(l).status), l.id === id); }).join('') +
      '</select></label></div><div id="chBody"></div>';
    $('#chLot').addEventListener('change', function (e) { location.hash = '#/kenh/' + e.target.value; });
    paintChannels(E.lotById(id));
  }

  function updateChannels() { paintChannels(E.lotById(channelLotId())); }

  function paintChannels(lot) {
    var day = st().day, rules = R();
    var pf = S.planFor(lot);
    var action = channelAction(lot);
    var meta = D.ACTIONS[action];
    var alloc = currentAlloc(lot, action);
    var plan = { action: action, extraCut: pf.plan.extraCut || 0, allocations: alloc };
    var simDay = E.simulateLot(lot, plan, rules, { until: day });
    var simAll = E.simulateLot(lot, plan, rules, {});
    var left = lot.daysLeft - day;
    var safety = E.safetyDays(lot, rules);
    var removed = left <= safety;
    var total = E.allocTotal(alloc);
    var over = total > lot.qty;
    var dirty = !!allocDraft[lot.id];
    var when = I.when(day);
    var body = $('#chBody');

    var summary = '<section class="card ch-summary z-' + E.zone(left, safety) + '">' +
      '<div class="ch-summary__main">' +
        '<div class="appr__pills">' + zonePill(left) + statusPill(pf.status) + actionChip(action) + '</div>' +
        '<h2>' + esc(lotName(lot)) + '</h2>' +
        '<p class="muted small">' + esc(lot.brand) + ' · ' + esc(lot.sku) + ' · <span class="mono">' + esc(lot.lotNo) + '</span> · ' + esc(I.date(S.expiryOf(lot))) + ' · ' + esc(whLabel(lot.warehouse)) + '</p>' +
      '</div>' +
      '<div class="ch-summary__nums">' +
        '<div><span>' + esc(t('ch.stock')) + '</span><b>' + esc(units(lot, lot.qty)) + '</b></div>' +
        '<div><span>' + esc(t('ch.done', { when: when })) + '</span><b>' + esc(num(lot.qty - simDay.units.stock)) + '</b></div>' +
        '<div><span>' + esc(t('ch.net', { when: when })) + '</span><b class="pos">' + esc(short(simDay.money.net)) + '</b></div>' +
      '</div>' +
    '</section>';

    if (pf.status !== 'approved') {
      summary += '<div class="banner banner--warn">' + icon('info') + '<p>' + esc(t('ch.preview', { action: actLabel(action) })) +
        ' <a href="#/duyet" data-focus-lot="' + lot.id + '">' + esc(t('ch.goApprove')) + '</a></p></div>';
    }

    if (meta.kind !== 'sell' && meta.kind !== 'donate') {
      body.innerHTML = summary + '<div class="card">' + emptyState(meta.icon, t('ch.noChannels'), t('ch.noChannels.text', { action: actLabel(action) }),
        '<a class="btn btn--outline btn--sm" href="#/bao-cao/' + lot.id + '">' + esc(t('ch.openRecord')) + '</a>') + '</div>';
      U.hydrateIcons(body);
      return;
    }

    // Hub: one lot record in the middle, channels around it.
    var nodes = D.CHANNELS.map(function (c, i) {
      var acc = E.channelAccess(c, rules);
      var q = alloc[c.id] || 0;
      var b = simDay.byChannel[c.id];
      var price = c.kind === 'sale' && !removed ? E.priceAt(lot, left, rules, { extraCut: plan.extraCut, channel: c.id }).price : null;
      var state = acc.blocked ? 'blocked' : (q > 0 ? 'on' : 'off');
      return '<div class="node node--' + i + ' is-' + state + '" style="--c:' + c.color + ';--w:' + Math.max(2, Math.min(10, q / lot.qty * 14)) + 'px">' +
        '<span class="node__ico">' + icon(c.icon) + '</span><b>' + esc(L(c.label)) + '</b>' +
        (acc.blocked ? '<span class="node__st">' + icon('lock', 'ico--sm') + esc(t('ch.blocked')) + '</span>' :
          '<span class="node__q">' + esc(t('ch.allocated', { n: units(lot, q) })) + '</span>' +
          '<span class="node__p">' + esc(c.kind === 'sale' ? (price ? money(price) : t('card.pulled')) : t('ch.donation')) + '</span>' +
          '<span class="node__sold">' + esc(t(c.kind === 'sale' ? 'ch.sold' : 'ch.handed')) + ' <b>' + esc(num(b.units)) + '</b></span>') +
      '</div>';
    }).join('');
    var entries = simDay.events.filter(function (e) { return e.kind === 'sale' || e.kind === 'donate'; }).length;
    var hub = '<section class="card"><div class="card__head"><h3>' + esc(t('ch.hub')) + '</h3><span class="muted small">' + esc(t('ch.at', { when: when })) + '</span></div>' +
      '<div class="hub' + (playTimer ? ' is-live' : '') + '">' + nodes +
        '<div class="hub__core">' + U.logo(26) + '<b>' + esc(t('ch.record')) + '</b><span class="mono">' + esc(lot.lotNo) + '</span><small>' + esc(t('ch.entries', { n: num(entries) })) + '</small></div>' +
      '</div></section>';

    // Allocation table
    var rows = D.CHANNELS.map(function (c) {
      var acc = E.channelAccess(c, rules);
      var q = alloc[c.id] || 0;
      var proj = simAll.byChannel[c.id];
      var price = c.kind === 'sale' && !removed ? E.priceAt(lot, left, rules, { extraCut: plan.extraCut, channel: c.id }).price : null;
      var why = acc.blocked ? t('ch.why.region') : (c.kind === 'donate' && !lot.charityOk ? t('ch.why.category') : (meta.kind === 'donate' && c.kind === 'sale' ? t('ch.why.donate') : ''));
      var shown = E.brandVisible(c.id, rules);
      var brand = c.kind === 'sale'
        ? '<span class="pill ' + (shown ? 'pill--ok' : '') + '">' + esc(t(shown ? 'ch.brandShow' : 'ch.brandHide')) + '</span><br><span class="muted">' + esc(listingName(lot, c.id)) + '</span>'
        : '—';
      return '<tr class="' + (why ? 'is-disabled' : '') + '">' +
        '<td><div class="cell-ch">' + channelDot(c.id) + '<div><b>' + esc(L(c.label)) + '</b><span class="muted small">' + esc(L(c.note)) + '</span></div></div></td>' +
        '<td class="small">' + esc(acc.openRegions.length ? acc.openRegions.map(regionLabel).join(', ') : '—') +
          (acc.hiddenRegions.length ? '<br><span class="neg">' + esc(t('ch.hiddenIn', { list: acc.hiddenRegions.map(regionLabel).join(', ') })) + '</span>' : '') + '</td>' +
        '<td class="small">' + brand + '</td>' +
        '<td class="num">' + (c.kind === 'sale' ? (price ? '<b>' + esc(money(price)) + '</b>' + (c.extraCutPct ? '<br><span class="muted small">' + esc(t('ch.groupNote', { n: c.extraCutPct })) + '</span>' : '') : esc(t('card.pulled'))) : esc(money(0))) + '</td>' +
        '<td class="num small">' + (c.feePct ? c.feePct + '%' : '—') + '<br><span class="muted">' + esc(t('ch.perUnit', { price: money(c.shipPerUnit * lot.bulk) })) + '</span></td>' +
        '<td class="alloc"><input class="input input--num" type="number" min="0" max="' + lot.qty + '" step="1" value="' + q + '" data-alloc="' + c.id + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + ' aria-label="' + esc(t('ch.col.alloc') + ' · ' + L(c.label)) + '">' +
          (why ? '<span class="small neg">' + esc(why) + '</span>' : '') + '</td>' +
        '<td class="num">' + esc(num(proj.units)) + '</td>' +
        '<td class="num"><b class="' + (proj.net >= 0 ? '' : 'neg') + '">' + esc(short(proj.net)) + '</b></td>' +
      '</tr>';
    }).join('');
    var unalloc = lot.qty - total;
    var cols = ['ch.col.channel', 'ch.col.regions', 'ch.col.brand', 'ch.col.price', 'ch.col.fees', 'ch.col.alloc', 'ch.col.sold', 'ch.col.net'];
    var table = '<section class="card"><div class="card__head"><h3>' + esc(t('ch.split')) + '</h3>' +
      '<div class="card__tools"><button class="btn btn--ghost btn--sm" data-action="alloc-auto">' + icon('refresh', 'ico--sm') + esc(t('ch.auto')) + '</button>' +
      '<button class="btn btn--primary btn--sm" data-action="alloc-save"' + (dirty && !over ? '' : ' disabled') + '>' + icon('check', 'ico--sm') + esc(t('ch.save')) + '</button></div></div>' +
      '<div class="tablewrap"><table class="tbl tbl--alloc"><thead><tr>' + cols.map(function (k, i) {
        return '<th' + ([3, 4, 6, 7].indexOf(i) !== -1 ? ' class="num"' : '') + '>' + esc(t(k, { when: when })) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="5">' + esc(t('ch.total', { n: rules.perBuyerCap })) + '</td><td class="' + (over ? 'neg' : '') + '"><b>' + esc(num(total)) + '</b> / ' + esc(num(lot.qty)) + '</td>' +
        '<td class="num">' + esc(num(simAll.units.sold + simAll.units.donated)) + '</td><td class="num"><b>' + esc(short(simAll.money.net)) + '</b></td></tr></tfoot></table></div>' +
      (over ? '<p class="formmsg neg">' + icon('alert', 'ico--sm') + esc(t('ch.over', { n: units(lot, total - lot.qty) })) + '</p>'
        : (unalloc > 0 ? '<p class="formmsg muted">' + icon('info', 'ico--sm') + esc(t('ch.unalloc', { n: units(lot, unalloc) })) + '</p>' : '')) +
      (dirty && !over ? '<p class="formmsg">' + icon('info', 'ico--sm') + esc(t('ch.dirty')) + '</p>' : '') +
    '</section>';

    // Unified ledger
    var all = E.ledger(lot, simDay);
    var led = all.slice(-12).reverse();
    var counts = {};
    all.forEach(function (r) { counts[r.channel] = (counts[r.channel] || 0) + r.orders; });
    var ledger = '<section class="card"><div class="card__head card__head--wrap"><h3>' + esc(t('ch.ledger')) + ' <small class="muted">· ' + esc(t('ch.ledgerSub', { lot: lot.lotNo })) + '</small></h3>' +
      '<div class="ledger-counts">' + D.CHANNELS.map(function (c) { return '<span>' + channelDot(c.id) + esc(L(c.label)) + ' <b>' + esc(num(counts[c.id] || 0)) + '</b></span>'; }).join('') + '</div></div>' +
      (led.length ? '<div class="tablewrap"><table class="tbl tbl--ledger"><thead><tr>' +
        ['ld.id', 'ld.date', 'ld.channel', 'ld.qty', 'ld.price', 'ld.amount', 'ld.to'].map(function (k, i) { return '<th' + (i >= 3 && i <= 5 ? ' class="num"' : '') + '>' + esc(t(k)) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        led.map(function (r, i) {
          return '<tr' + (i === 0 && playTimer ? ' class="is-new"' : '') + '><td class="mono small">' + esc(r.id) + '</td><td>' + esc(I.date(S.dateAt(r.day))) + '</td>' +
            '<td>' + channelDot(r.channel) + esc(chLabel(r.channel)) + '</td>' +
            '<td class="num">' + esc(num(r.units)) + (r.kind === 'sale' ? ' <span class="muted small">(' + esc(t('ld.orders', { n: r.orders })) + ')</span>' : '') + '</td>' +
            '<td class="num">' + esc(r.kind === 'sale' ? money(r.price) : t('ch.donation')) + '</td><td class="num">' + esc(money(r.units * r.price)) + '</td>' +
            '<td class="small"><span class="pill pill--outline">' + icon('file') + esc(lot.lotNo) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<p class="muted small pad">' + esc(t('ld.empty', { when: when })) + '</p>') +
    '</section>';

    body.innerHTML = summary + hub + table + ledger;
    U.hydrateIcons(body);
  }

  /* ======================================================================
     SCREEN 5 — LOT REPORT
     ====================================================================== */
  function reportLotId() {
    var id = route.param || st().ui.reportLot;
    if (id && E.lotById(id)) return id;
    var first = D.LOTS.filter(function (l) { return S.planFor(l).status === 'approved'; })[0];
    return first ? first.id : 'L01';
  }

  function renderReport() {
    st().ui.reportLot = reportLotId();
    view.innerHTML = '<div id="rpPortfolio"></div><div id="rpLot"></div><div id="rpLog"></div>';
    paintPortfolio();
    paintLotRecord(reportLotId());
    paintLog();
    countAll(view);
  }

  function updateReport() {
    paintPortfolio();
    paintLotRecord(reportLotId());
    countAll(view);
  }

  function tile(label, sub, valueHTML) {
    return '<div class="tile"><span>' + esc(label) + '</span>' + valueHTML + '<small>' + esc(sub) + '</small></div>';
  }

  function paintPortfolio() {
    var day = st().day;
    var tt = portfolio(day);
    var ratio = tt.base > 0 ? tt.net / tt.base : null;
    var rate = tt.value ? Math.round(tt.net / tt.value * 100) : 0;
    var selected = reportLotId();

    var rows = D.LOTS.map(function (lot) {
      var p = projected(lot);
      return { lot: lot, plan: p.sim.money.net, base: p.base.net, status: p.pf.status };
    });
    var maxPos = Math.max.apply(null, rows.map(function (r) { return Math.max(r.plan, r.base, 0); })) || 1;
    var maxNeg = Math.abs(Math.min.apply(null, rows.map(function (r) { return Math.min(r.plan, r.base, 0); })));
    var span = maxPos + maxNeg;
    function bar(v, cls, tipHTML) {
      return '<span class="bar ' + cls + (v < 0 ? ' is-neg' : '') + '" data-tip="' + esc(tipHTML) + '" style="--w:' + (Math.abs(v) / span * 100) + '%"></span>';
    }
    var chart = '<div class="bars" style="--zero:' + (maxNeg / span * 100) + '%">' + rows.map(function (r) {
      return '<button class="bars__row' + (r.lot.id === selected ? ' is-sel' : '') + '" data-action="report-lot" data-id="' + r.lot.id + '">' +
        '<span class="bars__label"><b>' + esc(r.lot.lotNo) + '</b><span>' + esc(lotName(r.lot)) + '</span></span>' +
        '<span class="bars__plot"><i class="bars__zero"></i>' +
          bar(r.plan, 'bar--plan' + (r.status !== 'approved' ? ' is-proj' : ''), '<b>' + esc(t('rp.tipPlan', { lot: r.lot.lotNo }) + (r.status !== 'approved' ? t('rp.tipPending') : '')) + '</b><span>' + esc(short(r.plan)) + '</span>') +
          bar(r.base, 'bar--base', '<b>' + esc(t('rp.tipBase', { lot: r.lot.lotNo })) + '</b><span>' + esc(short(r.base)) + '</span>') +
        '</span>' +
        '<span class="bars__val"><b>' + esc(short(r.plan)) + '</b><span>' + esc(short(r.base)) + '</span></span>' +
        '<span class="bars__st">' + statusPill(r.status) + '</span>' +
      '</button>';
    }).join('') + '</div>';

    $('#rpPortfolio').innerHTML =
      '<section class="hero-num">' +
        '<div class="hero-num__main">' +
          '<span class="hero-num__label">' + esc(t('rp.hero')) + '<small>' + esc(t('rp.heroSub')) + '</small></span>' +
          '<strong class="hero-num__val" data-count="rp-net" data-value="' + tt.net + '" data-fmt="money">' + esc(money(tt.net)) + '</strong>' +
          '<div class="hero-num__vs"><span>' + esc(t('rp.vs', { base: money(tt.base) })) + '</span>' +
            '<span class="pill ' + (tt.net - tt.base >= 0 ? 'pill--ok' : 'pill--danger') + '">' + esc(signed(tt.net - tt.base)) + (ratio && ratio > 1 ? ' · ' + esc(t('rp.times', { x: I.dec(ratio, 1) })) : '') + '</span></div>' +
          '<p class="hero-num__note">' + esc(t('rp.note', { a: tt.approved, b: tt.pending + tt.rejected })) +
            (tt.pending ? ' <b class="pos">' + esc(t('rp.upside', { n: tt.pending, delta: signed(tt.potential) })) + '</b>' : '') + '</p>' +
        '</div>' +
        '<div class="hero-num__side">' +
          tile(t('rp.toDate', { when: I.when(day) }), t('rp.toDateSub'), counter('rp-today', tt.toDay, 'short')) +
          tile(t('rp.rate'), t('rp.rateSub'), '<b>' + rate + '%</b>') +
          tile(t('rp.units'), t('rp.unitsSub', { s: num(tt.units.sold), d: num(tt.units.donated), r: num(tt.units.returned) }), counter('rp-units', tt.units.sold + tt.units.donated + tt.units.returned, 'num')) +
          tile(t('rp.co2'), t('rp.co2Sub'), '<b>' + esc(num(tt.co2)) + ' kg</b>') +
        '</div>' +
      '</section>' +
      '<section class="card"><div class="card__head card__head--wrap"><h3>' + esc(t('rp.byLot')) + '</h3>' +
        '<div class="legend"><span class="legend__i"><i class="sw sw--plan"></i>' + esc(t('rp.legend.plan')) + '</span><span class="legend__i"><i class="sw sw--proj"></i>' + esc(t('rp.legend.proj')) + '</span><span class="legend__i"><i class="sw sw--base"></i>' + esc(t('rp.legend.base')) + '</span></div></div>' +
        chart + '<p class="muted small pad">' + esc(t('rp.byLotHint')) + '</p></section>';
  }

  function paintLotRecord(id) {
    var lot = E.lotById(id), day = st().day, rules = R();
    var p = projected(lot), pf = p.pf, sim = p.sim, base = p.base;
    var simDay = E.simulateLot(lot, pf.plan, rules, { until: day });
    var when = I.when(day);
    var m = sim.money, md = simDay.money;
    var logs = st().log.filter(function (e) { return e.lotId === id; });

    function moneyRow(key, a, b, sign) {
      var f = function (v) { return v ? (sign < 0 ? '−' : '') + money(Math.abs(v)) : '—'; };
      return '<tr><td>' + esc(t(key)) + '</td><td class="num">' + esc(f(a)) + '</td><td class="num">' + esc(f(b)) + '</td></tr>';
    }
    var flow = '<table class="tbl tbl--money"><thead><tr><th>' + esc(t('flow.col')) + '</th><th class="num">' + esc(t('flow.proj')) + '</th><th class="num">' + esc(t('flow.day', { when: when })) + '</th></tr></thead><tbody>' +
      moneyRow('flow.revenue', m.revenue, md.revenue, 1) + moneyRow('flow.refund', m.refund, md.refund, 1) +
      moneyRow('flow.fees', m.fees, md.fees, -1) + moneyRow('flow.ship', m.shipping, md.shipping, -1) +
      moneyRow('flow.handling', m.handling, md.handling, -1) + moneyRow('flow.transfer', m.transfer, md.transfer, -1) +
      moneyRow('flow.destroy', m.destroy, md.destroy, -1) +
      '</tbody><tfoot><tr><td><b>' + esc(t('flow.net')) + '</b></td><td class="num"><b>' + esc(money(m.net)) + '</b></td><td class="num"><b>' + esc(money(md.net)) + '</b></td></tr>' +
      '<tr class="muted"><td>' + esc(t('flow.base', { practice: practiceLabel(base.practice).toLowerCase() })) + '</td><td class="num">' + esc(money(base.net)) + '</td><td></td></tr></tfoot></table>';

    var steps = sim.priceSteps.length
      ? '<table class="tbl"><thead><tr>' + ['st.channel', 'st.price', 'st.pct', 'st.qty', 'st.rev'].map(function (k, i) { return '<th' + (i ? ' class="num"' : '') + '>' + esc(t(k)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        sim.priceSteps.map(function (s) {
          return '<tr><td>' + channelDot(s.channel) + esc(chLabel(s.channel)) + '</td><td class="num">' + esc(money(s.price)) + '</td><td class="num">' + Math.round(s.price / lot.base * 100) + '%</td><td class="num">' + esc(num(s.units)) + '</td><td class="num">' + esc(money(s.revenue)) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="muted small pad">' + esc(t('st.none', { action: actLabel(pf.action).toLowerCase() })) + '</p>';

    var PARTS = [['sold', 'u-sold'], ['donated', 'u-don'], ['returned', 'u-ret'], ['destroyed', 'u-des'], ['stock', 'u-stock']];
    function stack(u, label) {
      return '<div class="stack"><span class="stack__label">' + esc(label) + '</span><div class="stack__bar">' + PARTS.map(function (pp) {
        var v = u[pp[0]];
        return v ? '<i class="' + pp[1] + '" style="flex:' + v + '" data-tip="' + esc('<b>' + esc(t('u.' + pp[0])) + '</b><span>' + esc(units(lot, v)) + ' (' + Math.round(v / lot.qty * 100) + '%)</span>') + '"></i>' : '';
      }).join('') + '</div><ul class="stack__legend">' + PARTS.map(function (pp) {
        return u[pp[0]] ? '<li><i class="' + pp[1] + '"></i>' + esc(t('u.' + pp[0])) + ' <b>' + esc(num(u[pp[0]])) + '</b></li>' : '';
      }).join('') + '</ul></div>';
    }
    var removedNote = sim.disposition
      ? '<p class="small muted">' + esc(t('rec.removed', { date: I.date(S.dateAt(sim.removedDay)), n: E.safetyDays(lot, rules), action: actLabel(sim.disposition.action).toLowerCase() })) + '</p>'
      : '';

    var docs = sim.docs.length ? '<ul class="docs">' + sim.docs.map(function (d) {
      var done = d.day <= day;
      return '<li class="' + (done ? 'is-done' : '') + '">' + icon('file', 'ico--sm') + '<div><b>' + esc(t('doc.' + d.type)) + '</b><span class="mono">' + esc(d.no) + '</span></div>' +
        '<span class="small">' + esc(units(lot, d.units)) + ' · ' + esc(I.date(S.dateAt(d.day))) + '</span>' +
        '<span class="pill ' + (done ? 'pill--ok' : '') + '">' + esc(t(done ? 'doc.done' : 'doc.planned')) + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted small pad">' + esc(t('doc.none')) + '</p>';

    var logTable = logs.length ? logTableHTML(logs) : '<p class="muted small pad">' + esc(t('log.none')) + '</p>';
    var dec = pf.decision;
    var diff = m.net - base.net;

    $('#rpLot').innerHTML =
      '<section class="card record">' +
        '<div class="card__head card__head--wrap">' +
          '<div><p class="eyebrow-sm">' + esc(t('rec.eyebrow')) + '</p><h2>' + esc(lotName(lot)) + '</h2>' +
          '<p class="muted small">' + esc(lot.brand) + ' · ' + esc(lot.sku) + ' · <span class="mono">' + esc(lot.lotNo) + '</span> · ' + esc(I.date(S.expiryOf(lot))) + ' · ' + esc(units(lot, lot.qty)) + ' · ' + esc(whLabel(lot.warehouse)) + '</p></div>' +
          '<div class="card__tools">' +
            '<label class="sr-only" for="rpLotSel">' + esc(t('rec.select')) + '</label><select class="select select--sm" id="rpLotSel">' +
              D.LOTS.map(function (l) { return option(l.id, l.lotNo + ' · ' + lotName(l), l.id === id); }).join('') + '</select>' +
            '<button class="btn btn--outline btn--sm" data-action="export-lot" data-id="' + lot.id + '">' + icon('download', 'ico--sm') + esc(t('rec.csv')) + '</button>' +
            '<button class="btn btn--outline btn--sm" data-action="export-json" data-id="' + lot.id + '">' + icon('file', 'ico--sm') + esc(t('rec.json')) + '</button>' +
            '<button class="btn btn--primary btn--sm" data-action="print">' + icon('printer', 'ico--sm') + esc(t('rec.print')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="record__status">' + statusPill(pf.status) + actionChip(pf.status === 'approved' ? pf.action : pf.rec.action) +
          (dec ? '<span class="small muted">' + esc(t('dr.decided', { verb: t('verb.' + dec.status), name: who(dec.persona).name, time: I.dateTime(dec.at) })) + '</span>' : '') + '</div>' +
        (pf.status !== 'approved' ? '<div class="banner banner--warn">' + icon('info') + '<p>' + esc(t(pf.status === 'pending' ? 'rec.pending' : 'rec.rejected')) + '</p></div>' : '') +
        '<div class="record__kpis">' +
          '<div class="rk rk--hero"><span>' + esc(t('rec.kNet')) + '</span>' + counter('lot-net-' + id, m.net, 'money') + '</div>' +
          '<div class="rk"><span>' + esc(t('rec.kBase')) + '</span><b>' + esc(money(base.net)) + '</b></div>' +
          '<div class="rk"><span>' + esc(t('rec.kDiff')) + '</span><b class="' + (diff >= 0 ? 'pos' : 'neg') + '">' + esc(signed(diff)) + '</b></div>' +
          '<div class="rk"><span>' + esc(t('rec.kDay', { when: when })) + '</span>' + counter('lot-day-' + id, md.net, 'money') + '</div>' +
        '</div>' +
        '<div class="record__grid">' +
          '<div class="record__col"><h3>' + esc(t('rec.recovered')) + '</h3>' + flow + '</div>' +
          '<div class="record__col"><h3>' + esc(t('rec.sold')) + '</h3>' + steps + '</div>' +
        '</div>' +
        '<div class="record__grid">' +
          '<div class="record__col"><h3>' + esc(t('rec.where')) + '</h3>' + stack(simDay.units, t('stack.at', { when: when })) + stack(sim.units, t('stack.end')) + removedNote + '</div>' +
          '<div class="record__col">' + priceChart(lot, pf.plan, rules, day, t('chart.captionRecord')) + '</div>' +
        '</div>' +
        '<div class="record__grid">' +
          '<div class="record__col"><h3>' + esc(t('rec.docs')) + '</h3>' + docs + '</div>' +
          '<div class="record__col"><h3>' + esc(t('rec.log')) + '</h3>' + logTable + '</div>' +
        '</div>' +
        '<p class="sample-note">' + esc(t('common.sample')) + ' · ' + esc(t('rec.co2', { n: num(sim.co2Kg) })) + '</p>' +
      '</section>';
    U.hydrateIcons($('#rpLot'));
    $('#rpLotSel').addEventListener('change', function (e) { location.hash = '#/bao-cao/' + e.target.value; });
  }

  var LOG_TONE = { approve: 'pill--ok', reject: 'pill--danger', blocked: 'pill--danger', undo: 'pill--warn', rules: 'pill--info', allocation: 'pill--info', export: '', system: 'pill--dark' };
  function logTableHTML(list) {
    return '<table class="tbl tbl--log"><thead><tr><th>' + esc(t('log.time')) + '</th><th>' + esc(t('log.who')) + '</th><th>' + esc(t('log.event')) + '</th></tr></thead><tbody>' +
      list.map(function (e) {
        var w = who(e.persona);
        return '<tr><td class="small nowrap">' + esc(I.dateTime(e.at)) + '</td><td class="small"><b>' + esc(w.name) + '</b><br><span class="muted">' + esc(w.role) + '</span></td>' +
          '<td><span class="pill ' + (LOG_TONE[e.type] || '') + '">' + esc(t('lt.' + e.type)) + '</span> <span class="small">' + esc(logText(e)) + '</span></td></tr>';
      }).join('') + '</tbody></table>';
  }

  var logFilter = 'all';
  function paintLog() {
    var list = st().log.filter(function (e) { return logFilter === 'all' || e.type === logFilter; });
    $('#rpLog').innerHTML = '<section class="card"><div class="card__head card__head--wrap"><h3>' + esc(t('log.all')) + '</h3>' +
      '<div class="card__tools"><select class="select select--sm" id="logFilter" aria-label="' + esc(t('log.filter')) + '">' +
        option('all', t('log.filterAll'), logFilter === 'all') + Object.keys(LOG_TONE).map(function (k) { return option(k, t('lt.' + k), logFilter === k); }).join('') +
      '</select><button class="btn btn--outline btn--sm" data-action="export-log">' + icon('download', 'ico--sm') + esc(t('log.csv')) + '</button>' +
      '<button class="btn btn--outline btn--sm" data-action="export-lots">' + icon('download', 'ico--sm') + esc(t('log.financeCsv')) + '</button></div></div>' +
      (list.length ? '<div class="tablewrap tablewrap--tall">' + logTableHTML(list) + '</div>' : '<p class="muted small pad">' + esc(t('log.empty')) + '</p>') +
    '</section>';
    U.hydrateIcons($('#rpLog'));
    $('#logFilter').addEventListener('change', function (e) { logFilter = e.target.value; paintLog(); });
  }

  /* ======================================================================
     SCREEN 1 — OWNER RULES
     ====================================================================== */
  var rulesDraft = null;
  var previewLot = 'L01';

  function renderRules() {
    if (!rulesDraft) rulesDraft = S.clone(R());
    view.innerHTML = '<div class="rules">' + rulesFormHTML(rulesDraft) + rulesSideHTML(rulesDraft) + '</div>';
    U.hydrateIcons(view);
    countAll(view);
    $$('.range', view).forEach(U.paintRange);
  }

  function cardHead(ico, title, sub) {
    return '<div class="card__head"><h3>' + icon(ico, 'ico--sm') + esc(title) + '</h3>' + (sub ? '<span class="muted small">' + esc(sub) + '</span>' : '') + '</div>';
  }
  function rangeField(key, label, unitTxt, value, min, max, step, hint) {
    return '<label class="field"><span class="field__label">' + esc(label) + ' <output class="out" data-unit="' + esc(unitTxt) + '">' + value + ' ' + esc(unitTxt) + '</output></span>' +
      '<input type="range" class="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-rule="' + key + '">' +
      '<span class="field__hint">' + esc(hint) + '</span></label>';
  }
  function numField(key, label, unitTxt, value, min, max, step) {
    return '<label class="field"><span class="field__label">' + esc(label) + '</span><div class="numrow"><input class="input input--num" type="number" min="' + min + '" max="' + max + '" step="' + step + '" data-rule="' + key + '" value="' + value + '"><span>' + esc(unitTxt) + '</span></div></label>';
  }
  function seg(action, attrs, items, cls, aria) {
    return '<div class="seg' + (cls ? ' ' + cls : '') + '" role="group"' + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + items.map(function (it) {
      return '<button type="button" data-action="' + action + '" ' + attrs + ' data-v="' + it.v + '" aria-pressed="' + it.on + '">' + esc(it.label) + '</button>';
    }).join('') + '</div>';
  }

  function rulesFormHTML(r) {
    var brandRows = E.saleChannels().map(function (c) {
      var o = r.brandByChannel[c.id];
      var v = o === true ? 'show' : (o === false ? 'hide' : 'default');
      return '<div class="brandrow">' + channelDot(c.id) + '<span>' + esc(L(c.label)) + '</span>' +
        seg('brand-ch', 'data-ch="' + c.id + '"', [
          { v: 'default', label: t('ru.bDefault'), on: v === 'default' },
          { v: 'show', label: t('ru.bShow'), on: v === 'show' },
          { v: 'hide', label: t('ru.bHide'), on: v === 'hide' }
        ], 'seg--sm', t('ru.brandAt', { channel: L(c.label) })) + '</div>';
    }).join('');

    var regions = D.REGIONS.map(function (g) {
      var on = r.excludedRegions.indexOf(g.id) !== -1;
      var here = D.CHANNELS.filter(function (c) { return c.regions.indexOf(g.id) !== -1; }).map(function (c) { return L(c.label); });
      return '<button type="button" class="chip' + (on ? ' is-excl' : '') + '" data-action="region" data-r="' + g.id + '" aria-pressed="' + on + '" title="' + esc(t('ru.regionTitle', { list: here.join(', ') })) + '">' +
        icon(on ? 'lock' : 'pin', 'ico--sm') + esc(L(g.label)) + '</button>';
    }).join('');

    var perUnit = t('ru.perUnit');
    return '<form class="rules__form" id="rulesForm" novalidate onsubmit="return false">' +
      '<section class="card">' + cardHead('shield', t('ru.price'), t('ru.priceSub')) +
        rangeField('floorPct', t('ru.floor'), t('ru.floorUnit'), r.floorPct, 20, 90, 5, t('ru.floorHint')) +
        rangeField('maxDiscountPct', t('ru.cap'), '%', r.maxDiscountPct, 0, 80, 5, t('ru.capHint')) +
        '<p class="formmsg" id="minPriceMsg">' + icon('info', 'ico--sm') + esc(t('ru.minMsg', { pct: Math.max(r.floorPct, 100 - r.maxDiscountPct) })) + '</p>' +
      '</section>' +
      '<section class="card">' + cardHead('users', t('ru.buyers')) +
        '<label class="field"><span class="field__label">' + esc(t('ru.buyerCap')) + '</span>' +
          '<div class="numrow"><input class="input input--num" type="number" min="1" max="50" step="1" data-rule="perBuyerCap" value="' + r.perBuyerCap + '"><span>' + esc(t('ru.buyerUnit')) + '</span></div>' +
          '<span class="field__hint">' + esc(t('ru.buyerHint')) + '</span></label>' +
        '<div class="field"><span class="field__label">' + esc(t('ru.brandDefault')) + '</span>' +
          seg('brand-default', '', [{ v: '1', label: t('ru.brandShow'), on: !!r.showBrand }, { v: '0', label: t('ru.brandHide'), on: !r.showBrand }]) + '</div>' +
        '<div class="field"><span class="field__label">' + esc(t('ru.perChannel')) + '</span>' + brandRows + '</div>' +
      '</section>' +
      '<section class="card">' + cardHead('pin', t('ru.regions')) +
        '<p class="small muted">' + esc(t('ru.regionsHint')) + '</p>' +
        '<div class="chips chips--wrap">' + regions + '</div>' +
      '</section>' +
      '<section class="card">' + cardHead('clock', t('ru.safety')) +
        '<div class="safety">' +
          '<div class="safety__row"><span class="pill pill--ok">' + esc(t('ru.dry')) + '</span><div class="numrow"><span>' + esc(t('ru.dryText')) + '</span><input class="input input--num" type="number" min="30" max="90" data-rule="safetyDays.kho" value="' + r.safetyDays.kho + '"><span>' + esc(t('ru.days')) + '</span></div></div>' +
          '<div class="safety__row is-config"><span class="pill pill--info">' + esc(t('ru.chilled')) + '</span><div class="numrow"><span>' + esc(t('ru.chilledText')) + '</span><input class="input input--num" type="number" min="7" max="30" data-rule="safetyDays.lanh" value="' + r.safetyDays.lanh + '"><span>' + esc(t('ru.days')) + '</span></div><small class="muted">' + esc(t('ru.chilledNote')) + '</small></div>' +
          '<div class="safety__row is-off"><span class="pill pill--danger">' + esc(t('ru.fresh')) + '</span><span class="small">' + icon('lock', 'ico--sm') + ' ' + esc(t('ru.refused')) + '</span></div>' +
          '<div class="safety__row is-off"><span class="pill pill--danger">' + esc(t('ru.expired')) + '</span><span class="small">' + icon('lock', 'ico--sm') + ' ' + esc(t('ru.expiredText')) + '</span></div>' +
        '</div>' +
        '<label class="field"><span class="field__label">' + esc(t('ru.donMin')) + '</span><div class="numrow"><input class="input input--num" type="number" min="7" max="60" data-rule="donationMinDays" value="' + r.donationMinDays + '"><span>' + esc(t('ru.days')) + '</span></div></label>' +
      '</section>' +
      '<section class="card">' + cardHead('coins', t('ru.costs'), t('ru.costsSub')) +
        '<div class="grid2">' +
          numField('handlingPerUnit', t('ru.handling'), perUnit, r.handlingPerUnit, 0, 10000, 100) +
          numField('destroyCostPerUnit', t('ru.destroy'), perUnit, r.destroyCostPerUnit, 0, 20000, 100) +
          numField('liquidationPct', t('ru.liq'), t('ru.pctList'), r.liquidationPct, 0, 80, 1) +
          numField('returnShipPerUnit', t('ru.retShip'), perUnit, r.returnShipPerUnit, 0, 10000, 100) +
        '</div>' +
      '</section>' +
    '</form>';
  }

  function rulesSideHTML(r) {
    var dirty = JSON.stringify(r) !== JSON.stringify(R());
    var p = S.persona();
    return '<aside class="rules__side">' +
      '<div class="card sticky">' +
        '<div class="card__head"><h3>' + esc(t('ru.preview')) + '</h3>' + (dirty ? '<span class="pill pill--warn">' + esc(t('ru.unsaved')) + '</span>' : '<span class="pill pill--ok">' + icon('check') + esc(t('ru.active')) + '</span>') + '</div>' +
        rulesSummary(r) +
        '<label class="field"><span class="field__label">' + esc(t('ru.tryLot')) + '</span><select class="select select--sm" id="previewLot">' +
          D.LOTS.map(function (l) { return option(l.id, l.lotNo + ' · ' + lotName(l), l.id === previewLot); }).join('') + '</select></label>' +
        ladderTable(E.lotById(previewLot), r) +
        impactBox(r) +
        '<div class="rules__btns">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-action="rules-default">' + esc(t('ru.default')) + '</button>' +
          '<button type="button" class="btn btn--outline btn--sm" data-action="rules-discard"' + (dirty ? '' : ' disabled') + '>' + esc(t('ru.discard')) + '</button>' +
          '<button type="button" class="btn btn--primary btn--sm" data-action="rules-save"' + (dirty && p.canApprove ? '' : ' disabled') + '>' + icon('check', 'ico--sm') + esc(t('ru.save')) + '</button>' +
        '</div>' +
        (!p.canApprove ? '<p class="small muted">' + esc(t('ru.noRight', { role: L(p.role) })) + '</p>' : '') +
      '</div>' +
    '</aside>';
  }

  function rulesSummary(r) {
    var hidden = E.saleChannels().filter(function (c) { return !E.brandVisible(c.id, r); }).map(function (c) { return L(c.label); });
    var excl = r.excludedRegions.map(regionLabel);
    var blocked = D.CHANNELS.filter(function (c) { return E.channelAccess(c, r).blocked; }).map(function (c) { return L(c.label); });
    function li(ico, text) { return '<li>' + icon(ico, 'ico--sm') + esc(text) + '</li>'; }
    return '<ul class="summary">' +
      li('shield', t('sum.floor', { pct: Math.max(r.floorPct, 100 - r.maxDiscountPct) })) +
      li('tag', t('sum.cap', { pct: r.maxDiscountPct })) +
      li('users', t('sum.buyer', { n: r.perBuyerCap })) +
      li('eye', hidden.length ? t('sum.brandHidden', { list: hidden.join(', ') }) : t('sum.brandAll')) +
      li('pin', excl.length ? t('sum.regions', { list: excl.join(', ') }) : t('sum.noRegions')) +
      (blocked.length ? li('lock', t('sum.blocked', { list: blocked.join(', ') })) : '') +
      li('clock', t('sum.safety', { n: r.safetyDays.kho, d: r.donationMinDays })) +
    '</ul>';
  }

  function ladderTable(lot, r) {
    var safety = E.safetyDays(lot, r);
    var steps = (r.ladder || D.DEFAULT_LADDER).slice().sort(function (a, b) { return b.minDays - a.minDays; });
    var rows = steps.map(function (s, idx) {
      var upper = idx === 0 ? null : steps[idx - 1].minDays - 1;
      if (upper != null && upper <= safety) return '';
      var from = Math.max(s.minDays, safety + 1);
      var pr = E.priceAt(lot, from, r);
      var note = pr.clamped ? '<span class="neg">' + esc(t(pr.min.binding === 'floor' ? 'lad.clampFloor' : 'lad.clampCap')) + '</span>' : esc(t(s.cut ? 'lad.onStep' : 'lad.hold'));
      return '<tr' + (pr.clamped ? ' class="is-clamp"' : '') + '><td>' + (upper == null ? '≥ ' + from : from + '–' + upper) + '</td><td class="num">' + s.cut + '%</td><td class="num"><b>' + esc(money(pr.price)) + '</b></td><td class="small">' + note + '</td></tr>';
    }).join('');
    return '<table class="tbl tbl--ladder"><thead><tr><th>' + esc(t('lad.left')) + '</th><th class="num">' + esc(t('lad.step')) + '</th><th class="num">' + esc(t('lad.price')) + '</th><th></th></tr></thead><tbody>' + rows +
      '<tr class="is-off"><td>≤ ' + safety + '</td><td colspan="3">' + icon('lock', 'ico--sm') + ' ' + esc(t('lad.pulled', { action: actLabel(E.postSafetyAction(lot, safety, r).action).toLowerCase() })) + '</td></tr></tbody></table>' +
      '<p class="small muted">' + esc(t('ru.ladderNote')) + '</p>';
  }

  function recommendedNet(rules) {
    return D.LOTS.reduce(function (s, l) {
      var a = E.recommend(l, l.daysLeft, rules).action;
      return s + E.simulateLot(l, { action: a, allocations: E.defaultAllocation(l, a, rules) }, rules, {}).money.net;
    }, 0);
  }

  function impactBox(r) {
    var next = recommendedNet(r), diff = next - recommendedNet(R());
    return '<div class="impact"><span>' + esc(t('ru.impact')) + '</span>' +
      '<div>' + counter('impact', next, 'short') +
      (Math.abs(diff) > 1 ? '<span class="pill ' + (diff >= 0 ? 'pill--ok' : 'pill--danger') + '">' + esc(t('ru.impactDiff', { delta: signed(diff) })) + '</span>' : '<span class="muted small">' + esc(t('ru.impactSame')) + '</span>') + '</div></div>';
  }

  var RULE_LIMITS = {
    floorPct: [20, 90], maxDiscountPct: [0, 80], perBuyerCap: [1, 50], 'safetyDays.kho': [30, 90], 'safetyDays.lanh': [7, 30],
    donationMinDays: [7, 60], handlingPerUnit: [0, 10000], destroyCostPerUnit: [0, 20000], liquidationPct: [0, 80], returnShipPerUnit: [0, 10000]
  };
  var rulesTimer = null;

  function setRule(path, value) {
    var parts = path.split('.');
    if (parts.length === 2) rulesDraft[parts[0]][parts[1]] = value;
    else rulesDraft[path] = value;
  }

  function onRuleInput(el) {
    var key = el.dataset.rule;
    var lim = RULE_LIMITS[key] || [0, 1e9];
    var v = Math.round(+el.value);
    if (isNaN(v)) return;
    var clamped = Math.max(lim[0], Math.min(lim[1], v));
    el.setAttribute('aria-invalid', String(clamped !== v));
    setRule(key, clamped);
    if (el.type === 'range') {
      U.paintRange(el);
      var out = el.parentNode.querySelector('output');
      if (out) out.textContent = clamped + ' ' + out.dataset.unit;
    }
    clearTimeout(rulesTimer);
    rulesTimer = setTimeout(refreshRulesSide, el.type === 'range' ? 60 : 250);
  }

  /* Only the preview column is redrawn so the form keeps focus. */
  function refreshRulesSide() {
    var side = $('.rules__side', view);
    if (!side) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = rulesSideHTML(rulesDraft);
    side.replaceWith(tmp.firstChild);
    countAll($('.rules__side', view));
    var msgEl = $('#minPriceMsg');
    if (msgEl) msgEl.innerHTML = icon('info', 'ico--sm') + esc(t('ru.minMsg', { pct: Math.max(rulesDraft.floorPct, 100 - rulesDraft.maxDiscountPct) }));
  }

  function saveRules() {
    var p = S.persona();
    if (!p.canApprove) { U.toast(t('ru.noRight', { role: L(p.role) }), 'error'); return; }
    var before = R(), after = rulesDraft, changes = [];
    ['floorPct', 'maxDiscountPct', 'perBuyerCap', 'showBrand', 'donationMinDays', 'handlingPerUnit', 'destroyCostPerUnit', 'liquidationPct', 'returnShipPerUnit']
      .forEach(function (k) { if (before[k] !== after[k]) changes.push({ k: k, from: before[k], to: after[k] }); });
    if (before.safetyDays.kho !== after.safetyDays.kho) changes.push({ k: 'safetyKho', from: before.safetyDays.kho, to: after.safetyDays.kho });
    if (before.safetyDays.lanh !== after.safetyDays.lanh) changes.push({ k: 'safetyLanh', from: before.safetyDays.lanh, to: after.safetyDays.lanh });
    if (before.excludedRegions.slice().sort().join() !== after.excludedRegions.slice().sort().join()) changes.push({ k: 'regions', list: after.excludedRegions.slice() });
    if (JSON.stringify(before.brandByChannel) !== JSON.stringify(after.brandByChannel)) changes.push({ k: 'brand' });
    st().rules = S.clone(after);
    // Saved splits into channels that are now blocked are zeroed so nothing breaks the new rules.
    Object.keys(st().allocations).forEach(function (id) {
      var a = st().allocations[id];
      D.CHANNELS.forEach(function (c) { if (E.channelAccess(c, after).blocked && a[c.id]) a[c.id] = 0; });
    });
    S.addLog({ type: 'rules', lotId: null, msg: { key: 'lm.rules', vars: { changes: changes } } });
    touch();
    rulesDraft = null;
    renderRules();
    U.toast(t('toast.rulesSaved'));
  }

  /* ======================================================================
     Exports
     ====================================================================== */
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }
  function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function stamp() { var d = new Date(); return isoDay(d) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }
  function H(keys) { return keys.map(function (k) { return t('csv.' + k); }); }

  function exportLots() {
    var rows = [H(['id', 'lotNo', 'sku', 'product', 'brand', 'category', 'warehouse', 'expiry', 'daysLeft', 'stock', 'unit', 'list',
      'status', 'action', 'decidedBy', 'decidedAt', 'sold', 'donated', 'returned', 'destroyed',
      'revenue', 'refund', 'fees', 'freight', 'handling', 'transfer', 'disposal', 'planNet', 'baseline', 'counted', 'diff', 'note'])];
    D.LOTS.forEach(function (lot) {
      var p = projected(lot), pf = p.pf, m = p.sim.money, u = p.sim.units;
      var counted = pf.status === 'approved' ? m.net : p.base.net;
      rows.push([lot.id, lot.lotNo, lot.sku, lotName(lot), lot.brand, L(D.CATEGORIES[lot.cat].label), whLabel(lot.warehouse),
        isoDay(S.expiryOf(lot)), lot.daysLeft, lot.qty, unit(lot), lot.base,
        t('status.' + pf.status), actLabel(pf.status === 'approved' ? pf.action : pf.rec.action),
        pf.decision ? who(pf.decision.persona).name : '', pf.decision ? I.dateTime(pf.decision.at) : '',
        u.sold, u.donated, u.returned, u.destroyed,
        Math.round(m.revenue), Math.round(m.refund), Math.round(m.fees), Math.round(m.shipping), Math.round(m.handling), Math.round(m.transfer), Math.round(m.destroy), Math.round(m.net),
        Math.round(p.base.net), Math.round(counted), Math.round(counted - p.base.net), t('common.sample')]);
    });
    var tt = portfolio(null);
    var total = new Array(rows[0].length).fill('');
    total[0] = t('csv.total');
    total[12] = t('csv.approvedN', { n: tt.approved });
    total[28] = Math.round(tt.base); total[29] = Math.round(tt.net); total[30] = Math.round(tt.net - tt.base); total[31] = t('common.sample');
    rows.push([]); rows.push(total);
    U.download('mrwowo-lots-' + stamp() + '.csv', csv(rows), 'text/csv;charset=utf-8');
    S.addLog({ type: 'export', lotId: null, msg: { key: 'lm.exportLots', vars: { n: D.LOTS.length } } });
    touch();
    U.toast(t('toast.exportLots'));
  }

  function exportLog() {
    var rows = [H(['time', 'operator', 'role', 'type', 'id', 'lotNo', 'action', 'detail'])];
    st().log.forEach(function (e) {
      var lot = e.lotId ? E.lotById(e.lotId) : null, w = who(e.persona);
      rows.push([I.dateTime(e.at), w.name, w.role, t('lt.' + e.type), e.lotId || '', lot ? lot.lotNo : '', e.action ? actLabel(e.action) : '', logText(e)]);
    });
    U.download('mrwowo-decision-log-' + stamp() + '.csv', csv(rows), 'text/csv;charset=utf-8');
    S.addLog({ type: 'export', lotId: null, msg: { key: 'lm.exportLog', vars: { n: rows.length - 1 } } });
    touch();
    paintLog();
    U.toast(t('toast.exportLog'));
  }

  function exportLotCsv(id) {
    var lot = E.lotById(id), p = projected(lot), sim = p.sim, m = sim.money;
    var rows = [[t('csv.record'), lot.lotNo, lotName(lot), lot.brand, t('common.sample')], [], H(['date', 'kind', 'channel', 'qty', 'price', 'amount'])];
    sim.events.forEach(function (e) {
      rows.push([isoDay(S.dateAt(e.day)), t('ev.' + e.kind), e.channel ? chLabel(e.channel) : '', e.units, e.price, e.units * e.price]);
    });
    rows.push([]);
    [['flow.revenue', m.revenue], ['flow.refund', m.refund], ['flow.fees', -m.fees], ['flow.ship', -m.shipping], ['flow.handling', -m.handling],
      ['flow.transfer', -m.transfer], ['flow.destroy', -m.destroy], ['flow.net', m.net]].forEach(function (r) { rows.push([t(r[0]), '', '', '', '', Math.round(r[1])]); });
    rows.push([t('csv.baseline'), '', '', '', '', Math.round(p.base.net)]);
    U.download('mrwowo-lot-' + lot.lotNo + '.csv', csv(rows), 'text/csv;charset=utf-8');
    S.addLog({ type: 'export', lotId: id, msg: { key: 'lm.exportLot', vars: { lot: lot.lotNo, fmt: 'CSV' } } });
    touch();
    U.toast(t('toast.exportLot', { lot: lot.lotNo }));
  }

  function exportLotJson(id) {
    var lot = E.lotById(id), p = projected(lot);
    var data = {
      note: t('common.sample'),
      generatedAt: new Date().toISOString(),
      language: I.lang(),
      owner: L(D.OWNER.name),
      lot: Object.assign({}, lot, { name: lotName(lot), unit: unit(lot), story: L(lot.story), expiry: isoDay(S.expiryOf(lot)) }),
      rules: R(),
      status: p.pf.status,
      decision: p.pf.decision,
      plan: p.pf.plan,
      projection: { money: p.sim.money, units: p.sim.units, byChannel: p.sim.byChannel, docs: p.sim.docs, removedDay: p.sim.removedDay,
        disposition: p.sim.disposition && p.sim.disposition.action, co2KgEstimate: p.sim.co2Kg },
      baseline: p.base,
      log: st().log.filter(function (e) { return e.lotId === id; }).map(function (e) {
        var w = who(e.persona);
        return { at: e.at, operator: w.name, role: w.role, type: e.type, text: logText(e) };
      })
    };
    U.download('mrwowo-lot-' + lot.lotNo + '.json', JSON.stringify(data, null, 2), 'application/json');
    S.addLog({ type: 'export', lotId: id, msg: { key: 'lm.exportLot', vars: { lot: lot.lotNo, fmt: 'JSON' } } });
    touch();
    U.toast(t('toast.exportLot', { lot: lot.lotNo }));
  }

  /* ======================================================================
     3-minute demo script
     ====================================================================== */
  var TOUR = [
    { at: '0:00', route: 'lo-hang' },
    { at: '0:30', route: 'lo-hang', play: true },
    { at: '1:10', route: 'luat' },
    { at: '1:40', route: 'duyet' },
    { at: '2:15', route: 'kenh', play: true },
    { at: '2:35', route: 'bao-cao' },
    { at: '3:00', route: 'bao-cao' }
  ];

  function renderTour() {
    var el = $('#tour'), tr = st().tour;
    el.hidden = !tr.open;
    if (!tr.open) return;
    var s = TOUR[tr.step], n = tr.step + 1;
    var goLabel = route.name !== s.route ? t('tour.go') : (playTimer ? t('tour.pause') : t('tour.play'));
    el.setAttribute('aria-label', t('nav.tour'));
    el.innerHTML =
      '<div class="tour__head"><span class="pill pill--dark">' + icon('clock') + s.at + '</span><b>' + esc(t('tour.title', { i: n, n: TOUR.length })) + '</b>' +
      '<button class="icon-btn icon-btn--sm" data-action="tour-toggle" aria-label="' + esc(t('tour.close')) + '">' + icon('x') + '</button></div>' +
      '<h3>' + esc(t('tour.' + n + '.t')) + '</h3><p>' + esc(t('tour.' + n + '.x')) + '</p>' +
      '<div class="tour__dots">' + TOUR.map(function (_, i) { return '<i class="' + (i === tr.step ? 'is-on' : (i < tr.step ? 'is-done' : '')) + '"></i>'; }).join('') + '</div>' +
      '<div class="tour__btns">' +
        '<button class="btn btn--ghost btn--xs" data-action="tour-prev"' + (tr.step === 0 ? ' disabled' : '') + '>' + esc(t('tour.prev')) + '</button>' +
        (route.name !== s.route || s.play ? '<button class="btn btn--outline btn--xs" data-action="tour-go">' + esc(goLabel) + '</button>' : '') +
        '<button class="btn btn--primary btn--xs" data-action="tour-next"' + (tr.step === TOUR.length - 1 ? ' disabled' : '') + '>' + esc(t('tour.next')) + '</button>' +
      '</div>';
  }

  function tourGo(step) {
    var tr = st().tour;
    tr.step = Math.max(0, Math.min(TOUR.length - 1, step));
    S.save();
    var s = TOUR[tr.step];
    if (route.name !== s.route) location.hash = '#/' + s.route; else renderTour();
  }

  /* ======================================================================
     Sidebar, menu, operator, badges, language
     ====================================================================== */
  function openNav() { $('#side').classList.add('is-open'); $('.side-scrim').hidden = false; }
  function closeNav() { $('#side').classList.remove('is-open'); $('.side-scrim').hidden = true; }

  function syncBadges() {
    var n = D.LOTS.filter(function (l) { return S.planFor(l).status === 'pending'; }).length;
    var b = $('#badgePending');
    b.textContent = n;
    b.hidden = !n;
  }

  function syncPersona() {
    $('#personaSelect').innerHTML = D.PERSONAS.map(function (p) { return option(p.id, p.name + ' — ' + L(p.role), p.id === st().persona); }).join('');
    $('#personaAva').textContent = S.persona().initials;
  }

  function syncStatic() {
    $('#ownerName').textContent = L(D.OWNER.short);
    $('#ownerAva').textContent = D.OWNER.initials;
    $('#contrastLabel').textContent = t(U.getContrast() ? 'menu.contrastOff' : 'menu.contrastOn');
    syncPersona();
    syncTimebar();
    syncChrome();
  }

  function toggleMenu(force) {
    var pop = $('#menuPop'), btn = $('[data-action="menu-toggle"]');
    var open = force != null ? force : pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  I.onChange(function () {
    syncStatic();
    renderedIds = '';
    render();
    renderTour();
    if (drawerLot) renderDrawer(drawerLot);
    U.toast(t('toast.lang'));
  });

  /* ======================================================================
     Events (delegated)
     ====================================================================== */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    var lotCard = e.target.closest('[data-lot]');
    var focusLink = e.target.closest('[data-focus-lot]');
    if (focusLink) { focusLot = focusLink.dataset.focusLot; st().ui.approvalTab = 'pending'; }
    if (!a) {
      if (lotCard && view.contains(lotCard)) openDrawer(lotCard.dataset.lot);
      if (!e.target.closest('.menu')) toggleMenu(false);
      return;
    }
    var action = a.dataset.action;
    if (a.getAttribute('aria-disabled') === 'true' && ['approve', 'approve-all', 'reject'].indexOf(action) === -1) return;
    switch (action) {
      case 'nav-open': openNav(); break;
      case 'nav-close': closeNav(); break;
      case 'menu-toggle': toggleMenu(); break;
      case 'seed':
        toggleMenu(false);
        drafts = {}; allocDraft = {}; rulesDraft = null;
        S.seedScenario(); touch(); render();
        U.toast(t('toast.seed'));
        break;
      case 'reset':
        toggleMenu(false);
        if (!window.confirm(t('toast.resetConfirm'))) break;
        togglePlay(false);
        drafts = {}; allocDraft = {}; rulesDraft = null; lastVals = {};
        S.reset(); touch(); syncStatic(); render();
        U.toast(t('toast.reset'));
        break;
      case 'export-lots': toggleMenu(false); exportLots(); break;
      case 'export-log': exportLog(); break;
      case 'export-lot': exportLotCsv(a.dataset.id); break;
      case 'export-json': exportLotJson(a.dataset.id); break;
      case 'print':
        S.addLog({ type: 'export', lotId: reportLotId(), msg: { key: 'lm.print', vars: { lot: E.lotById(reportLotId()).lotNo } } });
        touch();
        window.print();
        break;
      case 'contrast':
        U.setContrast(!U.getContrast());
        $('#contrastLabel').textContent = t(U.getContrast() ? 'menu.contrastOff' : 'menu.contrastOn');
        toggleMenu(false);
        U.toast(t(U.getContrast() ? 'toast.contrastOn' : 'toast.contrastOff'));
        break;
      case 'play': togglePlay(); if (route.name === 'kenh') updateChannels(); renderTour(); break;
      case 'day-step': setDay(st().day + (+a.dataset.step)); break;
      case 'day-reset': togglePlay(false); setDay(0); break;
      case 'drawer-close': closeDrawer(); break;
      case 'open-lot': openDrawer(a.dataset.id); break;
      // Lot board
      case 'zone': st().ui.filter = a.dataset.z; S.save(); $('#zoneChips').innerHTML = zoneChips(boardLots(st().day).counts); paintBoardList(boardLots(st().day), true); break;
      case 'view': st().ui.view = a.dataset.v; S.save(); render(); break;
      case 'clear-filters': Object.assign(st().ui, { filter: 'all', cat: '', wh: '', q: '' }); S.save(); render(); break;
      // Approvals
      case 'appr-tab': st().ui.approvalTab = a.dataset.tab; S.save(); render(); break;
      case 'approve': if (approve(a.dataset.id)) render(); else if (route.name === 'duyet') refreshApprItem(a.dataset.id); break;
      case 'reject': reject(a.dataset.id); render(); break;
      case 'undo': undo(a.dataset.id); render(); break;
      case 'approve-all': approveAll(); break;
      // Channel split
      case 'alloc-auto': {
        var lot = E.lotById(channelLotId()), act = channelAction(lot);
        allocDraft[lot.id] = Object.assign(E.defaultAllocation(lot, act, R()), { __action: act });
        paintChannels(lot);
        break;
      }
      case 'alloc-save': {
        var lot2 = E.lotById(channelLotId()), d2 = allocDraft[lot2.id];
        if (!d2) break;
        if (E.allocTotal(d2) > lot2.qty) { U.toast(t('toast.allocOver'), 'error'); break; }
        S.setAllocation(lot2.id, d2, d2.__action);
        delete allocDraft[lot2.id];
        S.addLog({ type: 'allocation', lotId: lot2.id, msg: { key: 'lm.alloc', vars: { lot: lot2.lotNo,
          split: D.CHANNELS.map(function (c) { return { ch: c.id, n: d2[c.id] || 0 }; }) } } });
        touch();
        paintChannels(lot2);
        U.toast(t('toast.allocSaved', { lot: lot2.lotNo }));
        break;
      }
      // Report
      case 'report-lot': location.hash = '#/bao-cao/' + a.dataset.id; break;
      // Rules
      case 'brand-default': rulesDraft.showBrand = a.dataset.v === '1'; renderRules(); break;
      case 'brand-ch':
        if (a.dataset.v === 'default') delete rulesDraft.brandByChannel[a.dataset.ch];
        else rulesDraft.brandByChannel[a.dataset.ch] = a.dataset.v === 'show';
        renderRules();
        break;
      case 'region': {
        var list = rulesDraft.excludedRegions, i = list.indexOf(a.dataset.r);
        if (i === -1) list.push(a.dataset.r); else list.splice(i, 1);
        renderRules();
        break;
      }
      case 'rules-save': saveRules(); break;
      case 'rules-discard': rulesDraft = null; renderRules(); break;
      case 'rules-default': rulesDraft = S.clone(D.DEFAULT_RULES); renderRules(); U.toast(t('toast.rulesDefault')); break;
      // Tour
      case 'tour-toggle': st().tour.open = !st().tour.open; S.save(); renderTour(); break;
      case 'tour-next': tourGo(st().tour.step + 1); break;
      case 'tour-prev': tourGo(st().tour.step - 1); break;
      case 'tour-go': {
        var s = TOUR[st().tour.step];
        if (route.name !== s.route) location.hash = '#/' + s.route;
        else if (s.play) { togglePlay(); renderTour(); }
        break;
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); toggleMenu(false); closeNav(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-lot]')) {
      e.preventDefault();
      openDrawer(e.target.dataset.lot);
    }
  });

  view.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.field && el.dataset.id) {
      var dr = draftFor(E.lotById(el.dataset.id));
      if (el.dataset.field === 'extra') { dr.extraCut = +el.value; U.paintRange(el); refreshApprItem(el.dataset.id); }
      else if (el.dataset.field === 'note') dr.note = el.value;
      return;
    }
    if (el.dataset.alloc) {
      var lot = E.lotById(channelLotId()), act = channelAction(lot);
      var d = allocDraft[lot.id] || currentAlloc(lot, act);
      d[el.dataset.alloc] = Math.max(0, Math.floor(+el.value || 0));
      d.__action = act;
      allocDraft[lot.id] = d;
      clearTimeout(allocTimer);
      allocTimer = setTimeout(function () {
        var focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.alloc : null;
        paintChannels(lot);
        if (focused) {
          var again = view.querySelector('[data-alloc="' + focused + '"]');
          if (again) again.focus();
        }
      }, 350);
      return;
    }
    if (el.dataset.rule) onRuleInput(el);
  });

  view.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'previewLot') { previewLot = el.value; refreshRulesSide(); return; }
    if (el.dataset.field === 'action' && el.dataset.id) {
      var dr = draftFor(E.lotById(el.dataset.id));
      dr.action = el.value;
      dr.extraCut = 0;
      refreshApprItem(el.dataset.id);
    }
  });

  $('#personaSelect').addEventListener('change', function (e) {
    st().persona = e.target.value;
    S.save();
    syncPersona();
    var p = S.persona();
    U.toast(t('toast.persona', { name: p.name, role: L(p.role) }));
    render();
  });

  window.addEventListener('hashchange', go);
  window.addEventListener('beforeprint', function () { closeDrawer(true); });

  /* ======================================================================
     Boot
     ====================================================================== */
  $$('[data-logo]').forEach(function (el) { el.outerHTML = U.logo(30); });
  $$('[data-lang-switch]').forEach(function (el) { el.outerHTML = I.switcher(); });
  U.hydrateIcons();
  I.applyDom();
  if (!location.hash) history.replaceState(null, '', '#/lo-hang');
  route = parseHash();
  syncStatic();
  syncBadges();
  go();
})();
