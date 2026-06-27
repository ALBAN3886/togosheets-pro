import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

function optionList(rows = [], selected = '') {
  return rows.map(row => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${row.name || row.id}</option>`).join('');
}

export function renderReportsPage(report = {}, { stores = [], filters = {} } = {}, currency = 'XOF') {
  const filterForm = `<section class="cm-card cm-section" style="margin-bottom:16px"><h2>Filtres rapport</h2><form id="reportFiltersForm" class="cm-grid cols-5"><select class="cm-select" name="storeId"><option value="">Toutes les boutiques</option>${optionList(stores, filters.storeId || '')}</select><input class="cm-input" type="date" name="from" value="${filters.from || ''}" /><input class="cm-input" type="date" name="to" value="${filters.to || ''}" /><div class="cm-actions-inline"><button class="cm-btn primary" type="submit">Appliquer</button><button class="cm-btn" type="button" id="resetReportFiltersBtn">Réinitialiser</button></div><button class="cm-btn" type="button" id="printReportBtn">Imprimer</button></form></section>`;
  const payments = Object.entries(report.paymentBreakdown || {}).map(([method, amount]) => `<li><strong>${method}</strong><span>${formatMoney(amount, currency)}</span></li>`).join('');
  const topProducts = (report.topProducts || []).map(item => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${formatMoney(item.revenue, currency)}</td></tr>`).join('');
  const series = (report.dailySeries || []).map(item => `<li><strong>${item.date}</strong><span>${formatMoney(item.total, currency)}</span></li>`).join('');
  if (!report.totalSales && !report.pendingOrders && !report.lowStockCount) {
    return `${filterForm}${emptyState('Aucun rapport disponible', 'Les indicateurs apparaîtront dès les premières ventes.')}`;
  }
  return `${filterForm}<section class="cm-card cm-section">
    <h2>Rapport synthétique</h2>
    <div class="cm-grid cols-4">
      <div class="cm-kpi"><span>Chiffre d'affaires</span><strong>${formatMoney(report.totalRevenue || 0, currency)}</strong></div>
      <div class="cm-kpi"><span>Ventes</span><strong>${report.totalSales || 0}</strong></div>
      <div class="cm-kpi"><span>Articles vendus</span><strong>${report.itemsSold || 0}</strong></div>
      <div class="cm-kpi"><span>Panier moyen</span><strong>${formatMoney(report.avgTicket || 0, currency)}</strong></div>
    </div>
  </section>
  <div class="cm-grid cols-2" style="margin-top:16px">
    <section class="cm-card cm-section"><h2>Répartition paiements</h2><ul class="cm-split-list">${payments || '<li><span>Aucune donnée</span><strong>—</strong></li>'}</ul></section>
    <section class="cm-card cm-section"><h2>Série journalière</h2><ul class="cm-split-list">${series || '<li><span>Aucune donnée</span><strong>—</strong></li>'}</ul></section>
  </div>
  <section class="cm-card cm-section" style="margin-top:16px"><h2>Top produits</h2><table class="cm-table"><thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead><tbody>${topProducts || '<tr><td colspan="3">Aucune vente</td></tr>'}</tbody></table></section>`;
}
