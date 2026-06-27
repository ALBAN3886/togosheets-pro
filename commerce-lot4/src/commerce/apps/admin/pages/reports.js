import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderReportsPage(report = {}, currency = 'XOF') {
  const payments = Object.entries(report.paymentBreakdown || {}).map(([method, amount]) => `<li><strong>${method}</strong><span>${formatMoney(amount, currency)}</span></li>`).join('');
  const topProducts = (report.topProducts || []).map(item => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${formatMoney(item.revenue, currency)}</td></tr>`).join('');
  const series = (report.dailySeries || []).map(item => `<li><strong>${item.date}</strong><span>${formatMoney(item.total, currency)}</span></li>`).join('');
  if (!report.totalSales && !report.pendingOrders && !report.lowStockCount) {
    return emptyState('Aucun rapport disponible', 'Les indicateurs apparaîtront dès les premières ventes.');
  }
  return `<section class="cm-card cm-section">
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
