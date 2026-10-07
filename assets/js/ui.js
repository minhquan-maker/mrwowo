/*
 * mrwowo — shared UI helpers (icons, toast, count-up, safe storage, contrast, downloads).
 * Exposed as window.Mrwowo.ui.
 */
(function (root) {
  'use strict';

  /* 24×24 stroke icons (hand-drawn in a Lucide-like style). */
  var P = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    truck: '<path d="M10 17h4V5H2v12h3M20 17h2v-3.3a4 4 0 0 0-1.2-2.9L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    approve: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    split: '<path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.2-2.9L3 3M15 9l6-6"/>',
    report: '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    store: '<path d="M3 9 4.5 4h15L21 9M4 9v11h16V9M9 20v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M12 18h.01"/>',
    warehouse: '<path d="M22 8.4V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.4a2 2 0 0 1 1.3-1.9l8-3.2a2 2 0 0 1 1.4 0l8 3.2A2 2 0 0 1 22 8.4z"/><path d="M6 18h12M6 14h12M6 22V10h12v12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    play2: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z" fill="currentColor"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    sort: '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
    'sort-up': '<path d="m7 14 5-5 5 5"/>',
    'sort-down': '<path d="m7 10 5 5 5-5"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 2V2l-2 2-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>'
  };

  function icon(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';
  }

  /* Replace <i data-icon="tag" data-class="ico--sm"></i> with inline SVG. */
  function hydrateIcons(scope) {
    (scope || document).querySelectorAll('i[data-icon]').forEach(function (el) {
      var tmp = document.createElement('span');
      tmp.innerHTML = icon(el.getAttribute('data-icon'), el.getAttribute('data-class'));
      el.replaceWith(tmp.firstChild);
    });
  }

  /* mrwowo logo: a price tag with a check mark. */
  function logo(size) {
    var s = size || 30;
    return '<svg class="brand__mark" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect width="32" height="32" rx="9" fill="#09090B"/>' +
      '<path d="M8 9.5A1.5 1.5 0 0 1 9.5 8h7.4c.4 0 .8.2 1.1.4l6.6 6.6a1.5 1.5 0 0 1 0 2.1l-7.3 7.3a1.5 1.5 0 0 1-2.1 0L8.4 17.8a1.5 1.5 0 0 1-.4-1.1z" fill="#fff"/>' +
      '<path d="m12.6 16.2 2.4 2.4 4.6-4.8" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="12" r="1.6" fill="#10B981"/></svg>';
  }

  /*
   * Product pack illustration (adapted from the earlier prototype's art()).
   * kind: pouch | tin | can | bottle | box | cup | jar | tube | jug | spray
   */
  function packArt(kind, c1, c2, uid) {
    var id = 'g' + String(uid || kind + c1).replace(/[^a-z0-9]/gi, '');
    var f = 'url(#' + id + 'a)', sh = 'url(#' + id + 's)';
    var label = function (x, y, w, h) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="#fff" opacity=".92"/>' +
        '<rect x="' + (x + 3) + '" y="' + (y + 4) + '" width="' + (w - 6) + '" height="2.2" rx="1.1" fill="' + c2 + '" opacity=".55"/>' +
        '<rect x="' + (x + 3) + '" y="' + (y + 8.4) + '" width="' + (w - 10) + '" height="2.2" rx="1.1" fill="' + c2 + '" opacity=".32"/>';
    };
    var P = {
      pouch: '<path d="M19 21h26l-2.6 45a4 4 0 0 1-4 3.8H25.6a4 4 0 0 1-4-3.8L19 21z" fill="' + f + '"/><path d="M19 21h26l-.4 7H19.4z" fill="' + c2 + '"/><path d="M34 21h11l-2.6 45a4 4 0 0 1-4 3.8H34z" fill="' + sh + '"/>' + label(24, 40, 16, 14),
      tin: '<ellipse cx="32" cy="25" rx="19" ry="6.5" fill="' + c2 + '"/><path d="M13 25v33c0 3.6 8.5 6.5 19 6.5s19-2.9 19-6.5V25" fill="' + f + '"/><path d="M38 25.6V64c7.6-.8 13-3.2 13-6V25" fill="' + sh + '"/>' + label(19, 37, 26, 14),
      can: '<rect x="20" y="16" width="24" height="50" rx="5" fill="' + f + '"/><rect x="20" y="16" width="24" height="5" rx="2" fill="' + c2 + '"/><rect x="34" y="16" width="10" height="50" rx="4" fill="' + sh + '"/>' + label(23, 36, 18, 14),
      bottle: '<path d="M27 15h10v7l5 6v35a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V28l5-6z" fill="' + f + '"/><path d="M34 15h3v7l5 6v35a5 5 0 0 1-5 5h-3z" fill="' + sh + '"/><rect x="26" y="8" width="12" height="8" rx="2.5" fill="' + c2 + '"/>' + label(22, 38, 20, 14),
      box: '<path d="M14 24h36v40a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="' + f + '"/><path d="M14 24l6-8h24l6 8z" fill="' + c2 + '"/><path d="M38 24h12v40a3 3 0 0 1-3 3h-9z" fill="' + sh + '"/>' + label(19, 38, 22, 14),
      cup: '<path d="M21 25h22l-2.6 36a5 5 0 0 1-5 4.6h-6.8a5 5 0 0 1-5-4.6z" fill="' + f + '"/><ellipse cx="32" cy="25" rx="11" ry="3.6" fill="' + c2 + '"/><path d="M34 25h9l-2.6 36a5 5 0 0 1-5 4.6H34z" fill="' + sh + '"/>' + label(25, 38, 14, 13),
      jar: '<rect x="19" y="27" width="26" height="31" rx="5" fill="' + f + '"/><rect x="34" y="27" width="11" height="31" rx="5" fill="' + sh + '"/><rect x="16" y="18" width="32" height="11" rx="3.5" fill="' + c2 + '"/>' + label(23, 36, 18, 13),
      tube: '<path d="M25 21h14v38a7 7 0 0 1-14 0z" fill="' + f + '"/><path d="M33 21h6v38a7 7 0 0 1-6 6.9z" fill="' + sh + '"/><rect x="27" y="12" width="10" height="10" rx="2.5" fill="' + c2 + '"/>' + label(27, 33, 10, 14),
      jug: '<path d="M18 26a6 6 0 0 1 6-6h14l8 8v34a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="' + f + '"/><path d="M38 20h4v7h4z" fill="' + c2 + '"/><rect x="24" y="12" width="10" height="9" rx="2" fill="' + c2 + '"/><path d="M36 26h10v36a4 4 0 0 1-4 4h-6z" fill="' + sh + '"/>' + label(22, 38, 20, 14),
      spray: '<rect x="22" y="26" width="20" height="40" rx="5" fill="' + f + '"/><path d="M26 14h12v12H26z" fill="' + c2 + '"/><path d="M38 16h7v4h-7z" fill="' + c2 + '"/><rect x="34" y="26" width="8" height="40" rx="4" fill="' + sh + '"/>' + label(25, 40, 14, 14)
    };
    return '<svg viewBox="0 0 64 80" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
      '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<ellipse cx="32" cy="72" rx="17" ry="3.2" fill="#09090B" opacity=".08"/>' + (P[kind] || P.box) + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var reduced = false;
  try { reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  /* Smooth count-up. Respects prefers-reduced-motion. */
  function animateNumber(el, to, fmt, opts) {
    if (!el) return;
    opts = opts || {};
    var from = el.__val != null ? el.__val : (opts.from != null ? opts.from : 0);
    var dur = opts.duration || 900;
    el.__val = to;
    if (reduced || from === to) { el.textContent = fmt(to); return; }
    if (el.__raf) cancelAnimationFrame(el.__raf);
    var t0 = null;
    function step(t) {
      if (t0 == null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) el.__raf = requestAnimationFrame(step);
    }
    el.__raf = requestAnimationFrame(step);
  }

  var toastTimer;
  function toast(msg, kind) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
    t.innerHTML = icon(kind === 'error' ? 'alert' : 'check-circle') + '<span>' + esc(msg) + '</span>';
    void t.offsetWidth;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  /* localStorage can throw (private mode, blocked) — always wrapped in try/catch. */
  var storage = {
    get: function (key, fallback) {
      try {
        var raw = root.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { root.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  /* High contrast — shared by both pages. */
  var CONTRAST_KEY = 'mrwowo.contrast';
  function applyContrast(on) {
    if (on) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }
  applyContrast(storage.get(CONTRAST_KEY, false));
  function setContrast(on) { storage.set(CONTRAST_KEY, !!on); applyContrast(!!on); }
  function getContrast() { return !!storage.get(CONTRAST_KEY, false); }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function paintRange(el) {
    var min = +el.min || 0, max = +el.max || 100;
    el.style.setProperty('--pct', ((+el.value - min) / (max - min || 1)) * 100 + '%');
  }

  (root.Mrwowo = root.Mrwowo || {}).ui = {
    icon: icon,
    hydrateIcons: hydrateIcons,
    logo: logo,
    packArt: packArt,
    esc: esc,
    reduced: reduced,
    animateNumber: animateNumber,
    toast: toast,
    storage: storage,
    setContrast: setContrast,
    getContrast: getContrast,
    download: download,
    paintRange: paintRange
  };
})(typeof self !== 'undefined' ? self : this);
