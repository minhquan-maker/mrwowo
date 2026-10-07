/*
 * mrwowo — shop.js (buyer storefront)
 *
 * Buyers only see lots the seller has approved for sale. Everything the seller set
 * still applies here: price steps and the floor, the per-buyer limit, hidden brands,
 * excluded regions and the safety line (a lot disappears when it is reached).
 * Orders are written to the shared store and show up in the seller's lot record.
 */
(function () {
  'use strict';

  var M = window.Mrwowo;
  if (!M || !M.data || !M.engine || !M.ui || !M.store || !M.i18n) return;
  var D = M.data, E = M.engine, U = M.ui, S = M.store, I = M.i18n;
  var t = I.t, L = I.L, esc = U.esc, icon = U.icon;

  var DELIVERY_FEE = 15000;
  var FREE_DELIVERY_OVER = 200000;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  function st() { return S.state; }
  function sh() { return S.state.shop; }

  var mode = 'all';          // 'all' | 'saved'
  var overlay = null;        // { kind, id? }
  var checkoutError = '';

  /* ---------- products from the engine ---------- */

  function products() {
    return D.LOTS.map(function (lot) {
      var o = S.offer(lot);
      return {
        lot: lot, offer: o, listed: o.listed,
        price: o.price, list: lot.base, cutPct: o.cutPct || 0,
        left: o.left, expiry: S.expiryOf(lot)
      };
    });
  }
  function productById(id) {
    var lot = E.lotById(id);
    var o = S.offer(lot);
    return { lot: lot, offer: o, listed: o.listed, price: o.price, list: lot.base, cutPct: o.cutPct || 0, left: o.left, expiry: S.expiryOf(lot) };
  }
  function brandOf(p) { return p.offer.brandVisible === false ? t('sh.genuine') : p.lot.brand; }
  function maxQty(p) { return Math.max(0, Math.min(p.offer.cap || 0, p.offer.available || 0)); }
  function art(lot) { return U.packArt(lot.art, lot.c1, lot.c2, 'sh' + lot.id); }

  var SORTS = ['featured', 'price-asc', 'price-desc', 'discount', 'expiry-soon', 'expiry-late'];
  function sortProducts(list, key) {
    var f = {
      'price-asc': function (a, b) { return a.price - b.price; },
      'price-desc': function (a, b) { return b.price - a.price; },
      'discount': function (a, b) { return b.cutPct - a.cutPct; },
      'expiry-soon': function (a, b) { return a.left - b.left; },
      'expiry-late': function (a, b) { return b.left - a.left; },
      'featured': function (a, b) { return (b.cutPct - a.cutPct) || (a.left - b.left); }
    }[key] || function () { return 0; };
    return list.sort(function (a, b) { return f(a, b) || a.lot.id.localeCompare(b.lot.id); });
  }

  function visible() {
    var q = (sh().q || '').trim().toLowerCase();
    var list = products().filter(function (p) {
      if (!p.listed) return false;
      if (mode === 'saved' && !sh().saved[p.lot.id]) return false;
      if (sh().cat !== 'all' && p.lot.cat !== sh().cat) return false;
      if (q && [L(p.lot.name), brandOf(p), L(D.CATEGORIES[p.lot.cat].label)].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    return sortProducts(list, sh().sort);
  }

  /* ---------- basket ---------- */

  function cartLines() {
    return Object.keys(sh().cart).map(function (id) {
      var p = productById(id);
      var qty = sh().cart[id];
      var ok = p.listed && qty <= maxQty(p);
      return { p: p, qty: qty, ok: ok, total: ok ? p.price * qty : 0 };
    });
  }
  function totals() {
    var lines = cartLines();
    var sub = 0, list = 0, units = 0, bad = 0;
    lines.forEach(function (l) {
      if (!l.ok) { bad++; return; }
      sub += l.total; list += l.p.list * l.qty; units += l.qty;
    });
    var fee = sh().method === 'delivery' && sub > 0 && sub < FREE_DELIVERY_OVER ? DELIVERY_FEE : 0;
    return { lines: lines, sub: sub, save: list - sub, units: units, bad: bad, fee: fee, total: sub + fee };
  }
  function cartCount() { return Object.keys(sh().cart).reduce(function (s, k) { return s + sh().cart[k]; }, 0); }

  function setQty(id, qty) {
    var p = productById(id);
    var max = maxQty(p);
    qty = Math.max(0, Math.min(qty, max));
    if (qty === 0) delete sh().cart[id]; else sh().cart[id] = qty;
    S.save();
    if (qty >= max && max > 0 && qty > 0) U.toast(t('sh.limitReached', { n: max }));
    refresh();
  }

  /* ---------- rendering ---------- */

  function renderCats() {
    var cats = ['all'].concat(Object.keys(D.CATEGORIES));
    $('#cats').innerHTML = (mode === 'saved' ? '<button data-action="view-all" aria-pressed="false">' + icon('arrow-left', 'ico--sm') + '</button>' : '') +
      cats.map(function (c) {
        return '<button data-action="cat" data-cat="' + c + '" aria-pressed="' + (sh().cat === c) + '">' + esc(c === 'all' ? t('sh.all') : L(D.CATEGORIES[c].label)) + '</button>';
      }).join('');
    U.hydrateIcons($('#cats'));
  }

  function renderSort() {
    $('#sort').innerHTML = SORTS.map(function (k) {
      return '<option value="' + k + '"' + (sh().sort === k ? ' selected' : '') + '>' + esc(t('sh.sort.' + k)) + '</option>';
    }).join('');
  }

  function renderHero(all) {
    var hero = $('#hero');
    var plain = mode === 'all' && sh().cat === 'all' && !(sh().q || '').trim();
    hero.hidden = !plain;
    if (!plain) return;
    var listed = all.filter(function (p) { return p.listed; });
    var best = listed.reduce(function (m, p) { return Math.max(m, p.cutPct); }, 0);
    var saved = listed.reduce(function (s, p) { return s + (p.list - p.price); }, 0) / Math.max(1, listed.length);
    hero.innerHTML = '<div class="hero__card"><div style="position:relative;z-index:1">' +
      '<h1>' + t('sh.heroTitle') + '</h1>' +
      '<p>' + esc(t('sh.heroText')) + '</p>' +
      '<ul class="hero__pts"><li>' + icon('shield', 'ico--sm') + esc(t('sh.pt1')) + '</li><li>' + icon('calendar', 'ico--sm') + esc(t('sh.pt2')) + '</li><li>' + icon('tag', 'ico--sm') + esc(t('sh.pt3')) + '</li></ul>' +
      '</div><div class="hero__stats">' +
        '<div><b>' + esc(I.num(listed.length)) + '</b><span>' + esc(t('sh.statDeals')) + '</span></div>' +
        '<div><b>' + Math.round(best) + '%</b><span>' + esc(t('sh.statBest')) + '</span></div>' +
        '<div><b>' + esc(I.short(saved)) + '</b><span>' + esc(t('sh.statAvg')) + '</span></div>' +
        '<div><b>' + esc(I.dayLabel(st().day)) + '</b><span>' + esc(I.date(S.dateAt(st().day))) + '</span></div>' +
      '</div></div>';
  }

  function card(p) {
    var id = p.lot.id, inCart = sh().cart[id] || 0, saved = !!sh().saved[id], max = maxQty(p);
    var meta = '<span>' + esc(t('sh.bestBefore', { date: I.date(p.expiry), n: p.left })) + '</span>';
    if (p.offer.atFloor) meta += '<span class="floor">' + esc(t('sh.lowest')) + '</span>';
    else if (p.offer.next) meta += '<span class="next">' + esc(t('sh.nextDrop', { n: p.offer.next.inDays, price: I.money(p.offer.next.price) })) + '</span>';
    var cta = inCart
      ? '<div class="stepper"><button data-action="dec" data-id="' + id + '" aria-label="' + esc(t('sh.less')) + '">' + icon('minus', 'ico--sm') + '</button><output>' + inCart + '</output>' +
        '<button data-action="inc" data-id="' + id + '" aria-label="' + esc(t('sh.more')) + '"' + (inCart >= max ? ' disabled' : '') + '>' + icon('plus', 'ico--sm') + '</button></div>'
      : '<button class="btn btn--outline btn--block" data-action="add" data-id="' + id + '">' + icon('plus', 'ico--sm') + esc(t('sh.add')) + '</button>';
    return '<article class="pcard">' +
      '<div class="pcard__art" data-action="open-product" data-id="' + id + '" role="button" tabindex="0" aria-label="' + esc(L(p.lot.name)) + '">' + art(p.lot) +
        (p.cutPct ? '<span class="pcard__off' + (p.offer.atFloor ? ' is-floor' : '') + '">−' + Math.round(p.cutPct) + '%</span>' : '') +
        '<button class="pcard__fav" data-action="fav" data-id="' + id + '" aria-pressed="' + saved + '" aria-label="' + esc(t('sh.save')) + '">' + icon('heart', 'ico--sm') + '</button>' +
        (p.offer.available <= 20 ? '<span class="pcard__left">' + esc(t('sh.onlyLeft', { n: p.offer.available })) + '</span>' : '') +
      '</div>' +
      '<div class="pcard__price"><b>' + esc(I.money(p.price)) + '</b>' + (p.cutPct ? '<s>' + esc(I.money(p.list)) + '</s>' : '') + '</div>' +
      '<div><div class="pcard__name" data-action="open-product" data-id="' + id + '">' + esc(L(p.lot.name)) + '</div><div class="pcard__brand">' + esc(brandOf(p)) + '</div></div>' +
      '<div class="pcard__meta">' + meta + '</div>' +
      '<div class="pcard__cta">' + cta + '</div>' +
    '</article>';
  }

  function renderGrid() {
    var all = products();
    renderHero(all);
    var list = visible();
    var title = mode === 'saved' ? t('sh.savedTitle') : (sh().cat === 'all' ? t('sh.allDeals') : L(D.CATEGORIES[sh().cat].label));
    $('#count').innerHTML = esc(title) + '<span>' + esc(t('sh.items', { n: list.length })) + '</span>';
    if (!list.length) {
      var none = !all.some(function (p) { return p.listed; });
      $('#grid').innerHTML = '<div class="empty">' + icon(mode === 'saved' ? 'heart' : 'bag') +
        '<h3>' + esc(t(none ? 'sh.emptyNone' : (mode === 'saved' ? 'sh.emptySaved' : 'sh.emptySearch'))) + '</h3>' +
        '<p>' + esc(t(none ? 'sh.emptyNoneText' : (mode === 'saved' ? 'sh.emptySavedText' : 'sh.emptySearchText'))) + '</p>' +
        (none ? '<a class="btn btn--outline btn--sm" href="seller.html#/duyet">' + esc(t('sh.sellerLink')) + '</a>' : '<button class="btn btn--outline btn--sm" data-action="view-all">' + esc(t('sh.showAll')) + '</button>') +
      '</div>';
    } else {
      $('#grid').innerHTML = list.map(card).join('');
    }
    U.hydrateIcons($('#grid'));
  }

  function renderHow() {
    $('#how').innerHTML = '<h2>' + esc(t('sh.howTitle')) + '</h2><div class="how__grid">' +
      [['tag', 'sh.how1'], ['shield', 'sh.how2'], ['calendar', 'sh.how3']].map(function (h) {
        return '<div class="how__item">' + icon(h[0]) + '<h3>' + esc(t(h[1] + '.t')) + '</h3><p>' + esc(t(h[1] + '.x')) + '</p></div>';
      }).join('') + '</div>';
  }

  function renderBadges() {
    var n = cartCount(), tt = totals();
    $('#cartLabel').textContent = n ? I.money(tt.sub) : t('sh.basket');
    $('#tabCount').textContent = n; $('#tabCount').hidden = !n;
    var s = Object.keys(sh().saved).length;
    $('#savedCount').textContent = s; $('#savedCount').hidden = !s;
  }

  function renderClock() {
    var r = $('#dayRange');
    r.value = st().day;
    U.paintRange(r);
    $('#dayOut').textContent = I.dayLabel(st().day) + ' · ' + I.date(S.dateAt(st().day));
  }

  /* ---------- overlays ---------- */

  function openOverlay(kind, id) {
    overlay = { kind: kind, id: id };
    checkoutError = '';
    $('#overlay').hidden = false;
    document.body.classList.add('is-locked');
    renderOverlay();
    var first = $('#overlayBody [data-autofocus]') || $('#overlayBody button');
    if (first) first.focus();
  }
  function closeOverlay() {
    overlay = null;
    $('#overlay').hidden = true;
    $('#overlayBody').innerHTML = '';
    document.body.classList.remove('is-locked');
  }

  function renderOverlay() {
    if (!overlay) return;
    var body = $('#overlayBody');
    if (overlay.kind === 'product') body.innerHTML = productModal(overlay.id);
    else body.innerHTML = '<aside class="sheet" role="dialog" aria-modal="true">' + sheetContent() + '</aside>';
    U.hydrateIcons(body);
  }

  function schedule(p) {
    var lot = p.lot, rules = st().rules, day = st().day, rows = [];
    var plan = S.planFor(lot).plan;
    var prev = null;
    for (var d = day; d < day + p.offer.delistIn; d++) {
      var price = E.priceAt(lot, lot.daysLeft - d, rules, { extraCut: plan.extraCut || 0, channel: 'shop' }).price;
      if (price !== prev) rows.push({ d: d, price: price });
      prev = price;
    }
    return '<table class="sched"><tbody>' + rows.map(function (r, i) {
      return '<tr class="' + (i === 0 ? 'is-now' : '') + '"><td>' + esc(i === 0 ? t('sh.now') : t('sh.from', { date: I.date(S.dateAt(r.d)) })) + '</td><td>' + esc(I.money(r.price)) + '</td></tr>';
    }).join('') + '<tr class="is-end"><td>' + esc(t('sh.delisted', { date: I.date(S.dateAt(day + p.offer.delistIn)) })) + '</td><td>—</td></tr></tbody></table>';
  }

  function productModal(id) {
    var p = productById(id);
    var close = '<button class="icon-btn pm__close" data-action="close" aria-label="' + esc(t('common.close')) + '">' + icon('x') + '</button>';
    if (!p.listed) {
      return '<div class="modal" role="dialog" aria-modal="true">' + close + '<div class="empty">' + icon('bag') + '<h3>' + esc(t('sh.gone')) + '</h3><p>' + esc(t('sh.goneText')) + '</p></div></div>';
    }
    var inCart = sh().cart[id] || 0, max = maxQty(p);
    return '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="pmTitle"><div class="pm">' +
      '<div class="pm__art">' + art(p.lot) + '</div>' +
      '<div class="pm__body">' + close +
        '<div><div class="pm__brand">' + esc(brandOf(p)) + ' · ' + esc(L(D.CATEGORIES[p.lot.cat].label)) + '</div><h2 id="pmTitle">' + esc(L(p.lot.name)) + '</h2></div>' +
        '<div class="pm__price"><b>' + esc(I.money(p.price)) + '</b>' + (p.cutPct ? '<s>' + esc(I.money(p.list)) + '</s><span class="badge badge--ok">' + esc(t('sh.youSave', { v: I.money(p.list - p.price) })) + '</span>' : '') + '</div>' +
        '<div class="pm__facts">' +
          '<div><span>' + esc(t('sh.bb')) + '</span><b>' + esc(I.date(p.expiry)) + '</b></div>' +
          '<div><span>' + esc(t('sh.daysLeft')) + '</span><b>' + esc(t('days.n', { n: p.left })) + '</b></div>' +
          '<div><span>' + esc(t('sh.inStock')) + '</span><b>' + esc(I.num(p.offer.available) + ' ' + L(p.lot.unit)) + '</b></div>' +
          '<div><span>' + esc(t('sh.limit')) + '</span><b>' + esc(t('sh.perOrder', { n: p.offer.cap })) + '</b></div>' +
        '</div>' +
        '<div class="pm__why"><b>' + esc(t('sh.why')) + '</b>' + esc(L(p.lot.story)) + '</div>' +
        '<div><div class="label" style="margin-bottom:6px">' + esc(t('sh.schedule')) + '</div>' + schedule(p) + '</div>' +
        '<div class="pm__buy">' +
          (inCart ? '<div class="stepper" style="flex:1"><button data-action="dec" data-id="' + id + '" aria-label="' + esc(t('sh.less')) + '">' + icon('minus', 'ico--sm') + '</button><output>' + inCart + '</output><button data-action="inc" data-id="' + id + '" aria-label="' + esc(t('sh.more')) + '"' + (inCart >= max ? ' disabled' : '') + '>' + icon('plus', 'ico--sm') + '</button></div>' +
            '<button class="btn btn--outline" data-action="open-cart">' + esc(t('sh.viewBasket')) + '</button>'
            : '<button class="btn btn--primary btn--lg" data-action="add" data-id="' + id + '" data-autofocus>' + icon('bag', 'ico--sm') + esc(t('sh.addBasket')) + '</button>') +
        '</div>' +
        '<p class="pm__note">' + icon('shield') + esc(t('sh.sealed')) + '</p>' +
      '</div></div></div>';
  }

  function regionOptions() {
    return D.REGIONS.map(function (r) {
      return '<option value="' + r.id + '"' + (sh().region === r.id ? ' selected' : '') + '>' + esc(L(r.label)) + '</option>';
    }).join('');
  }

  function sheetContent() {
    var k = overlay.kind;
    var head = function (title) {
      return '<div class="sheet__head"><h2>' + esc(title) + '</h2><button class="icon-btn icon-btn--sm" data-action="close" aria-label="' + esc(t('common.close')) + '">' + icon('x') + '</button></div>';
    };
    if (k === 'orders') {
      var orders = st().orders;
      return head(t('sh.orders')) + '<div class="sheet__body">' + (orders.length ? orders.map(function (o) {
        var total = o.lines.reduce(function (s, l) { return s + l.qty * l.price; }, 0) + (o.buyer.fee || 0);
        return '<div class="order"><div class="order__head"><b>' + esc(o.id) + '</b><span class="badge badge--ok">' + esc(t('sh.placed')) + '</span></div>' +
          '<p class="small muted" style="margin-bottom:8px">' + esc(I.dateTime(o.at)) + ' · ' + esc(I.dayLabel(o.day)) + ' · ' + esc(t('sh.method.' + o.buyer.method)) + '</p>' +
          '<ul>' + o.lines.map(function (l) { var lot = E.lotById(l.lotId); return '<li><span>' + l.qty + ' × ' + esc(L(lot.name)) + '</span><span>' + esc(I.money(l.qty * l.price)) + '</span></li>'; }).join('') + '</ul>' +
          '<div class="order__total"><span>' + esc(t('sh.total')) + '</span><span>' + esc(I.money(total)) + '</span></div></div>';
      }).join('') : '<div class="empty">' + icon('receipt') + '<h3>' + esc(t('sh.noOrders')) + '</h3><p>' + esc(t('sh.noOrdersText')) + '</p></div>') + '</div>';
    }
    if (k === 'done') {
      var o = st().orders[0];
      return head(t('sh.thanksTitle')) + '<div class="sheet__body"><div class="done"><span class="done__ico">' + icon('check') + '</span>' +
        '<h3>' + esc(t('sh.thanks', { id: o.id })) + '</h3><p class="muted">' + esc(t(o.buyer.method === 'pickup' ? 'sh.thanksPickup' : 'sh.thanksDelivery')) + '</p>' +
        '<p class="small muted">' + esc(t('sh.thanksNote')) + '</p>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn--outline btn--sm" data-action="open-orders">' + esc(t('sh.orders')) + '</button><button class="btn btn--primary btn--sm" data-action="close">' + esc(t('sh.continue')) + '</button></div></div></div>';
    }
    var tt = totals();
    if (k === 'checkout') {
      var excluded = st().rules.excludedRegions.indexOf(sh().region) !== -1;
      return head(t('sh.checkout')) + '<div class="sheet__body"><form class="form" id="checkoutForm" novalidate>' +
        '<div class="field"><span class="field__label">' + esc(t('sh.how')) + '</span><div class="seg" role="group">' +
          ['delivery', 'pickup'].map(function (m) { return '<button type="button" data-action="method" data-m="' + m + '" aria-pressed="' + (sh().method === m) + '">' + esc(t('sh.method.' + m)) + '</button>'; }).join('') +
        '</div></div>' +
        '<label class="field"><span class="field__label">' + esc(t('sh.name')) + '</span><input class="input" name="name" autocomplete="name" required data-autofocus></label>' +
        '<label class="field"><span class="field__label">' + esc(t('sh.phone')) + '</span><input class="input" name="phone" autocomplete="tel" inputmode="tel" required></label>' +
        '<label class="field"><span class="field__label">' + esc(t('sh.region')) + '</span><select class="select" name="region" data-action-change="region">' + regionOptions() + '</select>' +
          (excluded ? '<span class="field__hint neg">' + esc(t('sh.regionBlocked')) + '</span>' : '') + '</label>' +
        (sh().method === 'delivery' ? '<label class="field"><span class="field__label">' + esc(t('sh.address')) + '</span><input class="input" name="address" autocomplete="street-address" required></label>'
          : '<p class="small muted">' + esc(t('sh.pickupNote')) + '</p>') +
        (checkoutError ? '<p class="form-error" role="alert">' + esc(checkoutError) + '</p>' : '') +
      '</form></div>' +
      '<div class="sheet__foot">' + summary(tt) +
        '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn--outline" data-action="open-cart">' + esc(t('sh.back')) + '</button>' +
        '<button class="btn btn--accent" style="flex:1" data-action="place"' + (excluded || !tt.units ? ' disabled' : '') + '>' + esc(t('sh.place', { v: I.money(tt.total) })) + '</button></div></div>';
    }
    // basket
    if (!tt.lines.length) {
      return head(t('sh.basket')) + '<div class="sheet__body"><div class="empty">' + icon('bag') + '<h3>' + esc(t('sh.emptyCart')) + '</h3><p>' + esc(t('sh.emptyCartText')) + '</p><button class="btn btn--outline btn--sm" data-action="close">' + esc(t('sh.continue')) + '</button></div></div>';
    }
    return head(t('sh.basketN', { n: cartCount() })) + '<div class="sheet__body">' + tt.lines.map(function (l) {
      var p = l.p, id = p.lot.id, max = maxQty(p);
      return '<div class="line' + (l.ok ? '' : ' is-off') + '"><span class="pack">' + art(p.lot) + '</span>' +
        '<div><div class="line__name">' + esc(L(p.lot.name)) + '</div><div class="line__sub">' + esc(p.listed ? I.money(p.price) + ' · ' + t('sh.perOrder', { n: p.offer.cap }) : '—') + '</div></div>' +
        '<div class="line__right"><span class="line__total">' + esc(l.ok ? I.money(l.total) : '—') + '</span>' +
          '<div class="stepper stepper--light"><button data-action="dec" data-id="' + id + '" aria-label="' + esc(t('sh.less')) + '">' + icon(l.qty > 1 ? 'minus' : 'trash', 'ico--sm') + '</button><output>' + l.qty + '</output>' +
          '<button data-action="inc" data-id="' + id + '" aria-label="' + esc(t('sh.more')) + '"' + (l.qty >= max ? ' disabled' : '') + '>' + icon('plus', 'ico--sm') + '</button></div></div>' +
        (!l.ok ? '<p class="line__warn">' + esc(p.listed ? t('sh.tooMany', { n: max }) : t('sh.lineGone')) + '</p>' : '') +
      '</div>';
    }).join('') + '</div>' +
    '<div class="sheet__foot">' + summary(tt) +
      '<button class="btn btn--primary btn--block" style="margin-top:12px" data-action="checkout"' + (tt.units && !tt.bad ? '' : ' disabled') + '>' + esc(t('sh.toCheckout')) + '</button>' +
      (tt.bad ? '<p class="small neg" style="margin-top:6px">' + esc(t('sh.fixLines')) + '</p>' : '') + '</div>';
  }

  function summary(tt) {
    var toFree = FREE_DELIVERY_OVER - tt.sub;
    return '<div class="sum">' +
      '<div><span>' + esc(t('sh.subtotal')) + '</span><span>' + esc(I.money(tt.sub)) + '</span></div>' +
      (tt.save > 0 ? '<div class="save"><span>' + esc(t('sh.saving')) + '</span><span>−' + esc(I.money(tt.save)) + '</span></div>' : '') +
      '<div><span>' + esc(t(sh().method === 'pickup' ? 'sh.pickup' : 'sh.delivery')) + '</span><span>' + esc(tt.fee ? I.money(tt.fee) : t('sh.free')) + '</span></div>' +
      (sh().method === 'delivery' && tt.fee && toFree > 0 ? '<div class="muted small"><span>' + esc(t('sh.toFree', { v: I.money(toFree) })) + '</span><span></span></div>' : '') +
      '<div class="total"><span>' + esc(t('sh.total')) + '</span><span>' + esc(I.money(tt.total)) + '</span></div></div>';
  }

  function placeOrder() {
    var f = $('#checkoutForm');
    var data = {};
    new FormData(f).forEach(function (v, k) { data[k] = String(v).trim(); });
    var need = ['name', 'phone'].concat(sh().method === 'delivery' ? ['address'] : []);
    var missing = need.filter(function (k) { return !data[k]; });
    if (missing.length) { checkoutError = t('sh.errMissing'); renderOverlay(); return; }
    if (!/^[0-9 +().-]{9,}$/.test(data.phone)) { checkoutError = t('sh.errPhone'); renderOverlay(); return; }
    if (st().rules.excludedRegions.indexOf(sh().region) !== -1) { checkoutError = t('sh.regionBlocked'); renderOverlay(); return; }
    var tt = totals();
    if (tt.bad || !tt.units) { checkoutError = t('sh.fixLines'); renderOverlay(); return; }
    var lines = tt.lines.map(function (l) { return { lotId: l.p.lot.id, qty: l.qty, price: l.p.price }; });
    var order = S.placeOrder({ name: data.name, region: sh().region, method: sh().method, fee: tt.fee }, lines);
    lines.forEach(function (l) {
      S.addLog({ type: 'order', lotId: l.lotId, persona: null, buyer: data.name,
        msg: { key: 'lm.order', vars: { id: order.id, n: l.qty, price: l.price } } });
    });
    sh().cart = {};
    S.persist();
    overlay = { kind: 'done' };
    renderOverlay();
    refresh();
  }

  function refresh() {
    renderBadges();
    renderGrid();
    if (overlay && overlay.kind !== 'done') renderOverlay();
  }

  function renderAll() {
    renderClock();
    renderCats();
    renderSort();
    renderHow();
    refresh();
    $('#search').value = sh().q || '';
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    if (!a) return;
    var id = a.dataset.id;
    switch (a.dataset.action) {
      case 'cat': sh().cat = a.dataset.cat; S.save(); renderCats(); renderGrid(); break;
      case 'view-all': mode = 'all'; sh().cat = 'all'; sh().q = ''; $('#search').value = ''; closeOverlay(); renderCats(); renderGrid(); window.scrollTo({ top: 0 }); break;
      case 'view-saved': mode = 'saved'; closeOverlay(); renderCats(); renderGrid(); $('#count').scrollIntoView({ block: 'start' }); break;
      case 'fav':
        e.stopPropagation();
        if (sh().saved[id]) delete sh().saved[id]; else sh().saved[id] = true;
        S.save(); refresh();
        break;
      case 'add': setQty(id, (sh().cart[id] || 0) + 1); U.toast(t('sh.added')); break;
      case 'inc': setQty(id, (sh().cart[id] || 0) + 1); break;
      case 'dec': setQty(id, (sh().cart[id] || 0) - 1); break;
      case 'open-product': openOverlay('product', id); break;
      case 'open-cart': openOverlay('cart'); break;
      case 'open-orders': openOverlay('orders'); break;
      case 'checkout': overlay = { kind: 'checkout' }; checkoutError = ''; renderOverlay(); break;
      case 'method': sh().method = a.dataset.m; S.save(); renderOverlay(); break;
      case 'place': placeOrder(); break;
      case 'close': closeOverlay(); break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay) closeOverlay();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.pcard__art')) { e.preventDefault(); openOverlay('product', e.target.dataset.id); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'sort') { sh().sort = e.target.value; S.save(); renderGrid(); }
    if (e.target.getAttribute('data-action-change') === 'region') { sh().region = e.target.value; S.save(); checkoutError = ''; renderOverlay(); }
  });
  $('#search').addEventListener('input', function (e) { sh().q = e.target.value; S.save(); renderGrid(); });
  $('#dayRange').addEventListener('input', function (e) {
    st().day = +e.target.value;
    S.save();
    renderClock();
    refresh();
  });

  /* Seller changes (approvals, rules, day) in another tab refresh the shop. */
  S.onExternal(function () { renderAll(); });
  I.onChange(function () { renderAll(); if (overlay) renderOverlay(); });

  /* ---------- boot ---------- */
  $$('[data-logo]').forEach(function (el) { el.outerHTML = U.logo(28); });
  $$('[data-lang-switch]').forEach(function (el) { el.outerHTML = I.switcher(); });
  U.hydrateIcons();
  I.applyDom();
  renderAll();
})();
