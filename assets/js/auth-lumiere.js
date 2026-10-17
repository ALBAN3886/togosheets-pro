/* AET MonBudget – écran de connexion « Lumière » v2 : décor animé + alignement des blocs. Idempotent. */
(function () {
  'use strict';

  var LAMP = '' +
    '<svg viewBox="0 0 420 760" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="lmCone" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffd60a" stop-opacity=".55"/>' +
          '<stop offset=".6" stop-color="#ffd60a" stop-opacity=".12"/>' +
          '<stop offset="1" stop-color="#ffd60a" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="lmLeaf" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#3f9b4a"/><stop offset="1" stop-color="#14502a"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<polygon class="lm-cone" points="165,170 345,170 470,760 40,760" fill="url(#lmCone)"/>' +
      '<ellipse cx="205" cy="742" rx="120" ry="10" fill="#000" opacity=".5"/>' +
      '<ellipse cx="205" cy="740" rx="70" ry="6" fill="#ffd60a" opacity=".18" class="lm-cone"/>' +
      '<ellipse cx="205" cy="736" rx="74" ry="9" fill="#11141b"/>' +
      '<rect x="201" y="190" width="8" height="548" rx="3" fill="#0d1016"/>' +
      '<path d="M98 190 Q98 128 205 118 Q312 128 312 190 Z" fill="#07090e"/>' +
      '<ellipse cx="205" cy="190" rx="107" ry="11" fill="#ffe680" class="lm-bulb"/>' +
      '<ellipse cx="205" cy="187" rx="70" ry="5" fill="#fff8cf" opacity=".9" class="lm-bulb"/>' +
      '<g class="lm-cord" style="transform-origin:236px 196px">' +
        '<line x1="236" y1="196" x2="236" y2="262" stroke="#1b2029" stroke-width="3"/>' +
        '<rect x="230" y="262" width="12" height="26" rx="6" fill="#ffd60a"/>' +
      '</g>' +
      '<g transform="translate(-6 560)">' +
        '<path d="M-10 0 C10 -60 50 -90 105 -86 C80 -50 40 -16 -10 0Z" fill="url(#lmLeaf)"/>' +
        '<path d="M5 6 C-8 -48 -6 -96 30 -135 C48 -90 40 -36 5 6Z" fill="url(#lmLeaf)" opacity=".92"/>' +
        '<path d="M14 10 C40 -30 86 -50 132 -34 C106 -4 60 14 14 10Z" fill="url(#lmLeaf)" opacity=".85"/>' +
        '<path d="M0 8 C-30 -20 -60 -30 -92 -22 C-70 6 -34 16 0 8Z" fill="url(#lmLeaf)" opacity=".8"/>' +
        '<path d="M-8 168 L72 168 L64 214 Q34 222 4 214 Z" fill="#e9e9e4"/>' +
        '<path d="M-8 168 L72 168 L70 180 L-6 180 Z" fill="#cfcfc8"/>' +
      '</g>' +
    '</svg>';

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function lucioles(n) {
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<span class="lm-fly" style="left:' + rnd(2, 97).toFixed(1) + '%;top:' + rnd(4, 94).toFixed(1) + '%;' +
        '--d:' + rnd(9, 18).toFixed(1) + 's;--dl:' + (-rnd(0, 14)).toFixed(1) + 's;' +
        '--x:' + Math.round(rnd(-30, 30)) + 'px;--y:' + Math.round(rnd(-70, -20)) + 'px;' +
        'width:' + Math.round(rnd(4, 8)) + 'px;height:' + Math.round(rnd(4, 8)) + 'px"></span>';
    }
    return out;
  }

  function wrapLastWord(el) {
    if (!el || el.querySelector('span')) return;
    var t = (el.textContent || '').trim();
    if (!t) return;
    var i = t.lastIndexOf(' ');
    el.innerHTML = (i > 0 ? t.slice(0, i + 1) : '') + '<span>' + t.slice(i + 1) + '</span>';
  }

  function norm(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  function topLevel(root, el) {
    while (el && el.parentNode !== root) el = el.parentNode;
    return el;
  }

  function firstExact(root, text) {
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('.auth-box') || el.closest('.lm-bg')) continue;
      if (norm(el.textContent) === text) return el;
    }
    return null;
  }

  function findNote(root) {
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('.lm-bg')) continue;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.indexOf('Passez Premium') > -1) return el;
      }
    }
    return null;
  }

  function colify(root, el) {
    if (!el) return;
    var top = topLevel(root, el);
    if (top === el) el.classList.add('lm-col');
    else { if (top) top.classList.add('lm-col'); el.classList.add('lm-nested'); }
  }

  var tabLogin = null, tabSignup = null;

  function syncTabs() {
    if (!tabLogin || !tabSignup) return;
    var lb = document.getElementById('authBody-login');
    var loginOn = !lb || getComputedStyle(lb).display !== 'none';
    tabLogin.classList.toggle('lm-active', loginOn);
    tabSignup.classList.toggle('lm-active', !loginOn);
  }

  function topChild(container, el) {
    while (el && el.parentNode !== container) el = el.parentNode;
    return el;
  }

  function scan(s) {
    colify(s, s.querySelector('.auth-header'));
    var bodies = s.querySelectorAll('.auth-body');
    for (var b = 0; b < bodies.length; b++) bodies[b].classList.add('lm-col');

    var tl = firstExact(s, 'Connexion'), ts = firstExact(s, 'Créer un compte');
    if (tl && ts) {
      var c = tl.parentNode;
      while (c && c !== s && !c.contains(ts)) c = c.parentNode;
      if (c && c !== s) {
        c.classList.add('lm-tabs'); colify(s, c);
        tabLogin = topChild(c, tl); tabSignup = topChild(c, ts);
        if (tabLogin) tabLogin.classList.add('lm-tab');
        if (tabSignup) tabSignup.classList.add('lm-tab');
        syncTabs();
      }
    }
    var note = findNote(s);
    if (note) { note.classList.add('lm-note'); colify(s, note); }
  }

  function init() {
    var s = document.getElementById('authScreen');
    if (!s || s.getAttribute('data-lumiere')) return;
    s.setAttribute('data-lumiere', '1');
    s.classList.add('lumiere');

    var bg = document.createElement('div');
    bg.className = 'lm-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML =
      '<div class="lm-ambient"></div>' +
      '<div class="lm-lamp">' + LAMP + '</div>' +
      '<div class="lm-tag">Voyez clair<b>dans vos <em>finances</em></b><i></i></div>' +
      lucioles(18);
    s.insertBefore(bg, s.firstChild);

    var titles = s.querySelectorAll('.auth-title');
    for (var i = 0; i < titles.length; i++) {
      var tt = (titles[i].textContent || '').trim();
      if (tt === 'Connexion') titles[i].innerHTML = 'Bon <span>retour</span>';
      else wrapLastWord(titles[i]);
    }

    var bodies = s.querySelectorAll('.auth-body');
    for (var j = 0; j < bodies.length; j++) {
      var box = bodies[j].querySelector('.auth-box');
      var sub = bodies[j].querySelector('.auth-sub');
      var ttl = bodies[j].querySelector('.auth-title');
      if (!box) continue;
      if (sub && sub.parentNode !== box) box.insertBefore(sub, box.firstChild);
      if (ttl && ttl.parentNode !== box) box.insertBefore(ttl, box.firstChild);
    }

    scan(s);
    var pending = false;
    function later() {
      if (pending) return; pending = true;
      (window.requestAnimationFrame || setTimeout)(function () { pending = false; scan(s); });
    }
    if (window.MutationObserver) {
      new MutationObserver(later).observe(s, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    s.addEventListener('click', function () { setTimeout(syncTabs, 60); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
