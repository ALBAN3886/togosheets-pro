/* AET Magasin 3D - editeur du commercant (v1). Charge a la demande depuis Commerce. */
(function(){
'use strict';
if (window.AETStore3D) return;
var T = null, Orbit = null, st = null;
var SW = 0.62, LH = 0.5, DEPTH = 0.55;

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(n){ return Number(n || 0).toLocaleString('fr-FR', {maximumFractionDigits: 0}) + ' F'; }
function uid(){ return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function hue(s){ var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function isOut(a){ return Number(a.stock || 0) <= 0; }
function isLow(a){ return !isOut(a) && Number(a.seuil || 0) > 0 && Number(a.stock || 0) <= Number(a.seuil); }

function loadThree(){
  if (T) return Promise.resolve();
  var cdn = [
    ['https://cdn.jsdelivr.net/npm/three@0.160.0/+esm', 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm'],
    ['https://esm.sh/three@0.160.0', 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js']
  ];
  var i = 0;
  function next(){
    if (i >= cdn.length) return Promise.reject(new Error('Three.js indisponible'));
    var c = cdn[i++];
    return import(c[0]).then(function(m){ return import(c[1]).then(function(o){ T = m; Orbit = o.OrbitControls; }); }).catch(next);
  }
  return next();
}

/* ---------- Donnees (lues en direct dans window.CM) ---------- */
function CMo(){ return window.CM || {}; }
function shop(){ return (CMo().shops || []).find(function(x){ return String(x.id) === String(st.shopId); }) || null; }
function L(){ var s = shop(); if (!s) return {aisles: []}; if (!s.store3d || !Array.isArray(s.store3d.aisles)) s.store3d = {v: 1, aisles: []}; return s.store3d; }
function arts(){ var id = String(st.shopId); return (CMo().articles || []).filter(function(a){ return a && (!a.shopId || String(a.shopId) === id); }); }
function artById(id){ return (CMo().articles || []).find(function(a){ return String(a.id) === String(id); }) || null; }
function aisle(id){ return L().aisles.find(function(a){ return a.id === id; }) || null; }
function placed(){ var p = {}; L().aisles.forEach(function(a){ Object.keys(a.slots || {}).forEach(function(k){ p[a.slots[k]] = {aisle: a.id, k: k}; }); }); return p; }
function freeSlot(a){ for (var l = 0; l < a.levels; l++) for (var c = 0; c < a.cols; c++) { var k = l + '_' + c; if (!a.slots[k]) return k; } return null; }
function newAisle(name){ var a = {id: uid(), name: name || ('Rayon ' + (L().aisles.length + 1)), levels: 4, cols: 6, slots: {}}; L().aisles.push(a); return a; }
function clean(a){ a.slots = a.slots || {}; Object.keys(a.slots).forEach(function(k){ var p = k.split('_'); if (+p[0] >= a.levels || +p[1] >= a.cols || !artById(a.slots[k])) delete a.slots[k]; }); }
function autoArrange(){
  var lay = L(); lay.aisles.forEach(clean); var p = placed(), n = 0;
  arts().forEach(function(ar){
    if (p[ar.id]) return;
    var cat = String(ar.cat || '').trim() || 'Divers';
    var a = lay.aisles.find(function(x){ return x.name === cat && freeSlot(x); }) || newAisle(cat);
    a.slots[freeSlot(a)] = String(ar.id); n++;
  });
  return n;
}
function commit(msg){ if (typeof window.cmSave === 'function') window.cmSave(); st.sig = ''; tick(); if (msg) hint(msg); }
function sig(){ return JSON.stringify([st.edit, st.move, L(), arts().map(function(a){ return [a.id, a.name, a.prixV, a.stock, a.seuil, a.imageUrl, a.cat]; })]); }
function tick(){ if (!st || !st.r) return; if (!shop()) { close(); return; } var s = sig(); if (s === st.sig) return; st.sig = s; build(); stats(); }

/* ---------- Textures ---------- */
function ctex(w, h, draw, keep){
  var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (!keep) st.disp.push(t); return t;
}
function fit(x, txt, max){ txt = String(txt || ''); if (x.measureText(txt).width <= max) return txt; while (txt.length > 1 && x.measureText(txt + '…').width > max) txt = txt.slice(0, -1); return txt + '…'; }
function imgOn(mat, url){
  var c = st.img[url];
  if (c && c !== 'wait' && c !== 'ko') { mat.map = c; mat.needsUpdate = true; return; }
  if (c) return;
  st.img[url] = 'wait';
  st.loader.load(url, function(t){ if (!st) { t.dispose(); return; } t.colorSpace = T.SRGBColorSpace; st.img[url] = t; st.sig = ''; }, undefined, function(){ if (st) st.img[url] = 'ko'; });
}

/* ---------- Construction 3D ---------- */
function lam(c){ return new T.MeshLambertMaterial({color: c}); }
function add(parent, mat, x, y, z, sx, sy, sz){ var m = new T.Mesh(st.geo.cube, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
function product(a){
  var out = isOut(a), hh = hue(a.cat || a.name);
  var side = new T.MeshLambertMaterial({color: out ? 0x9ca3af : new T.Color('hsl(' + hh + ',55%,55%)')});
  var front = new T.MeshLambertMaterial({map: ctex(256, 192, function(x, w, h){
    x.fillStyle = out ? '#e5e7eb' : 'hsl(' + hh + ',60%,92%)'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'hsl(' + hh + ',55%,30%)'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center';
    var words = String(a.name || '').split(' '), lines = [], cur = '';
    words.forEach(function(wd){ var t = cur ? cur + ' ' + wd : wd; if (x.measureText(t).width > w - 24 && cur) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur);
    lines.slice(0, 3).forEach(function(l, i){ x.fillText(fit(x, l, w - 20), w / 2, 56 + i * 38); });
    if (out) { x.fillStyle = '#dc2626'; x.font = 'bold 36px sans-serif'; x.fillText('ÉPUISÉ', w / 2, 178); }
  })});
  st.disp.push(side, front);
  if (a.imageUrl && !out) imgOn(front, a.imageUrl);
  return new T.Mesh(st.geo.box, [side, side, side, side, front, side]);
}
function tag(a){
  var out = isOut(a), low = isLow(a);
  var mat = new T.MeshBasicMaterial({map: ctex(256, 64, function(x, w, h){
    x.fillStyle = out ? '#dc2626' : low ? '#f59e0b' : '#ffffff'; x.fillRect(0, 0, w, h);
    x.fillStyle = (out || low) ? '#ffffff' : '#0f172a'; x.textAlign = 'center';
    x.font = 'bold 28px sans-serif'; x.fillText(fit(x, money(a.prixV), w - 10), w / 2, 29);
    x.font = 'bold 19px sans-serif'; x.fillText(out ? 'ÉPUISÉ' : 'Stock : ' + Number(a.stock || 0), w / 2, 55);
  })});
  st.disp.push(mat);
  return new T.Mesh(st.geo.tag, mat);
}
function clear(){ var g = st.group; while (g.children.length) g.remove(g.children[0]); st.disp.forEach(function(d){ d.dispose(); }); st.disp = []; st.pick = []; st.pos = {}; }
function build(){
  clear();
  var g = st.group, zL = 1, zR = 1;
  L().aisles.forEach(function(a, i){
    a.slots = a.slots || {};
    var lv = clamp(+a.levels || 4, 1, 8), cl = clamp(+a.cols || 6, 1, 12);
    var left = i % 2 === 0, w = cl * SW + 0.2, z = -((left ? zL : zR) + w / 2);
    if (left) zL += w + 0.7; else zR += w + 0.7;
    var u = new T.Group(); u.position.set(left ? -2.3 : 2.3, 0, z); u.rotation.y = left ? Math.PI / 2 : -Math.PI / 2; g.add(u);
    st.pos[a.id] = {x: u.position.x, z: z, left: left};
    var H = 0.12 + lv * LH;
    add(u, st.mat.back, 0, H / 2, -DEPTH / 2, w, H, 0.04);
    add(u, st.mat.frame, -w / 2, H / 2, 0, 0.05, H, DEPTH);
    add(u, st.mat.frame, w / 2, H / 2, 0, 0.05, H, DEPTH);
    for (var l = 0; l < lv; l++) {
      var y = 0.1 + l * LH;
      add(u, st.mat.board, 0, y, 0, w, 0.03, DEPTH);
      for (var c = 0; c < cl; c++) {
        var k = l + '_' + c, x = -w / 2 + 0.1 + SW * c + SW / 2, ar = a.slots[k] ? artById(a.slots[k]) : null;
        if (ar) {
          var m = product(ar); m.position.set(x, y + 0.185, 0); m.userData = {t: 'p', aisle: a.id, k: k, art: String(ar.id)}; u.add(m); st.pick.push(m);
          var tg = tag(ar); tg.position.set(x, y - 0.03, DEPTH / 2 + 0.006); tg.userData = m.userData; u.add(tg); st.pick.push(tg);
          if (st.move && st.move.aisle === a.id && st.move.k === k) add(u, st.mat.sel, x, y + 0.185, 0, SW - 0.04, 0.42, 0.4);
        } else if (st.edit) {
          var e = new T.Mesh(st.geo.slot, st.mat.slot); e.position.set(x, y + 0.185, 0); e.userData = {t: 'e', aisle: a.id, k: k}; u.add(e); st.pick.push(e);
        }
      }
    }
    add(u, st.mat.board, 0, 0.1 + lv * LH, 0, w, 0.03, DEPTH);
    var cw = Math.min(1024, Math.max(256, Math.round(w * 370)));
    var sm = new T.MeshBasicMaterial({map: ctex(cw, 96, function(x, W, Hh){ x.fillStyle = '#047857'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#fff'; x.font = 'bold 50px sans-serif'; x.textAlign = 'center'; x.fillText(fit(x, a.name, W - 30), W / 2, 66); })});
    st.disp.push(sm);
    var sg = new T.Mesh(st.geo.plane, sm); sg.scale.set(w, 0.26, 1); sg.position.set(0, H + 0.25, 0.05); sg.userData = {t: 'a', aisle: a.id}; u.add(sg); st.pick.push(sg);
  });
  var D = Math.max(zL, zR) + 1.5, cz = (3 - D) / 2;
  var f = new T.Mesh(st.geo.plane, st.mat.floor); f.rotation.x = -Math.PI / 2; f.scale.set(6.6, D + 4, 1); f.position.set(0, 0, cz); g.add(f);
  st.mat.floor.map.repeat.set(6.6, D + 4);
  add(g, st.mat.wall, 0, 1.75, -D - 0.5, 6.6, 3.5, 0.1);
  add(g, st.mat.wall, -3.3, 1.75, cz, 0.1, 3.5, D + 4);
  add(g, st.mat.wall, 3.3, 1.75, cz, 0.1, 3.5, D + 4);
  render();
}
function render(){ if (!st || !st.r || st.raf) return; st.raf = requestAnimationFrame(function(){ if (!st) return; st.raf = 0; st.r.render(st.scene, st.cam); }); }
function home(){ st.cam.position.set(0, 1.7, 3.2); st.ctl.target.set(0, 1.1, -3); st.ctl.update(); render(); }
function view(id){ var p = st.pos[id]; if (!p) return; st.cam.position.set(p.left ? 1.3 : -1.3, 1.45, p.z); st.ctl.target.set(p.x, 1.0, p.z); st.ctl.update(); render(); }

/* ---------- Interface ---------- */
var CSS = '#aet3d{position:fixed;inset:0;z-index:9600;background:#0b1220;color:#0f172a;font-family:inherit}'
+ '#aet3d canvas{display:block;width:100%;height:100%;touch-action:none}'
+ '.a3-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,rgba(15,23,42,.88),rgba(15,23,42,0));color:#fff}'
+ '.a3-top b{font-size:15px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.a3-top small{font-size:11px;opacity:.85}'
+ '.a3-btn{border:none;border-radius:12px;padding:10px 12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.95);color:#0f172a;box-shadow:0 4px 12px rgba(0,0,0,.18)}'
+ '.a3-bar{position:absolute;left:8px;right:8px;bottom:12px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap}'
+ '.a3-sheet{position:absolute;left:0;right:0;bottom:0;max-height:62%;overflow:auto;background:#fff;border-radius:20px 20px 0 0;padding:16px;box-shadow:0 -10px 30px rgba(0,0,0,.3);display:none}'
+ '.a3-hint{position:absolute;top:66px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.92);color:#fff;padding:8px 14px;border-radius:20px;font-size:12.5px;display:none;max-width:90%;text-align:center}'
+ '.a3-row{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;cursor:pointer}'
+ '.a3-row img{width:42px;height:42px;object-fit:cover;border-radius:8px;background:#f1f5f9}'
+ '.a3-mini{border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer;font-family:inherit}'
+ '.a3-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-direction:column;gap:12px;text-align:center}';

function hint(msg, ms){ var h = document.getElementById('a3hint'); if (!h) return; h.textContent = msg; h.style.display = 'block'; clearTimeout(st.ht); st.ht = setTimeout(function(){ h.style.display = 'none'; }, ms || 2500); }
function sheet(html, kind){ var s = document.getElementById('a3sheet'); s.innerHTML = html; s.style.display = 'block'; st.kind = kind || null; }
function closeSheet(){ var s = document.getElementById('a3sheet'); if (s) s.style.display = 'none'; if (st) st.kind = null; }
function refreshSheet(){ if (!st || !st.kind) return; if (st.kind === 'list') listSheet(); else aisleSheet(st.kind); }
function head(t){ return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px"><b style="font-size:15px">' + esc(t) + '</b><button class="a3-mini" data-act="shut">✕</button></div>'; }
function pill(l, v, c){ return '<div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px;text-align:center"><div style="font-size:10.5px;color:#64748b">' + l + '</div><div style="font-weight:900;font-size:13px;color:' + c + '">' + esc(v) + '</div></div>'; }
function row(a, act, extra){
  var out = isOut(a);
  return '<div class="a3-row" data-act="' + act + '" data-id="' + esc(a.id) + '" data-name="' + esc(String(a.name || '').toLowerCase()) + '">'
    + (a.imageUrl ? '<img src="' + esc(a.imageUrl) + '" loading="lazy" alt="">' : '<div style="width:42px;height:42px;border-radius:8px;background:#ecfdf5;display:flex;align-items:center;justify-content:center">📦</div>')
    + '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.name) + '</div>'
    + '<div style="font-size:12px;color:' + (out ? '#dc2626' : isLow(a) ? '#d97706' : '#64748b') + '">' + money(a.prixV) + ' · ' + (out ? 'ÉPUISÉ' : 'stock ' + Number(a.stock || 0)) + (extra ? ' · ' + extra : '') + '</div></div></div>';
}
function stats(){
  var a = arts(), p = placed(), n = a.filter(function(x){ return p[x.id]; }).length, o = a.filter(isOut).length;
  var el = document.getElementById('a3stats');
  if (el) el.textContent = n + '/' + a.length + ' produits placés · ' + L().aisles.length + ' rayon(s)' + (o ? ' · ⚠️ ' + o + ' épuisé(s)' : '');
}
function modeLabel(){ var b = document.getElementById('a3mode'); if (b) b.textContent = st.edit ? '👁 Aperçu' : '✏️ Éditer'; }
function pickFor(u){
  st.target = u;
  var p = placed(), A = aisle(u.aisle), kk = u.k.split('_');
  var list = arts().slice().sort(function(a, b){ return (p[a.id] ? 1 : 0) - (p[b.id] ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
  sheet(head('Placer un produit') + '<div style="font-size:12px;color:#64748b;margin-bottom:8px">' + esc(A ? A.name : '') + ' · étagère ' + (+kk[0] + 1) + ' · place ' + (+kk[1] + 1) + '</div>'
    + '<input id="a3q" placeholder="🔍 Rechercher un produit…" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:10px;font-size:14px">'
    + (list.length ? list.map(function(a){ return row(a, 'place', p[a.id] ? '📍 déjà placé' : ''); }).join('') : '<p style="color:#64748b">Aucun produit dans cette boutique.</p>'));
}
function showArt(u){
  var a = artById(u.art); if (!a) return; st.target = u;
  var out = isOut(a), low = isLow(a);
  sheet(head(a.name || 'Produit')
    + (a.imageUrl ? '<img src="' + esc(a.imageUrl) + '" alt="" style="width:100%;max-height:170px;object-fit:contain;border-radius:12px;background:#f8fafc;margin-bottom:10px">' : '')
    + '<div style="display:flex;gap:8px;margin-bottom:12px">' + pill('Prix', money(a.prixV), '#0f172a')
    + pill('Stock', out ? 'ÉPUISÉ' : (Number(a.stock || 0) + ' ' + (a.unit || '')), out ? '#dc2626' : low ? '#d97706' : '#059669')
    + pill('Catégorie', a.cat || '—', '#334155') + '</div>'
    + '<div style="display:flex;gap:8px"><button class="a3-btn" style="flex:1;background:#0f766e;color:#fff" data-act="move">↔ Déplacer</button>'
    + '<button class="a3-btn" style="flex:1;background:#fee2e2;color:#b91c1c" data-act="remove">Retirer du rayon</button></div>');
}
function aisleRow(a, i, n){
  var id = esc(a.id);
  return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:10px;margin-bottom:10px">'
    + '<input data-ren="' + id + '" value="' + esc(a.name) + '" style="width:100%;box-sizing:border-box;font-weight:800;padding:8px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;font-size:14px">'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px">'
    + 'Étagères <button class="a3-mini" data-act="lv" data-id="' + id + '" data-d="-1">−</button><b>' + a.levels + '</b><button class="a3-mini" data-act="lv" data-id="' + id + '" data-d="1">+</button>'
    + '&nbsp; Places <button class="a3-mini" data-act="cl" data-id="' + id + '" data-d="-1">−</button><b>' + a.cols + '</b><button class="a3-mini" data-act="cl" data-id="' + id + '" data-d="1">+</button></div>'
    + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="a3-mini" data-act="view" data-id="' + id + '">👁 Voir</button>'
    + (i > 0 ? '<button class="a3-mini" data-act="mv" data-id="' + id + '" data-d="-1">▲</button>' : '')
    + (i < n - 1 ? '<button class="a3-mini" data-act="mv" data-id="' + id + '" data-d="1">▼</button>' : '')
    + '<button class="a3-mini" style="color:#b91c1c" data-act="del" data-id="' + id + '">🗑 Supprimer</button></div></div>';
}
function listSheet(){ var ls = L().aisles; sheet(head('Rayons (' + ls.length + ')') + (ls.length ? ls.map(function(a, i){ return aisleRow(a, i, ls.length); }).join('') : '<p style="color:#64748b">Aucun rayon. Appuyez sur ➕ Rayon ou ⚡ Ranger auto.</p>'), 'list'); }
function aisleSheet(id){ var ls = L().aisles, i = ls.findIndex(function(a){ return a.id === id; }); if (i < 0) { closeSheet(); return; } sheet(head('Rayon') + aisleRow(ls[i], i, ls.length), id); }
function outSheet(){
  var l = arts().filter(function(a){ return isOut(a) || isLow(a); }).sort(function(a, b){ return Number(a.stock || 0) - Number(b.stock || 0); });
  sheet(head('Ruptures et stock bas (' + l.length + ')') + (l.length ? l.map(function(a){ return row(a, 'loc', placed()[a.id] ? '👁 voir' : 'non placé'); }).join('') : '<p style="color:#059669;font-weight:700">✅ Aucun produit épuisé.</p>'));
}

function onClick(e){
  var b = e.target.closest('[data-act]'); if (!b || !st) return;
  var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), d = +b.getAttribute('data-d') || 0, A = id ? aisle(id) : null, ls = L().aisles;
  if (act === 'close') return close();
  if (!st.r) return;
  if (act === 'shut') closeSheet();
  else if (act === 'home') home();
  else if (act === 'mode') { st.edit = !st.edit; st.move = null; modeLabel(); tick(); }
  else if (act === 'add') { var na = newAisle(); commit('Rayon ajouté ✓'); view(na.id); aisleSheet(na.id); }
  else if (act === 'auto') { var n = autoArrange(); commit(n ? n + ' produit(s) rangé(s) ✓' : 'Tous les produits sont déjà placés'); }
  else if (act === 'list') listSheet();
  else if (act === 'out') outSheet();
  else if (act === 'place') { var u = st.target, TA = u && aisle(u.aisle); if (!TA) return; var pp = placed()[id]; if (pp) { var O = aisle(pp.aisle); if (O) delete O.slots[pp.k]; } TA.slots[u.k] = String(id); closeSheet(); commit('Produit placé ✓'); }
  else if (act === 'move') { st.move = {aisle: st.target.aisle, k: st.target.k}; st.edit = true; modeLabel(); closeSheet(); tick(); hint('Touchez la nouvelle place du produit', 4000); }
  else if (act === 'remove') { var RA = aisle(st.target.aisle); if (RA) delete RA.slots[st.target.k]; closeSheet(); commit('Produit retiré du rayon'); }
  else if (act === 'lv' && A) { A.levels = clamp((+A.levels || 4) + d, 1, 8); clean(A); commit(); refreshSheet(); }
  else if (act === 'cl' && A) { A.cols = clamp((+A.cols || 6) + d, 1, 12); clean(A); commit(); refreshSheet(); }
  else if (act === 'mv' && A) { var i = ls.indexOf(A), j = i + d; if (j >= 0 && j < ls.length) { ls[i] = ls[j]; ls[j] = A; commit(); refreshSheet(); } }
  else if (act === 'view') { closeSheet(); view(id); }
  else if (act === 'del' && A) { if (confirm('Supprimer le rayon « ' + 
