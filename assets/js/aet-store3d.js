/* AET Magasin 3D v1 - editeur de rayons pour Commerce (charge a la demande) */
(function () {
  'use strict';
  if (window.AETStore3D) return;

  var SW = 0.62, LH = 0.5, DEPTH = 0.55, BASE = 0.2, AX = 2.3;
  var PH = LH * 0.62, PD = DEPTH * 0.7;
  var T = null, OC = null, S = { open: false };
  var LOW = Math.min(screen.width, screen.height) * (window.devicePixelRatio || 1) < 800 ||
    (navigator.hardwareConcurrency || 4) <= 4;

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function cm() { return window.CM || {}; }
  function shop() {
    var c = cm(), l = c.shops || [];
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === c.currentShopId) return l[i];
    return l[0] || null;
  }
  function arts() {
    var s = shop();
    if (s == null) return [];
    return (cm().articles || []).filter(function (a) { return a && (a.shopId || s.id) === s.id; });
  }
  function art(id) {
    var l = cm().articles || [];
    for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === id) return l[i];
    return null;
  }
  function plan() {
    var s = shop();
    if (s == null) return null;
    if (s.store3d == null || Array.isArray(s.store3d.aisles) === false) s.store3d = { v: 1, aisles: [] };
    return s.store3d;
  }
  function money(n) { return (Number(n) || 0).toLocaleString('fr-FR') + ' F'; }
  function stk(a) { return Number(a && a.stock) || 0; }
  function low(a) {
    var v = a ? a.seuil : null, se = (v === undefined || v === null || v === '') ? 3 : Number(v);
    return stk(a) > 0 && stk(a) <= se;
  }
  function hue(s) {
    var h = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function msg(t, ms) {
    var m = $('a3Msg');
    if (m == null) return;
    m.textContent = t || '';
    m.style.display = t ? 'block' : 'none';
    clearTimeout(S.mt);
    if (t && ms !== 0) S.mt = setTimeout(function () { m.style.display = 'none'; }, ms || 2500);
  }

  function loadThree() {
    if (T) return Promise.resolve();
    var v = '0.160.0', i = 0, src = [
      ['https://cdn.jsdelivr.net/npm/three@' + v + '/+esm',
        'https://cdn.jsdelivr.net/npm/three@' + v + '/examples/jsm/controls/OrbitControls.js/+esm'],
      ['https://esm.sh/three@' + v,
        'https://esm.sh/three@' + v + '/examples/jsm/controls/OrbitControls.js']
    ];
    function next(err) {
      if (i >= src.length) return Promise.reject(err || new Error('three'));
      var p = src[i++];
      return import(p[0]).then(function (m) {
        return import(p[1]).then(function (o) { T = m; OC = o.OrbitControls; });
      }).catch(next);
    }
    return next();
  }

  function css() {
    if ($('a3Css')) return;
    var st = document.createElement('style');
    st.id = 'a3Css';
    st.textContent =
      '#aet3d{position:fixed;inset:0;z-index:9600;background:#dfe7ef;font:14px system-ui,sans-serif;color:#111;overflow:hidden}' +
      '#aet3d canvas{display:block;touch-action:none}' +
      '#a3Top{position:absolute;top:0;left:0;right:0;display:flex;gap:6px;align-items:center;padding:8px;' +
      'padding-top:calc(8px + env(safe-area-inset-top));background:linear-gradient(#000a,#0000);color:#fff}' +
      '#a3Title{flex:1;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.a3b{border:0;border-radius:10px;padding:9px 11px;font:600 14px system-ui,sans-serif;background:#fff;color:#111;' +
      'box-shadow:0 1px 4px #0003;cursor:pointer}' +
      '.a3b.g{background:#16a34a;color:#fff}.a3b.r{background:#dc2626;color:#fff}.a3b.s{padding:6px 9px;font-size:13px}' +
      '#a3Bar{position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:8px;' +
      'padding-bottom:calc(8px + env(safe-area-inset-bottom));background:linear-gradient(#0000,#0008)}' +
      '#a3Bar .a3b{flex:0 0 auto}#aet3d.view .ed{display:none}' +
      '#a3Sheet{position:absolute;left:0;right:0;bottom:0;max-height:72%;overflow:auto;background:#fff;color:#111;' +
      'border-radius:16px 16px 0 0;padding:14px;padding-bottom:calc(14px + env(safe-area-inset-bottom));' +
      'box-shadow:0 -4px 20px #0005;display:none}' +
      '#a3Sheet.on{display:block}#a3Sheet h3{margin:0 0 10px;font-size:16px;display:flex;align-items:center;gap:8px}' +
      '#a3Sheet h3 span{flex:1}' +
      '.a3r{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;flex-wrap:wrap}' +
      '.a3r img,.a3r i{width:40px;height:40px;object-fit:cover;border-radius:8px;background:#eee;flex:0 0 40px}' +
      '.a3r .t{flex:1;min-width:120px}.a3r .t small{display:block;color:#666}' +
      '.a3in{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:10px;font-size:15px;margin-bottom:6px}' +
      '#a3Msg{position:absolute;top:calc(160px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);' +
      'background:#111e;color:#fff;padding:8px 14px;border-radius:20px;font-size:13px;display:none;max-width:88%;' +
      'text-align:center;pointer-events:none}' +
      '#a3Nav{position:absolute;left:8px;right:8px;top:calc(58px + env(safe-area-inset-top));display:none}' +
      '.a3n{display:flex;gap:6px;justify-content:center;align-items:center;margin-bottom:6px;flex-wrap:wrap}' +
      '.a3n span{background:#fffe;border-radius:10px;padding:6px 10px;font-weight:700;font-size:13px}' +
      '#a3Load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'font-size:16px;color:#333;text-align:center;padding:20px}';
    document.head.appendChild(st);
  }

  function ui() {
    var d = document.createElement('div');
    d.id = 'aet3d';
    d.innerHTML =
      '<div id="a3Load">⏳ Chargement du magasin 3D…</div>' +
      '<div id="a3Top"><button class="a3b" data-a="close">✕</button><span id="a3Title"></span>' +
      '<button class="a3b" id="a3Mode" data-a="mode"></button></div>' +
      '<div id="a3Nav"></div><div id="a3Msg"></div>' +
      '<div id="a3Bar"><button class="a3b g ed" data-a="add">➕ Rayon</button>' +
      '<button class="a3b ed" data-a="auto">⚡ Ranger auto</button>' +
      '<button class="a3b ed" data-a="list">☰ Rayons</button>' +
      '<button class="a3b" data-a="out">⚠️ Épuisés</button>' +
      '<button class="a3b" data-a="home">🎯 Accueil</button></div>' +
      '<div id="a3Sheet"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', onClick);
    d.addEventListener('input', function (e) { if (e.target && e.target.id === 'a3Q') pickList(e.target.value); });
    return d;
  }
  /* -- fin morceau 1 -- */
  /* -- morceau 2 : scene 3D -- */
  function tex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    if (S.r) t.anisotropy = S.r.capabilities.getMaxAnisotropy();
    return t;
  }
  function lines(g, t, x, y, mw, lh, max) {
    var ws = String(t).split(/\s+/), cur = '', n = 0;
    for (var i = 0; i < ws.length && n < max; i++) {
      var tr = cur ? cur + ' ' + ws[i] : ws[i];
      if (g.measureText(tr).width > mw && cur) { g.fillText(cur, x, y + n * lh); n++; cur = ws[i]; }
      else cur = tr;
    }
    if (n < max && cur) g.fillText(cur, x, y + n * lh);
  }
  function front(a) {
    var out = stk(a) <= 0;
    function deco(g, w, h) {
      if (out === false) return;
      g.fillStyle = 'rgba(80,80,80,.65)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#dc2626'; g.fillRect(0, h * 0.38, w, h * 0.26);
      g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ÉPUISÉ', w / 2, h / 2);
    }
    var t = tex(512, 320, function (g, w, h) {
      g.fillStyle = 'hsl(' + hue(a.cat || a.name) + ',55%,50%)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'top';
      lines(g, a.name || '?', w / 2, 30, w - 40, 68, 4);
      deco(g, w, h);
    });
    if (a.imageUrl) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var c = t.image, g = c.getContext('2d'), w = c.width, h = c.height;
          var k = Math.max(w / im.width, h / im.height);
          g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
          g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k);
          deco(g, w, h);
          t.needsUpdate = true; req();
        } catch (e) {}
      };
      im.src = a.imageUrl;
    }
    return t;
  }
  function label(a) {
    var out = stk(a) <= 0, lo = low(a);
    return tex(512, 150, function (g, w, h) {
      g.fillStyle = out ? '#dc2626' : (lo ? '#fb923c' : '#ffffff'); g.fillRect(0, 0, w, h);
      g.fillStyle = (out || lo) ? '#fff' : '#111'; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = 'bold 64px sans-serif'; g.fillText(money(a.prixV), 16, 46);
      g.font = 'bold 42px sans-serif'; g.fillText(out ? 'Épuisé' : 'Stock : ' + stk(a), 16, 116);
    });
  }
  function sign(t) {
    return tex(512, 96, function (g, w, h) {
      g.fillStyle = '#16a34a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(t || 'Rayon').slice(0, 22), w / 2, h / 2);
    });
  }
  function req() {
    if (S.raf || S.r == null) return;
    S.raf = requestAnimationFrame(function () { S.raf = 0; if (S.r) S.r.render(S.sc, S.cam); });
  }
  function onResize() {
    if (S.r == null) return;
    var w = S.el.clientWidth, h = S.el.clientHeight;
    S.r.setSize(w, h); S.cam.aspect = w / h; S.cam.updateProjectionMatrix(); req(); if (S.cur) go();
  }
  function init3d() {
    var el = S.el, w = el.clientWidth, h = el.clientHeight;
    var r = new T.WebGLRenderer({ antialias: LOW === false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2));
    r.setSize(w, h);
    el.insertBefore(r.domElement, el.firstChild);
    var sc = new T.Scene();
    sc.background = new T.Color(0xdfe7ef);
    var cam = new T.PerspectiveCamera(60, w / h, 0.1, 200);
    sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 2));
    var dl = new T.DirectionalLight(0xffffff, 1.2);
    dl.position.set(3, 8, 5); sc.add(dl);
    var fl = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshLambertMaterial({ color: 0xcfd6dd }));
    fl.rotation.x = -Math.PI / 2; sc.add(fl);
    var gr = new T.GridHelper(80, 80, 0xaab3bc, 0xaab3bc);
    gr.position.y = 0.002; sc.add(gr);
    var ctl = new OC(cam, r.domElement);
    ctl.maxPolarAngle = Math.PI * 0.49; ctl.minDistance = 0.6; ctl.maxDistance = 40;
    ctl.addEventListener('change', req);
    S.r = r; S.sc = sc; S.cam = cam; S.ctl = ctl; S.pick = []; S.pos = {};
    S.grp = new T.Group(); sc.add(S.grp);
    S.emat = new T.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35 });
    r.domElement.addEventListener('pointerdown', pDown);
    r.domElement.addEventListener('pointerup', pUp);
    window.addEventListener('resize', onResize);
  }
  function clear() {
    S.grp.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      var m = o.material;
      if (m && m !== S.emat) (Array.isArray(m) ? m : [m]).forEach(function (x) {
        if (x.map) x.map.dispose();
        x.dispose();
      });
    });
    while (S.grp.children.length) S.grp.remove(S.grp.children[0]);
    S.pick = []; S.pos = {};
  }
  function box(w, h, d, mat, x, y, z, par) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); par.add(m); return m;
  }
  /* -- fin morceau 2 -- */
  /* -- morceau 3 : rayons, camera, toucher -- */
  function sig() {
    var p = plan();
    return (S.edit ? 'E' : 'V') + JSON.stringify(p ? p.aisles : []) + '|' + arts().map(function (a) {
      return [a.id, a.name, a.prixV, a.stock, a.seuil, a.imageUrl, a.cat].join('~');
    }).join('|');
  }
  function build() {
    if (S.r == null) return;
    clear();
    S.sig = sig();
    var A = (plan() || { aisles: [] }).aisles, L0 = 0;
    A.forEach(function (a) { L0 = Math.max(L0, (a.cols || 6) * SW); });
    var wood = new T.MeshLambertMaterial({ color: 0xc08a50 });
    var metal = new T.MeshLambertMaterial({ color: 0x9aa4ae });
    A.forEach(function (a, ai) {
      var lv = a.levels || 4, co = a.cols || 6, L = co * SW, H = BASE + lv * LH;
      var fx = ai % 2 === 0 ? 1 : -1, row = Math.floor(ai / 2);
      var g = new T.Group();
      g.position.set(-fx * AX, 0, -row * (L0 + 1.2) - L0 / 2 - 1);
      g.rotation.y = fx * Math.PI / 2;
      g.userData.aid = a.id; S.grp.add(g);
      S.pos[a.id] = { x: g.position.x, z: g.position.z, fx: fx, h: H, l: L };
      box(L, H, 0.04, metal, 0, H / 2, -DEPTH / 2, g);
      box(0.04, H, DEPTH, metal, -L / 2, H / 2, 0, g);
      box(0.04, H, DEPTH, metal, L / 2, H / 2, 0, g);
      for (var k = 0; k <= lv; k++) box(L, 0.03, DEPTH, wood, 0, BASE + k * LH, 0, g);
      var sw2 = Math.min(L, 2.6);
      var sgg = new T.PlaneGeometry(sw2, sw2 * 96 / 512), sgm = new T.MeshBasicMaterial({ map: sign(a.name) });
      var sg = new T.Mesh(sgg, sgm); sg.position.set(0, H + 0.25, 0); g.add(sg);
      var sb = new T.Mesh(sgg, sgm); sb.position.set(0, H + 0.25, 0); sb.rotation.y = Math.PI; g.add(sb);
      var sl = a.slots || (a.slots = {});
      for (var l = 0; l < lv; l++) for (var c = 0; c < co; c++) {
        var key = l + '_' + c, x = -L / 2 + SW * (c + 0.5), y = BASE + l * LH + 0.015;
        var p = sl[key] ? art(sl[key]) : null;
        if (p) {
          var sm = new T.MeshLambertMaterial({
            color: new T.Color().setHSL(hue(p.cat || p.name) / 360, 0.45, stk(p) > 0 ? 0.45 : 0.3) });
          var fm = new T.MeshBasicMaterial({ map: front(p) });
          var m = new T.Mesh(new T.BoxGeometry(SW * 0.8, PH, PD), [sm, sm, sm, sm, fm, sm]);
          m.position.set(x, y + PH / 2, DEPTH / 2 - PD / 2 - 0.02);
          m.userData = { k: 'p', ai: ai, key: key, id: p.id };
          g.add(m); S.pick.push(m);
          var lb = new T.Mesh(new T.PlaneGeometry(SW * 0.85, SW * 0.85 * 150 / 512),
            new T.MeshBasicMaterial({ map: label(p) }));
          lb.position.set(x, y - 0.09, DEPTH / 2 + 0.006);
          lb.userData = m.userData; g.add(lb); S.pick.push(lb);
        } else if (S.edit) {
          var e = box(SW * 0.8, 0.04, DEPTH * 0.8, S.emat, x, y + 0.035, 0, g);
          e.userData = { k: 'e', ai: ai, key: key }; S.pick.push(e);
        }
      }
    });
    req(); nav(); focus();
  }
  function home() {
    if (S.cam == null) return;
    S.cur = null; nav(); focus(); S.ctl.enabled = true; S.cam.position.set(0, 2.4, 3.2); S.ctl.target.set(0, 0.9, -3); S.ctl.update(); req();
  }
  function ncols() {
    var pt = S.cam && S.cam.aspect < 0.8;
    if (S.cur && S.cur.lv >= 0) return pt ? 3 : 6;
    return pt ? 2 : 4;
  }
  function focus() {
    if (S.grp == null) return;
    var c = S.cur;
    S.grp.children.forEach(function (g) {
      var on = c == null || g.userData.aid === c.id;
      g.visible = on;
      if (on) g.children.forEach(function (m) {
        var u = m.userData;
        if (u && u.key) m.visible = c == null || c.lv < 0 || Number(String(u.key).split('_')[0]) === c.lv;
      });
    });
    req();
  }
  function findA(id) {
    var A = (plan() || { aisles: [] }).aisles;
    for (var i = 0; i < A.length; i++) if (A[i].id === id) return i;
    return -1;
  }
  function look(id) { S.cur = { id: id, lv: -1, c0: 0 }; go(); }
  function go() {
    var A = (plan() || { aisles: [] }).aisles, c = S.cur, i = c ? findA(c.id) : -1, a = A[i];
    var p = a ? S.pos[a.id] : null;
    if (p == null || S.cam == null) { S.cur = null; nav(); if (S.ctl) S.ctl.enabled = true; return; }
    var lv = a.levels || 4, co = a.cols || 6, nc = Math.min(ncols(), co);
    if (c.lv >= lv) c.lv = lv - 1;
    c.c0 = Math.max(0, Math.min(c.c0, co - nc));
    nav();
    var cv = S.r.domElement.getBoundingClientRect(), H = cv.height || 1, top = 0, bot = H;
    var nb = $('a3Nav'), bb = $('a3Bar');
    if (nb && nb.offsetHeight) top = Math.max(0, nb.getBoundingClientRect().bottom - cv.top + 4);
    if (bb && bb.offsetHeight) bot = Math.min(H, bb.getBoundingClientRect().top - cv.top - 4);
    if (bot - top < H * 0.3) { top = 0; bot = H; }
    var fh = (bot - top) / H, asp = S.cam.aspect, tn = Math.tan(S.cam.fov * Math.PI / 360);
    var lx = -p.l / 2 + SW * (c.c0 + nc / 2), cy, hc;
    if (c.lv < 0) { cy = (p.h + 0.5) / 2; hc = p.h + 0.7; }
    else { cy = BASE + c.lv * LH + 0.17; hc = LH + 0.3; }
    var V = Math.max(hc / fh, (nc * SW + 0.2) / asp);
    var d = Math.max(0.8, V / (2 * tn));
    V = 2 * tn * d;
    var camY = cy + ((top + bot) / 2 / H - 0.5) * V;
    var wz = p.z - lx * p.fx;
    focus(); S.ctl.enabled = false;
    S.cam.position.set(p.x + p.fx * (d + DEPTH / 2), camY, wz);
    S.ctl.target.set(p.x, camY, wz); S.ctl.update(); req();
  }
  function step(dir) {
    var A = (plan() || { aisles: [] }).aisles;
    if (A.length === 0) return;
    var c = S.cur, i = c ? findA(c.id) : -1;
    if (i < 0) { S.cur = { id: A[0].id, lv: -1, c0: 0 }; return go(); }
    var co = A[i].cols || 6, nc = Math.min(ncols(), co), c0;
    if (dir > 0) {
      if (c.c0 + nc >= co) { i = (i + 1) % A.length; c0 = 0; } else c0 = c.c0 + nc;
    } else {
      if (c.c0 <= 0) { i = (i - 1 + A.length) % A.length; var co2 = A[i].cols || 6; c0 = co2 - Math.min(ncols(), co2); }
      else c0 = Math.max(0, c.c0 - nc);
    }
    S.cur = { id: A[i].id, lv: c.lv, c0: c0 };
    go();
  }
  function nav() {
    var n = $('a3Nav');
    if (n == null) return;
    var A = (plan() || { aisles: [] }).aisles, c = S.cur, a = c ? A[findA(c.id)] : null;
    if (A.length === 0) { n.style.display = 'none'; return; }
    n.style.display = 'block';
    if (a == null) { n.innerHTML = '<div class="a3n"><button class="a3b s g" data-a="nx">▶ Visiter les rayons</button></div>'; return; }
    var lv = a.levels || 4, co = a.cols || 6, nc = Math.min(ncols(), co);
    var h = '<div class="a3n"><button class="a3b" data-a="pv">◀</button><span>' + esc(a.name) + ' · places ' +
      (c.c0 + 1) + '-' + Math.min(co, c.c0 + nc) + '/' + co + '</span><button class="a3b" data-a="nx">▶</button></div><div class="a3n">';
    for (var l = lv - 1; l >= 0; l--) h += '<button class="a3b s' + (c.lv === l ? ' g' : '') + '" data-a="lv" data-l="' + l + '">É' + (l + 1) + '</button>';
    h += '<button class="a3b s' + (c.lv < 0 ? ' g' : '') + '" data-a="lv" data-l="-1">Tout</button></div>';
    n.innerHTML = h;
  }
  function pDown(e) { S.pd = { x: e.clientX, y: e.clientY, t: Date.now() }; }
  function pUp(e) {
    var d = S.pd; S.pd = null;
    if (d == null) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (S.cur && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { step(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) + Math.abs(dy) > 10 || Date.now() - d.t > 600) return;
    var rc = S.r.domElement.getBoundingClientRect();
    var v = new T.Vector2((e.clientX - rc.left) / rc.width * 2 - 1, 1 - (e.clientY - rc.top) / rc.height * 2);
    var ray = new T.Raycaster();
    ray.setFromCamera(v, S.cam);
    var h = ray.intersectObjects(S.pick.filter(function (o) { return o.visible && o.parent && o.parent.visible; }), false);
    if (h.length) onPick(h[0].object.userData);
  }
  function tick() { if (S.r == null || sig() === S.sig) return; build(); }
  /* -- fin morceau 3 -- */
  /* -- morceau 4 : fiches -- */
  function commit() {
    try { if (typeof window.cmSave === 'function') window.cmSave(); } catch (e) { console.warn('[3D] save', e); }
    build();
  }
  function sheet(h) {
    var s = $('a3Sheet');
    if (s == null) return;
    if (h) { s.innerHTML = h; s.classList.add('on'); } else { s.innerHTML = ''; s.classList.remove('on'); }
  }
  function head(t) { return '<h3><span>' + t + '</span><button class="a3b s" data-a="shut">✕</button></h3>'; }
  function where(id) {
    var r = [];
    ((plan() || { aisles: [] }).aisles).forEach(function (a) {
      var sl = a.slots || {};
      for (var k in sl) if (sl[k] === id) { r.push(a); break; }
    });
    return r;
  }
  function names(w) { return w.map(function (a) { return a.name; }).join(', '); }
  function thumb(a) { return a.imageUrl ? '<img src="' + esc(a.imageUrl) + '" loading="lazy" alt="">' : '<i></i>'; }
  function pickList(q) {
    var bx = $('a3List');
    if (bx == null) return;
    q = String(q || '').toLowerCase().trim();
    var l = arts().filter(function (a) {
      return q === '' || [a.name, a.cat, a.code].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    l.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'fr'); });
    bx.innerHTML = l.length ? l.slice(0, 200).map(function (a) {
      var w = where(a.id);
      return '<div class="a3r">' + thumb(a) + '<div class="t">' + esc(a.name) + '<small>' + money(a.prixV) +
        ' · stock ' + stk(a) + (w.length ? ' · déjà dans : ' + esc(names(w)) : '') + '</small></div>' +
        '<button class="a3b s g" data-a="put" data-id="' + esc(a.id) + '">Placer</button></div>';
    }).join('') : '<p>Aucun produit trouvé.</p>';
  }
  function onPick(u) {
    var A = plan().aisles, a = A[u.ai];
    if (a == null) return;
    if (S.mv) {
      var m = S.mv, src = A[m.ai];
      S.mv = null;
      if (src && (m.ai !== u.ai || m.key !== u.key)) {
        var dst = a.slots || (a.slots = {}), old = dst[u.key];
        dst[u.key] = m.id;
        if (old) src.slots[m.key] = old; else delete src.slots[m.key];
        commit(); msg(old ? '↔ Produits échangés' : '✅ Produit déplacé');
      } else msg('Déplacement annulé');
      return;
    }
    if (u.k === 'e') {
      S.tg = { ai: u.ai, key: u.key };
      sheet(head('Placer un produit · ' + esc(a.name)) +
        '<input id="a3Q" class="a3in" placeholder="🔍 Rechercher…" autocomplete="off"><div id="a3List"></div>');
      pickList('');
      return;
    }
    var p = art(u.id);
    if (p == null) return;
    S.sel = u;
    var h = head(esc(p.name)) + '<div class="a3r">' + thumb(p) + '<div class="t">' + money(p.prixV) +
      '<small>Stock : ' + stk(p) + (p.unit ? ' ' + esc(p.unit) : '') + (p.cat ? ' · ' + esc(p.cat) : '') +
      '</small><small>Rayon : ' + esc(a.name) + '</small></div></div>';
    if (stk(p) <= 0) h += '<p style="color:#dc2626;font-weight:700">⚠️ Épuisé : pensez à réapprovisionner.</p>';
    else if (low(p)) h += '<p style="color:#ea580c;font-weight:700">⚠️ Stock bas.</p>';
    if (S.edit) h += '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="a3b g" data-a="mv">↔ Déplacer</button><button class="a3b r" data-a="rm">Retirer</button></div>';
    sheet(h);
  }
  function aisleList() {
    var A = plan().aisles, h = head('☰ Rayons (' + A.length + ')');
    if (A.length === 0) h += '<p>Aucun rayon. Touchez ➕ Rayon.</p>';
    A.forEach(function (a, i) {
      var n = Object.keys(a.slots || {}).length;
      function b(act, t, c) { return '<button class="a3b s ' + (c || '') + '" data-a="' + act + '" data-i="' + i + '">' + t + '</button>'; }
      h += '<div class="a3r"><div class="t"><b>' + esc(a.name) + '</b><small>' + (a.levels || 4) + ' étagères × ' +
        (a.cols || 6) + ' places · ' + n + ' produit(s)</small></div>' +
        b('look', '👁') + b('ren', '✏️') + b('up', '▲') + b('dn', '▼') +
        '<div style="display:flex;gap:6px;width:100%;flex-wrap:wrap">' +
        b('lv-', 'Étagère −') + b('lv+', 'Étagère +') + b('co-', 'Place −') + b('co+', 'Place +') +
        b('del', '🗑', 'r') + '</div></div>';
    });
    sheet(h);
  }
  function outList() {
    var l = arts().filter(function (a) { return stk(a) <= 0 || low(a); });
    var h = head('⚠️ Épuisés et stock bas (' + l.length + ')');
    if (l.length === 0) h += '<p>✅ Tout est en stock.</p>';
    l.forEach(function (a) {
      var w = where(a.id), o = stk(a) <= 0;
      h += '<div class="a3r">' + thumb(a) + '<div class="t">' + esc(a.name) +
        '<small style="color:' + (o ? '#dc2626' : '#ea580c') + '">' + (o ? 'Épuisé' : 'Stock bas : ' + stk(a)) + '</small>' +
        '<small>' + (w.length ? 'Rayon : ' + esc(names(w)) : 'Pas en rayon') + '</small></div>' +
        (w.length ? '<button class="a3b s" data-a="find" data-id="' + esc(a.id) + '">👁 Voir</button>' : '') + '</div>';
    });
    sheet(h);
  }
  /* -- fin morceau 4 -- */
  /* -- morceau 5 : actions, ouverture, fermeture -- */
  function addAisle() {
    var A = plan().aisles, n = prompt('Nom du rayon :', 'Rayon ' + (A.length + 1));
    if (n == null) return;
    n = n.trim() || ('Rayon ' + (A.length + 1));
    A.push({ id: nid(), name: n.slice(0, 40), levels: 4, cols: 6, slots: {} });
    commit(); look(A[A.length - 1].id); msg('✅ Rayon ajouté');
  }
  function autoArrange() {
    var A = plan().aisles, placed = {};
    A.forEach(function (a) { for (var k in (a.slots || {})) placed[a.slots[k]] = 1; });
    var todo = arts().filter(function (p) { return placed[p.id] === undefined; });
    if (todo.length === 0) { msg('✅ Tous les produits sont déjà en rayon'); return; }
    if (confirm('Ranger ' + todo.length + ' produit(s) par catégorie ?') === false) return;
    var gp = {};
    todo.forEach(function (p) {
      var c = String(p.cat || '').trim() || 'Divers';
      (gp[c] = gp[c] || []).push(p);
    });
    Object.keys(gp).sort().forEach(function (c) {
      var list = gp[c], a = null, n = 1;
      for (var i = 0; i < A.length; i++) if (String(A[i].name).toLowerCase() === c.toLowerCase()) { a = A[i]; break; }
      while (list.length) {
        if (a == null) {
          a = { id: nid(), name: (n > 1 ? c + ' ' + n : c).slice(0, 40), levels: 4, cols: 6, slots: {} };
          A.push(a);
        }
        a.slots = a.slots || {};
        var lv = a.levels || 4, co = a.cols || 6;
        for (var l = 0; l < lv && list.length; l++) for (var k = 0; k < co && list.length; k++) {
          var key = l + '_' + k;
          if (a.slots[key] == null) a.slots[key] = list.shift().id;
        }
        if (list.length) { a = null; n++; }
      }
    });
    commit(); home(); msg('✅ ' + todo.length + ' produit(s) rangé(s)');
  }
  function aisleAct(act, i) {
    var A = plan().aisles, a = A[i];
    if (a == null) return;
    if (act === 'look') { sheet(''); look(a.id); return; }
    if (act === 'ren') {
      var n = prompt('Nouveau nom :', a.name);
      if (n == null || n.trim() === '') return;
      a.name = n.trim().slice(0, 40);
    } else if (act === 'up' || act === 'dn') {
      var j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= A.length) return;
      A[i] = A[j]; A[j] = a;
    } else if (act === 'lv+') a.levels = Math.min(8, (a.levels || 4) + 1);
    else if (act === 'co+') a.cols = Math.min(20, (a.cols || 6) + 1);
    else if (act === 'lv-' || act === 'co-') {
      var nl = a.levels || 4, nc = a.cols || 6;
      if (act === 'lv-') nl--; else nc--;
      if (nl < 1 || nc < 1) return;
      var lost = Object.keys(a.slots || {}).filter(function (k) {
        var p = k.split('_'); return Number(p[0]) >= nl || Number(p[1]) >= nc;
      });
      if (lost.length && confirm(lost.length + ' produit(s) seront retirés du rayon. Continuer ?') === false) return;
      lost.forEach(function (k) { delete a.slots[k]; });
      a.levels = nl; a.cols = nc;
    } else if (act === 'del') {
      if (confirm('Supprimer le rayon « ' + a.name + ' » ? Les produits restent dans le stock.') === false) return;
      A.splice(i, 1);
    } else return;
    commit(); aisleList();
  }
  function mode() {
    var d = $('aet3d');
    if (d == null) return;
    d.classList.toggle('view', S.edit === false);
    $('a3Mode').textContent = S.edit ? '👁 Aperçu' : '✏️ Éditer';
  }
  function onClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (b == null) return;
    var act = b.getAttribute('data-a'), id = b.getAttribute('data-id');
    if (act === 'close') return close();
    if (act === 'shut') return sheet('');
    if (act === 'mode') { S.edit = S.edit === false; S.mv = null; mode(); sheet(''); build(); return; }
    if (act === 'nx' || act === 'pv') return step(act === 'nx' ? 1 : -1);
    if (act === 'lv') { if (S.cur) { S.cur.lv = Number(b.getAttribute('data-l')); go(); } return; }
    if (act === 'add') return addAisle();
    if (act === 'auto') return autoArrange();
    if (act === 'list') return aisleList();
    if (act === 'out') return outList();
    if (act === 'home') { sheet(''); return home(); }
    if (act === 'find') { var w = where(id); sheet(''); if (w.length) look(w[0].id); return; }
    if (act === 'put') {
      var t = S.tg, pa = t ? plan().aisles[t.ai] : null;
      if (pa == null) return;
      (pa.slots || (pa.slots = {}))[t.key] = id;
      S.tg = null; sheet(''); commit(); msg('✅ Produit placé'); return;
    }
    if (act === 'mv') {
      var s = S.sel; sheet('');
      if (s) { S.mv = { ai: s.ai, key: s.key, id: s.id }; msg('Touchez la nouvelle place (vide ou produit)', 0); }
      return;
    }
    if (act === 'rm') {
      var r = S.sel, ra = r ? plan().aisles[r.ai] : null;
      if (ra && ra.slots) { delete ra.slots[r.key]; sheet(''); commit(); msg('Produit retiré du rayon'); }
      return;
    }
    if (b.hasAttribute('data-i')) aisleAct(act, Number(b.getAttribute('data-i')));
  }
  function fit() {
    var v = window.visualViewport, d = S.el;
    if (v == null || d == null) return;
    d.style.right = 'auto'; d.style.bottom = 'auto';
    var k = v.scale || 1;
    d.style.left = v.offsetLeft + 'px'; d.style.top = v.offsetTop + 'px';
    d.style.width = (v.width * k) + 'px'; d.style.height = (v.height * k) + 'px';
    d.style.transformOrigin = '0 0';
    d.style.transform = Math.abs(k - 1) < 0.01 ? '' : 'scale(' + (1 / k) + ')';
    onResize();
  }
  function onPop() { if (S.open) { S.hist = false; close(); } }
  function openEditor() {
    if (S.open) return;
    var s = shop();
    if (s == null) { alert("Créez d'abord une boutique dans Commerce."); return; }
    css(); S.el = ui(); S.open = true; S.edit = true; mode();
    fit();
    var vv = window.visualViewport;
    if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
    $('a3Title').textContent = '🛒 ' + (s.name || 'Magasin');
    try { history.pushState({ a3: 1 }, ''); S.hist = true; } catch (e) {}
    window.addEventListener('popstate', onPop);
    loadThree().then(function () {
      if (S.open === false) return;
      var c = document.createElement('canvas');
      if (c.getContext('webgl2') == null && c.getContext('webgl') == null) throw new Error('webgl');
      init3d();
      var ld = $('a3Load'); if (ld) ld.remove();
      build(); home();
      if (plan().aisles.length === 0) msg('Touchez ➕ Rayon ou ⚡ Ranger auto pour commencer', 5000);
      S.iv = setInterval(tick, 1500);
    }).catch(function (e) {
      console.warn('[3D]', e);
      var ld = $('a3Load');
      if (ld) ld.innerHTML = '⚠️ Impossible de charger la 3D.<br><small>Vérifiez la connexion internet ' +
        '(ou WebGL non pris en charge).</small><br><br><button class="a3b" data-a="close">Fermer</button>';
    });
  }
  function close() {
    if (S.open === false) return;
    S.open = false;
    clearInterval(S.iv); clearTimeout(S.mt);
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('resize', onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', fit);
      window.visualViewport.removeEventListener('scroll', fit);
    }
    if (S.raf) cancelAnimationFrame(S.raf);
    try {
      if (S.r) {
        clear(); S.emat.dispose(); S.ctl.dispose(); S.r.dispose();
        if (S.r.forceContextLoss) S.r.forceContextLoss();
      }
    } catch (e) {}
    var d = $('aet3d'); if (d) d.remove();
    var h = S.hist;
    S = { open: false };
    if (h) try { history.back(); } catch (e) {}
    try { if (typeof window.cmRenderAll === 'function') window.cmRenderAll(); } catch (e) {}
  }

  window.AETStore3D = { openEditor: openEditor, close: close, version: 1 };
})();
