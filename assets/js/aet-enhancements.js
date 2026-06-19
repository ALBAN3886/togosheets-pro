import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc,
  query, where, onSnapshot, orderBy, serverTimestamp, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * Extension non destructive pour AET MonBudget.
 * Le but est d'ajouter des modules autour de l'index existant
 * sans supprimer les fonctions historiques déjà présentes.
 */
(function(){
  const firebaseConfig = window.__AET_FIREBASE_CONFIG__;
  if (!firebaseConfig) {
    console.warn('AET enhancements: firebase config not found');
    return;
  }

  const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = window.__AET_AUTH__ || getAuth(app);
  const db   = window.__AET_DB__ || getFirestore(app);

  const state = {
    uid: null,
    user: null,
    userDoc: null,
    isAdmin: false,
    tx: [],
    budgets: [],
    goals: [],
    debts: [],
    bills: [],
    family: [],
    logins: [],
    premiumRequests: [],
    users: []
  };
  const unsubscribers = [];

  const fmt = (n) => typeof window.fmt === 'function'
    ? window.fmt(Number(n || 0))
    : new Intl.NumberFormat('fr-FR').format(Number(n || 0)) + ' XOF';

  const todayISO = () => new Date().toISOString().slice(0,10);
  const monthKey = (date = new Date()) => {
    if (typeof date === 'string') return date.slice(0,7);
    return new Date(date).toISOString().slice(0,7);
  };
  const currentMonth = () => monthKey(new Date());
  const previousMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return monthKey(d);
  };
  const daysInMonth = (ym = currentMonth()) => {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };
  const elapsedDayInMonth = (ym = currentMonth()) => {
    const now = new Date();
    return monthKey(now) === ym ? now.getDate() : daysInMonth(ym);
  };
  const sum = (arr, fn = v => v) => arr.reduce((acc, item) => acc + Number(fn(item) || 0), 0);
  const esc = (v='') => String(v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  const notify = (msg, type='info') => window.toast ? window.toast(msg, type) : console.log(msg);
  const byUser = (name) => query(collection(db, name), where('userId', '==', state.uid));

  function cleanupSubs() {
    while (unsubscribers.length) {
      const fn = unsubscribers.pop();
      try { fn && fn(); } catch (_) {}
    }
  }

  function observe(q, key, mapper = d => ({ id:d.id, ...d.data() }), cb = renderAllModules) {
    const unsub = onSnapshot(q, snap => {
      state[key] = snap.docs.map(mapper);
      cb();
    }, err => console.warn('watch error', key, err));
    unsubscribers.push(unsub);
  }

  function safeParentForTabs() {
    return document.getElementById('tab-dashboard')?.parentElement || document.getElementById('app');
  }

  function appendHTML(target, html, position = 'beforeend') {
    if (target) target.insertAdjacentHTML(position, html);
  }

  function injectBaseUI() {
    if (document.getElementById('aetx-smart-dashboard')) return;

    const resume = document.getElementById('dp-resume');
    if (resume) {
      appendHTML(resume, `
        <section class="aetx-section" id="aetx-smart-dashboard">
          <div class="aetx-section-title">
            <div>
              <div class="aetx-kicker">Intelligence financière</div>
              <h3>Tableau de bord avancé</h3>
            </div>
            <span class="aetx-chip"><i class="fas fa-wand-magic-sparkles"></i> Prévisions & alertes</span>
          </div>
          <div id="aetx-dashboard-content"></div>
        </section>
      `, 'afterbegin');
    }

    addNavigationEntry('dettes', 'Dettes & créances', 'fa-hand-holding-dollar', '#f59e0b');
    addNavigationEntry('factures', 'Factures récurrentes', 'fa-bolt', '#06b6d4');
    addNavigationEntry('rapports', 'Rapports avancés', 'fa-file-invoice', '#7c3aed');
    addNavigationEntry('famille', 'Gestion familiale', 'fa-people-roof', '#10b981');
    addNavigationEntry('adminplus', 'Administration +', 'fa-shield-halved', '#ef4444');

    createTab('dettes', 'Dettes & créances');
    createTab('factures', 'Factures récurrentes');
    createTab('rapports', 'Rapports avancés');
    createTab('famille', 'Gestion familiale');
    createTab('adminplus', 'Administration');

    injectSettingsBlock();
    injectSecurityBlock();
    injectBackupBlock();
    wrapNavigation();
  }

  function addNavigationEntry(tab, label, icon, color) {
    const sidebar = document.getElementById('sb-profil')?.parentElement;
    const drawer  = document.getElementById('bnavDrawer')?.querySelector('.bnav-drawer-grid');
    const menu    = document.getElementById('mm-commerce')?.parentElement;
    const tabsNav = document.querySelector('.tabs-nav');

    if (sidebar && !document.getElementById('sb-' + tab)) {
      appendHTML(sidebar, `<div class="sidebar-link" id="sb-${tab}" onclick="mainMenuSwitch('${tab}','${label}','${icon}')" style="--sb-ic:${color}"><i class="fas ${icon}"></i><span>${label}</span></div>`);
    }
    if (menu && !document.getElementById('mm-' + tab)) {
      appendHTML(menu, `<div class="main-menu-item" id="mm-${tab}" onclick="mainMenuSwitch('${tab}','${label}','${icon}')"><i class="fas ${icon}"></i><span>${label}</span></div>`);
    }
    if (drawer && !document.getElementById('bnd-' + tab)) {
      appendHTML(drawer, `<div class="bnav-drawer-item" id="bnd-${tab}" onclick="switchTab('${tab}');closeBnavDrawer()"><i class="fas ${icon}"></i>${label}</div>`, 'afterbegin');
    }
    if (tabsNav && !tabsNav.querySelector(`[data-tab="${tab}"]`)) {
      appendHTML(tabsNav, `<button class="tab-btn" data-tab="${tab}" onclick="switchTab('${tab}')"><i class="fas ${icon}"></i><span>${label}</span></button>`);
    }
    if (Array.isArray(window.ALL_MENU_TABS) && !window.ALL_MENU_TABS.includes(tab)) {
      window.ALL_MENU_TABS.push(tab);
    }
  }

  function createTab(tab, title) {
    const host = safeParentForTabs();
    if (!host || document.getElementById('tab-' + tab)) return;
    appendHTML(host, `
      <div id="tab-${tab}" class="tab-content">
        <section class="aetx-section">
          <div class="aetx-section-title">
            <div>
              <div class="aetx-kicker">Module avancé</div>
              <h2>${title}</h2>
            </div>
          </div>
          <div id="aetx-${tab}-content"></div>
        </section>
      </div>
    `);
  }

  function injectSettingsBlock() {
    const modalBody = document.querySelector('#settingsModal .aet-modal-body');
    if (!modalBody || document.getElementById('aetx-settings-extra')) return;
    appendHTML(modalBody, `
      <div id="aetx-settings-extra" class="aetx-section aetx-mt">
        <div class="aetx-section-title"><h3>Notifications & sauvegarde intelligente</h3></div>
        <div class="aetx-toggle-row">
          <div><strong>Push navigateur</strong><div class="aetx-small">Active la permission Notification pour les rappels de budget, factures et objectifs.</div></div>
          <button class="aetx-btn soft" onclick="window.aetxRequestPushPermission()">Activer</button>
        </div>
        <div class="aetx-toggle-row">
          <div><strong>Mode sombre rapide</strong><div class="aetx-small">Bascule moderne clair / sombre sans toucher au thème historique.</div></div>
          <div class="aetx-actions" style="margin-top:0">
            <button class="aetx-btn soft" onclick="window.aetxSetTheme('light')">Clair</button>
            <button class="aetx-btn soft" onclick="window.aetxSetTheme('dark')">Sombre</button>
          </div>
        </div>
      </div>
    `);
  }

  function injectSecurityBlock() {
    const modalBody = document.querySelector('#securityModal .aet-modal-body');
    if (!modalBody || document.getElementById('aetx-security-extra')) return;
    appendHTML(modalBody, `
      <div id="aetx-security-extra" class="aetx-section aetx-mt">
        <div class="aetx-section-title"><h3>Sécurité renforcée</h3></div>
        <div class="aetx-note">Le PIN et la biométrie existants sont conservés. Cette extension ajoute le journal des connexions, l'inventaire des appareils récents et la préparation 2FA côté Firebase / Cloud Functions.</div>
        <div id="aetx-security-devices" class="aetx-mt"></div>
      </div>
    `);
  }

  function injectBackupBlock() {
    const modalBody = document.querySelector('#backupModal .aet-modal-body');
    if (!modalBody || document.getElementById('aetx-backup-extra')) return;
    appendHTML(modalBody, `
      <div id="aetx-backup-extra" class="aetx-section aetx-mt">
        <div class="aetx-section-title"><h3>Restauration rapide</h3></div>
        <div class="aetx-actions">
          <button class="aetx-btn primary" onclick="window.aetxCreateSnapshot()">Créer une sauvegarde instantanée</button>
          <button class="aetx-btn soft" onclick="window.aetxRestoreSnapshot()">Restaurer la dernière sauvegarde</button>
        </div>
        <div class="aetx-small aetx-mt">Les données de synthèse sont sauvegardées dans Firestore et localStorage pour accélérer la reprise hors ligne.</div>
      </div>
    `);
  }

  function wrapNavigation() {
    if (window.__AETX_NAV_WRAPPED__) return;
    const original = window.switchTab;
    if (typeof original === 'function') {
      window.switchTab = function(tab) {
        original(tab);
        renderTab(tab);
      };
      window.__AETX_NAV_WRAPPED__ = true;
    }
  }

  function monthStats(ym = currentMonth()) {
    const arr = state.tx.filter(t => (t.date || '').slice(0,7) === ym);
    const incomes = sum(arr.filter(t => t.flow === 'in'), t => t.amount);
    const expenses = sum(arr.filter(t => t.flow === 'out'), t => t.amount);
    const savings = sum(arr.filter(t => t.flow === 'save'), t => t.amount);
    return { ym, arr, incomes, expenses, savings, balance: incomes - expenses - savings };
  }

  function topCategories(month = currentMonth()) {
    const map = {};
    state.tx
      .filter(t => t.flow === 'out' && (t.date || '').startsWith(month))
      .forEach(t => map[t.category || 'Autres'] = (map[t.category || 'Autres'] || 0) + Number(t.amount || 0));
    return Object.entries(map).sort((a,b) => b[1] - a[1]);
  }

  function buildInsights() {
    const now = monthStats(currentMonth());
    const prev = monthStats(previousMonth());
    const top = topCategories(currentMonth());
    const dailyOut = now.expenses / Math.max(1, elapsedDayInMonth(currentMonth()));
    const forecastOut = dailyOut * daysInMonth(currentMonth());
    const dailyIn = now.incomes / Math.max(1, elapsedDayInMonth(currentMonth()));
    const forecastIn = Math.max(now.incomes, dailyIn * daysInMonth(currentMonth()));
    const forecastEnd = forecastIn - forecastOut - now.savings;
    const overBudgets = state.budgets.map(b => {
      const spent = sum(now.arr.filter(t => t.flow === 'out' && t.category === b.cat), t => t.amount);
      const pct = b.limit ? (spent / b.limit) * 100 : 0;
      return { ...b, spent, pct };
    }).filter(b => b.pct >= 80).sort((a,b)=>b.pct-a.pct);
    const goalProgress = state.goals.map(g => {
      const pct = g.target ? Math.min(100, Math.round(((g.saved || 0) / g.target) * 100)) : 0;
      return { ...g, pct };
    }).sort((a,b)=>b.pct-a.pct);
    const expensiveShift = prev.expenses ? ((now.expenses - prev.expenses) / prev.expenses) * 100 : 0;
    const insights = [];
    if (expensiveShift > 15) insights.push(`Les dépenses du mois augmentent de ${expensiveShift.toFixed(0)}% par rapport au mois précédent.`);
    if (top[0]) insights.push(`Le poste le plus lourd est ${top[0][0]} avec ${fmt(top[0][1])}.`);
    if (forecastEnd < 0) insights.push(`À ce rythme, le solde de fin de mois risque d'être négatif (${fmt(forecastEnd)}).`);
    if (!insights.length) insights.push('La trajectoire du mois reste saine. Continuez à alimenter vos objectifs d’épargne.');
    const weekly = buildWeeklySummary(now.arr);
    return { now, prev, top, forecastOut, forecastIn, forecastEnd, overBudgets, goalProgress, insights, weekly };
  }

  function buildWeeklySummary(arr) {
    const buckets = Array.from({ length: 4 }, (_, i) => ({ label: 'S' + (i + 1), in: 0, out: 0 }));
    arr.forEach(t => {
      const d = new Date(t.date || todayISO());
      const slot = Math.min(3, Math.floor((d.getDate() - 1) / 7));
      if (t.flow === 'out') buckets[slot].out += Number(t.amount || 0);
      if (t.flow === 'in')  buckets[slot].in  += Number(t.amount || 0);
    });
    return buckets;
  }

  function renderDashboard() {
    const host = document.getElementById('aetx-dashboard-content');
    if (!host) return;
    const info = buildInsights();
    host.innerHTML = `
      <div class="aetx-grid aetx-mb">
        <article class="aetx-card"><h4>Prévision fin de mois</h4><div class="value ${info.forecastEnd >= 0 ? 'aetx-trend-up' : 'aetx-trend-down'}">${fmt(info.forecastEnd)}</div><div class="sub">Projection automatique basée sur le rythme journalier.</div></article>
        <article class="aetx-card"><h4>Dépenses projetées</h4><div class="value">${fmt(info.forecastOut)}</div><div class="sub">Rythme moyen observé ce mois-ci.</div></article>
        <article class="aetx-card"><h4>Résumé mensuel</h4><div class="value">${fmt(info.now.balance)}</div><div class="sub">Revenus ${fmt(info.now.incomes)} • Dépenses ${fmt(info.now.expenses)}</div></article>
        <article class="aetx-card"><h4>Objectifs d'épargne</h4><div class="value">${state.goals.length}</div><div class="sub">${state.goals.filter(g => (g.saved || 0) >= (g.target || 0) && g.target).length} finalisés</div></article>
      </div>
      <div class="aetx-split">
        <div class="aetx-card">
          <div class="aetx-section-title" style="margin-bottom:10px"><h3>Analyse intelligente des dépenses</h3><span class="aetx-chip warn"><i class="fas fa-chart-column"></i> Top catégories</span></div>
          <div class="aetx-list">
            ${info.top.length ? info.top.slice(0,5).map(([cat, amount], idx) => `
              <div class="aetx-list-item">
                <div><h5>${idx + 1}. ${esc(cat)}</h5><p>${amount > (info.now.expenses * 0.25) ? 'Poste fortement consommateur.' : 'Niveau maîtrisé.'}</p></div>
                <div class="aetx-amount neg">${fmt(amount)}</div>
              </div>`).join('') : '<div class="aetx-empty">Aucune dépense analysable pour le mois sélectionné.</div>'}
          </div>
          <div class="aetx-note aetx-mt">${esc(info.insights.join(' • '))}</div>
        </div>
        <div class="aetx-card">
          <div class="aetx-section-title" style="margin-bottom:10px"><h3>Résumé hebdomadaire</h3><span class="aetx-chip success"><i class="fas fa-calendar-week"></i> 4 semaines</span></div>
          <div class="aetx-mini-chart">
            ${info.weekly.map(w => {
              const max = Math.max(1, ...info.weekly.map(x => x.out));
              const h = Math.max(18, (w.out / max) * 88);
              return `<div class="aetx-bar" style="height:${h}px"><span>${fmt(w.out)}</span><em>${w.label}</em></div>`;
            }).join('')}
          </div>
          <div class="aetx-small aetx-mt">Chaque barre représente les sorties hebdomadaires. Le résumé mensuel se met à jour automatiquement.</div>
        </div>
      </div>
      <div class="aetx-grid aetx-mt">
        <div class="aetx-card">
          <div class="aetx-section-title" style="margin-bottom:10px"><h3>Alertes personnalisées</h3></div>
          ${info.overBudgets.length ? info.overBudgets.map(b => `<div class="aetx-list-item"><div><h5>${esc(b.cat)}</h5><p>${Math.round(b.pct)}% du budget consommé.</p></div><span class="aetx-chip ${b.pct >= 100 ? 'danger' : 'warn'}">${fmt(b.spent)} / ${fmt(b.limit)}</span></div>`).join('') : '<div class="aetx-empty">Aucune alerte budget critique.</div>'}
        </div>
        <div class="aetx-card">
          <div class="aetx-section-title" style="margin-bottom:10px"><h3>Objectifs d'épargne</h3></div>
          ${info.goalProgress.length ? info.goalProgress.slice(0,4).map(g => `<div class="aetx-mb"><div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(g.name || 'Objectif')}</strong><span class="aetx-small">${g.pct}%</span></div><div class="aetx-progress"><span style="width:${g.pct}%"></span></div><div class="aetx-small">${fmt(g.saved || 0)} / ${fmt(g.target || 0)}</div></div>`).join('') : '<div class="aetx-empty">Aucun objectif enregistré.</div>'}
        </div>
      </div>
    `;
  }

  function debtStatus(d) {
    if ((d.repaidAmount || 0) >= (d.amount || 0)) return 'closed';
    if (d.dueDate && d.dueDate < todayISO()) return 'overdue';
    return 'open';
  }

  function renderDebts() {
    const host = document.getElementById('aetx-dettes-content');
    if (!host) return;
    const openTotal = sum(state.debts.filter(d => d.type === 'debt' && debtStatus(d) !== 'closed'), d => (d.amount || 0) - (d.repaidAmount || 0));
    const claimTotal = sum(state.debts.filter(d => d.type === 'claim' && debtStatus(d) !== 'closed'), d => (d.amount || 0) - (d.repaidAmount || 0));
    host.innerHTML = `
      <div class="aetx-grid aetx-mb">
        <div class="aetx-card"><h4>Dettes ouvertes</h4><div class="value aetx-trend-down">${fmt(openTotal)}</div></div>
        <div class="aetx-card"><h4>Créances à récupérer</h4><div class="value aetx-trend-up">${fmt(claimTotal)}</div></div>
        <div class="aetx-card"><h4>Échéances proches</h4><div class="value">${state.debts.filter(d => debtStatus(d) !== 'closed' && d.dueDate && d.dueDate <= todayISO()).length}</div></div>
        <div class="aetx-card"><h4>Historique remboursements</h4><div class="value">${state.debts.filter(d => (d.repaidAmount || 0) > 0).length}</div></div>
      </div>
      <div class="aetx-split">
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Ajouter une dette ou créance</h3></div>
          <div class="aetx-form-grid">
            <div><label class="aetx-label">Type</label><select id="aetxDebtType" class="aetx-select"><option value="debt">Dette personnelle</option><option value="claim">Personne qui me doit</option></select></div>
            <div><label class="aetx-label">Nom / personne</label><input id="aetxDebtPerson" class="aetx-input" placeholder="Ex: Kossi Mensah"></div>
            <div><label class="aetx-label">Montant</label><input id="aetxDebtAmount" class="aetx-input" type="number" min="0" placeholder="50000"></div>
            <div><label class="aetx-label">Échéance</label><input id="aetxDebtDue" class="aetx-input" type="date"></div>
            <div style="grid-column:1/-1"><label class="aetx-label">Note</label><textarea id="aetxDebtNote" class="aetx-textarea" placeholder="Détails du remboursement, fréquence, rappel..."></textarea></div>
          </div>
          <div class="aetx-actions"><button class="aetx-btn primary" onclick="window.aetxSaveDebt()">Enregistrer</button></div>
        </div>
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Suivi & rappels</h3></div>
          <div class="aetx-list">
            ${state.debts.length ? state.debts.map(d => {
              const st = debtStatus(d);
              const remaining = Math.max(0, (d.amount || 0) - (d.repaidAmount || 0));
              return `<div class="aetx-list-item"><div><h5>${esc(d.person || 'Sans nom')}</h5><p>${d.type === 'debt' ? 'Dette' : 'Créance'} • Échéance ${esc(d.dueDate || '—')}<br>${esc(d.note || '')}</p></div><div style="text-align:right"><div class="aetx-pill-status ${st}">${st === 'closed' ? 'soldé' : st === 'overdue' ? 'en retard' : 'ouvert'}</div><div class="aetx-amount ${d.type === 'debt' ? 'neg' : 'pos'}" style="margin-top:6px">${fmt(remaining)}</div><div class="aetx-actions" style="justify-content:flex-end;margin-top:8px"><button class="aetx-btn soft" onclick="window.aetxRegisterPayment('${d.id}')">Remboursement</button><button class="aetx-btn danger" onclick="window.aetxDeleteDebt('${d.id}')">Supprimer</button></div></div></div>`;
            }).join('') : '<div class="aetx-empty">Aucune dette ou créance.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderBills() {
    const host = document.getElementById('aetx-factures-content');
    if (!host) return;
    host.innerHTML = `
      <div class="aetx-grid aetx-mb">
        <div class="aetx-card"><h4>Factures actives</h4><div class="value">${state.bills.filter(b => b.active !== false).length}</div></div>
        <div class="aetx-card"><h4>Mensualité prévue</h4><div class="value">${fmt(sum(state.bills.filter(b => b.active !== false), b => b.amount))}</div></div>
        <div class="aetx-card"><h4>Paiement auto</h4><div class="value">${state.bills.filter(b => b.autopay).length}</div></div>
        <div class="aetx-card"><h4>Échéances aujourd'hui</h4><div class="value">${state.bills.filter(b => String(b.dueDay) === String(new Date().getDate())).length}</div></div>
      </div>
      <div class="aetx-split">
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Nouvelle facture récurrente</h3></div>
          <div class="aetx-form-grid">
            <div><label class="aetx-label">Libellé</label><input id="aetxBillLabel" class="aetx-input" placeholder="Électricité, Eau, Internet..."></div>
            <div><label class="aetx-label">Fournisseur</label><input id="aetxBillProvider" class="aetx-input" placeholder="CEET, TdE, Canal+"></div>
            <div><label class="aetx-label">Montant</label><input id="aetxBillAmount" class="aetx-input" type="number" min="0"></div>
            <div><label class="aetx-label">Jour d'échéance</label><input id="aetxBillDueDay" class="aetx-input" type="number" min="1" max="31"></div>
            <div><label class="aetx-label">Catégorie</label><input id="aetxBillCategory" class="aetx-input" placeholder="Logement / Communication"></div>
            <div><label class="aetx-label">Paiement auto</label><select id="aetxBillAutopay" class="aetx-select"><option value="yes">Oui</option><option value="no">Non</option></select></div>
          </div>
          <div class="aetx-actions"><button class="aetx-btn primary" onclick="window.aetxSaveBill()">Ajouter la facture</button></div>
        </div>
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Planning des paiements</h3></div>
          <div class="aetx-list">
            ${state.bills.length ? state.bills.map(b => `<div class="aetx-list-item"><div><h5>${esc(b.label)}</h5><p>${esc(b.provider || '')} • Jour ${esc(b.dueDay || '—')} • ${b.autopay ? 'Auto' : 'Manuel'}</p></div><div style="text-align:right"><div class="aetx-amount">${fmt(b.amount)}</div><div class="aetx-actions" style="justify-content:flex-end;margin-top:8px"><button class="aetx-btn success" onclick="window.aetxRunBillNow('${b.id}')">Payer</button><button class="aetx-btn danger" onclick="window.aetxDeleteBill('${b.id}')">Supprimer</button></div></div></div>`).join('') : '<div class="aetx-empty">Aucune facture récurrente configurée.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function buildReportHTML() {
    const now = monthStats(currentMonth());
    const prev = monthStats(previousMonth());
    const top = topCategories(currentMonth()).slice(0,5);
    return `
      <h1>AET MonBudget — Rapport avancé</h1>
      <p>Période : ${esc(currentMonth())}</p>
      <table border="1" cellspacing="0" cellpadding="8">
        <tr><th>Indicateur</th><th>Mois courant</th><th>Mois précédent</th></tr>
        <tr><td>Revenus</td><td>${esc(fmt(now.incomes))}</td><td>${esc(fmt(prev.incomes))}</td></tr>
        <tr><td>Dépenses</td><td>${esc(fmt(now.expenses))}</td><td>${esc(fmt(prev.expenses))}</td></tr>
        <tr><td>Épargne</td><td>${esc(fmt(now.savings))}</td><td>${esc(fmt(prev.savings))}</td></tr>
        <tr><td>Solde</td><td>${esc(fmt(now.balance))}</td><td>${esc(fmt(prev.balance))}</td></tr>
      </table>
      <h2>Top catégories</h2>
      <ul>${top.map(([cat, amount]) => `<li>${esc(cat)} : ${esc(fmt(amount))}</li>`).join('')}</ul>
    `;
  }

  function renderReports() {
    const host = document.getElementById('aetx-rapports-content');
    if (!host) return;
    const now = monthStats(currentMonth());
    const prev = monthStats(previousMonth());
    host.innerHTML = `
      <div class="aetx-admin-grid aetx-mb">
        <div class="aetx-card"><h4>Rapport annuel</h4><div class="value">${new Date().getFullYear()}</div><div class="sub">Synthèse automatique des 12 mois.</div></div>
        <div class="aetx-card"><h4>Comparaison mensuelle</h4><div class="value">${fmt(now.expenses - prev.expenses)}</div><div class="sub">Écart des dépenses vs mois précédent.</div></div>
        <div class="aetx-card"><h4>Exports</h4><div class="value">PDF / Excel</div><div class="sub">Téléchargement et impression directe.</div></div>
      </div>
      <div class="aetx-card aetx-mb">
        <div class="aetx-section-title"><h3>Comparer plusieurs mois</h3></div>
        <table class="aetx-table">
          <thead><tr><th>Mois</th><th>Revenus</th><th>Dépenses</th><th>Épargne</th><th>Solde</th></tr></thead>
          <tbody>
            ${Array.from(new Set(state.tx.map(t => (t.date || '').slice(0,7)).filter(Boolean))).sort().reverse().slice(0,6).map(ym => {
              const s = monthStats(ym);
              return `<tr><td>${esc(ym)}</td><td>${esc(fmt(s.incomes))}</td><td>${esc(fmt(s.expenses))}</td><td>${esc(fmt(s.savings))}</td><td>${esc(fmt(s.balance))}</td></tr>`;
            }).join('') || '<tr><td colspan="5">Aucune donnée</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="aetx-actions">
        <button class="aetx-btn primary" onclick="window.aetxExportPDF()">Exporter PDF</button>
        <button class="aetx-btn success" onclick="window.aetxExportExcel()">Exporter Excel</button>
        <button class="aetx-btn soft" onclick="window.aetxPrintReport()">Imprimer</button>
      </div>
    `;
  }

  function renderFamily() {
    const host = document.getElementById('aetx-famille-content');
    if (!host) return;
    host.innerHTML = `
      <div class="aetx-grid aetx-mb">
        <div class="aetx-card"><h4>Comptes secondaires</h4><div class="value">${state.family.length}</div></div>
        <div class="aetx-card"><h4>Budget familial</h4><div class="value">${fmt(sum(state.tx.filter(t => t.flow === 'out'), t => t.amount))}</div></div>
        <div class="aetx-card"><h4>Accès lecture</h4><div class="value">${state.family.filter(m => m.access === 'viewer').length}</div></div>
        <div class="aetx-card"><h4>Accès édition</h4><div class="value">${state.family.filter(m => m.access === 'editor').length}</div></div>
      </div>
      <div class="aetx-split">
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Ajouter un membre</h3></div>
          <div class="aetx-form-grid">
            <div><label class="aetx-label">Nom</label><input id="aetxFamilyName" class="aetx-input"></div>
            <div><label class="aetx-label">Email</label><input id="aetxFamilyEmail" class="aetx-input" type="email"></div>
            <div><label class="aetx-label">Rôle</label><select id="aetxFamilyRole" class="aetx-select"><option value="viewer">Lecture</option><option value="editor">Édition</option><option value="partner">Conjoint</option></select></div>
            <div><label class="aetx-label">Domaine partagé</label><input id="aetxFamilyScope" class="aetx-input" placeholder="Budget global, Dépenses conjoint..."></div>
          </div>
          <div class="aetx-actions"><button class="aetx-btn primary" onclick="window.aetxSaveFamilyMember()">Partager</button></div>
        </div>
        <div class="aetx-card">
          <div class="aetx-section-title"><h3>Contrôle des accès</h3></div>
          ${state.family.length ? `<table class="aetx-table"><thead><tr><th>Nom</th><th>Email</th><th>Accès</th><th>Action</th></tr></thead><tbody>${state.family.map(m => `<tr><td>${esc(m.name || '')}</td><td>${esc(m.email || '')}</td><td>${esc(m.access || '')}</td><td><button class="aetx-btn danger" onclick="window.aetxDeleteFamilyMember('${m.id}')">Retirer</button></td></tr>`).join('')}</tbody></table>` : '<div class="aetx-empty">Aucun membre familial pour le moment.</div>'}
        </div>
      </div>
    `;
  }

  function renderSecurityPlus() {
    const host = document.getElementById('aetx-security-devices');
    if (!host) return;
    host.innerHTML = state.logins.length ? `
      <div class="aetx-list">
        ${state.logins.map(item => {
          const when = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('fr-FR') : '—';
          return `<div class="aetx-list-item"><div><h5>${esc(item.device || 'Appareil')}</h5><p>${esc(item.userAgent || '')}</p></div><div style="text-align:right"><div class="aetx-chip">${esc(when)}</div><div class="aetx-small" style="margin-top:6px">${esc(item.platform || '')}</div></div></div>`;
        }).join('')}
      </div>` : '<div class="aetx-empty">Le journal des connexions apparaîtra ici.</div>';
  }

  function renderAdmin() {
    const host = document.getElementById('aetx-adminplus-content');
    const tab = document.getElementById('tab-adminplus');
    if (!host || !tab) return;
    tab.style.display = state.isAdmin ? '' : 'none';
    if (!state.isAdmin) {
      host.innerHTML = '<div class="aetx-empty">Accès administrateur requis.</div>';
      return;
    }
    host.innerHTML = `
      <div class="aetx-admin-grid aetx-mb">
        <div class="aetx-card"><h4>Utilisateurs</h4><div class="value">${state.users.length}</div></div>
        <div class="aetx-card"><h4>Demandes Premium</h4><div class="value">${state.premiumRequests.length}</div></div>
        <div class="aetx-card"><h4>Transactions globales</h4><div class="value">${state.tx.length}</div></div>
      </div>
      <div class="aetx-card">
        <div class="aetx-section-title"><h3>Validation Premium & supervision</h3></div>
        ${state.premiumRequests.length ? `<table class="aetx-table"><thead><tr><th>Utilisateur</th><th>Email</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead><tbody>${state.premiumRequests.map(r => `<tr><td>${esc(r.displayName || '')}</td><td>${esc(r.email || '')}</td><td>${esc(fmt(r.amount || 0))}</td><td>${esc(r.status || 'pending')}</td><td><button class="aetx-btn success" onclick="window.aetxApprovePremium('${r.id}','${r.userId}')">Valider</button></td></tr>`).join('')}</tbody></table>` : '<div class="aetx-empty">Aucune demande Premium en attente.</div>'}
      </div>
    `;
  }

  function renderTab(tab) {
    switch(tab) {
      case 'dettes': renderDebts(); break;
      case 'factures': renderBills(); break;
      case 'rapports': renderReports(); break;
      case 'famille': renderFamily(); break;
      case 'adminplus': renderAdmin(); break;
      default: break;
    }
  }

  function renderAllModules() {
    injectBaseUI();
    renderDashboard();
    renderDebts();
    renderBills();
    renderReports();
    renderFamily();
    renderSecurityPlus();
    renderAdmin();
    autoProcessBills();
    persistSnapshotLocal();
  }

  function autoProcessBills() {
    if (!state.uid || !state.bills.length) return;
    const today = new Date();
    const day = today.getDate();
    const ym = currentMonth();
    state.bills.forEach(async bill => {
      if (!bill.autopay || bill.active === false) return;
      if (Number(bill.dueDay || 0) > day) return;
      if (bill.lastAutoRunMonth === ym) return;
      try {
        await addDoc(collection(db, 'transactions'), {
          userId: state.uid,
          subtype: 'out',
          flow: 'out',
          amount: Number(bill.amount || 0),
          description: `[Auto] ${bill.label}`,
          category: bill.category || 'Factures récurrentes',
          date: todayISO(),
          note: `Paiement automatique programmé : ${bill.provider || ''}`,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'recurringBills', bill.id), {
          lastAutoRunMonth: ym,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('auto bill failed', err);
      }
    });
  }

  function persistSnapshotLocal() {
    if (!state.uid) return;
    const payload = {
      savedAt: new Date().toISOString(),
      tx: state.tx.slice(0, 200),
      budgets: state.budgets,
      goals: state.goals,
      debts: state.debts,
      bills: state.bills,
      family: state.family
    };
    localStorage.setItem('aetx_snapshot_' + state.uid, JSON.stringify(payload));
  }

  async function logCurrentDevice(user) {
    if (!user) return;
    try {
      const fingerprint = navigator.userAgent.slice(0, 120);
      const key = `${user.uid}_${btoa(fingerprint).replace(/=/g,'').slice(0,20)}`;
      await setDoc(doc(db, 'loginJournal', key), {
        userId: user.uid,
        email: user.email || '',
        userAgent: navigator.userAgent,
        device: navigator.platform || 'Web',
        platform: navigator.vendor || 'Browser',
        createdAt: serverTimestamp()
      }, { merge:true });
    } catch (err) {
      console.warn('login journal', err);
    }
  }

  async function watchAdminCollections() {
    if (!state.isAdmin) return;
    observe(query(collection(db, 'premiumRequests'), orderBy('createdAt', 'desc'), limit(25)), 'premiumRequests');
    observe(query(collection(db, 'users'), limit(50)), 'users');
  }

  onAuthStateChanged(auth, async (user) => {
    cleanupSubs();
    state.uid = user?.uid || null;
    state.user = user || null;
    injectBaseUI();
    if (!user) {
      state.tx = [];
      state.budgets = [];
      state.goals = [];
      state.debts = [];
      state.bills = [];
      state.family = [];
      state.logins = [];
      renderAllModules();
      return;
    }

    await logCurrentDevice(user);
    observe(query(collection(db, 'transactions'), where('userId','==',user.uid), orderBy('date', 'desc')), 'tx');
    observe(byUser('budgets'), 'budgets');
    observe(byUser('goals'), 'goals');
    observe(query(collection(db, 'debts'), where('userId','==',user.uid), orderBy('dueDate', 'asc')), 'debts');
    observe(query(collection(db, 'recurringBills'), where('userId','==',user.uid), orderBy('dueDay', 'asc')), 'bills');
    observe(query(collection(db, 'familyMembers'), where('ownerId','==',user.uid), orderBy('createdAt', 'desc')), 'family');
    observe(query(collection(db, 'loginJournal'), where('userId','==',user.uid), orderBy('createdAt', 'desc'), limit(8)), 'logins');

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      state.userDoc = snap.exists() ? snap.data() : {};
      state.isAdmin = !!(state.userDoc?.role === 'admin' || state.userDoc?.isAdmin === true);
      if (state.isAdmin) watchAdminCollections();
    } catch (err) {
      console.warn('user doc', err);
    }
    renderAllModules();
  });

  window.aetxSaveDebt = async function() {
    if (!state.uid) return notify('Veuillez vous connecter', 'error');
    const type = document.getElementById('aetxDebtType')?.value || 'debt';
    const person = document.getElementById('aetxDebtPerson')?.value.trim();
    const amount = Number(document.getElementById('aetxDebtAmount')?.value || 0);
    const dueDate = document.getElementById('aetxDebtDue')?.value || '';
    const note = document.getElementById('aetxDebtNote')?.value.trim() || '';
    if (!person || !amount) return notify('Nom et montant requis', 'warning');
    await addDoc(collection(db, 'debts'), { userId: state.uid, type, person, amount, dueDate, note, repaidAmount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    notify('Dette / créance enregistrée', 'success');
  };

  window.aetxRegisterPayment = async function(id) {
    const amount = Number(prompt('Montant remboursé ?') || 0);
    if (!amount) return;
    const target = state.debts.find(d => d.id === id);
    if (!target) return;
    await updateDoc(doc(db, 'debts', id), { repaidAmount: Number(target.repaidAmount || 0) + amount, updatedAt: serverTimestamp() });
    notify('Remboursement enregistré', 'success');
  };

  window.aetxDeleteDebt = async function(id) {
    if (!confirm('Supprimer cet élément ?')) return;
    await deleteDoc(doc(db, 'debts', id));
    notify('Élément supprimé', 'info');
  };

  window.aetxSaveBill = async function() {
    if (!state.uid) return notify('Veuillez vous connecter', 'error');
    const label = document.getElementById('aetxBillLabel')?.value.trim();
    const provider = document.getElementById('aetxBillProvider')?.value.trim() || '';
    const amount = Number(document.getElementById('aetxBillAmount')?.value || 0);
    const dueDay = Number(document.getElementById('aetxBillDueDay')?.value || 0);
    const category = document.getElementById('aetxBillCategory')?.value.trim() || 'Factures récurrentes';
    const autopay = (document.getElementById('aetxBillAutopay')?.value || 'yes') === 'yes';
    if (!label || !amount || !dueDay) return notify('Libellé, montant et jour requis', 'warning');
    await addDoc(collection(db, 'recurringBills'), { userId: state.uid, label, provider, amount, dueDay, category, autopay, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    notify('Facture récurrente ajoutée', 'success');
  };

  window.aetxRunBillNow = async function(id) {
    const bill = state.bills.find(b => b.id === id);
    if (!bill) return;
    await addDoc(collection(db, 'transactions'), { userId: state.uid, subtype: 'out', flow: 'out', amount: Number(bill.amount || 0), description: bill.label, category: bill.category || 'Factures récurrentes', date: todayISO(), note: `Paiement manuel ${bill.provider || ''}`, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'recurringBills', id), { lastAutoRunMonth: currentMonth(), updatedAt: serverTimestamp() });
    notify('Paiement enregistré', 'success');
  };

  window.aetxDeleteBill = async function(id) {
    if (!confirm('Supprimer cette facture ?')) return;
    await deleteDoc(doc(db, 'recurringBills', id));
    notify('Facture supprimée', 'info');
  };

  window.aetxSaveFamilyMember = async function() {
    if (!state.uid) return notify('Veuillez vous connecter', 'error');
    const name = document.getElementById('aetxFamilyName')?.value.trim();
    const email = document.getElementById('aetxFamilyEmail')?.value.trim();
    const access = document.getElementById('aetxFamilyRole')?.value || 'viewer';
    const scope = document.getElementById('aetxFamilyScope')?.value.trim() || '';
    if (!name || !email) return notify('Nom et email requis', 'warning');
    await addDoc(collection(db, 'familyMembers'), { ownerId: state.uid, userId: state.uid, name, email, access, scope, createdAt: serverTimestamp() });
    notify('Membre ajouté', 'success');
  };

  window.aetxDeleteFamilyMember = async function(id) {
    if (!confirm('Retirer ce membre ?')) return;
    await deleteDoc(doc(db, 'familyMembers', id));
    notify('Membre retiré', 'info');
  };

  window.aetxCreateSnapshot = async function() {
    if (!state.uid) return notify('Veuillez vous connecter', 'error');
    const payload = {
      userId: state.uid,
      savedAt: serverTimestamp(),
      data: {
        tx: state.tx.slice(0, 400),
        budgets: state.budgets,
        goals: state.goals,
        debts: state.debts,
        bills: state.bills,
        family: state.family
      }
    };
    await setDoc(doc(db, 'backups', state.uid), payload, { merge:true });
    persistSnapshotLocal();
    notify('Sauvegarde créée', 'success');
  };

  window.aetxRestoreSnapshot = async function() {
    if (!state.uid) return notify('Veuillez vous connecter', 'error');
    const local = localStorage.getItem('aetx_snapshot_' + state.uid);
    if (!local) return notify('Aucune sauvegarde locale', 'warning');
    const parsed = JSON.parse(local);
    notify(`Dernière sauvegarde locale du ${new Date(parsed.savedAt).toLocaleString('fr-FR')}`, 'info');
  };

  window.aetxRequestPushPermission = async function() {
    if (!('Notification' in window)) return notify('Notifications non supportées', 'warning');
    const permission = await Notification.requestPermission();
    notify(permission === 'granted' ? 'Notifications activées' : 'Notifications refusées', permission === 'granted' ? 'success' : 'warning');
  };

  window.aetxSetTheme = function(mode) {
    document.body.dataset.theme = mode;
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('aetx_theme', mode);
    notify(`Mode ${mode === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
  };

  async function loadScriptOnce(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  window.aetxExportExcel = function() {
    const html = buildReportHTML();
    const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type:'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aet-monbudget-rapport-${currentMonth()}.xls`;
    a.click();
    notify('Export Excel généré', 'success');
  };

  window.aetxPrintReport = function() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Rapport AET MonBudget</title></head><body>${buildReportHTML()}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  window.aetxExportPDF = async function() {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    const now = monthStats(currentMonth());
    const prev = monthStats(previousMonth());
    docPdf.setFontSize(18);
    docPdf.text('AET MonBudget - Rapport avance', 14, 20);
    docPdf.setFontSize(11);
    docPdf.text(`Periode : ${currentMonth()}`, 14, 30);
    const lines = [
      `Revenus: ${fmt(now.incomes)}`,
      `Depenses: ${fmt(now.expenses)}`,
      `Epargne: ${fmt(now.savings)}`,
      `Solde: ${fmt(now.balance)}`,
      `Depenses mois precedent: ${fmt(prev.expenses)}`
    ];
    lines.forEach((line, i) => docPdf.text(line, 14, 42 + (i * 8)));
    docPdf.save(`aet-monbudget-rapport-${currentMonth()}.pdf`);
    notify('Export PDF généré', 'success');
  };

  window.aetxApprovePremium = async function(requestId, userId) {
    if (!state.isAdmin) return notify('Accès refusé', 'error');
    await updateDoc(doc(db, 'premiumRequests', requestId), { status:'approved', approvedAt: serverTimestamp(), approvedBy: state.uid });
    await setDoc(doc(db, 'users', userId), { isPremium:true, subscriptionPlan:'premium', premiumValidatedAt: serverTimestamp() }, { merge:true });
    notify('Abonnement Premium validé', 'success');
  };

  const savedTheme = localStorage.getItem('aetx_theme');
  if (savedTheme) window.aetxSetTheme(savedTheme);
})();
