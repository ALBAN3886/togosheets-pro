/**
 * ═══════════════════════════════════════════════════════════════
 * AET COMMERCE PRO — Module d'amélioration du Commerce
 * Version: 3.0.0 | Compatible avec index.html v2 (schemaVersion:2)
 * Auteur: AET Technology — ALBAN3886
 *
 * INSTALLATION : Ajouter dans index.html APRÈS la balise :
 * <!-- ═══════════════ FIN MODULE COMMERCE ═══════════════ -->
 * <script src="assets/js/aet-commerce-pro.js"></script>
 *
 * Ce fichier étend le module CM existant SANS le casser.
 * Il injecte de nouveaux onglets, modals, logiques et graphiques.
 * ═══════════════════════════════════════════════════════════════
 */


(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
   * 0. VERROU IMMÉDIAT AU CHARGEMENT
   *
   * CM natif garde activeRole EN MÉMOIRE UNIQUEMENT (reset au reload).
   * Solution : on persiste la session employé dans localStorage et on
   * applique le CSS de verrou IMMÉDIATEMENT avant tout rendu UI.
   * ═══════════════════════════════════════════════════════════ */
  const CP_SESSION_KEY  = 'aet_cp_employee_session';
  const CP_LOCK_STYLE_ID = 'cp-early-lock-style';

  function cpReadSession()  { try { return JSON.parse(localStorage.getItem(CP_SESSION_KEY)||'null'); } catch(e){ return null; } }
  function cpWriteSession(d){ try { localStorage.setItem(CP_SESSION_KEY, JSON.stringify(d)); } catch(e){} }
  function cpClearSession() { try { localStorage.removeItem(CP_SESSION_KEY); } catch(e){} }

  function cpInjectEarlyLock() {
    if (document.getElementById(CP_LOCK_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = CP_LOCK_STYLE_ID;
    s.textContent = `
      body.cp-locked-early #sidebar .sidebar-link:not(#sb-commerce),
      body.cp-locked-early .sidebar  .sidebar-link:not(#sb-commerce) {
        opacity:.18!important; pointer-events:none!important; filter:grayscale(1)!important;
      }
      body.cp-locked-early #bnav-dashboard,
      body.cp-locked-early #bnav-historique,
      body.cp-locked-early #bnav-epargne,
      body.cp-locked-early #bnav-more {
        opacity:.18!important; pointer-events:none!important; filter:grayscale(1)!important;
      }
      body.cp-locked-early .tab-btn:not([data-tab="commerce"]) {
        opacity:.18!important; pointer-events:none!important;
      }
      body.cp-locked-early .bnav-drawer-item:not(#bnd-commerce) {
        opacity:.18!important; pointer-events:none!important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function cpApplyEarlyLockClass() {
    document.body.classList.add('cp-locked-early','cp-employee-mode');
  }

  // ► Appliquer immédiatement si session employé trouvée
  const _earlySession = cpReadSession();
  if (_earlySession && _earlySession.role && _earlySession.role !== 'patron') {
    cpInjectEarlyLock();
    if (document.body) {
      cpApplyEarlyLockClass();
    } else {
      document.addEventListener('DOMContentLoaded', cpApplyEarlyLockClass, { once: true });
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * 1. ATTENTE DU MODULE CM DE BASE
   * ═══════════════════════════════════════════════════════════ */
  function waitForCM(cb, attempts = 0) {
    if (typeof window.cmSwitch === 'function' && typeof window.CM_DEBUG !== 'undefined') {
      cb();
    } else if (attempts < 80) {
      setTimeout(() => waitForCM(cb, attempts + 1), 150);
    } else {
      console.warn('[AET Commerce Pro] Module CM non trouvé après délai max.');
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * 2. HELPERS PARTAGÉS
   * ═══════════════════════════════════════════════════════════ */
  const CP = {
    // Raccourcis
    fmt: (n) => (typeof window.fmt === 'function' ? window.fmt(n || 0) : (n || 0).toLocaleString('fr-FR')),
    cur: () => window.activeCurrency || localStorage.getItem('aet_currency') || 'XOF',
    amt: (n) => CP.fmt(n) + ' ' + CP.cur(),
    today: () => new Date().toISOString().slice(0, 10),
    month: () => new Date().toISOString().slice(0, 7),
    uid: () => 'cp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    toast: (msg, type) => typeof window.toast === 'function' ? window.toast(msg, type || 'success') : alert(msg),
    getCM: () => window.CM_DEBUG,
    getShop: () => { const cm = window.CM_DEBUG; return cm ? cm.shops.find(s => s.id === cm.currentShopId) : null; },
    getArticles: () => { const cm = window.CM_DEBUG; return cm ? cm.articles.filter(a => a.shopId === cm.currentShopId) : []; },
    getMvts: () => { const cm = window.CM_DEBUG; return cm ? cm.mouvements.filter(m => m.shopId === cm.currentShopId) : []; },
    db: () => window.__AET_DB__,
    fs: () => window.__AET_FIRESTORE__,
    uid_user: () => window.currentUser ? window.currentUser.uid : null,
  };

  /* Données locales Pro (clients, fournisseurs, caisse, inventaire physique, crédits) */
  let CPData = {
    clients: [],        // {id, shopId, nom, tel, email, adresse, createdAt}
    fournisseurs: [],   // {id, shopId, nom, tel, email, produits, createdAt}
    credits: [],        // {id, shopId, clientId, clientNom, artNom, montantTotal, montantPaye, echeance, date, statut, paiements:[]}
    caisse: [],         // {id, shopId, type:'ouverture'|'entree'|'sortie'|'fermeture', montant, note, date, userId}
    inventaires: [],    // {id, shopId, date, lignes:[{artId,artNom,stockSys,stockReel,ecart}], statut:'brouillon'|'validé'}
  };
  let _cpDataStamp = 0;
  let _cpSaveTimer = null;

  function cpKey() {
    const uid = CP.uid_user() || 'guest';
    return 'aet_commerce_pro_' + uid;
  }

  function cpLoad() {
    try {
      const raw = localStorage.getItem(cpKey());
      if (raw) { Object.assign(CPData, JSON.parse(raw)); }
    } catch (e) { console.warn('[CP] load', e); }
  }

  function cpSaveLocal() {
    try { localStorage.setItem(cpKey(), JSON.stringify(CPData)); } catch (e) { }
  }

  async function cpSaveRemote() {
    const uid = CP.uid_user();
    const db = CP.db();
    const fs = CP.fs();
    if (!uid || !db || !fs) return;
    try {
      await fs.setDoc(fs.doc(db, 'commerce_pro_data', uid), {
        userId: uid,
        ...CPData,
        updatedAt: fs.serverTimestamp(),
        updatedAtMs: Date.now(),
      }, { merge: true });
    } catch (e) { console.warn('[CP] save remote', e); }
  }

  async function cpLoadRemote() {
    const uid = CP.uid_user();
    const db = CP.db();
    const fs = CP.fs();
    if (!uid || !db || !fs) return;
    try {
      const snap = await fs.getDoc(fs.doc(db, 'commerce_pro_data', uid));
      if (snap.exists()) {
        const remote = snap.data() || {};
        ['clients', 'fournisseurs', 'credits', 'caisse', 'inventaires'].forEach(k => {
          if (Array.isArray(remote[k])) CPData[k] = remote[k];
        });
        cpSaveLocal();
      }
    } catch (e) { console.warn('[CP] load remote', e); }
  }

  function cpSave() {
    cpSaveLocal();
    clearTimeout(_cpSaveTimer);
    _cpSaveTimer = setTimeout(cpSaveRemote, 400);
  }

  /* ═══════════════════════════════════════════════════════════
   * 2B. GÉNÉRATEUR DE LIENS EMPLOYÉS
   *
   * Accessible via l'onglet Paramètres Commerce (bouton ajouté
   * automatiquement dans la section Résumé pour le Patron).
   * Génère un lien avec token unique, copiable ou partageable.
   * ═══════════════════════════════════════════════════════════ */

  function injectEmployeeLinkGenerator() {
    // Injecter le modal de génération de lien
    if (document.getElementById('cpLinkGenModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cpLinkGenModal">
        <div class="modal-box" style="max-width:480px">
          <div class="modal-header">
            <h3><i class="fas fa-link" style="color:#10b981;margin-right:8px"></i>Générer un lien Employé</h3>
            <button class="modal-close" onclick="closeModal('cpLinkGenModal')"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
              Partagez ce lien avec votre employé. Il ouvrira l'app directement sur Commerce, sans accès aux autres modules.
            </p>
            <div class="cp-form-group">
              <label class="cp-label">Nom de l'employé</label>
              <input type="text" id="cpLinkName" class="cp-input" placeholder="Ex: Koffi">
            </div>
            <div class="cp-form-row">
              <div class="cp-form-group">
                <label class="cp-label">Rôle</label>
                <select id="cpLinkRole" class="cp-select">
                  <option value="employee">Employé</option>
                  <option value="manager">Manager</option>
                  <option value="caissier">Caissier</option>
                </select>
              </div>
              <div class="cp-form-group">
                <label class="cp-label">Boutique</label>
                <select id="cpLinkShop" class="cp-select"></select>
              </div>
            </div>
            <div class="cp-form-group" id="cpLinkResultBox" style="display:none">
              <label class="cp-label">🔗 Lien généré</label>
              <div style="display:flex;gap:8px">
                <input type="text" id="cpLinkResult" class="cp-input" readonly
                  style="font-size:11px;flex:1;color:var(--muted)">
                <button onclick="cpCopyLink()" class="cp-btn green" style="flex-shrink:0;padding:10px 14px">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="cpShareLink()" class="cp-btn blue" style="flex:1">
                  <i class="fas fa-share-nodes"></i> Partager
                </button>
                <button onclick="cpOpenQRLink()" class="cp-btn soft" style="flex:1">
                  <i class="fas fa-qrcode"></i> QR Code
                </button>
              </div>
            </div>
            <!-- QR Code affiché ici -->
            <div id="cpLinkQR" style="display:none;text-align:center;margin-top:12px">
              <div id="cpLinkQRCanvas" style="display:inline-block;background:#fff;padding:12px;border-radius:12px;border:1px solid var(--border)"></div>
              <div style="font-size:11px;color:var(--muted);margin-top:8px">Scanner ce QR code pour accéder directement</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal('cpLinkGenModal')">Fermer</button>
            <button class="btn-save" onclick="cpGenerateEmployeeLink()" style="background:linear-gradient(135deg,#10b981,#059669)">
              <i class="fas fa-link"></i> Générer le lien
            </button>
          </div>
        </div>
      </div>

      <!-- Modal PWA Install Guide -->
      <div class="modal-overlay" id="cpInstallGuideModal">
        <div class="modal-box" style="max-width:440px">
          <div class="modal-header">
            <h3><i class="fas fa-mobile-screen" style="color:#2563eb;margin-right:8px"></i>Installer l'application</h3>
            <button class="modal-close" onclick="closeModal('cpInstallGuideModal')"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <!-- Bouton install direct si disponible -->
            <div id="cpInstallDirectBtn" style="display:none;margin-bottom:16px">
              <button onclick="cpTriggerInstall();closeModal('cpInstallGuideModal')" style="width:100%;padding:14px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:13px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">
                <i class="fas fa-download"></i> Installer maintenant (1 clic)
              </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <!-- Android Chrome -->
              <div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:12px">
                <div style="font-weight:800;font-size:13px;margin-bottom:6px"><i class="fab fa-android" style="color:#10b981"></i> Android (Chrome)</div>
                <div style="font-size:12.5px;color:var(--muted);line-height:1.7">
                  1. Ouvrez le lien dans <strong>Chrome</strong><br>
                  2. Tapez les <strong>3 points</strong> ⋮ en haut à droite<br>
                  3. Sélectionnez <strong>"Ajouter à l'écran d'accueil"</strong><br>
                  4. Confirmez → L'icône apparaît sur votre écran
                </div>
              </div>
              <!-- iOS Safari -->
              <div style="background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);border-radius:12px;padding:12px">
                <div style="font-weight:800;font-size:13px;margin-bottom:6px"><i class="fab fa-apple" style="color:#2563eb"></i> iPhone / iPad (Safari)</div>
                <div style="font-size:12.5px;color:var(--muted);line-height:1.7">
                  1. Ouvrez le lien dans <strong>Safari</strong><br>
                  2. Tapez l'icône <strong>Partager</strong> 
                  3. Sélectionnez <strong>"Sur l'écran d'accueil"</strong><br>
                  4. Confirmez → L'icône apparaît sur votre écran
                </div>
              </div>
              <!-- PC -->
              <div style="background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:12px">
                <div style="font-weight:800;font-size:13px;margin-bottom:6px"><i class="fas fa-desktop" style="color:#8b5cf6"></i> PC (Chrome / Edge)</div>
                <div style="font-size:12.5px;color:var(--muted);line-height:1.7">
                  1. Ouvrez le lien dans <strong>Chrome ou Edge</strong><br>
                  2. Cliquez sur l'icône <strong>⊕</strong> dans la barre d'adresse<br>
                  3. Cliquez <strong>"Installer"</strong><br>
                  4. L'app s'ouvre comme un programme natif
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal('cpInstallGuideModal')">Fermer</button>
          </div>
        </div>
      </div>
    `);

    // Peupler le select boutiques
    cpRefreshLinkShopSelect();
  }

  function cpRefreshLinkShopSelect() {
    const sel = document.getElementById('cpLinkShop');
    if (!sel) return;
    const cm = window.CM_DEBUG;
    if (!cm) return;
    sel.innerHTML = cm.shops.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');
  }

  window.cpOpenLinkGenerator = function () {
    cpRefreshLinkShopSelect();
    document.getElementById('cpLinkResultBox').style.display = 'none';
    document.getElementById('cpLinkQR').style.display = 'none';
    document.getElementById('cpLinkName').value = '';
    if (window.openModal) window.openModal('cpLinkGenModal');
  };

  window.cpGenerateEmployeeLink = function () {
    const name  = document.getElementById('cpLinkName')?.value.trim();
    const role  = document.getElementById('cpLinkRole')?.value || 'employee';
    const shopId= document.getElementById('cpLinkShop')?.value;
    if (!name) { CP.toast("Nom de l'employe requis", "error"); return; }
    if (!shopId) { CP.toast('Sélectionnez une boutique', 'error'); return; }

    // Générer un token simple (non cryptographique, juste pour identification)
    const token = btoa(name + ':' + shopId + ':' + Date.now()).replace(/=/g,'');

    const base  = window.location.origin + window.location.pathname;
    const link  = `${base}?mode=employee&shop=${encodeURIComponent(shopId)}&name=${encodeURIComponent(name)}&role=${role}&token=${token}`;

    const resultInput = document.getElementById('cpLinkResult');
    if (resultInput) resultInput.value = link;
    document.getElementById('cpLinkResultBox').style.display = 'block';
    document.getElementById('cpLinkQR').style.display = 'none';

    // Sauvegarder dans les données Pro (historique des liens)
    const shopId2 = CP.getCM()?.currentShopId;
    if (!CPData.employeeLinks) CPData.employeeLinks = [];
    CPData.employeeLinks.push({ name, role, shopId, token, link, createdAt: Date.now() });
    cpSave();

    CP.toast('Lien généré ✓', 'success');
  };

  window.cpCopyLink = function () {
    const val = document.getElementById('cpLinkResult')?.value;
    if (!val) return;
    navigator.clipboard?.writeText(val).then(() => {
      CP.toast("Lien copie !", 'success');
    }).catch(() => {
      // Fallback
      const el = document.getElementById('cpLinkResult');
      el.select(); document.execCommand('copy');
      CP.toast("Lien copie !", 'success');
    });
  };

  window.cpShareLink = function () {
    const val   = document.getElementById('cpLinkResult')?.value;
    const name  = document.getElementById('cpLinkName')?.value || 'Employé';
    if (!val) return;
    if (navigator.share) {
      navigator.share({
        title: "Acces Commerce - " + name,
        text:  "Lien acces Commerce pour " + name,
        url:   val,
      }).catch(() => {});
    } else {
      cpCopyLink();
      CP.toast("Lien copie - partagez-le par WhatsApp ou SMS", 'info');
    }
  };

  window.cpOpenQRLink = function () {
    const val = document.getElementById('cpLinkResult')?.value;
    if (!val) return;
    const qrDiv = document.getElementById('cpLinkQR');
    const canvas = document.getElementById('cpLinkQRCanvas');
    if (!qrDiv || !canvas) return;

    // Utiliser QRCode.js si disponible, sinon API externe
    if (typeof QRCode !== 'undefined') {
      canvas.innerHTML = '';
      new QRCode(canvas, { text: val, width: 180, height: 180, colorDark: '#0f172a', colorLight: '#ffffff' });
    } else {
      // API Google Charts (fallback sans lib)
      canvas.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(val)}" style="border-radius:6px" alt="QR Code">`;
    }
    qrDiv.style.display = 'block';
  };

  window.cpOpenInstallGuide = function () {
    // Vérifier si le prompt natif est disponible
    const btn = document.getElementById('cpInstallDirectBtn');
    if (btn) btn.style.display = _cpDeferredInstallPrompt ? 'block' : 'none';
    if (window.openModal) window.openModal('cpInstallGuideModal');
  };

  /* Ajouter le bouton "Générer lien employé" dans le dashboard Résumé */
  function injectLinkBtnInDashboard() {
    const resumeSec = document.getElementById('cm-sec-resume');
    if (!resumeSec || resumeSec.dataset.cpLinkBtn) return;
    resumeSec.dataset.cpLinkBtn = '1';

    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap';
    btnBar.innerHTML = `
      <button onclick="cpOpenLinkGenerator()" id="cpLinkGenBtn" style="display:none;flex:1;padding:11px 14px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px;justify-content:center">
        <i class="fas fa-link"></i> Lien Employé
      </button>
      <button onclick="cpOpenInstallGuide()" style="padding:11px 14px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px">
        <i class="fas fa-download" style="color:#2563eb"></i> Installer l'app
      </button>
    `;
    resumeSec.insertBefore(btnBar, resumeSec.firstChild);

    // Afficher le bouton lien uniquement pour le Patron
    function syncLinkBtn() {
      const btn = document.getElementById('cpLinkGenBtn');
      if (!btn) return;
      const isPatron = !cpIsEmployeeSession();
      btn.style.display = isPatron ? 'flex' : 'none';
    }
    syncLinkBtn();
    setInterval(syncLinkBtn, 1500);
  }

  /* ═══════════════════════════════════════════════════════════
   * 3. INJECTION CSS AMÉLIORATIONS
   * ═══════════════════════════════════════════════════════════ */
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'aet-commerce-pro-css';
    style.textContent = `
/* ── Commerce Pro : Variables & Reset ── */
:root {
  --cp-green: #10b981;
  --cp-blue: #2563eb;
  --cp-orange: #f59e0b;
  --cp-red: #ef4444;
  --cp-purple: #8b5cf6;
  --cp-teal: #06b6d4;
}

/* ── Nouveaux onglets Commerce Pro ── */
.cm-tabs { flex-wrap: wrap; gap: 4px; }
.cm-tab { font-size: 11.5px !important; padding: 8px 10px !important; }

/* ── Dashboard Pro : KPI cards ── */
.cp-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
@media(min-width:600px){ .cp-kpi-grid { grid-template-columns: repeat(4, 1fr); } }

.cp-kpi {
  background: var(--card, #fff);
  border: 1px solid var(--border, rgba(148,163,184,.22));
  border-radius: 16px;
  padding: 14px;
  position: relative;
  overflow: hidden;
  transition: transform .15s ease, box-shadow .15s ease;
}
.cp-kpi:active { transform: scale(.98); }
.cp-kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 16px 16px 0 0;
  background: var(--cp-accent, var(--cp-green));
}
.cp-kpi-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--muted, #64748b);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.cp-kpi-value {
  font-size: 20px;
  font-weight: 900;
  color: var(--text, #0f172a);
  line-height: 1.1;
}
.cp-kpi-sub {
  font-size: 10.5px;
  color: var(--muted, #64748b);
  margin-top: 4px;
}
.cp-kpi-icon {
  position: absolute;
  right: 12px;
  top: 12px;
  font-size: 20px;
  opacity: .12;
}

/* ── Graphiques ── */
.cp-chart-card {
  background: var(--card, #fff);
  border: 1px solid var(--border, rgba(148,163,184,.22));
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.cp-chart-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted, #64748b);
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cp-chart-wrap { position: relative; height: 160px; }

/* ── Bouton flottant avancé ── */
#cpFabMenu {
  position: fixed;
  bottom: 88px;
  right: 16px;
  z-index: 1050;
}
#cpFabBtn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--cp-green), #059669);
  border: none;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(16,185,129,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .2s ease;
}
#cpFabBtn.open { transform: rotate(45deg); background: linear-gradient(135deg, #ef4444, #dc2626); }
#cpFabItems {
  position: absolute;
  bottom: 60px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px);
  transition: opacity .2s ease, transform .2s ease;
}
#cpFabItems.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
.cp-fab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.cp-fab-label {
  background: var(--card, #fff);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
  white-space: nowrap;
}
.cp-fab-ico {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
  flex-shrink: 0;
}

/* ── Section Pro générale ── */
.cp-section { display: none; }
.cp-section.active { display: block; }

/* ── Listes Pro ── */
.cp-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.cp-list-item {
  background: var(--card, #fff);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-list-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 16px;
  flex-shrink: 0;
}
.cp-list-body { flex: 1; min-width: 0; }
.cp-list-name { font-weight: 700; font-size: 13.5px; color: var(--text); }
.cp-list-sub { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
.cp-list-right { text-align: right; flex-shrink: 0; }
.cp-list-amount { font-weight: 900; font-size: 13px; }

/* ── Badges statut ── */
.cp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 10.5px;
  font-weight: 700;
}
.cp-badge.green { background: rgba(16,185,129,.12); color: #047857; }
.cp-badge.red { background: rgba(239,68,68,.12); color: #b91c1c; }
.cp-badge.orange { background: rgba(245,158,11,.12); color: #b45309; }
.cp-badge.blue { background: rgba(37,99,235,.1); color: var(--cp-blue); }

/* ── Formulaires Pro ── */
.cp-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cp-form-group { margin-bottom: 12px; }
.cp-label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  margin-bottom: 5px;
}
.cp-input, .cp-select, .cp-textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  padding: 11px 13px;
  font: inherit;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color .15s;
}
.cp-input:focus, .cp-select:focus, .cp-textarea:focus {
  border-color: rgba(16,185,129,.5);
  box-shadow: 0 0 0 3px rgba(16,185,129,.08);
}
.cp-textarea { min-height: 80px; resize: vertical; }

/* ── Boutons Pro ── */
.cp-btn {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: transform .12s, opacity .12s;
}
.cp-btn:active { transform: translateY(1px); opacity: .9; }
.cp-btn.green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 6px 18px rgba(16,185,129,.28); }
.cp-btn.blue { background: linear-gradient(135deg, #2563eb, #3b82f6); color: #fff; box-shadow: 0 6px 18px rgba(37,99,235,.25); }
.cp-btn.red { background: rgba(239,68,68,.1); color: #ef4444; }
.cp-btn.soft { background: var(--card); border: 1px solid var(--border); color: var(--text); }
.cp-btn.full { width: 100%; justify-content: center; }
.cp-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── Caisse : solde affiché ── */
.cp-caisse-balance {
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 18px;
  padding: 20px;
  color: #fff;
  text-align: center;
  margin-bottom: 14px;
  box-shadow: 0 10px 28px rgba(16,185,129,.3);
}
.cp-caisse-balance-label { font-size: 12px; font-weight: 700; opacity: .8; text-transform: uppercase; letter-spacing: .08em; }
.cp-caisse-balance-value { font-size: 34px; font-weight: 900; margin: 6px 0 2px; }
.cp-caisse-balance-date { font-size: 11px; opacity: .75; }

/* ── Inventaire physique ── */
.cp-inv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cp-inv-table th {
  background: rgba(16,185,129,.08);
  padding: 8px 10px;
  text-align: left;
  font-weight: 800;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
.cp-inv-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.cp-inv-table input[type=number] {
  width: 70px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 8px;
  background: var(--card);
  color: var(--text);
  font-size: 13px;
}
.cp-ecart-pos { color: #10b981; font-weight: 700; }
.cp-ecart-neg { color: #ef4444; font-weight: 700; }

/* ── Alertes stock ── */
.cp-alert-item {
  background: rgba(239,68,68,.06);
  border: 1px solid rgba(239,68,68,.2);
  border-left: 3px solid #ef4444;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-alert-item.warning {
  background: rgba(245,158,11,.06);
  border-color: rgba(245,158,11,.25);
  border-left-color: #f59e0b;
}

/* ── IA Commerce ── */
#cpAiPanel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
}
.cp-ai-header {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-ai-messages {
  max-height: 260px;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cp-ai-msg {
  max-width: 88%;
  border-radius: 14px;
  padding: 10px 13px;
  font-size: 13px;
  line-height: 1.5;
}
.cp-ai-msg.user {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}
.cp-ai-msg.bot {
  background: rgba(139,92,246,.1);
  color: var(--text);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}
.cp-ai-input-row {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}
.cp-ai-input-row input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 13px;
  background: var(--card);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.cp-ai-input-row button {
  border: none;
  border-radius: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.cp-ai-suggestions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 14px 12px;
}
.cp-ai-suggest-btn {
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.2);
  border-radius: 20px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #7c3aed;
  cursor: pointer;
  font-family: inherit;
}

/* ── Rapport ── */
.cp-report-period {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.cp-period-btn {
  flex: 1;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  text-align: center;
}
.cp-period-btn.active {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  border-color: transparent;
}

/* ── Recherche globale ── */
#cpSearchOverlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 2000;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
}
#cpSearchOverlay.open { display: flex; }
#cpSearchBox {
  background: var(--card, #fff);
  border-radius: 18px;
  width: 94%;
  max-width: 520px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  overflow: hidden;
}
#cpSearchInput {
  width: 100%;
  border: none;
  padding: 16px 18px;
  font-size: 16px;
  background: transparent;
  color: var(--text);
  outline: none;
  font-family: inherit;
  border-bottom: 1px solid var(--border);
}
#cpSearchResults { max-height: 360px; overflow-y: auto; padding: 10px 12px; }
.cp-search-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background .1s;
}
.cp-search-result:hover { background: rgba(16,185,129,.07); }
.cp-search-result-ico {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.cp-search-result-body { flex: 1; min-width: 0; }
.cp-search-result-name { font-weight: 700; font-size: 13px; }
.cp-search-result-type { font-size: 11px; color: var(--muted); }

/* ── Crédits / Dettes ── */
.cp-credit-bar {
  height: 6px;
  background: rgba(148,163,184,.2);
  border-radius: 99px;
  margin-top: 6px;
  overflow: hidden;
}
.cp-credit-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 99px;
  transition: width .4s ease;
}

/* ── Mode sombre support ── */
body.dark .cp-caisse-balance, html[data-theme=dark] .cp-caisse-balance { box-shadow: 0 10px 28px rgba(16,185,129,.15); }
body.dark #cpSearchBox, html[data-theme=dark] #cpSearchBox { background: #111827; }

/* ── Scrollbar commune ── */
.cp-ai-messages::-webkit-scrollbar,
#cpSearchResults::-webkit-scrollbar { width: 4px; }
.cp-ai-messages::-webkit-scrollbar-thumb,
#cpSearchResults::-webkit-scrollbar-thumb { background: rgba(148,163,184,.3); border-radius: 99px; }

/* ── Animations ── */
@keyframes cpSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.cp-anim { animation: cpSlideIn .25s ease; }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════
   * 4. INJECTION DES NOUVEAUX ONGLETS DANS L'UI EXISTANTE
   * ═══════════════════════════════════════════════════════════ */
  function injectTabs() {
    const tabsBar = document.querySelector('#tab-commerce .cm-tabs');
    if (!tabsBar || tabsBar.dataset.cpDone) return;
    tabsBar.dataset.cpDone = '1';

    const newTabs = [
      { id: 'clients', icon: 'fa-users', label: 'Clients' },
      { id: 'fournisseurs', icon: 'fa-truck', label: 'Fournisseurs' },
      { id: 'credits', icon: 'fa-hand-holding-dollar', label: 'Crédits' },
      { id: 'caisse', icon: 'fa-cash-register', label: 'Caisse' },
      { id: 'inventaire', icon: 'fa-clipboard-list', label: 'Inventaire' },
      { id: 'rapports', icon: 'fa-chart-bar', label: 'Rapports' },
      { id: 'ia', icon: 'fa-robot', label: 'IA' },
    ];

    newTabs.forEach(tab => {
      if (document.getElementById('cm-tab-' + tab.id)) return;
      const btn = document.createElement('button');
      btn.className = 'cm-tab';
      btn.id = 'cm-tab-' + tab.id;
      btn.dataset.cmtab = tab.id;
      btn.innerHTML = `<i class="fas ${tab.icon}"></i><span>${tab.label}</span>`;
      btn.onclick = () => cpSwitchPro(tab.id);
      tabsBar.appendChild(btn);
    });
  }

  /* ═══════════════════════════════════════════════════════════
   * 5. INJECTION DES SECTIONS HTML
   * ═══════════════════════════════════════════════════════════ */
  function injectSections() {
    const container = document.getElementById('tab-commerce');
    if (!container || container.dataset.cpSectionsDone) return;
    container.dataset.cpSectionsDone = '1';

    // Améliorer le tableau de bord existant
    improveDashboard();

    // Sections Pro
    const sections = [
      { id: 'clients', html: buildClientsHTML() },
      { id: 'fournisseurs', html: buildFournisseursHTML() },
      { id: 'credits', html: buildCreditsHTML() },
      { id: 'caisse', html: buildCaisseHTML() },
      { id: 'inventaire', html: buildInventaireHTML() },
      { id: 'rapports', html: buildRapportsHTML() },
      { id: 'ia', html: buildIaHTML() },
    ];

    sections.forEach(sec => {
      if (document.getElementById('cp-sec-' + sec.id)) return;
      const div = document.createElement('div');
      div.className = 'cm-section cp-section';
      div.id = 'cp-sec-' + sec.id;
      div.innerHTML = sec.html;
      container.appendChild(div);
    });

    // Modals Pro
    injectModals();
    injectFAB();
    injectSearchOverlay();
  }

  /* ── Améliorer le tableau de bord existant ── */
  function improveDashboard() {
    const resumeSec = document.getElementById('cm-sec-resume');
    if (!resumeSec || resumeSec.dataset.cpImproved) return;
    resumeSec.dataset.cpImproved = '1';
    injectLinkBtnInDashboard(); // ← boutons Lien employé + Installer

    // Injecter les KPI Pro au début
    const kpiDiv = document.createElement('div');
    kpiDiv.id = 'cp-kpi-grid';
    kpiDiv.className = 'cp-kpi-grid';
    kpiDiv.innerHTML = `
      <div class="cp-kpi" style="--cp-accent:#10b981">
        <i class="fas fa-chart-line cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-sun"></i> CA Jour</div>
        <div class="cp-kpi-value" id="cpKpiDay">—</div>
        <div class="cp-kpi-sub">Aujourd'hui</div>
      </div>
      <div class="cp-kpi" style="--cp-accent:#2563eb">
        <i class="fas fa-calendar-month cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-calendar"></i> CA Mois</div>
        <div class="cp-kpi-value" id="cpKpiMonth">—</div>
        <div class="cp-kpi-sub" id="cpKpiMonthSub">Ce mois</div>
      </div>
      <div class="cp-kpi" style="--cp-accent:#8b5cf6">
        <i class="fas fa-box cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-boxes-stacked"></i> Produits</div>
        <div class="cp-kpi-value" id="cpKpiProduits">—</div>
        <div class="cp-kpi-sub">Articles actifs</div>
      </div>
      <div class="cp-kpi" style="--cp-accent:#f59e0b">
        <i class="fas fa-users cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-user-group"></i> Clients</div>
        <div class="cp-kpi-value" id="cpKpiClients">—</div>
        <div class="cp-kpi-sub">Enregistrés</div>
      </div>
      <div class="cp-kpi" style="--cp-accent:#06b6d4">
        <i class="fas fa-receipt cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-shopping-bag"></i> Ventes</div>
        <div class="cp-kpi-value" id="cpKpiVentes">—</div>
        <div class="cp-kpi-sub">Ce mois</div>
      </div>
      <div class="cp-kpi" style="--cp-accent:#ef4444">
        <i class="fas fa-triangle-exclamation cp-kpi-icon"></i>
        <div class="cp-kpi-label"><i class="fas fa-bell"></i> Alertes</div>
        <div class="cp-kpi-value" id="cpKpiAlertes">—</div>
        <div class="cp-kpi-sub">Stock bas / Rupture</div>
      </div>
    `;
    resumeSec.insertBefore(kpiDiv, resumeSec.firstChild);

    // Graphique ventes
    const chartCard = document.createElement('div');
    chartCard.className = 'cp-chart-card';
    chartCard.innerHTML = `
      <div class="cp-chart-title"><i class="fas fa-chart-area" style="color:var(--cp-green)"></i> Évolution des ventes (7 derniers jours)</div>
      <div class="cp-chart-wrap"><canvas id="cpChartVentes"></canvas></div>
    `;
    resumeSec.insertBefore(chartCard, document.querySelector('#cm-sec-resume > div[style*="background"]') || resumeSec.children[1]);

    // Produits les moins vendus & en rupture
    const bottomCard = document.createElement('div');
    bottomCard.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px;';
    bottomCard.innerHTML = `
      <div style="font-size:13px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-arrow-trend-down" style="color:#f59e0b"></i> Produits à réapprovisionner
      </div>
      <div id="cpProduitsReappro"><div class="cm-empty" style="padding:14px 10px"><i class="fas fa-check-circle" style="color:#10b981"></i> Stock OK</div></div>
    `;
    resumeSec.insertBefore(bottomCard, resumeSec.lastChild);
  }

  /* ── HTML Sections ── */
  function buildClientsHTML() {
    return `
      <div class="cm-search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="cpClientSearch" placeholder="Rechercher un client…" oninput="cpRenderClients()">
      </div>
      <div class="cp-list" id="cpClientsList"></div>
      <div class="cp-btn-row">
        <button class="cp-btn green full" onclick="cpOpenClientModal()"><i class="fas fa-plus"></i> Nouveau client</button>
      </div>
    `;
  }

  function buildFournisseursHTML() {
    return `
      <div class="cm-search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="cpFourSearch" placeholder="Rechercher un fournisseur…" oninput="cpRenderFournisseurs()">
      </div>
      <div class="cp-list" id="cpFournisseursList"></div>
      <div class="cp-btn-row">
        <button class="cp-btn green full" onclick="cpOpenFournisseurModal()"><i class="fas fa-plus"></i> Nouveau fournisseur</button>
      </div>
    `;
  }

  function buildCreditsHTML() {
    return `
      <div class="cm-filter-bar">
        <div class="cm-filter-chip active" data-cpf="all" onclick="cpFilterCredit('all',this)">Tous</div>
        <div class="cm-filter-chip" data-cpf="actif" onclick="cpFilterCredit('actif',this)">En cours</div>
        <div class="cm-filter-chip" data-cpf="partiel" onclick="cpFilterCredit('partiel',this)">Partiel</div>
        <div class="cm-filter-chip" data-cpf="solde" onclick="cpFilterCredit('solde',this)">Soldés</div>
        <div class="cm-filter-chip" data-cpf="retard" onclick="cpFilterCredit('retard',this)">En retard</div>
      </div>
      <div class="cp-list" id="cpCreditsList"></div>
      <div class="cp-btn-row">
        <button class="cp-btn green full" onclick="cpOpenCreditModal()"><i class="fas fa-plus"></i> Nouvelle vente à crédit</button>
      </div>
    `;
  }

  function buildCaisseHTML() {
    return `
      <div class="cp-caisse-balance">
        <div class="cp-caisse-balance-label"><i class="fas fa-cash-register"></i> Solde actuel</div>
        <div class="cp-caisse-balance-value" id="cpCaisseBalance">—</div>
        <div class="cp-caisse-balance-date" id="cpCaisseDate">Mise à jour —</div>
      </div>
      <div class="cp-btn-row" style="margin-bottom:14px">
        <button class="cp-btn green" style="flex:1" onclick="cpCaisseOp('entree')"><i class="fas fa-arrow-down"></i> Entrée</button>
        <button class="cp-btn red" style="flex:1" onclick="cpCaisseOp('sortie')"><i class="fas fa-arrow-up"></i> Sortie</button>
        <button class="cp-btn soft" style="flex:1" onclick="cpCaisseOp('fermeture')"><i class="fas fa-lock"></i> Fermer</button>
      </div>
      <div class="cp-chart-card">
        <div class="cp-chart-title"><i class="fas fa-chart-column" style="color:#10b981"></i> Mouvements caisse (7j)</div>
        <div class="cp-chart-wrap"><canvas id="cpChartCaisse"></canvas></div>
      </div>
      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Historique</div>
      <div class="cp-list" id="cpCaisseList"></div>
    `;
  }

  function buildInventaireHTML() {
    return `
      <div class="cm-filter-bar">
        <div class="cm-filter-chip active" data-cpinv="physique" onclick="cpInventFilter('physique',this)">Inventaire physique</div>
        <div class="cm-filter-chip" data-cpinv="alertes" onclick="cpInventFilter('alertes',this)">Alertes stock</div>
        <div class="cm-filter-chip" data-cpinv="historique" onclick="cpInventFilter('historique',this)">Historique mvts</div>
      </div>
      <div id="cpInventBody"></div>
    `;
  }

  function buildRapportsHTML() {
    return `
      <div class="cp-report-period" id="cpReportPeriodBar">
        <button class="cp-period-btn active" data-per="jour" onclick="cpSetPeriod('jour',this)">Jour</button>
        <button class="cp-period-btn" data-per="semaine" onclick="cpSetPeriod('semaine',this)">Semaine</button>
        <button class="cp-period-btn" data-per="mois" onclick="cpSetPeriod('mois',this)">Mois</button>
        <button class="cp-period-btn" data-per="annee" onclick="cpSetPeriod('annee',this)">Année</button>
      </div>
      <div id="cpReportBody"></div>
      <div class="cp-btn-row" style="margin-top:14px">
        <button class="cp-btn blue" onclick="cpExportCSV()"><i class="fas fa-file-csv"></i> CSV</button>
        <button class="cp-btn soft" onclick="cpExportPrint()"><i class="fas fa-print"></i> Imprimer</button>
      </div>
    `;
  }

  function buildIaHTML() {
    return `
      <div id="cpAiPanel">
        <div class="cp-ai-header">
          <i class="fas fa-robot" style="font-size:20px"></i>
          <div>
            <div style="font-weight:800;font-size:14px">Assistant Commerce IA</div>
            <div style="font-size:11px;opacity:.8">Posez vos questions sur votre activité</div>
          </div>
        </div>
        <div class="cp-ai-messages" id="cpAiMessages">
          <div class="cp-ai-msg bot">Bonjour ! 👋 Je suis votre assistant Commerce. Posez-moi des questions sur vos ventes, stocks, clients ou marges.</div>
        </div>
        <div class="cp-ai-suggestions" id="cpAiSuggestions">
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Quel est mon produit le plus vendu ?')">🏆 Meilleur produit</button>
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Quelle est ma marge ce mois ?')">📊 Marge du mois</button>
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Quels produits vont bientôt manquer ?')">⚠️ Stocks faibles</button>
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Quels clients ont des dettes ?')">💳 Clients débiteurs</button>
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Quelle est la valeur actuelle de mon stock ?')">📦 Valeur stock</button>
          <button class="cp-ai-suggest-btn" onclick="cpAiAsk('Combien de ventes ai-je fait ce mois ?')">🛍️ Nb ventes</button>
        </div>
        <div class="cp-ai-input-row">
          <input type="text" id="cpAiInput" placeholder="Votre question…" onkeydown="if(event.key==='Enter') cpAiSend()">
          <button onclick="cpAiSend()"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
   * 6. MODALS PRO
   * ═══════════════════════════════════════════════════════════ */
  function injectModals() {
    if (document.getElementById('cpClientModal')) return;
    const modalsHTML = `
<!-- Modal Client -->
<div class="modal-overlay" id="cpClientModal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header">
      <h3><i class="fas fa-user-plus" style="color:#10b981;margin-right:8px"></i><span id="cpClientModalTitle">Nouveau client</span></h3>
      <button class="modal-close" onclick="closeModal('cpClientModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Nom *</label>
          <input type="text" id="cpCNom" class="cp-input" placeholder="Ex: Kofi Mensah">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Téléphone</label>
          <input type="tel" id="cpCTel" class="cp-input" placeholder="Ex: +228 90 00 00 00">
        </div>
      </div>
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Email</label>
          <input type="email" id="cpCEmail" class="cp-input" placeholder="email@exemple.com">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Adresse</label>
          <input type="text" id="cpCAddr" class="cp-input" placeholder="Quartier, ville…">
        </div>
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Note</label>
        <textarea id="cpCNote" class="cp-textarea" placeholder="Informations complémentaires…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" id="cpCDelBtn" onclick="cpDeleteClient()" style="display:none;background:rgba(239,68,68,.1);color:#ef4444"><i class="fas fa-trash"></i> Supprimer</button>
      <button class="btn-cancel" onclick="closeModal('cpClientModal')">Annuler</button>
      <button class="btn-save" onclick="cpSaveClient()" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- Modal Fournisseur -->
<div class="modal-overlay" id="cpFournisseurModal">
  <div class="modal-box" style="max-width:480px">
    <div class="modal-header">
      <h3><i class="fas fa-truck" style="color:#2563eb;margin-right:8px"></i><span id="cpFourModalTitle">Nouveau fournisseur</span></h3>
      <button class="modal-close" onclick="closeModal('cpFournisseurModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Nom *</label>
          <input type="text" id="cpFNom" class="cp-input" placeholder="Ex: Distributeur Lomé">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Téléphone</label>
          <input type="tel" id="cpFTel" class="cp-input" placeholder="+228…">
        </div>
      </div>
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Email</label>
          <input type="email" id="cpFEmail" class="cp-input" placeholder="email@exemple.com">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Ville</label>
          <input type="text" id="cpFVille" class="cp-input" placeholder="Lomé, Kara…">
        </div>
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Produits fournis</label>
        <textarea id="cpFProduits" class="cp-textarea" placeholder="Liste des produits fournis…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" id="cpFDelBtn" onclick="cpDeleteFournisseur()" style="display:none;background:rgba(239,68,68,.1);color:#ef4444"><i class="fas fa-trash"></i> Supprimer</button>
      <button class="btn-cancel" onclick="closeModal('cpFournisseurModal')">Annuler</button>
      <button class="btn-save" onclick="cpSaveFournisseur()" style="background:linear-gradient(135deg,#2563eb,#3b82f6)"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- Modal Crédit -->
<div class="modal-overlay" id="cpCreditModal">
  <div class="modal-box" style="max-width:500px">
    <div class="modal-header">
      <h3><i class="fas fa-hand-holding-dollar" style="color:#f59e0b;margin-right:8px"></i><span id="cpCreditModalTitle">Vente à crédit</span></h3>
      <button class="modal-close" onclick="closeModal('cpCreditModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Client *</label>
          <input type="text" id="cpCrClient" class="cp-input" placeholder="Nom du client">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Article</label>
          <input type="text" id="cpCrArticle" class="cp-input" placeholder="Produit / service">
        </div>
      </div>
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Montant total *</label>
          <input type="number" id="cpCrMontant" class="cp-input" min="0" placeholder="0">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Acompte versé</label>
          <input type="number" id="cpCrAcompte" class="cp-input" min="0" placeholder="0">
        </div>
      </div>
      <div class="cp-form-row">
        <div class="cp-form-group">
          <label class="cp-label">Date</label>
          <input type="date" id="cpCrDate" class="cp-input">
        </div>
        <div class="cp-form-group">
          <label class="cp-label">Échéance</label>
          <input type="date" id="cpCrEcheance" class="cp-input">
        </div>
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Note</label>
        <textarea id="cpCrNote" class="cp-textarea" placeholder="Conditions, remarques…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal('cpCreditModal')">Annuler</button>
      <button class="btn-save" onclick="cpSaveCredit()" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- Modal Paiement Partiel -->
<div class="modal-overlay" id="cpPayModal">
  <div class="modal-box" style="max-width:400px">
    <div class="modal-header">
      <h3><i class="fas fa-money-bill-wave" style="color:#10b981;margin-right:8px"></i>Enregistrer un paiement</h3>
      <button class="modal-close" onclick="closeModal('cpPayModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div id="cpPaySummary" style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:12px;margin-bottom:14px;font-size:13px;"></div>
      <div class="cp-form-group">
        <label class="cp-label">Montant reçu *</label>
        <input type="number" id="cpPayMontant" class="cp-input" min="0" placeholder="0">
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Date</label>
        <input type="date" id="cpPayDate" class="cp-input">
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Note</label>
        <input type="text" id="cpPayNote" class="cp-input" placeholder="Ref, remarque…">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal('cpPayModal')">Annuler</button>
      <button class="btn-save" onclick="cpConfirmPay()" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-check"></i> Valider</button>
    </div>
  </div>
</div>

<!-- Modal Caisse Op -->
<div class="modal-overlay" id="cpCaisseModal">
  <div class="modal-box" style="max-width:400px">
    <div class="modal-header">
      <h3><i class="fas fa-cash-register" style="color:#10b981;margin-right:8px"></i><span id="cpCaisseModalTitle">Opération caisse</span></h3>
      <button class="modal-close" onclick="closeModal('cpCaisseModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="cp-form-group">
        <label class="cp-label">Montant *</label>
        <input type="number" id="cpCaisseMontant" class="cp-input" min="0" placeholder="0">
      </div>
      <div class="cp-form-group">
        <label class="cp-label">Note</label>
        <input type="text" id="cpCaisseNote" class="cp-input" placeholder="Description de l'opération…">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal('cpCaisseModal')">Annuler</button>
      <button class="btn-save" id="cpCaisseOpBtn" onclick="cpConfirmCaisseOp()" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-check"></i> Valider</button>
    </div>
  </div>
</div>

<!-- Client Detail Modal -->
<div class="modal-overlay" id="cpClientDetailModal">
  <div class="modal-box" style="max-width:520px">
    <div class="modal-header">
      <h3><i class="fas fa-user" style="color:#10b981;margin-right:8px"></i><span id="cpCDName">Client</span></h3>
      <button class="modal-close" onclick="closeModal('cpClientDetailModal')"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" id="cpClientDetailBody"></div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal('cpClientDetailModal')">Fermer</button>
      <button class="btn-save" id="cpCDEditBtn" style="background:linear-gradient(135deg,#2563eb,#3b82f6)"><i class="fas fa-edit"></i> Modifier</button>
    </div>
  </div>
</div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
  }

  /* ═══════════════════════════════════════════════════════════
   * 7. BOUTON FLOTTANT FAB AVANCÉ
   * ═══════════════════════════════════════════════════════════ */
  function injectFAB() {
    if (document.getElementById('cpFabMenu')) return;
    const fabHTML = `
      <div id="cpFabMenu" style="display:none">
        <div id="cpFabItems">
          <div class="cp-fab-item" onclick="cpFabAction('vente')">
            <span class="cp-fab-label">➕ Vente</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-cart-shopping"></i></div>
          </div>
          <div class="cp-fab-item" onclick="cpFabAction('produit')">
            <span class="cp-fab-label">➕ Produit</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#2563eb,#3b82f6)"><i class="fas fa-box"></i></div>
          </div>
          <div class="cp-fab-item" onclick="cpFabAction('achat')">
            <span class="cp-fab-label">➕ Achat</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-truck-ramp-box"></i></div>
          </div>
          <div class="cp-fab-item" onclick="cpFabAction('client')">
            <span class="cp-fab-label">➕ Client</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)"><i class="fas fa-user-plus"></i></div>
          </div>
          <div class="cp-fab-item" onclick="cpFabAction('fournisseur')">
            <span class="cp-fab-label">➕ Fournisseur</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#06b6d4,#0891b2)"><i class="fas fa-truck"></i></div>
          </div>
          <div class="cp-fab-item" onclick="cpFabAction('inventaire')">
            <span class="cp-fab-label">📋 Inventaire</span>
            <div class="cp-fab-ico" style="background:linear-gradient(135deg,#ef4444,#dc2626)"><i class="fas fa-clipboard-list"></i></div>
          </div>
        </div>
        <button id="cpFabBtn" onclick="cpToggleFab()"><i class="fas fa-plus"></i></button>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', fabHTML);
  }

  /* ═══════════════════════════════════════════════════════════
   * 8. OVERLAY DE RECHERCHE GLOBALE
   * ═══════════════════════════════════════════════════════════ */
  function injectSearchOverlay() {
    if (document.getElementById('cpSearchOverlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="cpSearchOverlay" onclick="if(event.target===this)cpCloseSearch()">
        <div id="cpSearchBox">
          <input id="cpSearchInput" type="text" placeholder="🔍 Rechercher produit, client, vente, fournisseur…" oninput="cpDoSearch(this.value)" onkeydown="if(event.key==='Escape')cpCloseSearch()">
          <div id="cpSearchResults"></div>
        </div>
      </div>
    `);
  }

  /* ═══════════════════════════════════════════════════════════
   * 9. NAVIGATION PRO
   * ═══════════════════════════════════════════════════════════ */
  let _cpCurrentSection = '';

  window.cpSwitchPro = function (sec) {
    _cpCurrentSection = sec;

    // Désactiver tous les onglets
    document.querySelectorAll('#tab-commerce .cm-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#tab-commerce .cm-section').forEach(s => {
      s.classList.remove('active');
      if (s.classList.contains('cp-section')) s.classList.remove('active');
    });

    // Activer le bon onglet
    const btn = document.getElementById('cm-tab-' + sec);
    if (btn) btn.classList.add('active');
    const section = document.getElementById('cp-sec-' + sec);
    if (section) section.classList.add('active');

    // Masquer sections CM natives
    document.querySelectorAll('#tab-commerce .cm-section:not(.cp-section)').forEach(s => s.classList.remove('active'));

    // Render section
    cpRenderSection(sec);
  };

  function cpRenderSection(sec) {
    switch (sec) {
      case 'clients': cpRenderClients(); break;
      case 'fournisseurs': cpRenderFournisseurs(); break;
      case 'credits': cpRenderCredits(); break;
      case 'caisse': cpRenderCaisse(); break;
      case 'inventaire': cpRenderInventaire('physique'); break;
      case 'rapports': cpRenderRapports('jour'); break;
      case 'ia': break; // Pas de render initial
    }
  }

  /* ═══════════════════════════════════════════════════════════
   * 10. DASHBOARD PRO — KPI & GRAPHIQUES
   * ═══════════════════════════════════════════════════════════ */
  let _cpCharts = {};

  function cpRenderDashboard() {
    const mvts = CP.getMvts();
    const arts = CP.getArticles();
    const today = CP.today();
    const month = CP.month();
    const shopId = CP.getCM()?.currentShopId;

    // CA Jour
    const caJour = mvts.filter(m => m.type === 'vente' && m.date === today).reduce((s, m) => s + (m.total || 0), 0);
    // CA Mois
    const caMois = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month)).reduce((s, m) => s + (m.total || 0), 0);
    // Nombre ventes mois
    const nbVentes = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month)).length;
    // Alertes
    const shopSeuil = CP.getShop()?.seuil || 5;
    const nbAlertes = arts.filter(a => (a.stock || 0) <= (a.seuil !== undefined ? a.seuil : shopSeuil)).length;
    // Clients
    const nbClients = CPData.clients.filter(c => c.shopId === shopId).length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('cpKpiDay', CP.amt(caJour));
    set('cpKpiMonth', CP.amt(caMois));
    set('cpKpiProduits', arts.length);
    set('cpKpiClients', nbClients);
    set('cpKpiVentes', nbVentes);
    set('cpKpiAlertes', nbAlertes > 0 ? nbAlertes + ' ⚠️' : '✅ OK');

    // Chart ventes 7 jours
    cpRenderChartVentes(mvts);

    // Produits à réapprovisionner
    cpRenderProduitsReappro(arts, shopSeuil);
  }

  function cpRenderChartVentes(mvts) {
    const ctx = document.getElementById('cpChartVentes');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_cpCharts.ventes) { try { _cpCharts.ventes.destroy(); } catch (e) { } }

    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      labels.push(label);
      data.push(mvts.filter(m => m.type === 'vente' && m.date === dStr).reduce((s, m) => s + (m.total || 0), 0));
    }

    _cpCharts.ventes = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ventes',
          data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(148,163,184,.15)' }, ticks: { font: { size: 10 }, callback: v => CP.fmt(v) } }
        }
      }
    });
  }

  function cpRenderProduitsReappro(arts, shopSeuil) {
    const el = document.getElementById('cpProduitsReappro');
    if (!el) return;
    const lows = arts.filter(a => (a.stock || 0) <= (a.seuil !== undefined ? a.seuil : shopSeuil));
    if (lows.length === 0) {
      el.innerHTML = '<div class="cm-empty" style="padding:12px 10px"><i class="fas fa-check-circle" style="color:#10b981"></i> Tous les stocks sont OK</div>';
      return;
    }
    el.innerHTML = lows.slice(0, 5).map(a => {
      const isRupture = (a.stock || 0) === 0;
      return `<div class="cp-alert-item ${isRupture ? '' : 'warning'}">
        <i class="fas fa-${isRupture ? 'circle-exclamation' : 'triangle-exclamation'}" style="color:${isRupture ? '#ef4444' : '#f59e0b'}"></i>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${a.name}</div>
          <div style="font-size:11px;color:var(--muted)">Stock: ${a.stock || 0} ${a.unit || ''} | Seuil: ${a.seuil !== undefined ? a.seuil : shopSeuil}</div>
        </div>
        <span class="cp-badge ${isRupture ? 'red' : 'orange'}">${isRupture ? 'Rupture' : 'Faible'}</span>
      </div>`;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
   * 11. MODULE CLIENTS
   * ═══════════════════════════════════════════════════════════ */
  let _cpEditingClientId = null;

  window.cpRenderClients = function () {
    const el = document.getElementById('cpClientsList');
    if (!el) return;
    const shopId = CP.getCM()?.currentShopId;
    if (!shopId) { el.innerHTML = '<div class="cm-empty"><i class="fas fa-store-slash"></i>Créez d\'abord une boutique</div>'; return; }

    const search = (document.getElementById('cpClientSearch')?.value || '').toLowerCase();
    let clients = CPData.clients.filter(c => c.shopId === shopId);
    if (search) clients = clients.filter(c => c.nom.toLowerCase().includes(search) || (c.tel || '').includes(search));

    if (clients.length === 0) {
      el.innerHTML = '<div class="cm-empty"><i class="fas fa-users"></i>Aucun client enregistré<br><small>Ajoutez votre premier client</small></div>';
      return;
    }

    el.innerHTML = clients.map(c => {
      // Calcul total acheté
      const mvts = CP.getMvts().filter(m => m.type === 'vente' && (m.person || '').toLowerCase() === c.nom.toLowerCase());
      const totalAchats = mvts.reduce((s, m) => s + (m.total || 0), 0);
      // Crédits en cours
      const credits = CPData.credits.filter(cr => cr.shopId === shopId && cr.clientId === c.id && cr.statut !== 'solde');
      const totalDette = credits.reduce((s, cr) => s + ((cr.montantTotal || 0) - (cr.montantPaye || 0)), 0);
      const initials = c.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const colors = ['#10b981', '#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444'];
      const color = colors[c.nom.charCodeAt(0) % colors.length];

      return `<div class="cp-list-item cp-anim" onclick="cpOpenClientDetail('${c.id}')">
        <div class="cp-list-avatar" style="background:${color}20;color:${color}">${initials}</div>
        <div class="cp-list-body">
          <div class="cp-list-name">${c.nom}</div>
          <div class="cp-list-sub">${c.tel || '—'} ${c.email ? '· ' + c.email : ''}</div>
          ${totalDette > 0 ? `<span class="cp-badge red"><i class="fas fa-exclamation-circle"></i> Dette: ${CP.amt(totalDette)}</span>` : ''}
        </div>
        <div class="cp-list-right">
          <div class="cp-list-amount" style="color:var(--cp-green)">${CP.amt(totalAchats)}</div>
          <div style="font-size:10.5px;color:var(--muted)">${mvts.length} achat(s)</div>
        </div>
      </div>`;
    }).join('');
  };

  window.cpOpenClientModal = function (id) {
    _cpEditingClientId = id || null;
    const isEdit = !!id;
    document.getElementById('cpClientModalTitle').textContent = isEdit ? 'Modifier le client' : 'Nouveau client';
    document.getElementById('cpCDelBtn').style.display = isEdit ? '' : 'none';

    if (isEdit) {
      const c = CPData.clients.find(x => x.id === id);
      if (c) {
        document.getElementById('cpCNom').value = c.nom;
        document.getElementById('cpCTel').value = c.tel || '';
        document.getElementById('cpCEmail').value = c.email || '';
        document.getElementById('cpCAddr').value = c.adresse || '';
        document.getElementById('cpCNote').value = c.note || '';
      }
    } else {
      ['cpCNom', 'cpCTel', 'cpCEmail', 'cpCAddr', 'cpCNote'].forEach(id => document.getElementById(id).value = '');
    }
    if (window.openModal) window.openModal('cpClientModal');
  };

  window.cpSaveClient = function () {
    const nom = document.getElementById('cpCNom').value.trim();
    if (!nom) { CP.toast('Le nom est requis', 'error'); return; }
    const shopId = CP.getCM()?.currentShopId;
    if (!shopId) return;
    const payload = {
      nom,
      tel: document.getElementById('cpCTel').value.trim(),
      email: document.getElementById('cpCEmail').value.trim(),
      adresse: document.getElementById('cpCAddr').value.trim(),
      note: document.getElementById('cpCNote').value.trim(),
      shopId,
    };
    if (_cpEditingClientId) {
      const idx = CPData.clients.findIndex(c => c.id === _cpEditingClientId);
      if (idx >= 0) Object.assign(CPData.clients[idx], payload);
    } else {
      CPData.clients.push({ id: CP.uid(), createdAt: Date.now(), ...payload });
    }
    cpSave();
    if (window.closeModal) window.closeModal('cpClientModal');
    cpRenderClients();
    CP.toast(_cpEditingClientId ? 'Client mis à jour ✓' : 'Client ajouté ✓', 'success');
  };

  window.cpDeleteClient = function () {
    if (!_cpEditingClientId) return;
    const c = CPData.clients.find(x => x.id === _cpEditingClientId);
    if (!c || !confirm(`Supprimer le client "${c.nom}" ?`)) return;
    CPData.clients = CPData.clients.filter(x => x.id !== _cpEditingClientId);
    cpSave();
    if (window.closeModal) window.closeModal('cpClientModal');
    cpRenderClients();
    CP.toast('Client supprimé', 'info');
  };

  window.cpOpenClientDetail = function (id) {
    const c = CPData.clients.find(x => x.id === id);
    if (!c) return;
    const shopId = CP.getCM()?.currentShopId;
    const mvts = CP.getMvts().filter(m => m.type === 'vente' && (m.person || '').toLowerCase() === c.nom.toLowerCase());
    const totalAchats = mvts.reduce((s, m) => s + (m.total || 0), 0);
    const credits = CPData.credits.filter(cr => cr.shopId === shopId && cr.clientId === id);
    const dette = credits.filter(cr => cr.statut !== 'solde').reduce((s, cr) => s + ((cr.montantTotal || 0) - (cr.montantPaye || 0)), 0);

    document.getElementById('cpCDName').textContent = c.nom;
    document.getElementById('cpCDEditBtn').onclick = () => { window.closeModal('cpClientDetailModal'); cpOpenClientModal(id); };
    document.getElementById('cpClientDetailBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:rgba(16,185,129,.08);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Total achats</div>
          <div style="font-size:20px;font-weight:900;color:#10b981">${CP.amt(totalAchats)}</div>
        </div>
        <div style="background:rgba(239,68,68,.08);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Dette</div>
          <div style="font-size:20px;font-weight:900;color:#ef4444">${CP.amt(dette)}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">📞 ${c.tel || '—'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">✉️ ${c.email || '—'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">📍 ${c.adresse || '—'}</div>
      <div style="font-size:13px;font-weight:800;margin-bottom:8px">Dernières ventes</div>
      ${mvts.slice(0, 5).map(m => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px">
          <span>${m.artName} (${m.qte} ${m.unit || ''})</span>
          <span style="font-weight:700;color:#10b981">${CP.amt(m.total)}</span>
        </div>`).join('')}
      ${mvts.length === 0 ? '<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Aucune vente enregistrée</div>' : ''}
    `;
    if (window.openModal) window.openModal('cpClientDetailModal');
  };

  /* ═══════════════════════════════════════════════════════════
   * 12. MODULE FOURNISSEURS
   * ═══════════════════════════════════════════════════════════ */
  let _cpEditingFourId = null;

  window.cpRenderFournisseurs = function () {
    const el = document.getElementById('cpFournisseursList');
    if (!el) return;
    const shopId = CP.getCM()?.currentShopId;
    if (!shopId) { el.innerHTML = '<div class="cm-empty"><i class="fas fa-store-slash"></i>Créez d\'abord une boutique</div>'; return; }

    const search = (document.getElementById('cpFourSearch')?.value || '').toLowerCase();
    let fours = CPData.fournisseurs.filter(f => f.shopId === shopId);
    if (search) fours = fours.filter(f => f.nom.toLowerCase().includes(search) || (f.tel || '').includes(search));

    if (fours.length === 0) {
      el.innerHTML = '<div class="cm-empty"><i class="fas fa-truck"></i>Aucun fournisseur enregistré</div>';
      return;
    }

    el.innerHTML = fours.map(f => {
      const achats = CP.getMvts().filter(m => m.type === 'achat' && (m.person || '').toLowerCase() === f.nom.toLowerCase());
      const totalAchats = achats.reduce((s, m) => s + (m.total || 0), 0);
      return `<div class="cp-list-item cp-anim" onclick="cpOpenFournisseurModal('${f.id}')">
        <div class="cp-list-avatar" style="background:rgba(37,99,235,.1);color:#2563eb"><i class="fas fa-truck" style="font-size:15px"></i></div>
        <div class="cp-list-body">
          <div class="cp-list-name">${f.nom}</div>
          <div class="cp-list-sub">${f.tel || '—'} ${f.ville ? '· ' + f.ville : ''}</div>
          ${f.produits ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${f.produits.slice(0, 50)}${f.produits.length > 50 ? '…' : ''}</div>` : ''}
        </div>
        <div class="cp-list-right">
          <div class="cp-list-amount" style="color:#2563eb">${CP.amt(totalAchats)}</div>
          <div style="font-size:10.5px;color:var(--muted)">${achats.length} achat(s)</div>
        </div>
      </div>`;
    }).join('');
  };

  window.cpOpenFournisseurModal = function (id) {
    _cpEditingFourId = id || null;
    document.getElementById('cpFourModalTitle').textContent = id ? 'Modifier le fournisseur' : 'Nouveau fournisseur';
    document.getElementById('cpFDelBtn').style.display = id ? '' : 'none';
    if (id) {
      const f = CPData.fournisseurs.find(x => x.id === id);
      if (f) {
        document.getElementById('cpFNom').value = f.nom;
        document.getElementById('cpFTel').value = f.tel || '';
        document.getElementById('cpFEmail').value = f.email || '';
        document.getElementById('cpFVille').value = f.ville || '';
        document.getElementById('cpFProduits').value = f.produits || '';
      }
    } else {
      ['cpFNom', 'cpFTel', 'cpFEmail', 'cpFVille', 'cpFProduits'].forEach(i => document.getElementById(i).value = '');
    }
    if (window.openModal) window.openModal('cpFournisseurModal');
  };

  window.cpSaveFournisseur = function () {
    const nom = document.getElementById('cpFNom').value.trim();
    if (!nom) { CP.toast('Le nom est requis', 'error'); return; }
    const shopId = CP.getCM()?.currentShopId;
    const payload = {
      nom,
      tel: document.getElementById('cpFTel').value.trim(),
      email: document.getElementById('cpFEmail').value.trim(),
      ville: document.getElementById('cpFVille').value.trim(),
      produits: document.getElementById('cpFProduits').value.trim(),
      shopId,
    };
    if (_cpEditingFourId) {
      const idx = CPData.fournisseurs.findIndex(f => f.id === _cpEditingFourId);
      if (idx >= 0) Object.assign(CPData.fournisseurs[idx], payload);
    } else {
      CPData.fournisseurs.push({ id: CP.uid(), createdAt: Date.now(), ...payload });
    }
    cpSave();
    if (window.closeModal) window.closeModal('cpFournisseurModal');
    cpRenderFournisseurs();
    CP.toast('Fournisseur enregistré ✓', 'success');
  };

  window.cpDeleteFournisseur = function () {
    if (!_cpEditingFourId) return;
    const f = CPData.fournisseurs.find(x => x.id === _cpEditingFourId);
    if (!f || !confirm(`Supprimer "${f.nom}" ?`)) return;
    CPData.fournisseurs = CPData.fournisseurs.filter(x => x.id !== _cpEditingFourId);
    cpSave();
    if (window.closeModal) window.closeModal('cpFournisseurModal');
    cpRenderFournisseurs();
    CP.toast('Fournisseur supprimé', 'info');
  };

  /* ═══════════════════════════════════════════════════════════
   * 13. MODULE CRÉDITS / DETTES
   * ═══════════════════════════════════════════════════════════ */
  let _cpCreditFilter = 'all';
  let _cpPayingCreditId = null;

  window.cpFilterCredit = function (f, el) {
    _cpCreditFilter = f;
    document.querySelectorAll('#cp-sec-credits .cm-filter-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    cpRenderCredits();
  };

  function cpRenderCredits() {
    const el = document.getElementById('cpCreditsList');
    if (!el) return;
    const shopId = CP.getCM()?.currentShopId;
    if (!shopId) { el.innerHTML = '<div class="cm-empty"><i class="fas fa-store-slash"></i>Créez d\'abord une boutique</div>'; return; }

    let credits = CPData.credits.filter(c => c.shopId === shopId);
    const today = CP.today();
    if (_cpCreditFilter === 'actif') credits = credits.filter(c => c.statut === 'actif');
    if (_cpCreditFilter === 'partiel') credits = credits.filter(c => c.statut === 'partiel');
    if (_cpCreditFilter === 'solde') credits = credits.filter(c => c.statut === 'solde');
    if (_cpCreditFilter === 'retard') credits = credits.filter(c => c.statut !== 'solde' && c.echeance && c.echeance < today);

    if (credits.length === 0) {
      el.innerHTML = '<div class="cm-empty"><i class="fas fa-hand-holding-dollar"></i>Aucun crédit pour ce filtre</div>';
      return;
    }

    el.innerHTML = credits.map(c => {
      const solde = (c.montantTotal || 0) - (c.montantPaye || 0);
      const pct = c.montantTotal ? Math.min(100, Math.round((c.montantPaye / c.montantTotal) * 100)) : 0;
      const enRetard = c.echeance && c.echeance < today && c.statut !== 'solde';
      const badgeColor = c.statut === 'solde' ? 'green' : enRetard ? 'red' : c.statut === 'partiel' ? 'orange' : 'blue';
      const badgeLabel = c.statut === 'solde' ? '✓ Soldé' : enRetard ? '⚠️ Retard' : c.statut === 'partiel' ? 'Partiel' : 'En cours';

      return `<div class="cp-list-item cp-anim">
        <div class="cp-list-avatar" style="background:rgba(245,158,11,.1);color:#f59e0b"><i class="fas fa-file-invoice-dollar" style="font-size:15px"></i></div>
        <div class="cp-list-body">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="cp-list-name">${c.clientNom}</span>
            <span class="cp-badge ${badgeColor}">${badgeLabel}</span>
          </div>
          <div class="cp-list-sub">${c.artNom || '—'} · Échéance: ${c.echeance || '—'}</div>
          <div class="cp-credit-bar"><span style="width:${pct}%"></span></div>
          <div style="font-size:10.5px;color:var(--muted);margin-top:3px">${pct}% payé · Reste: ${CP.amt(solde)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
          ${c.statut !== 'solde' ? `<button class="cp-btn green" style="padding:6px 10px;font-size:11px" onclick="cpOpenPayModal('${c.id}')"><i class="fas fa-plus"></i> Payer</button>` : ''}
          <button class="cp-btn red" style="padding:6px 10px;font-size:11px" onclick="cpDeleteCredit('${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  window.cpOpenCreditModal = function () {
    document.getElementById('cpCrClient').value = '';
    document.getElementById('cpCrArticle').value = '';
    document.getElementById('cpCrMontant').value = '';
    document.getElementById('cpCrAcompte').value = '0';
    document.getElementById('cpCrDate').value = CP.today();
    document.getElementById('cpCrEcheance').value = '';
    document.getElementById('cpCrNote').value = '';
    if (window.openModal) window.openModal('cpCreditModal');
  };

  window.cpSaveCredit = function () {
    const clientNom = document.getElementById('cpCrClient').value.trim();
    const montantTotal = parseFloat(document.getElementById('cpCrMontant').value) || 0;
    if (!clientNom) { CP.toast('Nom du client requis', 'error'); return; }
    if (!montantTotal) { CP.toast('Montant requis', 'error'); return; }
    const shopId = CP.getCM()?.currentShopId;
    const montantPaye = parseFloat(document.getElementById('cpCrAcompte').value) || 0;
    const statut = montantPaye >= montantTotal ? 'solde' : montantPaye > 0 ? 'partiel' : 'actif';
    const paiements = montantPaye > 0 ? [{ montant: montantPaye, date: CP.today(), note: 'Acompte initial' }] : [];
    // Tenter de trouver le client
    const client = CPData.clients.find(c => c.shopId === shopId && c.nom.toLowerCase() === clientNom.toLowerCase());

    CPData.credits.push({
      id: CP.uid(),
      shopId,
      clientId: client ? client.id : null,
      clientNom,
      artNom: document.getElementById('cpCrArticle').value.trim(),
      montantTotal,
      montantPaye,
      echeance: document.getElementById('cpCrEcheance').value,
      date: document.getElementById('cpCrDate').value,
      note: document.getElementById('cpCrNote').value.trim(),
      statut,
      paiements,
      createdAt: Date.now(),
    });
    cpSave();
    if (window.closeModal) window.closeModal('cpCreditModal');
    cpRenderCredits();
    CP.toast('Crédit enregistré ✓', 'success');
  };

  window.cpDeleteCredit = function (id) {
    if (!confirm('Supprimer ce crédit ?')) return;
    CPData.credits = CPData.credits.filter(c => c.id !== id);
    cpSave();
    cpRenderCredits();
    CP.toast('Crédit supprimé', 'info');
  };

  window.cpOpenPayModal = function (creditId) {
    _cpPayingCreditId = creditId;
    const cr = CPData.credits.find(c => c.id === creditId);
    if (!cr) return;
    const solde = (cr.montantTotal || 0) - (cr.montantPaye || 0);
    document.getElementById('cpPaySummary').innerHTML = `
      <strong>${cr.clientNom}</strong> — ${cr.artNom || '—'}<br>
      Total: <strong>${CP.amt(cr.montantTotal)}</strong> · Payé: <strong>${CP.amt(cr.montantPaye)}</strong><br>
      <span style="color:#ef4444;font-weight:700">Reste: ${CP.amt(solde)}</span>
    `;
    document.getElementById('cpPayMontant').value = '';
    document.getElementById('cpPayDate').value = CP.today();
    document.getElementById('cpPayNote').value = '';
    if (window.openModal) window.openModal('cpPayModal');
  };

  window.cpConfirmPay = function () {
    const montant = parseFloat(document.getElementById('cpPayMontant').value) || 0;
    if (!montant) { CP.toast('Montant requis', 'error'); return; }
    const cr = CPData.credits.find(c => c.id === _cpPayingCreditId);
    if (!cr) return;
    cr.montantPaye = (cr.montantPaye || 0) + montant;
    if (!Array.isArray(cr.paiements)) cr.paiements = [];
    cr.paiements.push({ montant, date: document.getElementById('cpPayDate').value, note: document.getElementById('cpPayNote').value });
    cr.statut = cr.montantPaye >= cr.montantTotal ? 'solde' : 'partiel';
    cpSave();
    if (window.closeModal) window.closeModal('cpPayModal');
    cpRenderCredits();
    CP.toast(cr.statut === 'solde' ? '✅ Crédit soldé !' : `Paiement de ${CP.amt(montant)} enregistré ✓`, 'success');
  };

  /* ═══════════════════════════════════════════════════════════
   * 14. MODULE CAISSE
   * ═══════════════════════════════════════════════════════════ */
  let _cpCaisseOpType = 'entree';

  function cpRenderCaisse() {
    const shopId = CP.getCM()?.currentShopId;
    if (!shopId) return;
    const caisseOps = CPData.caisse.filter(c => c.shopId === shopId).sort((a, b) => b.date.localeCompare(a.date));

    // Calcul solde
    const solde = caisseOps.reduce((s, op) => {
      if (op.type === 'entree' || op.type === 'ouverture') return s + (op.montant || 0);
      if (op.type === 'sortie' || op.type === 'fermeture') return s - (op.montant || 0);
      return s;
    }, 0);

    const el = document.getElementById('cpCaisseBalance');
    if (el) el.textContent = CP.amt(solde);
    const dateEl = document.getElementById('cpCaisseDate');
    if (dateEl) dateEl.textContent = 'Mis à jour le ' + new Date().toLocaleDateString('fr-FR');

    // Chart caisse 7 jours
    cpRenderChartCaisse(caisseOps);

    // Liste
    const listEl = document.getElementById('cpCaisseList');
    if (listEl) {
      if (caisseOps.length === 0) {
        listEl.innerHTML = '<div class="cm-empty"><i class="fas fa-cash-register"></i>Aucune opération caisse</div>';
      } else {
        listEl.innerHTML = caisseOps.slice(0, 20).map(op => {
          const isIn = op.type === 'entree' || op.type === 'ouverture';
          return `<div class="cp-list-item cp-anim">
            <div class="cp-list-avatar" style="background:${isIn ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)'};color:${isIn ? '#10b981' : '#ef4444'}">
              <i class="fas fa-${isIn ? 'arrow-down' : 'arrow-up'}"></i>
            </div>
            <div class="cp-list-body">
              <div class="cp-list-name">${{ entree: 'Entrée caisse', sortie: 'Sortie caisse', ouverture: 'Ouverture caisse', fermeture: 'Fermeture caisse' }[op.type] || op.type}</div>
              <div class="cp-list-sub">${op.note || '—'} · ${op.date}</div>
            </div>
            <div class="cp-list-amount ${isIn ? '' : ''}" style="color:${isIn ? '#10b981' : '#ef4444'}">${isIn ? '+' : '-'}${CP.amt(op.montant)}</div>
          </div>`;
        }).join('');
      }
    }
  }

  function cpRenderChartCaisse(ops) {
    const ctx = document.getElementById('cpChartCaisse');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_cpCharts.caisse) { try { _cpCharts.caisse.destroy(); } catch (e) { } }

    const labels = [];
    const entrees = [];
    const sorties = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
      entrees.push(ops.filter(o => (o.type === 'entree' || o.type === 'ouverture') && o.date === dStr).reduce((s, o) => s + (o.montant || 0), 0));
      sorties.push(ops.filter(o => (o.type === 'sortie' || o.type === 'fermeture') && o.date === dStr).reduce((s, o) => s + (o.montant || 0), 0));
    }

    _cpCharts.caisse = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Entrées', data: entrees, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 6 },
          { label: 'Sorties', data: sorties, backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 6 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(148,163,184,.15)' }, ticks: { font: { size: 10 }, callback: v => CP.fmt(v) } }
        }
      }
    });
  }

  window.cpCaisseOp = function (type) {
    _cpCaisseOpType = type;
    const titles = { entree: '💰 Entrée caisse', sortie: '💸 Sortie caisse', ouverture: '🔓 Ouverture caisse', fermeture: '🔒 Fermeture caisse' };
    document.getElementById('cpCaisseModalTitle').textContent = titles[type] || type;
    document.getElementById('cpCaisseMontant').value = '';
    document.getElementById('cpCaisseNote').value = '';
    if (window.openModal) window.openModal('cpCaisseModal');
  };

  window.cpConfirmCaisseOp = function () {
    const montant = parseFloat(document.getElementById('cpCaisseMontant').value) || 0;
    if (!montant) { CP.toast('Montant requis', 'error'); return; }
    const shopId = CP.getCM()?.currentShopId;
    CPData.caisse.push({
      id: CP.uid(),
      shopId,
      type: _cpCaisseOpType,
      montant,
      note: document.getElementById('cpCaisseNote').value.trim(),
      date: CP.today(),
      createdAt: Date.now(),
    });
    cpSave();
    if (window.closeModal) window.closeModal('cpCaisseModal');
    cpRenderCaisse();
    CP.toast('Opération caisse enregistrée ✓', 'success');
  };

  /* ═══════════════════════════════════════════════════════════
   * 15. MODULE INVENTAIRE PHYSIQUE & ALERTES
   * ═══════════════════════════════════════════════════════════ */
  let _cpInventFilter = 'physique';
  let _cpCurrentInventaire = null;

  window.cpInventFilter = function (f, el) {
    _cpInventFilter = f;
    document.querySelectorAll('#cp-sec-inventaire .cm-filter-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    cpRenderInventaire(f);
  };

  function cpRenderInventaire(view) {
    const body = document.getElementById('cpInventBody');
    if (!body) return;
    if (view === 'physique') renderInventairePhysique(body);
    else if (view === 'alertes') renderAlertesStock(body);
    else if (view === 'historique') renderHistoriqueMvts(body);
  }

  function renderInventairePhysique(body) {
    const arts = CP.getArticles();
    if (arts.length === 0) {
      body.innerHTML = '<div class="cm-empty"><i class="fas fa-clipboard-list"></i>Aucun article dans cette boutique</div>';
      return;
    }

    body.innerHTML = `
      <div style="margin-bottom:12px">
        <button class="cp-btn green full" onclick="cpStartInventaire()"><i class="fas fa-play"></i> Démarrer l'inventaire physique</button>
      </div>
      <div id="cpInventTable"></div>
      <div id="cpInventActions" style="display:none;margin-top:12px">
        <div class="cp-btn-row">
          <button class="cp-btn soft" onclick="cpAnnulerInventaire()"><i class="fas fa-times"></i> Annuler</button>
          <button class="cp-btn green" style="flex:1" onclick="cpValiderInventaire()"><i class="fas fa-check"></i> Valider l'inventaire</button>
        </div>
      </div>
    `;

    if (_cpCurrentInventaire) {
      document.getElementById('cpInventActions').style.display = '';
      document.getElementById('cpInventTable').innerHTML = `
        <div style="overflow-x:auto">
          <table class="cp-inv-table">
            <thead><tr>
              <th>Article</th><th>Stock système</th><th>Stock réel</th><th>Écart</th><th>Valeur écart</th>
            </tr></thead>
            <tbody id="cpInventRows">
              ${_cpCurrentInventaire.lignes.map((l, i) => {
        const ecart = (l.stockReel !== undefined ? l.stockReel : l.stockSys) - l.stockSys;
        const valEcart = ecart * (arts.find(a => a.id === l.artId)?.prixA || 0);
        return `<tr>
                  <td style="font-weight:700;font-size:12.5px">${l.artNom}</td>
                  <td style="text-align:center">${l.stockSys}</td>
                  <td style="text-align:center"><input type="number" min="0" value="${l.stockReel !== undefined ? l.stockReel : l.stockSys}" onchange="cpUpdateInvLigne(${i},this.value)" style=""></td>
                  <td style="text-align:center" class="${ecart > 0 ? 'cp-ecart-pos' : ecart < 0 ? 'cp-ecart-neg' : ''}">${ecart > 0 ? '+' : ''}${ecart}</td>
                  <td style="text-align:center;font-size:11px;color:var(--muted)">${CP.amt(valEcart)}</td>
                </tr>`;
      }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  window.cpStartInventaire = function () {
    const arts = CP.getArticles();
    const shopId = CP.getCM()?.currentShopId;
    _cpCurrentInventaire = {
      id: CP.uid(),
      shopId,
      date: CP.today(),
      lignes: arts.map(a => ({ artId: a.id, artNom: a.name, stockSys: a.stock || 0, stockReel: a.stock || 0 })),
      statut: 'brouillon',
    };
    renderInventairePhysique(document.getElementById('cpInventBody'));
    CP.toast('Inventaire démarré — saisissez les stocks réels', 'info');
  };

  window.cpUpdateInvLigne = function (index, val) {
    if (_cpCurrentInventaire && _cpCurrentInventaire.lignes[index]) {
      _cpCurrentInventaire.lignes[index].stockReel = parseFloat(val) || 0;
    }
  };

  window.cpValiderInventaire = function () {
    if (!_cpCurrentInventaire) return;
    if (!confirm('Valider l\'inventaire ? Les stocks seront mis à jour automatiquement.')) return;

    // Mettre à jour les stocks
    const cm = CP.getCM();
    _cpCurrentInventaire.lignes.forEach(l => {
      const art = cm.articles.find(a => a.id === l.artId);
      if (art) art.stock = l.stockReel;
    });

    // Sauvegarder dans CM
    if (window.cmSave) window.cmSave(); // Utilise la fonction existante du module CM
    else {
      // Fallback : sauvegarder manuellement
      try {
        const key = 'aet_commerce_' + (CP.uid_user() || 'guest');
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          data.articles = cm.articles;
          data.updatedAtMs = Date.now();
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) { }
    }

    _cpCurrentInventaire.statut = 'validé';
    CPData.inventaires.push({ ..._cpCurrentInventaire });
    cpSave();
    _cpCurrentInventaire = null;
    renderInventairePhysique(document.getElementById('cpInventBody'));
    CP.toast('✅ Inventaire validé ! Stocks mis à jour.', 'success');
  };

  window.cpAnnulerInventaire = function () {
    _cpCurrentInventaire = null;
    renderInventairePhysique(document.getElementById('cpInventBody'));
  };

  function renderAlertesStock(body) {
    const arts = CP.getArticles();
    const shopSeuil = CP.getShop()?.seuil || 5;
    const ruptures = arts.filter(a => (a.stock || 0) === 0);
    const lows = arts.filter(a => (a.stock || 0) > 0 && (a.stock || 0) <= (a.seuil !== undefined ? a.seuil : shopSeuil));

    if (ruptures.length === 0 && lows.length === 0) {
      body.innerHTML = '<div class="cm-empty" style="padding:24px"><i class="fas fa-check-circle" style="color:#10b981;font-size:32px"></i><br>Tous les stocks sont OK !<br><small style="color:var(--muted)">Aucun produit en rupture ou stock bas</small></div>';
      return;
    }

    body.innerHTML = `
      ${ruptures.length > 0 ? `
        <div style="font-size:13px;font-weight:800;color:#ef4444;margin-bottom:8px"><i class="fas fa-circle-exclamation"></i> Ruptures de stock (${ruptures.length})</div>
        ${ruptures.map(a => `<div class="cp-alert-item">
          <i class="fas fa-box" style="color:#ef4444"></i>
          <div style="flex:1"><div style="font-weight:700;font-size:13px">${a.name}</div><div style="font-size:11px;color:var(--muted)">${a.cat} · Stock: 0 ${a.unit || ''}</div></div>
          <button class="cp-btn green" style="padding:6px 10px;font-size:11px" onclick="cpQuickRestock('${a.id}')"><i class="fas fa-plus"></i> Commander</button>
        </div>`).join('')}
      ` : ''}
      ${lows.length > 0 ? `
        <div style="font-size:13px;font-weight:800;color:#f59e0b;margin:12px 0 8px"><i class="fas fa-triangle-exclamation"></i> Stock bas (${lows.length})</div>
        ${lows.map(a => `<div class="cp-alert-item warning">
          <i class="fas fa-box" style="color:#f59e0b"></i>
          <div style="flex:1"><div style="font-weight:700;font-size:13px">${a.name}</div><div style="font-size:11px;color:var(--muted)">Stock: ${a.stock || 0} ${a.unit || ''} · Seuil: ${a.seuil !== undefined ? a.seuil : shopSeuil}</div></div>
          <button class="cp-btn green" style="padding:6px 10px;font-size:11px" onclick="cpQuickRestock('${a.id}')"><i class="fas fa-plus"></i> Acheter</button>
        </div>`).join('')}
      ` : ''}
    `;
  }

  // Wrapper pour le réapprovisionnement rapide
  window.cpQuickRestock = function (artId) {
    if (typeof window.cmQuickRestock === 'function') {
      window.cmQuickRestock(artId);
      // Switcher vers l'onglet mouvements
      if (typeof window.cmSwitch === 'function') window.cmSwitch('mouvements');
    }
  };

  function renderHistoriqueMvts(body) {
    const mvts = CP.getMvts().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 50);
    if (mvts.length === 0) {
      body.innerHTML = '<div class="cm-empty"><i class="fas fa-history"></i>Aucun mouvement enregistré</div>';
      return;
    }
    body.innerHTML = `
      <div class="cp-list">
        ${mvts.map(m => {
      const isV = m.type === 'vente';
      return `<div class="cp-list-item cp-anim">
            <div class="cp-list-avatar" style="background:${isV ? 'rgba(16,185,129,.1)' : 'rgba(37,99,235,.1)'};color:${isV ? '#10b981' : '#2563eb'}">
              <i class="fas fa-${isV ? 'arrow-up-right' : 'arrow-down-left'}" style="font-size:14px"></i>
            </div>
            <div class="cp-list-body">
              <div class="cp-list-name">${m.artName}</div>
              <div class="cp-list-sub">${m.type === 'vente' ? 'Vente' : 'Achat'} · ${m.qte} ${m.unit || ''} · ${m.date}</div>
              ${m.person ? `<div style="font-size:11px;color:var(--muted)">${m.type === 'vente' ? 'Client' : 'Fournisseur'}: ${m.person}</div>` : ''}
            </div>
            <div class="cp-list-amount" style="color:${isV ? '#10b981' : '#ef4444'}">${isV ? '+' : '-'}${CP.amt(m.total)}</div>
          </div>`;
    }).join('')}
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
   * 16. MODULE RAPPORTS
   * ═══════════════════════════════════════════════════════════ */
  let _cpReportPeriod = 'jour';

  window.cpSetPeriod = function (per, el) {
    _cpReportPeriod = per;
    document.querySelectorAll('.cp-period-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    cpRenderRapports(per);
  };

  function cpRenderRapports(period) {
    const body = document.getElementById('cpReportBody');
    if (!body) return;

    const mvts = CP.getMvts();
    const today = CP.today();
    const month = CP.month();
    const year = new Date().getFullYear().toString();
    const weekStart = (() => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
    })();

    let filtered;
    switch (period) {
      case 'jour': filtered = mvts.filter(m => m.date === today); break;
      case 'semaine': filtered = mvts.filter(m => m.date >= weekStart); break;
      case 'mois': filtered = mvts.filter(m => (m.date || '').startsWith(month)); break;
      case 'annee': filtered = mvts.filter(m => (m.date || '').startsWith(year)); break;
      default: filtered = mvts;
    }

    const ventes = filtered.filter(m => m.type === 'vente');
    const achats = filtered.filter(m => m.type === 'achat');
    const caVentes = ventes.reduce((s, m) => s + (m.total || 0), 0);
    const caAchats = achats.reduce((s, m) => s + (m.total || 0), 0);
    const benefice = caVentes - caAchats;
    const nbVentes = ventes.length;

    // Top produits
    const topMap = {};
    ventes.forEach(m => {
      if (!topMap[m.artId]) topMap[m.artId] = { name: m.artName, qte: 0, total: 0 };
      topMap[m.artId].qte += (m.qte || 0);
      topMap[m.artId].total += (m.total || 0);
    });
    const top5 = Object.values(topMap).sort((a, b) => b.total - a.total).slice(0, 5);

    // Top clients
    const clientMap = {};
    ventes.forEach(m => {
      if (!m.person) return;
      if (!clientMap[m.person]) clientMap[m.person] = { name: m.person, total: 0, nb: 0 };
      clientMap[m.person].total += (m.total || 0);
      clientMap[m.person].nb++;
    });
    const top3Clients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 3);

    const periodLabel = { jour: "Aujourd'hui", semaine: 'Cette semaine', mois: 'Ce mois', annee: 'Cette année' }[period];

    body.innerHTML = `
      <div class="cp-kpi-grid">
        <div class="cp-kpi" style="--cp-accent:#10b981">
          <div class="cp-kpi-label"><i class="fas fa-chart-line"></i> CA Ventes</div>
          <div class="cp-kpi-value">${CP.amt(caVentes)}</div>
          <div class="cp-kpi-sub">${nbVentes} vente(s)</div>
        </div>
        <div class="cp-kpi" style="--cp-accent:#ef4444">
          <div class="cp-kpi-label"><i class="fas fa-cart-arrow-down"></i> CA Achats</div>
          <div class="cp-kpi-value">${CP.amt(caAchats)}</div>
          <div class="cp-kpi-sub">${achats.length} achat(s)</div>
        </div>
        <div class="cp-kpi" style="--cp-accent:#8b5cf6">
          <div class="cp-kpi-label"><i class="fas fa-percent"></i> Bénéfice</div>
          <div class="cp-kpi-value" style="color:${benefice >= 0 ? '#10b981' : '#ef4444'}">${CP.amt(benefice)}</div>
          <div class="cp-kpi-sub">${benefice >= 0 ? '✅ Positif' : '⚠️ Négatif'}</div>
        </div>
        <div class="cp-kpi" style="--cp-accent:#f59e0b">
          <div class="cp-kpi-label"><i class="fas fa-cubes"></i> Valeur stock</div>
          <div class="cp-kpi-value">${CP.amt(CP.getArticles().reduce((s, a) => s + ((a.prixA || a.prixV || 0) * (a.stock || 0)), 0))}</div>
          <div class="cp-kpi-sub">${CP.getArticles().length} articles</div>
        </div>
      </div>

      ${top5.length > 0 ? `
        <div class="cp-chart-card">
          <div class="cp-chart-title"><i class="fas fa-trophy" style="color:#f59e0b"></i> Top produits — ${periodLabel}</div>
          ${top5.map((p, i) => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="font-size:12px;font-weight:800;width:18px;color:var(--muted)">#${i + 1}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="height:5px;background:rgba(148,163,184,.2);border-radius:99px;margin-top:4px">
                  <div style="height:100%;width:${top5[0].total ? Math.round(p.total / top5[0].total * 100) : 0}%;background:linear-gradient(90deg,#10b981,#059669);border-radius:99px"></div>
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:900;font-size:12.5px;color:#10b981">${CP.amt(p.total)}</div>
                <div style="font-size:10.5px;color:var(--muted)">${p.qte} vendus</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${top3Clients.length > 0 ? `
        <div class="cp-chart-card">
          <div class="cp-chart-title"><i class="fas fa-users" style="color:#2563eb"></i> Top clients — ${periodLabel}</div>
          ${top3Clients.map((c, i) => `
            <div class="cp-list-item" style="margin-bottom:6px">
              <div style="font-size:13px;font-weight:800;color:var(--muted);width:20px">#${i + 1}</div>
              <div class="cp-list-body">
                <div class="cp-list-name">${c.name}</div>
                <div class="cp-list-sub">${c.nb} achat(s)</div>
              </div>
              <div class="cp-list-amount" style="color:#2563eb">${CP.amt(c.total)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  window.cpExportCSV = function () {
    const mvts = CP.getMvts();
    const arts = CP.getArticles();
    const shop = CP.getShop();
    const rows = [['Date', 'Type', 'Article', 'Quantité', 'Prix unitaire', 'Total', 'Personne', 'Note']];
    mvts.forEach(m => rows.push([m.date, m.type, m.artName, m.qte, m.prix, m.total, m.person || '', m.note || '']));

    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-commerce-${shop?.name || 'boutique'}-${CP.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    CP.toast('CSV exporté ✓', 'success');
  };

  window.cpExportPrint = function () {
    window.print();
  };

  /* ═══════════════════════════════════════════════════════════
   * 17. ASSISTANT IA COMMERCE
   * ═══════════════════════════════════════════════════════════ */
  window.cpAiSend = function () {
    const input = document.getElementById('cpAiInput');
    const question = input?.value.trim();
    if (!question) return;
    input.value = '';
    cpAiAsk(question);
  };

  window.cpAiAsk = function (question) {
    const msgs = document.getElementById('cpAiMessages');
    if (!msgs) return;

    // Ajouter message utilisateur
    msgs.insertAdjacentHTML('beforeend', `<div class="cp-ai-msg user cp-anim">${question}</div>`);
    msgs.scrollTop = msgs.scrollHeight;

    // Construire le contexte
    const mvts = CP.getMvts();
    const arts = CP.getArticles();
    const shop = CP.getShop();
    const shopId = CP.getCM()?.currentShopId;
    const month = CP.month();
    const today = CP.today();
    const shopSeuil = shop?.seuil || 5;

    // Réponses analytiques locales (sans API externe)
    let reponse = '';
    const q = question.toLowerCase();

    if (q.includes('plus vendu') || q.includes('meilleur produit') || q.includes('top produit')) {
      const topMap = {};
      mvts.filter(m => m.type === 'vente').forEach(m => {
        if (!topMap[m.artId]) topMap[m.artId] = { name: m.artName, qte: 0, total: 0 };
        topMap[m.artId].qte += (m.qte || 0);
        topMap[m.artId].total += (m.total || 0);
      });
      const top = Object.values(topMap).sort((a, b) => b.total - a.total);
      if (top.length === 0) reponse = 'Aucune vente enregistrée pour l\'instant.';
      else reponse = `🏆 Votre produit le plus vendu est <strong>${top[0].name}</strong> avec ${CP.amt(top[0].total)} de chiffre d'affaires (${top[0].qte} unités vendues).${top[1] ? `<br>2ème : ${top[1].name} (${CP.amt(top[1].total)})` : ''}`;
    }
    else if (q.includes('marge') || q.includes('bénéfice') || q.includes('profit')) {
      const ventes = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month)).reduce((s, m) => s + (m.total || 0), 0);
      const achats = mvts.filter(m => m.type === 'achat' && (m.date || '').startsWith(month)).reduce((s, m) => s + (m.total || 0), 0);
      const marge = ventes - achats;
      const taux = ventes > 0 ? Math.round((marge / ventes) * 100) : 0;
      reponse = `📊 Ce mois :<br>• Ventes : <strong>${CP.amt(ventes)}</strong><br>• Achats : <strong>${CP.amt(achats)}</strong><br>• Bénéfice : <strong style="color:${marge >= 0 ? '#10b981' : '#ef4444'}">${CP.amt(marge)}</strong><br>• Taux de marge : <strong>${taux}%</strong>`;
    }
    else if (q.includes('manquer') || q.includes('stock faible') || q.includes('stock bas') || q.includes('rupture')) {
      const lows = arts.filter(a => (a.stock || 0) <= (a.seuil !== undefined ? a.seuil : shopSeuil));
      const ruptures = arts.filter(a => (a.stock || 0) === 0);
      if (lows.length === 0) reponse = '✅ Tous vos stocks sont suffisants ! Aucun produit en alerte.';
      else {
        reponse = `⚠️ <strong>${lows.length} produit(s)</strong> en alerte :<br>`;
        if (ruptures.length > 0) reponse += `🔴 Rupture : ${ruptures.map(a => a.name).join(', ')}<br>`;
        const lowOnly = lows.filter(a => (a.stock || 0) > 0);
        if (lowOnly.length > 0) reponse += `🟡 Stock bas : ${lowOnly.map(a => `${a.name} (${a.stock || 0} restants)`).join(', ')}`;
      }
    }
    else if (q.includes('dette') || q.includes('débiteur') || q.includes('crédit') || q.includes('doit')) {
      const credits = CPData.credits.filter(c => c.shopId === shopId && c.statut !== 'solde');
      if (credits.length === 0) reponse = '✅ Aucun client débiteur en ce moment.';
      else {
        const total = credits.reduce((s, c) => s + ((c.montantTotal || 0) - (c.montantPaye || 0)), 0);
        reponse = `💳 <strong>${credits.length} client(s)</strong> ont des dettes :<br>`;
        credits.slice(0, 5).forEach(c => {
          const reste = (c.montantTotal || 0) - (c.montantPaye || 0);
          reponse += `• ${c.clientNom} : <strong>${CP.amt(reste)}</strong>${c.echeance && c.echeance < today ? ' ⚠️ EN RETARD' : ''}<br>`;
        });
        reponse += `Total dettes : <strong style="color:#ef4444">${CP.amt(total)}</strong>`;
      }
    }
    else if (q.includes('valeur') || q.includes('stock actuel') || q.includes('valeur stock')) {
      const valStock = arts.reduce((s, a) => s + ((a.prixA || a.prixV || 0) * (a.stock || 0)), 0);
      const nbProd = arts.length;
      const nbUnites = arts.reduce((s, a) => s + (a.stock || 0), 0);
      reponse = `📦 Valeur actuelle de votre stock :<br>• <strong>${CP.amt(valStock)}</strong><br>• ${nbProd} article(s) référencés<br>• ${nbUnites} unités en stock`;
    }
    else if (q.includes('combien de vente') || q.includes('nombre de vente') || q.includes('nb vente')) {
      const ventesM = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month));
      const ventesJ = mvts.filter(m => m.type === 'vente' && m.date === today);
      reponse = `🛍️ Ventes :<br>• Aujourd'hui : <strong>${ventesJ.length}</strong> vente(s) (${CP.amt(ventesJ.reduce((s, m) => s + (m.total || 0), 0))})<br>• Ce mois : <strong>${ventesM.length}</strong> vente(s) (${CP.amt(ventesM.reduce((s, m) => s + (m.total || 0), 0))})`;
    }
    else if (q.includes('ca') || q.includes('chiffre') || q.includes('revenu')) {
      const caJour = mvts.filter(m => m.type === 'vente' && m.date === today).reduce((s, m) => s + (m.total || 0), 0);
      const caMois = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month)).reduce((s, m) => s + (m.total || 0), 0);
      reponse = `💰 Chiffre d'affaires :<br>• Aujourd'hui : <strong>${CP.amt(caJour)}</strong><br>• Ce mois : <strong>${CP.amt(caMois)}</strong>`;
    }
    else {
      // Réponse générique basée sur contexte
      const caM = mvts.filter(m => m.type === 'vente' && (m.date || '').startsWith(month)).reduce((s, m) => s + (m.total || 0), 0);
      reponse = `Je n'ai pas compris précisément votre question. Voici un résumé de votre boutique :<br>• CA mois : <strong>${CP.amt(caM)}</strong><br>• Articles : <strong>${arts.length}</strong><br>• Essayez des questions comme "quel est mon produit le plus vendu ?" ou "quelle est ma marge ce mois ?"`;
    }

    setTimeout(() => {
      msgs.insertAdjacentHTML('beforeend', `<div class="cp-ai-msg bot cp-anim">🤖 ${reponse}</div>`);
      msgs.scrollTop = msgs.scrollHeight;
    }, 500);
  };

  /* ═══════════════════════════════════════════════════════════
   * 18. BOUTON FAB AVANCÉ
   * ═══════════════════════════════════════════════════════════ */
  window.cpToggleFab = function () {
    const btn = document.getElementById('cpFabBtn');
    const items = document.getElementById('cpFabItems');
    btn?.classList.toggle('open');
    items?.classList.toggle('open');
  };

  window.cpFabAction = function (action) {
    cpToggleFab();
    switch (action) {
      case 'vente':
        if (typeof window.cmSwitch === 'function') window.cmSwitch('mouvements');
        setTimeout(() => { if (typeof window.cmOpenMvtModal === 'function') window.cmOpenMvtModal(); }, 200);
        break;
      case 'produit':
        if (typeof window.cmSwitch === 'function') window.cmSwitch('articles');
        setTimeout(() => { if (typeof window.cmOpenArticleModal === 'function') window.cmOpenArticleModal(); }, 200);
        break;
      case 'achat':
        if (typeof window.cmSwitch === 'function') window.cmSwitch('mouvements');
        setTimeout(() => {
          if (typeof window.cmSetMvtType === 'function') window.cmSetMvtType('achat');
          if (typeof window.cmOpenMvtModal === 'function') window.cmOpenMvtModal();
        }, 200);
        break;
      case 'client':
        cpSwitchPro('clients');
        setTimeout(() => cpOpenClientModal(), 200);
        break;
      case 'fournisseur':
        cpSwitchPro('fournisseurs');
        setTimeout(() => cpOpenFournisseurModal(), 200);
        break;
      case 'inventaire':
        cpSwitchPro('inventaire');
        break;
    }
  };

  // Fermer FAB si clic extérieur
  document.addEventListener('click', (e) => {
    const fab = document.getElementById('cpFabMenu');
    if (fab && !fab.contains(e.target)) {
      document.getElementById('cpFabBtn')?.classList.remove('open');
      document.getElementById('cpFabItems')?.classList.remove('open');
    }
  });

  /* ═══════════════════════════════════════════════════════════
   * 19. RECHERCHE GLOBALE
   * ═══════════════════════════════════════════════════════════ */
  window.cpOpenSearch = function () {
    const overlay = document.getElementById('cpSearchOverlay');
    if (overlay) {
      overlay.classList.add('open');
      setTimeout(() => document.getElementById('cpSearchInput')?.focus(), 100);
    }
  };

  window.cpCloseSearch = function () {
    document.getElementById('cpSearchOverlay')?.classList.remove('open');
  };

  window.cpDoSearch = function (q) {
    const results = document.getElementById('cpSearchResults');
    if (!results) return;
    if (!q || q.length < 2) { results.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">Saisissez au moins 2 caractères</div>'; return; }

    const ql = q.toLowerCase();
    const shopId = CP.getCM()?.currentShopId;
    let html = '';

    // Articles
    CP.getArticles().filter(a => a.name.toLowerCase().includes(ql) || (a.code || '').toLowerCase().includes(ql)).slice(0, 4).forEach(a => {
      html += `<div class="cp-search-result" onclick="cpCloseSearch();cmSwitch('articles')">
        <div class="cp-search-result-ico" style="background:rgba(16,185,129,.1);color:#10b981"><i class="fas fa-box"></i></div>
        <div class="cp-search-result-body">
          <div class="cp-search-result-name">${a.name}</div>
          <div class="cp-search-result-type">Article · ${CP.amt(a.prixV)} · Stock: ${a.stock || 0}</div>
        </div>
      </div>`;
    });

    // Clients
    CPData.clients.filter(c => c.shopId === shopId && (c.nom.toLowerCase().includes(ql) || (c.tel || '').includes(q))).slice(0, 3).forEach(c => {
      html += `<div class="cp-search-result" onclick="cpCloseSearch();cpSwitchPro('clients')">
        <div class="cp-search-result-ico" style="background:rgba(37,99,235,.1);color:#2563eb"><i class="fas fa-user"></i></div>
        <div class="cp-search-result-body">
          <div class="cp-search-result-name">${c.nom}</div>
          <div class="cp-search-result-type">Client · ${c.tel || '—'}</div>
        </div>
      </div>`;
    });

    // Fournisseurs
    CPData.fournisseurs.filter(f => f.shopId === shopId && f.nom.toLowerCase().includes(ql)).slice(0, 2).forEach(f => {
      html += `<div class="cp-search-result" onclick="cpCloseSearch();cpSwitchPro('fournisseurs')">
        <div class="cp-search-result-ico" style="background:rgba(6,182,212,.1);color:#06b6d4"><i class="fas fa-truck"></i></div>
        <div class="cp-search-result-body">
          <div class="cp-search-result-name">${f.nom}</div>
          <div class="cp-search-result-type">Fournisseur · ${f.tel || '—'}</div>
        </div>
      </div>`;
    });

    // Ventes récentes
    CP.getMvts().filter(m => m.type === 'vente' && (m.artName.toLowerCase().includes(ql) || (m.person || '').toLowerCase().includes(ql))).slice(0, 3).forEach(m => {
      html += `<div class="cp-search-result" onclick="cpCloseSearch();cmSwitch('mouvements')">
        <div class="cp-search-result-ico" style="background:rgba(139,92,246,.1);color:#8b5cf6"><i class="fas fa-receipt"></i></div>
        <div class="cp-search-result-body">
          <div class="cp-search-result-name">${m.artName}</div>
          <div class="cp-search-result-type">Vente · ${m.date} · ${CP.amt(m.total)}</div>
        </div>
      </div>`;
    });

    results.innerHTML = html || '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">Aucun résultat trouvé</div>';
  };

  /* ═══════════════════════════════════════════════════════════
   * 20. AFFICHER LE FAB ET LE BOUTON RECHERCHE DANS COMMERCE
   * ═══════════════════════════════════════════════════════════ */
  function syncFabVisibility() {
    const fab = document.getElementById('cpFabMenu');
    if (!fab) return;
    const inCommerce = document.getElementById('tab-commerce')?.classList.contains('active');
    fab.style.display = inCommerce ? 'block' : 'none';
  }

  // Injecter bouton recherche dans l'en-tête Commerce
  function injectSearchBtn() {
    const header = document.querySelector('#tab-commerce .cm-header');
    if (!header || header.dataset.cpSearch) return;
    header.dataset.cpSearch = '1';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    const btn = document.createElement('button');
    btn.onclick = cpOpenSearch;
    btn.style.cssText = 'border:none;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:6px;';
    btn.innerHTML = '<i class="fas fa-search"></i>';
    header.appendChild(btn);
  }

  /* ═══════════════════════════════════════════════════════════
   * 21. HOOKING : AUGMENTER cmSwitch existant
   * ═══════════════════════════════════════════════════════════ */
  function hookCmSwitch() {
    const origSwitch = window.cmSwitch;
    if (typeof origSwitch !== 'function' || origSwitch._cpHooked) return;
    window.cmSwitch = function (sec) {
      // Si c'est une section Pro, on gère nous-mêmes
      const proSections = ['clients', 'fournisseurs', 'credits', 'caisse', 'inventaire', 'rapports', 'ia'];
      if (proSections.includes(sec)) {
        cpSwitchPro(sec);
        return;
      }
      // Sinon déléguer au CM original
      origSwitch.call(this, sec);
      // Et fermer les sections Pro
      document.querySelectorAll('.cp-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('#tab-commerce .cm-tab').forEach(b => {
        if (!['resume', 'articles', 'mouvements', 'stock'].includes(b.dataset.cmtab)) {
          b.classList.remove('active');
        }
      });
    };
    window.cmSwitch._cpHooked = true;
  }

  /* ═══════════════════════════════════════════════════════════
   * 22. HOOKING : AUGMENTER cmRenderResume (dashboard enrichi)
   * ═══════════════════════════════════════════════════════════ */
  function hookCmRenderResume() {
    // On surveille les changements sur le résumé via MutationObserver
    const resumeSec = document.getElementById('cm-sec-resume');
    if (!resumeSec || resumeSec.dataset.cpObserved) return;
    resumeSec.dataset.cpObserved = '1';

    // Rafraîchir les KPI Pro à chaque render du résumé natif
    const observer = new MutationObserver(() => {
      if (document.getElementById('cpKpiDay')) {
        cpRenderDashboard();
      }
    });
    observer.observe(resumeSec, { childList: true, subtree: false });
  }

  /* ═══════════════════════════════════════════════════════════
   * 23. SYNCHRONISATION AVEC SWITCH TAB GLOBAL
   * ═══════════════════════════════════════════════════════════ */
  function hookGlobalSwitchTab() {
    const origSwitch = window.switchTab;
    if (typeof origSwitch !== 'function' || origSwitch._cpTabHooked) return;
    window.switchTab = function (tab) {
      origSwitch.apply(this, arguments);
      syncFabVisibility();
      if (tab === 'commerce') {
        setTimeout(() => {
          cpRenderDashboard();
          hookCmSwitch();
          hookCmRenderResume();
        }, 300);
      }
    };
    window.switchTab._cpTabHooked = true;
  }

  /* ═══════════════════════════════════════════════════════════
   * 24. VERROUILLAGE EMPLOYÉ — Accès Commerce uniquement
   *
   * Navigation réelle de l'app :
   *  - Sidebar : .sidebar-link avec ids sb-dashboard, sb-revenus…
   *  - Bottom nav : .bnav-btn avec ids bnav-dashboard, bnav-historique,
   *                 bnav-epargne, bnav-more (ouvre drawer)
   *  - Drawer : .bnav-drawer-item avec ids bnd-revenus, bnd-depenses…
   *  - Fonctions JS : switchTab(), bnavSwitch(), bnavSwitchExt(),
   *                   openBnavDrawer()
   * ═══════════════════════════════════════════════════════════ */

  // IDs sidebar à bloquer (tous sauf commerce)
  const CP_BLOCKED_SB = [
    'sb-dashboard','sb-revenus','sb-depenses','sb-epargne','sb-budget',
    'sb-salaire','sb-objectifs','sb-tontines','sb-plangestion',
    'sb-historique','sb-notes','sb-conseils','sb-profil',
  ];
  // IDs bottom nav à bloquer
  const CP_BLOCKED_BNAV = ['bnav-dashboard','bnav-historique','bnav-epargne','bnav-more'];
  // IDs drawer à bloquer
  const CP_BLOCKED_BND = [
    'bnd-revenus','bnd-depenses','bnd-budget','bnd-salaire',
    'bnd-notes','bnd-plangestion',
  ];

  function cpIsEmployeeSession() {
    const cm = window.CM_DEBUG;
    return !!(cm && cm.activeRole && cm.activeRole !== 'patron');
  }

  function injectLockCSS() {
    if (document.getElementById('cp-lock-css')) return;
    const s = document.createElement('style');
    s.id = 'cp-lock-css';
    s.textContent = `
/* ── Éléments bloqués en mode employé ── */
.cp-nav-blocked {
  opacity: .25 !important;
  pointer-events: none !important;
  filter: grayscale(1) !important;
  cursor: not-allowed !important;
}
/* ── Bandeau session employé ── */
#cpEmployeeBanner {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  color: #fff;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  align-items: center;
  gap: 8px;
  box-shadow: 0 3px 16px rgba(37,99,235,.5);
}
#cpEmployeeBanner.show { display: flex; }
#cpBannerName { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#cpBannerShop { font-size: 11px; opacity: .8; flex-shrink: 0; }
.cp-banner-exit {
  background: rgba(255,255,255,.2);
  border: none; border-radius: 8px;
  color: #fff; padding: 6px 12px;
  font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  flex-shrink: 0;
}
/* Pousser le contenu sous le bandeau */
body.cp-employee-mode { padding-top: 42px; }
/* ── Overlay de blocage ── */
#cpLockOverlay {
  display: none;
  position: fixed; inset: 0;
  z-index: 9998;
  background: rgba(15,23,42,.7);
  align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
#cpLockOverlay.show { display: flex; }
#cpLockOverlayBox {
  background: var(--card, #fff);
  border-radius: 22px; padding: 30px 24px;
  max-width: 290px; width: 88%;
  text-align: center;
  box-shadow: 0 24px 60px rgba(0,0,0,.3);
  animation: cpSlideIn .2s ease;
}
#cpLockOverlayBox .cp-lo-ico { font-size: 48px; margin-bottom: 12px; }
#cpLockOverlayBox h3 { margin: 0 0 8px; font-size: 18px; font-weight: 900; color: var(--text,#0f172a); }
#cpLockOverlayBox p  { margin: 0 0 20px; font-size: 13px; color: var(--muted,#64748b); line-height: 1.55; }
    `;
    document.head.appendChild(s);
  }

  function injectLockElements() {
    if (!document.getElementById('cpEmployeeBanner')) {
      document.body.insertAdjacentHTML('afterbegin', `
        <div id="cpEmployeeBanner">
          <i class="fas fa-user-shield"></i>
          <span id="cpBannerName">Session employé</span>
          <span id="cpBannerShop"></span>
          <button class="cp-banner-exit" onclick="cpExitEmployeeMode()">
            <i class="fas fa-right-from-bracket"></i> Quitter
          </button>
        </div>
      `);
    }
    if (!document.getElementById('cpLockOverlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="cpLockOverlay" onclick="this.classList.remove('show')">
          <div id="cpLockOverlayBox">
            <div class="cp-lo-ico">🔒</div>
            <h3>Accès restreint</h3>
            <p>En tant qu'<strong>employé</strong>, vous n'avez accès qu'au module <strong>Commerce</strong>.</p>
            <button onclick="cpGoToCommerce()" style="width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:13px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;">
              <i class="fas fa-store"></i> Retourner au Commerce
            </button>
          </div>
        </div>
      `);
    }
  }

  /* Active le mode employé */
  function cpActivateEmployeeMode() {
    const cm = window.CM_DEBUG;
    if (!cm || cm.activeRole === 'patron') return;

    injectLockCSS();
    injectLockElements();
    document.body.classList.add('cp-employee-mode');

    // Bandeau
    const banner = document.getElementById('cpEmployeeBanner');
    if (banner) banner.classList.add('show');
    const nameEl = document.getElementById('cpBannerName');
    const shopEl = document.getElementById('cpBannerShop');
    const emp  = cm.activeEmployee;
    const shop = CP.getShop();
    if (nameEl) nameEl.textContent = (emp ? emp.name : 'Employé') + ' · ' + (cm.activeRole === 'manager' ? 'Manager' : 'Employé');
    if (shopEl && shop) shopEl.textContent = '— ' + shop.name;

    // Appliquer classe de blocage sur les éléments nav
    [...CP_BLOCKED_SB, ...CP_BLOCKED_BNAV, ...CP_BLOCKED_BND].forEach(id => {
      document.getElementById(id)?.classList.add('cp-nav-blocked');
    });
    // Bloquer aussi tous les .bnav-drawer-item qui ne concernent pas commerce
    document.querySelectorAll('.bnav-drawer-item:not(#bnd-commerce)').forEach(el => {
      el.classList.add('cp-nav-blocked');
    });

    // ► Persister la session pour survie au rechargement
    cpWriteSession({
      role: cm.activeRole,
      employeeName: emp ? emp.name : 'Employé',
      employeeId:   emp ? emp.id   : null,
      shopName:     shop ? shop.name : '',
      shopId:       cm.currentShopId || null,
      lockedAt:     Date.now(),
    });

    // Forcer Commerce
    cpGoToCommerce();
  }

  /* Désactive le mode employé */
  function cpDeactivateEmployeeMode() {
    // ► Effacer la session persistée
    cpClearSession();

    document.body.classList.remove('cp-employee-mode','cp-locked-early');
    document.getElementById('cpEmployeeBanner')?.classList.remove('show');
    document.getElementById('cpLockOverlay')?.classList.remove('show');

    // Retirer les blocages CSS
    document.querySelectorAll('.cp-nav-blocked').forEach(el => {
      el.classList.remove('cp-nav-blocked');
    });
  }

  /* Montre l'overlay de blocage (auto-fermeture 3s) */
  function cpShowLockOverlay() {
    const o = document.getElementById('cpLockOverlay');
    if (!o) { injectLockElements(); }
    const ov = document.getElementById('cpLockOverlay');
    if (ov) {
      ov.classList.add('show');
      clearTimeout(cpShowLockOverlay._t);
      cpShowLockOverlay._t = setTimeout(() => ov.classList.remove('show'), 3000);
    }
  }

  window.cpGoToCommerce = function () {
    document.getElementById('cpLockOverlay')?.classList.remove('show');
    // Appel direct sur la dernière version de switchTab
    if (typeof window.switchTab === 'function') {
      // Contourner notre propre hook en appelant directement
      const fn = window.switchTab._cpOrigForLock || window.switchTab;
      fn.call(window, 'commerce');
    }
  };

  window.cpExitEmployeeMode = function () {
    if (typeof window.cmExitEmployeeSession === 'function') window.cmExitEmployeeSession();
    cpDeactivateEmployeeMode();
    CP.toast('Session terminée — Bienvenue Patron 👑', 'success');
  };

  /* ── Hook des 4 fonctions de navigation ── */
  function hookAllNavForLock() {

    // 1. switchTab
    const origST = window.switchTab;
    if (typeof origST === 'function' && !origST._cpLockHooked) {
      window.switchTab = function (tab) {
        if (cpIsEmployeeSession() && tab !== 'commerce') {
          cpShowLockOverlay(); return;
        }
        origST.apply(this, arguments);
      };
      window.switchTab._cpLockHooked = true;
      window.switchTab._cpOrigForLock = origST;
    }

    // 2. bnavSwitch
    const origBN = window.bnavSwitch;
    if (typeof origBN === 'function' && !origBN._cpLockHooked) {
      window.bnavSwitch = function (tab) {
        if (cpIsEmployeeSession() && tab !== 'commerce') {
          cpShowLockOverlay(); return;
        }
        origBN.apply(this, arguments);
      };
      window.bnavSwitch._cpLockHooked = true;
    }

    // 3. bnavSwitchExt
    const origBE = window.bnavSwitchExt;
    if (typeof origBE === 'function' && !origBE._cpLockHooked) {
      window.bnavSwitchExt = function (tab) {
        if (cpIsEmployeeSession()) {
          cpShowLockOverlay(); return;
        }
        origBE.apply(this, arguments);
      };
      window.bnavSwitchExt._cpLockHooked = true;
    }

    // 4. openBnavDrawer — bloquer l'ouverture du tiroir
    const origDr = window.openBnavDrawer;
    if (typeof origDr === 'function' && !origDr._cpLockHooked) {
      window.openBnavDrawer = function () {
        if (cpIsEmployeeSession()) {
          cpShowLockOverlay(); return;
        }
        origDr.apply(this, arguments);
      };
      window.openBnavDrawer._cpLockHooked = true;
    }
  }

  /* ── Hook cmSubmitIdentityPin : activer le verrou après login employé ── */
  /* Restaure la session CM depuis localStorage ou URL après rechargement */
  function cpRestoreSessionInCM() {
    const sess = cpReadSession();
    if (!sess || !sess.role || sess.role === 'patron') return;
    const cm = window.CM_DEBUG;
    if (!cm) return;

    // Si la session vient d'un lien, trouver la boutique par ID
    if (sess.fromLink && sess.shopId) {
      const shop = cm.shops.find(s => s.id === sess.shopId);
      if (shop) {
        cm.currentShopId = sess.shopId;
        sess.shopName = shop.name;
        cpWriteSession(sess); // Mettre à jour avec le vrai nom
      }
    }

    cm.activeRole = sess.role;
    cm.activeEmployee = {
      id:   sess.employeeId || 'link_emp',
      name: sess.employeeName || 'Employé',
      role: sess.role,
    };
    if (typeof window.cmUpdateRoleBadge === 'function') window.cmUpdateRoleBadge();
    cpActivateEmployeeMode();

    // Afficher le bouton d'installation PWA si disponible
    if (_cpDeferredInstallPrompt) cpShowInstallBtn();
  }

  function hookCmIdentityPin() {
    const orig = window.cmSubmitIdentityPin;
    if (typeof orig !== 'function' || orig._cpHooked) return;
    window.cmSubmitIdentityPin = function () {
      orig.apply(this, arguments);
      setTimeout(() => {
        if (cpIsEmployeeSession()) cpActivateEmployeeMode();
      }, 300);
    };
    window.cmSubmitIdentityPin._cpHooked = true;
  }

  /* ── PIN Patron ── */
  const CP_PATRON_PIN_KEY = 'aet_cp_patron_pin';
  function cpGetPatronPin() { return localStorage.getItem(CP_PATRON_PIN_KEY) || null; }

  function injectPatronPinModal() {
    if (document.getElementById('cpPatronPinModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="cpPatronPinModal">
        <div class="modal-box" style="max-width:320px;text-align:center">
          <div class="modal-header" style="justify-content:center;border-bottom:none;padding-bottom:0">
            <h3><i class="fas fa-crown" style="color:#f59e0b;margin-right:8px"></i>Accès Patron</h3>
          </div>
          <div class="modal-body">
            <p id="cpPatronPinLabel" style="font-size:13px;color:var(--muted);margin-bottom:16px">Entrez votre code PIN Patron</p>
            <input type="password" id="cpPatronPinInput" maxlength="6" inputmode="numeric" placeholder="••••••"
              style="width:100%;text-align:center;font-size:28px;letter-spacing:14px;padding:14px;border:1.5px solid var(--border);border-radius:12px;font-weight:700;background:var(--card);color:var(--text);box-sizing:border-box"
              onkeydown="if(event.key==='Enter')cpConfirmPatronPin()">
            <div id="cpPatronPinError" style="color:#ef4444;font-size:12px;margin-top:8px;min-height:18px"></div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button onclick="closeModal('cpPatronPinModal')" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:12px;background:transparent;font-weight:700;cursor:pointer;font-family:inherit;color:var(--muted)">Annuler</button>
              <button onclick="cpConfirmPatronPin()" style="flex:2;padding:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit">
                <i class="fas fa-unlock"></i> Confirmer
              </button>
            </div>
            <button id="cpPatronPinSetupBtn" onclick="cpSetupPatronPin()" style="display:none;width:100%;margin-top:10px;padding:10px;border:1.5px dashed var(--border);border-radius:12px;background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">
              <i class="fas fa-key"></i> Créer mon code PIN Patron
            </button>
          </div>
        </div>
      </div>
      <div class="modal-overlay" id="cpPatronPinSetupModal">
        <div class="modal-box" style="max-width:320px;text-align:center">
          <div class="modal-header" style="justify-content:center;border-bottom:none">
            <h3><i class="fas fa-key" style="color:#f59e0b;margin-right:8px"></i>Code PIN Patron</h3>
          </div>
          <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Ce code vous sera demandé à chaque fois que vous accédez en tant que Patron.</p>
            <label class="cp-label" style="text-align:left;display:block;margin-bottom:5px">Nouveau PIN (4–6 chiffres)</label>
            <input type="password" id="cpNewPin1" maxlength="6" inputmode="numeric" placeholder="••••••"
              style="width:100%;text-align:center;font-size:24px;letter-spacing:12px;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-weight:700;background:var(--card);color:var(--text);box-sizing:border-box;margin-bottom:10px">
            <label class="cp-label" style="text-align:left;display:block;margin-bottom:5px">Confirmer le PIN</label>
            <input type="password" id="cpNewPin2" maxlength="6" inputmode="numeric" placeholder="••••••"
              style="width:100%;text-align:center;font-size:24px;letter-spacing:12px;padding:12px;border:1.5px solid var(--border);border-radius:12px;font-weight:700;background:var(--card);color:var(--text);box-sizing:border-box"
              onkeydown="if(event.key==='Enter')cpSavePatronPin()">
            <div id="cpPinSetupError" style="color:#ef4444;font-size:12px;margin:8px 0;min-height:16px"></div>
            <button onclick="cpSavePatronPin()" style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit">
              <i class="fas fa-save"></i> Enregistrer le PIN
            </button>
          </div>
        </div>
      </div>
    `);
  }

  window.cpConfirmPatronPin = function () {
    const pin = document.getElementById('cpPatronPinInput')?.value.trim();
    const stored = cpGetPatronPin();
    const errEl = document.getElementById('cpPatronPinError');
    if (!pin) { if (errEl) errEl.textContent = 'Entrez votre PIN'; return; }
    if (pin === stored) {
      if (window.closeModal) window.closeModal('cpPatronPinModal');
      if (window.closeModal) window.closeModal('cmIdentityModal');
      const cm = window.CM_DEBUG;
      if (cm) { cm.activeRole = 'patron'; cm.activeEmployee = null; }
      if (typeof window.cmUpdateRoleBadge === 'function') window.cmUpdateRoleBadge();
      if (typeof window.cmRenderAll === 'function') window.cmRenderAll();
      cpDeactivateEmployeeMode();
      CP.toast('Bienvenue Patron 👑', 'success');
    } else {
      if (errEl) { errEl.textContent = 'PIN incorrect ❌'; setTimeout(() => { errEl.textContent = ''; }, 2000); }
      if (document.getElementById('cpPatronPinInput')) {
        document.getElementById('cpPatronPinInput').value = '';
        document.getElementById('cpPatronPinInput').focus();
      }
    }
  };

  window.cpSetupPatronPin = function () {
    if (window.closeModal) window.closeModal('cpPatronPinModal');
    document.getElementById('cpNewPin1').value = '';
    document.getElementById('cpNewPin2').value = '';
    document.getElementById('cpPinSetupError').textContent = '';
    if (window.openModal) window.openModal('cpPatronPinSetupModal');
  };

  window.cpSavePatronPin = function () {
    const p1 = document.getElementById('cpNewPin1')?.value.trim();
    const p2 = document.getElementById('cpNewPin2')?.value.trim();
    const errEl = document.getElementById('cpPinSetupError');
    if (!p1 || p1.length < 4) { if (errEl) errEl.textContent = 'Minimum 4 chiffres'; return; }
    if (p1 !== p2) { if (errEl) errEl.textContent = 'Les PIN ne correspondent pas'; return; }
    if (!/^\d+$/.test(p1)) { if (errEl) errEl.textContent = 'Chiffres uniquement'; return; }
    localStorage.setItem(CP_PATRON_PIN_KEY, p1);
    if (window.closeModal) window.closeModal('cpPatronPinSetupModal');
    CP.toast('Code PIN Patron enregistré ✓', 'success');
    // Accorder l'accès Patron directement
    const cm = window.CM_DEBUG;
    if (cm) { cm.activeRole = 'patron'; cm.activeEmployee = null; }
    if (window.closeModal) window.closeModal('cmIdentityModal');
    cpDeactivateEmployeeMode();
  };

  function hookCmShowPatronPinEntry() {
    const orig = window.cmShowPatronPinEntry;
    if (typeof orig !== 'function' || orig._cpHooked) return;
    window.cmShowPatronPinEntry = function () {
      injectPatronPinModal();
      const stored = cpGetPatronPin();
      const label   = document.getElementById('cpPatronPinLabel');
      const inputEl = document.getElementById('cpPatronPinInput');
      const errEl   = document.getElementById('cpPatronPinError');
      const setupBtn= document.getElementById('cpPatronPinSetupBtn');

      if (errEl) errEl.textContent = '';

      if (!stored) {
        // Pas de PIN encore — accès direct + proposition de créer un
        if (label) label.textContent = 'Aucun code PIN défini.';
        if (inputEl) inputEl.style.display = 'none';
        if (setupBtn) setupBtn.style.display = 'block';
        // Modifier temporairement le bouton Confirmer pour accès direct
        const confirmBtn = document.querySelector('#cpPatronPinModal [onclick="cpConfirmPatronPin()"]');
        if (confirmBtn) {
          confirmBtn.innerHTML = '<i class="fas fa-crown"></i> Accéder sans PIN';
          confirmBtn.onclick = () => {
            if (window.closeModal) window.closeModal('cpPatronPinModal');
            orig.apply(window, arguments);
          };
        }
      } else {
        if (label) label.textContent = 'Entrez votre code PIN Patron';
        if (inputEl) { inputEl.style.display = ''; inputEl.value = ''; }
        if (setupBtn) setupBtn.style.display = 'none';
        const confirmBtn = document.querySelector('#cpPatronPinModal [onclick="cpConfirmPatronPin()"]');
        if (confirmBtn) {
          confirmBtn.innerHTML = '<i class="fas fa-unlock"></i> Confirmer';
          confirmBtn.onclick = window.cpConfirmPatronPin;
        }
        setTimeout(() => inputEl?.focus(), 200);
      }
      if (window.openModal) window.openModal('cpPatronPinModal');
    };
    window.cmShowPatronPinEntry._cpHooked = true;
  }

  /* ── Watcher rôle (filet de sécurité) ── */
  function watchEmployeeRole() {
    let _last = null; // null = pas encore initialisé
    setInterval(() => {
      const cm = window.CM_DEBUG;
      if (!cm) return;
      const role = cm.activeRole || 'patron';
      if (role === _last) return;
      _last = role;
      if (role !== 'patron') {
        cpActivateEmployeeMode();
      } else {
        cpDeactivateEmployeeMode();
      }
    }, 600);
  }

  function injectLockCSS() {
    if (document.getElementById('cp-lock-css')) return;
    const s = document.createElement('style');
    s.id = 'cp-lock-css';
    s.textContent = `
/* ── Mode employé : navigation verrouillée ── */
body.cp-employee-mode #bnav-dashboard,
body.cp-employee-mode #bnav-revenus,
body.cp-employee-mode #bnav-depenses,
body.cp-employee-mode #bnav-epargne,
body.cp-employee-mode #bnav-more {
  opacity:.28 !important;
  pointer-events:none !important;
  filter:grayscale(1);
}
body.cp-employee-mode .sidebar-link:not(#sb-commerce) {
  opacity:.28 !important;
  pointer-events:none !important;
  filter:grayscale(1);
}
body.cp-employee-mode .tab-btn:not([data-tab="commerce"]) {
  opacity:.28 !important;
  pointer-events:none !important;
}
/* Bandeau session employé */
#cpEmployeeBanner {
  display:none;
  position:fixed;
  top:0;left:0;right:0;
  z-index:3000;
  background:linear-gradient(135deg,#1d4ed8,#2563eb);
  color:#fff;
  padding:9px 14px;
  font-size:12.5px;
  font-weight:700;
  align-items:center;
  gap:8px;
  box-shadow:0 2px 14px rgba(37,99,235,.45);
}
#cpEmployeeBanner.show { display:flex; }
#cpBannerName { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#cpBannerShop { font-size:11px; opacity:.8; flex-shrink:0; }
.cp-banner-exit {
  background:rgba(255,255,255,.18);
  border:none;border-radius:8px;
  color:#fff;padding:5px 11px;
  font-size:11.5px;font-weight:700;
  cursor:pointer;font-family:inherit;
  flex-shrink:0;
  transition:background .15s;
}
.cp-banner-exit:hover { background:rgba(255,255,255,.3); }
/* Décaler l'app pour ne pas être sous le bandeau */
body.cp-employee-mode #app,
body.cp-employee-mode #authScreen { margin-top:38px; }
/* Overlay blocage */
#cpLockOverlay {
  display:none;
  position:fixed;inset:0;
  z-index:2500;
  background:rgba(15,23,42,.65);
  align-items:center;justify-content:center;
  backdrop-filter:blur(5px);
}
#cpLockOverlay.show { display:flex; }
#cpLockOverlayBox {
  background:var(--card,#fff);
  border-radius:22px;padding:28px 22px;
  max-width:300px;width:88%;
  text-align:center;
  box-shadow:0 20px 60px rgba(0,0,0,.28);
  animation:cpSlideIn .25s ease;
}
#cpLockOverlayBox .cp-lo-icon { font-size:44px;margin-bottom:10px; }
#cpLockOverlayBox h3 { margin:0 0 7px;font-size:17px;font-weight:800;color:var(--text); }
#cpLockOverlayBox p  { margin:0 0 18px;font-size:13px;color:var(--muted);line-height:1.55; }
    `;
    document.head.appendChild(s);
  }

  function injectLockElements() {
    if (!document.getElementById('cpEmployeeBanner')) {
      document.body.insertAdjacentHTML('afterbegin', `
        <div id="cpEmployeeBanner">
          <i class="fas fa-user-shield"></i>
          <span id="cpBannerName">Session employé</span>
          <span id="cpBannerShop"></span>
          <button class="cp-banner-exit" onclick="cpExitEmployeeMode()">
            <i class="fas fa-right-from-bracket"></i> Quitter
          </button>
        </div>
      `);
    }
    if (!document.getElementById('cpLockOverlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="cpLockOverlay" onclick="document.getElementById('cpLockOverlay').classList.remove('show')">
          <div id="cpLockOverlayBox">
            <div class="cp-lo-icon">🔒</div>
            <h3>Accès restreint</h3>
            <p>Vous êtes connecté en tant qu'<strong>employé</strong>.<br>
               Seul le module <strong>Commerce</strong> est accessible.</p>
            <button onclick="cpGoToCommerce()" style="width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:13px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;">
              <i class="fas fa-store"></i> Retourner au Commerce
            </button>
          </div>
        </div>
      `);
    }
  }
  function hookSwitchTabForLock() {
    // Déjà géré dans hookAllNavForLock() — cette fonction
    // sert juste de point d'entrée unifié appelé dans cpInit
    hookAllNavForLock();
  }

  /* ═══════════════════════════════════════════════════════════
   * 26. INIT PRINCIPAL
   * ═══════════════════════════════════════════════════════════ */
  function cpInit() {
    cpLoad();
    injectCSS();

    const tryInject = (attempt = 0) => {
      if (document.getElementById('tab-commerce')) {
        injectTabs();
        injectSections();
        injectEmployeeLinkGenerator(); // ← Générateur de lien employé
        hookCmSwitch();
        hookGlobalSwitchTab();
        hookSwitchTabForLock();       // ← Bloquer nav hors Commerce
        hookCmIdentityPin();          // ← Activer verrou après PIN employé
        hookCmShowPatronPinEntry();   // ← PIN Patron obligatoire
        injectPatronPinModal();       // ← Injecter modals PIN Patron
        injectSearchBtn();
        syncFabVisibility();
        watchEmployeeRole();          // ← Surveillance rôle temps réel

        // ► Restaurer session depuis localStorage (survie rechargement/lien)
        cpRestoreSessionInCM();

        if (CP.uid_user()) {
          cpLoadRemote().then(() => cpRenderDashboard());
        }

        const observer = new MutationObserver(() => syncFabVisibility());
        const tabEl = document.getElementById('tab-commerce');
        if (tabEl) observer.observe(tabEl, { attributes: true, attributeFilter: ['class'] });

      } else if (attempt < 30) {
        setTimeout(() => tryInject(attempt + 1), 200);
      }
    };
    tryInject();
  }

  let _cpLastUid = null;
  setInterval(() => {
    const uid = CP.uid_user();
    if (uid !== _cpLastUid) {
      _cpLastUid = uid;
      cpLoad();
      if (uid) cpLoadRemote();
    }
    // Re-appliquer les hooks si l'app a été rechargée
    hookCmIdentityPin();
    hookCmShowPatronPinEntry();
  }, 2000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForCM(cpInit));
  } else {
    waitForCM(cpInit);
  }

  window.AET_COMMERCE_PRO = {
    version: '3.2.0',
    data: CPData,
    reload: () => { cpLoad(); cpRenderDashboard(); },
    openSearch: () => window.cpOpenSearch(),
    switchTo: (sec) => window.cpSwitchPro(sec),
    lockEmployee:   () => cpActivateEmployeeMode(),
    unlockEmployee: () => cpDeactivateEmployeeMode(),
    isEmployee:     () => cpIsEmployeeSession(),
    changePatronPin: () => { injectPatronPinModal(); window.cpSetupPatronPin(); },
  };

  console.log('[AET Commerce Pro v3.4.0] ✓ | Lien employé + PWA install actifs');

  /* ═══════════════════════════════════════════════════════════
   * 0B. LIEN EMPLOYÉ — URL params + mode kiosque
   *
   * Format du lien :
   *   https://alban3886.github.io/togosheets-pro/
   *     ?mode=employee
   *     &shop=SHOP_ID
   *     &name=Koffi
   *     &role=employee          (ou manager)
   *     &token=TOKEN_SECRET
   *
   * Généré par le Patron depuis le module Commerce.
   * Quand ce lien est ouvert :
   *  1. Le CSS de verrou est appliqué immédiatement
   *  2. Après auth Firebase, la session employé est injectée dans CM
   *  3. L'app s'ouvre directement sur Commerce, sidebar verrouillée
   *  4. Le bouton "Installer" (PWA) est proposé automatiquement
   * ═══════════════════════════════════════════════════════════ */

  const CP_URL_PARAMS = (function() {
    try {
      const p = new URLSearchParams(window.location.search);
      return {
        mode:   p.get('mode')   || null,   // 'employee'
        shop:   p.get('shop')   || null,   // shopId
        name:   p.get('name')   || null,   // nom employé
        role:   p.get('role')   || 'employee',
        token:  p.get('token')  || null,   // token de validation
      };
    } catch(e) { return {}; }
  })();

  const CP_IS_EMPLOYEE_LINK = CP_URL_PARAMS.mode === 'employee' && !!CP_URL_PARAMS.shop;

  // Si lien employé détecté → verrouiller immédiatement
  if (CP_IS_EMPLOYEE_LINK) {
    cpInjectEarlyLock();
    if (document.body) {
      document.body.classList.add('cp-locked-early', 'cp-employee-mode');
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('cp-locked-early', 'cp-employee-mode');
      }, { once: true });
    }
    // Sauvegarder la session depuis l'URL
    cpWriteSession({
      role:         CP_URL_PARAMS.role,
      employeeName: CP_URL_PARAMS.name || 'Employé',
      employeeId:   'link_' + (CP_URL_PARAMS.name || 'emp'),
      shopId:       CP_URL_PARAMS.shop,
      shopName:     '',
      fromLink:     true,
      token:        CP_URL_PARAMS.token,
      lockedAt:     Date.now(),
    });
  }

  /* ═══════════════════════════════════════════════════════════
   * 0C. PWA INSTALL — Bouton d'installation Android/PC
   * ═══════════════════════════════════════════════════════════ */
  let _cpDeferredInstallPrompt = null;
  let _cpInstallBtnInjected    = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _cpDeferredInstallPrompt = e;
    // Afficher le bouton d'installation si on est en mode employé ou dans Commerce
    cpShowInstallBtn();
  });

  window.addEventListener('appinstalled', () => {
    _cpDeferredInstallPrompt = null;
    const btn = document.getElementById('cpInstallBanner');
    if (btn) btn.remove();
  });

  function cpShowInstallBtn() {
    if (_cpInstallBtnInjected || !_cpDeferredInstallPrompt) return;
    _cpInstallBtnInjected = true;

    // Injecter le bandeau d'installation
    const banner = document.createElement('div');
    banner.id = 'cpInstallBanner';
    banner.style.cssText = `
      position:fixed; bottom:72px; left:12px; right:12px;
      background:linear-gradient(135deg,#1d4ed8,#2563eb);
      color:#fff; border-radius:16px; padding:14px 16px;
      display:flex; align-items:center; gap:12px;
      box-shadow:0 8px 28px rgba(37,99,235,.45);
      z-index:9990; animation:cpSlideIn .3s ease;
      font-family:inherit;
    `;
    banner.innerHTML = `
      <div style="font-size:26px">📲</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13.5px">Installer l'application</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:2px">Accès rapide depuis l'écran d'accueil</div>
      </div>
      <button onclick="cpTriggerInstall()" style="background:rgba(255,255,255,.2);border:none;border-radius:10px;color:#fff;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;flex-shrink:0">
        Installer
      </button>
      <button onclick="document.getElementById('cpInstallBanner').remove()" style="background:transparent;border:none;color:rgba(255,255,255,.6);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
    `;
    document.body.appendChild(banner);
    // Auto-fermeture après 12s si pas d'action
    setTimeout(() => banner.remove(), 12000);
  }

  window.cpTriggerInstall = async function () {
    if (!_cpDeferredInstallPrompt) return;
    _cpDeferredInstallPrompt.prompt();
    const { outcome } = await _cpDeferredInstallPrompt.userChoice;
    _cpDeferredInstallPrompt = null;
    document.getElementById('cpInstallBanner')?.remove();
    if (outcome === 'accepted') {
      CP.toast('Application installée avec succès ! 🎉', 'success');
    }
  };

})();
