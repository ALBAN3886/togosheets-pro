#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
aet_patch.py — correctifs TogoSheets Pro / AET Commerce (20/09/2026)

Usage (à la racine du dépôt, dans Termux) :
    python3 aet_patch.py --dry-run        # vérifie les ancres, n'écrit RIEN
    python3 aet_patch.py                  # applique (avec sauvegardes)
    python3 aet_patch.py --with-rules     # + ajoute profiles/profileHistory à firestore.rules
    python3 aet_patch.py --bump-sw        # + incrémente CACHE_NAME de sw.js

Garanties :
  * aucune écriture réseau, aucun git, aucun déploiement, aucune donnée Firestore touchée ;
  * chaque fichier modifié est d'abord sauvegardé : <fichier>.backup-YYYYMMDD-HHMMSS
    (une sauvegarde existante n'est jamais écrasée) ;
  * chaque correctif exige une ancre EXACTE trouvée UNE seule fois ; sinon le fichier
    concerné est laissé intact et le problème est affiché ;
  * relançable sans risque (marqueur AET-PATCH-20260920 => "déjà patché").
"""
import sys, os, re, shutil, datetime, subprocess, tempfile

MARK = 'AET-PATCH-20260920'
DRY = '--dry-run' in sys.argv
WITH_RULES = '--with-rules' in sys.argv
BUMP_SW = '--bump-sw' in sys.argv
TS = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')


class PatchError(Exception):
    pass


class AlreadyPatched(PatchError):
    pass


# ───────────────────────── helpers ─────────────────────────
def rep(src, old, new, label):
    n = src.count(old)
    if n != 1:
        raise PatchError('[%s] ancre trouvée %d fois (attendu 1)' % (label, n))
    return src.replace(old, new, 1)


def rep_between(src, start, end, new, label, max_len=20000, must_contain=()):
    if src.count(start) != 1:
        raise PatchError('[%s] début d\'ancre trouvé %d fois (attendu 1)' % (label, src.count(start)))
    i = src.index(start)
    j = src.find(end, i + len(start))
    if j < 0:
        raise PatchError('[%s] fin d\'ancre introuvable' % label)
    seg = src[i:j]
    if len(seg) > max_len:
        raise PatchError('[%s] segment anormalement long (%d)' % (label, len(seg)))
    for token in must_contain:
        if token not in seg:
            raise PatchError('[%s] le segment ne contient pas %r : fichier différent de celui analysé' % (label, token))
    return src[:i] + new + src[j:]


def backup(path):
    dest = '%s.backup-%s' % (path, TS)
    k = 1
    while os.path.exists(dest):
        dest = '%s.backup-%s-%d' % (path, TS, k)
        k += 1
    shutil.copy2(path, dest)
    return dest


def read(path):
    with open(path, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


# ───────────────────────── blocs JS : commandes ─────────────────────────
BRIDGE_EXPORT_NEW = r"""window.__AET_FIRESTORE__ = { doc, getDoc, setDoc, deleteDoc, serverTimestamp, runTransaction, onSnapshot,
  /* AET-PATCH-20260920 : pont module -> IIFE Commerce (commandes clients) */
  collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc };"""

WATCH_HEAD_OLD = """async function cmStartOrdersWatch(force = false){
  try {
    const uid = (window.currentUser && window.currentUser.uid) || '';
"""
WATCH_HEAD_NEW = """async function cmStartOrdersWatch(force = false){
  try {
    /* AET-PATCH-20260920 : ce code vit dans un script CLASSIQUE (IIFE) ; db/collection/query/where
       sont importés dans le <script type="module"> et n'y sont pas visibles. Pont explicite : */
    const db = window.__AET_DB__;
    const _fs = window.__AET_FIRESTORE__ || {};
    const { collection, query, where, onSnapshot } = _fs;
    if (typeof collection !== 'function' || typeof query !== 'function' ||
        typeof where !== 'function' || typeof onSnapshot !== 'function') {
      throw new Error('Pont Firestore incomplet (window.__AET_FIRESTORE__)');
    }
    const uid = (window.currentUser && window.currentUser.uid) || '';
"""

WATCH_CATCH_OLD = """    console.error('[COMMANDES] démarrage listener:', e);
    CM.orders = [];
    if (typeof cmRenderOrders === 'function') cmRenderOrders();
  }
}
"""
WATCH_CATCH_NEW = """    console.error('[COMMANDES] démarrage listener:', e);
    CM.orders = [];
    if (typeof cmRenderOrders === 'function') cmRenderOrders();
    /* AET-PATCH-20260920 : ne plus échouer en silence */
    const _l = document.getElementById('cmOrdersList');
    if (_l) _l.insertAdjacentHTML('afterbegin',
      '<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px;margin-bottom:10px;font-size:13px;">' +
      'Impossible de charger les commandes : ' + esc((e && (e.code || e.message)) || e) + '</div>');
  }
}
"""

ORDER_HELPERS = r"""/* AET-PATCH-20260920 : helpers manquants dans l'IIFE Commerce (esc n'y était pas défini) */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}
/* Statuts : le propriétaire écrit pending/confirmed/preparing/delivered/cancelled,
   l'employé écrit completed/rejected. Lecture seule (rien n'est réécrit dans Firestore) :
   completed -> delivered, rejected -> cancelled. */
function cmNormOrderStatus(s){
  const v = String(s || 'pending').toLowerCase();
  if (v === 'completed') return 'delivered';
  if (v === 'rejected' || v === 'canceled') return 'cancelled';
  return v;
}

"""

COUNTERS_OLD = """  const pending = orders.filter(o => o.status === 'pending').length;
  const active = orders.filter(o => ['confirmed','preparing'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;
"""
COUNTERS_NEW = """  const pending = orders.filter(o => cmNormOrderStatus(o.status) === 'pending').length;
  const active = orders.filter(o => ['confirmed','preparing'].includes(cmNormOrderStatus(o.status))).length;
  const delivered = orders.filter(o => cmNormOrderStatus(o.status) === 'delivered').length;
  const cancelled = orders.filter(o => cmNormOrderStatus(o.status) === 'cancelled').length;
"""

UPDATE_STATUS_OLD = """  try {
    const ref = doc(db, 'public_orders', orderId);
"""
UPDATE_STATUS_NEW = """  try {
    /* AET-PATCH-20260920 : pont module -> IIFE */
    const db = window.__AET_DB__;
    const { doc, updateDoc, serverTimestamp } = window.__AET_FIRESTORE__ || {};
    if (!db || typeof doc !== 'function' || typeof updateDoc !== 'function') {
      throw new Error('Pont Firestore indisponible');
    }
    const ref = doc(db, 'public_orders', orderId);
"""

# ───────────────────────── blocs JS : adaptateur de mouvements ─────────────────────────
MVT_ADAPTER = r"""/* AET-PATCH-20260920 — ADAPTATEUR DE LECTURE des mouvements (unique, partagé avec CP.getMvts).
   Ne modifie JAMAIS CM.mouvements et n'est JAMAIS réécrit dans Firestore : il renvoie des copies.
   Formats compris :
     ancien        {artId, artName, type:'vente'|'achat', qte, prix, total, date, createdAt, person, note, receiptNum}
     intermédiaire {lignes[]:{artName|artNom, qte|qty, prix|prixUnit}}
     courant       {type:'sale', items[]:{productId|articleId, name, qty, unitPrice|prixV, total}, total|grandTotal,
                    createdAtMs, sellerName|employeeName, receiptNumber, paymentMethod} (employe.html) */
function cmNormMvt(m){
  const r = m || {};
  const pick = function(){
    for (let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if (v === undefined || v === null || v === '') continue;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const rawLines = (Array.isArray(r.items) && r.items.length) ? r.items
                 : (Array.isArray(r.lignes) ? r.lignes : []);
  const lines = rawLines.filter(Boolean).map(function(l){
    const unit = pick(l.unitPrice, l.prixV, l.prix, l.prixUnit, l.price);
    const tot  = pick(l.total);
    let qty = pick(l.qty, l.qte, l.quantity);
    if (qty === null) qty = (unit !== null || tot !== null) ? 1 : 0;
    const unitF = unit !== null ? unit : (tot !== null && qty > 0 ? tot / qty : 0);
    return {
      id: l.productId || l.articleId || l.artId || l.id || '',
      name: l.name || l.artName || l.artNom || l.nom || 'Article',
      qty: qty,
      unitPrice: unitF,
      total: tot !== null ? tot : qty * unitF
    };
  });
  const sumQty = lines.reduce(function(s, l){ return s + l.qty; }, 0);
  const sumTot = lines.reduce(function(s, l){ return s + l.total; }, 0);

  const qteRaw = pick(r.qte, r.qty);
  const qte = qteRaw !== null ? qteRaw : sumQty;
  const prixRaw = pick(r.prix, r.prixUnit, r.prixV, r.unitPrice);
  const totRaw = pick(r.total, r.grandTotal);
  const total = totRaw !== null ? totRaw : (lines.length ? sumTot : qte * (prixRaw || 0));
  const prix = prixRaw !== null ? prixRaw
             : (lines.length === 1 ? lines[0].unitPrice : (qte > 0 ? total / qte : 0));

  let artName = r.artName || r.artNom || (lines[0] && lines[0].name) || 'Article';
  if (lines.length > 1 && !r.artName && !r.artNom){
    const n = lines.length - 1;
    artName += ' + ' + n + ' autre' + (n > 1 ? 's' : '');
  }

  const t0 = String(r.type || '').toLowerCase();
  const type = (t0 === 'sale' || t0 === 'vente') ? 'vente'
             : (t0 === 'purchase' || t0 === 'achat' || t0 === 'reception') ? 'achat'
             : (r.type || 'achat');

  let createdAt = null;
  const ca = r.createdAt;
  if (ca && typeof ca.toMillis === 'function') createdAt = ca.toMillis();
  else if (ca && typeof ca.seconds === 'number') createdAt = ca.seconds * 1000;
  else createdAt = pick(ca, r.createdAtMs);
  if (createdAt === null && r.date){
    const p = Date.parse(r.date);
    if (Number.isFinite(p)) createdAt = p;
  }
  createdAt = createdAt || 0;
  const date = r.date || (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '');

  return Object.assign({}, r, {
    type: type,
    artName: artName,
    artId: r.artId || r.productId || r.articleId || (lines.length === 1 ? lines[0].id : ''),
    qte: qte,
    prix: prix,
    total: total,
    date: date,
    createdAt: createdAt,
    person: r.person || (r.customer && r.customer.name) || r.clientName || '',
    note: r.note || (r.customer && r.customer.note) || '',
    sellerName: r.sellerName || r.employeeName || (r.employee && r.employee.name) || '',
    receiptNum: r.receiptNum || r.receiptNumber || r.docNumber || '',
    paymentMethod: r.paymentMethod || r.paymentMode || '',
    _lines: lines
  });
}
window.cmNormMvt = cmNormMvt;

/* Lignes d'un mouvement (ventes multi-articles => une ligne par article) */
function cmMvtLines(m){
  if (m && Array.isArray(m._lines) && m._lines.length > 1){
    return m._lines.map(function(l){ return { artId: l.id, name: l.name, qte: l.qty, total: l.total }; });
  }
  return [{ artId: m.artId, name: m.artName, qte: m.qte, total: m.total }];
}

/* Quantité (nombre, pas un montant) */
function cmFmtQty(n){
  return (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function cmGetShopMvts(){
  return CM.mouvements.filter(function(m){ return m && m.shopId === CM.currentShopId; }).map(cmNormMvt);
}"""

RESUME_TOP_OLD = """  cmGetShopMvts().filter(m=>m.type==='vente').forEach(m=>{
    if(!top[m.artId]) top[m.artId] = {name:m.artName, qte:0, total:0};
    top[m.artId].qte += (m.qte||0);
    top[m.artId].total += (m.total||0);
  });
"""
RESUME_TOP_NEW = """  cmGetShopMvts().filter(m=>m.type==='vente').forEach(m=>{
    cmMvtLines(m).forEach(l=>{           /* AET-PATCH-20260920 : ventes multi-articles */
      const k = l.artId || l.name;
      if(!top[k]) top[k] = {name:l.name, qte:0, total:0};
      top[k].qte += (l.qte||0);
      top[k].total += (l.total||0);
    });
  });
"""

MVT_RENDER_NEW = r"""function cmRenderMvts(){
  const c = document.getElementById('cmMvtList');
  if(!c) return;
  /* AET-PATCH-20260920 : cmGetShopMvts() renvoie déjà des copies normalisées (cmNormMvt) :
     type sale->vente, artName, qte, prix, total, date, createdAt, sellerName, receiptNum. */
  let mvts = cmGetShopMvts().slice();
  if(CM.currentMvtFilter!=='all') mvts = mvts.filter(m=>m.type===CM.currentMvtFilter);
  mvts.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(mvts.length===0){
    c.innerHTML = `<div class="cm-empty"><i class="fas fa-right-left"></i>${t('cm_no_movement')}<br><small>${t('cm_no_movement_sub')}</small></div>`;
    return;
  }
  c.innerHTML = mvts.map(m=>{
    const ic = m.type==='vente'?'fa-cash-register':'fa-truck-ramp-box';
    const sign = m.type==='vente'?'+':'−';
    const sellerLine = m.sellerName ? ' • ' + (currentLang==='en' ? 'Seller' : 'Vendu par') + ' ' + esc(m.sellerName) : '';
    return `<div class="cm-mvt-card" onclick="cmDeleteMvt('${esc(m.id)}')">
      <div class="cm-mvt-icon ${m.type}"><i class="fas ${ic}"></i></div>
      <div class="cm-mvt-body">
        <div class="cm-mvt-title">${esc(m.artName)} <span style="color:var(--muted);font-weight:500">×${cmFmtQty(m.qte)}</span></div>
        <div class="cm-mvt-sub">${esc(m.date||'—')}${m.person?' • '+esc(m.person):''}${sellerLine}${m.note?' • '+esc(m.note):''}</div>
      </div>
      ${m.receiptNum ? `<button onclick="event.stopPropagation();cmViewMvtReceipt('${esc(m.id)}')" title="${t('cm_view_receipt')}" style="flex-shrink:0;width:30px;height:30px;border-radius:8px;border:none;background:rgba(37,99,235,.08);color:var(--primary);cursor:pointer;margin-right:6px"><i class="fas fa-receipt" style="font-size:12px"></i></button>` : ''}
      <div class="cm-mvt-amt ${m.type}">${sign}${cmAmt(m.total)}</div>
    </div>`;
  }).join('');
}

"""

VIEW_RECEIPT_OLD = """  const m = CM.mouvements.find(x=>x.id===mvtId);
  if(!m || !m.receiptNum){ cmToast(t('cm_no_receipt'),'error'); return; }
"""
VIEW_RECEIPT_NEW = """  const rawM = CM.mouvements.find(x=>x.id===mvtId);
  const m = rawM ? cmNormMvt(rawM) : null;   /* AET-PATCH-20260920 : receiptNumber (employé) reconnu */
  if(!m || !m.receiptNum){ cmToast(t('cm_no_receipt'),'error'); return; }
"""

DELETE_MVT_OLD = """  const m = CM.mouvements.find(x=>x.id===id);
  if(!m) return;
  if(!confirm(t('cm_confirm_delete_mvt',{type:(m.type==='vente'?t('cm_filter_ventes_sing'):t('cm_filter_achats_sing')),name:m.artName,qte:m.qte}))) return;
"""
DELETE_MVT_NEW = """  const m = CM.mouvements.find(x=>x.id===id);   /* brut : la suite modifie l'enregistrement réel */
  if(!m) return;
  const nm = cmNormMvt(m);                      /* AET-PATCH-20260920 : libellé lisible (plus de "undefined") */
  if(!confirm(t('cm_confirm_delete_mvt',{type:(nm.type==='vente'?t('cm_filter_ventes_sing'):t('cm_filter_achats_sing')),name:nm.artName,qte:nm.qte}))) return;
"""

BUILD_RECEIPT_NEW = r"""function cmBuildReceipt(mvt, article){
  const shop = cmGetShop();
  const m = cmNormMvt(mvt);   /* AET-PATCH-20260920 : même adaptateur que l'écran Mouvements */
  return {
    docNumber: m.receiptNum,
    type: m.type, // 'vente' | 'achat'
    shopName: shop ? shop.name : '',
    articleName: m.artName,
    unit: article ? (article.unit||'') : '',
    qte: m.qte, prix: m.prix, total: m.total,
    lines: (m._lines || []).map(function(l){ return { name: l.name, qty: l.qty, unitPrice: l.unitPrice, total: l.total }; }),
    person: m.person, note: m.note, date: m.date,
    sellerName: m.sellerName,
    sellerRole: m.sellerRole || m.employeeRole || '',
    paymentMethod: m.paymentMethod,
    createdAt: m.createdAt || Date.now(),
  };
}

"""

DOC_HTML_NEW = r"""function cmDocHTML(doc){
  const isQuote = doc.kind === 'quote';
  const d = doc.data;
  const dateStr = new Date(d.createdAt).toLocaleDateString(currentLang==='en'?'en-US':'fr-FR');
  const personLabel = isQuote ? t('cm_doc_client') : (d.type==='achat' ? t('cm_doc_supplier') : t('cm_doc_client'));
  /* AET-PATCH-20260920 : ventes multi-articles + vendeur */
  const multi = Array.isArray(d.lines) && d.lines.length > 1;
  const articleRows = multi
    ? d.lines.map(l => `<div class="cm-doc-row"><span>${esc(l.name)} ×${cmFmtQty(l.qty)}</span><span>${cmAmt(l.total)}</span></div>`).join('')
    : `<div class="cm-doc-row"><span>${t('cm_doc_article')}</span><span>${esc(d.articleName)}</span></div>
    <div class="cm-doc-row"><span>${t('cm_doc_qty')}</span><span>${cmFmtQty(d.qte)} ${esc(d.unit||'')}</span></div>
    <div class="cm-doc-row"><span>${t('cm_doc_unit_price')}</span><span>${cmAmt(d.prix)}</span></div>`;
  const sellerRow = (!isQuote && d.sellerName)
    ? `<div class="cm-doc-row"><span>${currentLang==='en'?'Seller':'Vendu par'}</span><span>${esc(d.sellerName)}${d.sellerRole ? ' ('+esc(d.sellerRole)+')' : ''}</span></div>`
    : '';
  return `
    <div class="cm-doc-head">
      <div class="cm-doc-shop">${esc(d.shopName||'')}</div>
      <div class="cm-doc-type">${isQuote ? t('cm_doc_quote_title') : (d.type==='achat'?t('cm_doc_receipt_purchase'):t('cm_doc_receipt_sale'))}</div>
      <div class="cm-doc-num">${t('cm_doc_no')} ${esc(d.docNumber)} — ${t('cm_doc_date')} ${dateStr}</div>
    </div>
    ${d.person ? `<div class="cm-doc-row"><span>${personLabel}</span><span>${esc(d.person)}</span></div>` : ''}
    ${sellerRow}
    ${articleRows}
    <div class="cm-doc-row cm-doc-total"><span>${t('cm_doc_total')}</span><span>${cmAmt(d.total)}</span></div>
    ${isQuote && d.validUntil ? `<div class="cm-doc-row"><span>${t('cm_doc_valid_until')}</span><span>${new Date(d.validUntil).toLocaleDateString(currentLang==='en'?'en-US':'fr-FR')}</span></div>` : ''}
    ${d.note ? `<div class="cm-doc-row"><span colspan="2" style="color:#666">${esc(d.note)}</span></div>` : ''}
    <div class="cm-doc-foot">${isQuote ? t('cm_doc_quote_disclaimer') : t('cm_doc_thanks')}</div>
  `;
}

/* AET-PATCH-20260920 : ces fonctions sont LOCALES à l'IIFE ; on les expose explicitement pour que
   les scripts suivants (v5/v52) lisent les vraies fonctions et non une globale fantôme. */
window.cmBuildReceipt = cmBuildReceipt;
window.cmDocHTML = cmDocHTML;

"""

V2_STUB = ('<script id="aet-index-patch-v2">/* ' + MARK + ' : ancien patch v2 neutralisé. '
           'cmRenderMvts / cmBuildReceipt / cmDocHTML sont des fonctions LOCALES de l\'IIFE Commerce : '
           'les affecter depuis ce script externe créait des globales jamais appelées. '
           'La normalisation vit maintenant dans cmNormMvt (IIFE Commerce), corrigée à la source. */</script>')

# ───────────────────────── blocs JS : profil ─────────────────────────
LOAD_PROFILE_NEW = r"""async function loadProfile() {
  if (!_auth.currentUser) return;
  /* AET-PATCH-20260920 : ne jamais mélanger le profil d'un compte précédent avec le suivant */
  if (window._profileUid !== _auth.currentUser.uid) {
    userProfile = { displayName:'', phone:'', job:'', city:'', birth:'', avatar:'👤', email:'' };
    window._profileUid = _auth.currentUser.uid;
  }
  try {
    const snap = await _getDoc(_doc(_db,'profiles',_auth.currentUser.uid));
    if (snap.exists()) {
      userProfile = { ...userProfile, ...snap.data() };
    }
    window._profileLoadOk = true;
    userProfile.email = _auth.currentUser.email;
    if (!userProfile.displayName) userProfile.displayName = _auth.currentUser.displayName || _auth.currentUser.email.split('@')[0];
    window.userProfile = userProfile;
  } catch(e) {
    window._profileLoadOk = false;   /* saveProfileEdit refusera d'écraser un profil non lu */
    console.warn('loadProfile', e);
  }
}

"""

OPEN_EDIT_OLD = """window.openProfileEdit = async () => {
  await loadProfile();
"""
OPEN_EDIT_NEW = """window.openProfileEdit = async () => {
  await loadProfile();
  if (window._profileLoadOk === false) toast('Lecture du profil impossible (droits Firestore ?). Enregistrement bloqué pour protéger vos données.', 'error');
"""

SAVE_PROFILE_NEW = r"""window.saveProfileEdit = async () => {
  if (!_auth.currentUser) return;
  /* AET-PATCH-20260920 — ordre corrigé et photo jamais supprimée implicitement :
     1) profil d'abord (l'essentiel) ; 2) historique ensuite, non bloquant ;
     3) photoData n'est écrit QUE si nouvelle photo (valeur) ou suppression explicite (null) ;
        sinon le champ est absent du payload et merge:true conserve la photo existante. */
  if (window._profileLoadOk === false) {
    toast('Profil non chargé : enregistrement bloqué pour ne pas écraser vos données. Réessayez.', 'error');
    return;
  }
  const newProfile = {
    displayName: document.getElementById('editName').value.trim(),
    phone:       document.getElementById('editPhone').value.trim(),
    job:         document.getElementById('editJob').value.trim(),
    city:        document.getElementById('editCity').value.trim(),
    birth:       document.getElementById('editBirth').value,
    avatar:      document.querySelector('#avatarGrid .avatar-choice.selected')?.dataset.av || userProfile.avatar || '👤',
    email:       _auth.currentUser.email,
    updatedAt:   _ts(),
  };
  if (window._pendingPhotoData) {
    newProfile.photoData = window._pendingPhotoData;      // nouvelle photo
  } else if (window._removePhoto === true) {
    newProfile.photoData = null;                          // suppression volontaire
  }                                                        // sinon : champ absent => photo conservée
  if (!newProfile.displayName) { toast('Le nom est requis','error'); return; }

  loader(true);
  let historyOk = true;
  try {
    // Lecture de l'ancienne version (pour l'historique) — non bloquante
    let oldData = null;
    try {
      const oldSnap = await _getDoc(_doc(_db,'profiles',_auth.currentUser.uid));
      oldData = oldSnap.exists() ? oldSnap.data() : {};
    } catch(e) { console.warn('profil: lecture ancienne version', e); }

    // 1) Profil courant (jamais bloqué par l'historique)
    await _setDoc(_doc(_db,'profiles',_auth.currentUser.uid), newProfile, { merge:true });

    // 2) Historique (l'ancienne version n'est JAMAIS écrasée) — échec toléré
    if (oldData) {
      const changes = {};
      ['displayName','phone','job','city','birth','avatar'].forEach(k => {
        if ((oldData[k]||'') !== (newProfile[k]||'')) {
          changes[k] = { from: oldData[k]||'', to: newProfile[k]||'' };
        }
      });
      if (Object.keys(changes).length > 0) {
        try {
          await _addDoc(_col(_db,'profileHistory'), {
            userId: _auth.currentUser.uid,
            changes,
            snapshot: oldData,
            changedAt: _ts(),
          });
        } catch(he) { historyOk = false; console.warn('profileHistory', he); }
      }
    }

    // Also update Firebase Auth displayName
    if (newProfile.displayName && newProfile.displayName !== _auth.currentUser.displayName) {
      await _upProfile(_auth.currentUser, { displayName: newProfile.displayName });
    }
    userProfile = { ...userProfile, ...newProfile };
    window.userProfile = userProfile;
    window._pendingPhotoData = undefined;
    window._removePhoto = false;
    // Update top bar name
    const un = document.getElementById('userName'); if (un) un.textContent = newProfile.displayName;
    applyAvatarDisplay('userAvatarText','userAvatarImg', newProfile.displayName);
    renderProfileTab();
    closeAetModal('profileEditModal');
    showSuccess('Profil mis à jour !', historyOk
      ? 'Vos informations ont été enregistrées et l\'ancienne version a été archivée.'
      : 'Vos informations ont été enregistrées (l\'historique n\'a pas pu être archivé).');
  } catch(e) {
    console.error(e);
    toast(friendlyErr(e), 'error');
  }
  loader(false);
};

"""

# ───────────────────────── firestore.rules (optionnel) ─────────────────────────
RULES_BLOCK = """    // ── AET-PATCH-20260920 : profil utilisateur (index.html : loadProfile / saveProfileEdit) ──
    match /profiles/{uid} {
      allow read, write: if isSelf(uid) || isAdmin();
    }

    // Historique de profil : addDoc() => ID automatique + champ userId (jamais modifiable/supprimable).
    match /profileHistory/{id} {
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
    }

"""
RULES_PRO_BLOCK = """    // ── AET-PATCH-20260920 : Commerce Pro (clients, fournisseurs, crédits, caisse, inventaires) ──
    match /commerce_pro_data/{uid} {
      allow read, write: if isSelf(uid) || isAdmin();
    }

"""


# ───────────────────────── patchs par fichier ─────────────────────────
def patch_index(src):
    if MARK in src:
        raise AlreadyPatched('déjà patché (%s)' % MARK)
    s = src
    # 1. Pont module -> IIFE
    s = rep(s, 'window.__AET_FIRESTORE__ = { doc, getDoc, setDoc, deleteDoc, serverTimestamp, runTransaction, onSnapshot };',
            BRIDGE_EXPORT_NEW, 'pont-export')
    # 2. Commandes
    s = rep(s, WATCH_HEAD_OLD, WATCH_HEAD_NEW, 'orders-watch-head')
    s = rep(s, WATCH_CATCH_OLD, WATCH_CATCH_NEW, 'orders-watch-catch')
    s = rep(s, 'function cmOrderStatusLabel(status){', ORDER_HELPERS + 'function cmOrderStatusLabel(status){', 'orders-helpers')
    s = rep(s, COUNTERS_OLD, COUNTERS_NEW, 'orders-counters')
    s = rep(s, "    const status = order.status || 'pending';\n", "    const status = cmNormOrderStatus(order.status);\n", 'orders-status')
    s = rep(s, UPDATE_STATUS_OLD, UPDATE_STATUS_NEW, 'orders-update-status')
    # 3. Adaptateur de mouvements (IIFE Commerce)
    s = rep(s, "function cmGetShopMvts(){ return CM.mouvements.filter(m=>m.shopId===CM.currentShopId); }",
            MVT_ADAPTER, 'mvt-adapter')
    s = rep(s, RESUME_TOP_OLD, RESUME_TOP_NEW, 'resume-top')
    s = rep_between(s, 'function cmRenderMvts(){', 'window.cmViewMvtReceipt = function(mvtId){', MVT_RENDER_NEW,
                    'mvt-render', 4000, ("cm-mvt-title", "cmGetShopMvts()"))
    s = rep(s, VIEW_RECEIPT_OLD, VIEW_RECEIPT_NEW, 'mvt-view-receipt')
    s = rep(s, DELETE_MVT_OLD, DELETE_MVT_NEW, 'mvt-delete')
    s = rep_between(s, 'function cmBuildReceipt(mvt, article){', '// Construit un devis autonome', BUILD_RECEIPT_NEW,
                    'receipt-build', 2500, ('docNumber: mvt.receiptNum',))
    s = rep_between(s, 'function cmDocHTML(doc){', 'function cmRenderDocPreview(){', DOC_HTML_NEW,
                    'receipt-dochtml', 6000, ('cm-doc-head', 'cm_doc_thanks'))
    # 4. Ancien patch v2 (dead code + overrides window.* qui écrasaient nos corrections)
    s = rep_between(s, '<script id="aet-index-patch-v2">', '\n\n\n<script id="aet-index-patch-v5">', V2_STUB,
                    'patch-v2-stub', 12000, ('function normM(m)', 'cmRenderMvts = function'))
    # 5. Profil
    s = rep_between(s, 'async function loadProfile() {', 'window.openProfileEdit = async () => {', LOAD_PROFILE_NEW,
                    'profile-load', 1500, ("_getDoc(_doc(_db,'profiles'",))
    s = rep(s, OPEN_EDIT_OLD, OPEN_EDIT_NEW, 'profile-open')
    s = rep_between(s, 'window.saveProfileEdit = async () => {', 'window.showProfileHistory = async () => {', SAVE_PROFILE_NEW,
                    'profile-save', 6000, ("_addDoc(_col(_db,'profileHistory')", 'photoData'))
    if MARK not in s:
        raise PatchError('marqueur absent après patch')
    return s


def patch_cmpro(src):
    if MARK in src:
        raise AlreadyPatched('déjà patché (%s)' % MARK)
    new = """    getMvts: () => {
      const cm = window.CM_DEBUG;
      if (!cm) return [];
      // %s : adaptateur de lecture UNIQUE, défini dans index.html (cmNormMvt) — pas de 2e implémentation.
      const norm = (typeof window.cmNormMvt === 'function') ? window.cmNormMvt : null;
      if (!norm) console.warn('[CP] cmNormMvt indisponible : mouvements non normalisés');
      return (cm.mouvements || []).filter(m => m && m.shopId === cm.currentShopId).map(m => norm ? norm(m) : m);
    },
""" % MARK
    return rep_between(src, '    getMvts: () => {', '    db: () => window.__AET_DB__,', new, 'cmpro-getMvts', 3000,
                       ('m?.lignes?.[0]?.qte',))


def patch_rules(src):
    if MARK in src:
        raise AlreadyPatched('déjà patché (%s)' % MARK)
    for fn in ('isSignedIn', 'isSelf', 'isAdmin'):
        if 'function %s(' % fn not in src:
            raise PatchError('fonction de règles %s() absente : je n\'ajoute rien' % fn)
    s = src
    add = ''
    if 'match /profiles/' not in s:
        add += RULES_BLOCK
    if 'match /commerce_pro_data/' not in s:
        add += RULES_PRO_BLOCK
    if not add:
        raise PatchError('profiles / profileHistory / commerce_pro_data déjà couverts : rien à ajouter')
    anchor = re.search(r'\n(\s*)match /public_shops/\{', s)
    if not anchor:
        raise PatchError('ancre "match /public_shops/" introuvable')
    pos = anchor.start() + 1
    return s[:pos] + add + s[pos:]


def patch_sw(src):
    if MARK in src:
        raise AlreadyPatched('déjà patché (%s)' % MARK)
    m = re.search(r"const CACHE_NAME = '([^']+)';", src)
    if not m:
        raise PatchError('CACHE_NAME introuvable')
    old = m.group(1)
    mm = re.match(r'^(.*-v)(\d+)(.*)$', old)
    if not mm:
        raise PatchError('format CACHE_NAME inattendu : %s' % old)
    new = '%s%d%s' % (mm.group(1), int(mm.group(2)) + 1, mm.group(3))
    return src.replace("const CACHE_NAME = '%s';" % old,
                       "const CACHE_NAME = '%s'; // %s : cache incrémenté (nouveaux index.html / aet-commerce-pro.js)" % (new, MARK), 1)


# ───────────────────────── vérification de syntaxe JS ─────────────────────────
def js_syntax_errors(text, is_html):
    """Retourne l'ensemble des blocs <script> (ou du .js) qui échouent à `node --check`."""
    if subprocess.call(['sh', '-c', 'command -v node >/dev/null 2>&1']) != 0:
        return None
    blocks = []
    if is_html:
        for i, m in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>', text, re.S | re.I)):
            attrs, body = m.group(1), m.group(2)
            if 'src=' in attrs or not body.strip():
                continue
            if re.search(r'type\s*=\s*["\'](?!module)[^"\']+["\']', attrs, re.I):
                continue  # json / template
            blocks.append(('script#%d' % i, body, '.mjs' if 'module' in attrs else '.js'))
    else:
        blocks.append(('fichier', text, '.js'))
    bad = set()
    with tempfile.TemporaryDirectory() as d:
        for name, body, ext in blocks:
            p = os.path.join(d, 'x' + ext)
            with open(p, 'w', encoding='utf-8') as f:
                f.write(body)
            r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
            if r.returncode != 0:
                bad.add(name)
    return bad


def process(path, fn, is_html, label):
    if not os.path.exists(path):
        print('  ⏭  %s : fichier absent, ignoré' % path)
        return False
    src = read(path)
    try:
        new = fn(src)
    except AlreadyPatched as e:
        print('  ⏭  %s : %s — rien à faire' % (path, e))
        return True
    except PatchError as e:
        print('  ✖  %s : %s' % (path, e))
        return False
    before = js_syntax_errors(src, is_html) if label != 'rules' and label != 'sw' else set()
    after = js_syntax_errors(new, is_html) if label != 'rules' and label != 'sw' else set()
    if before is not None and after is not None and (after - before):
        print('  ✖  %s : NOUVELLE erreur de syntaxe JS %s -> fichier laissé intact' % (path, sorted(after - before)))
        return False
    if DRY:
        print('  ✔  %s : ancres OK, syntaxe OK (dry-run, rien écrit)' % path)
        return True
    b = backup(path)
    write(path, new)
    print('  ✔  %s modifié — sauvegarde : %s' % (path, b))
    return True


def main():
    print('aet_patch.py %s%s' % (MARK, '  [DRY-RUN]' if DRY else ''))
    if not os.path.exists('index.html'):
        print('✖ Lance ce script à la racine du dépôt (index.html introuvable).')
        sys.exit(1)
    ok = []
    ok.append(process('index.html', patch_index, True, 'index'))
    ok.append(process(os.path.join('assets', 'js', 'aet-commerce-pro.js'), patch_cmpro, False, 'cmpro'))
    if WITH_RULES:
        ok.append(process('firestore.rules', patch_rules, False, 'rules'))
    if BUMP_SW:
        ok.append(process('sw.js', patch_sw, False, 'sw'))
    print()
    if all(ok):
        print('Terminé. Rien n\'a été déployé, poussé ni supprimé.')
    else:
        print('Certains fichiers n\'ont PAS été modifiés (voir ✖ ci-dessus). Aucun fichier partiellement patché.')
        sys.exit(2)


if __name__ == '__main__':
    main()
