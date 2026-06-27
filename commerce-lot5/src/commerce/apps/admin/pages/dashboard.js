import { statCard } from '../../../shared-ui/components/stat-card.js';
import { formatMoney } from '../../../core/utils/money.js';

function optionList(rows = [], selected = '') {
  return rows.map(row => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${row.name || row.id}</option>`).join('');
}

export function renderAdminDashboard(stats = {}, { stores = [], filters = {} } = {}, currency = 'XOF') {
  const topProducts = (stats.topProducts || []).map(item => `<li><strong>${item.name}</strong> · ${item.qty} unité(s) · ${formatMoney(item.revenue || 0, currency)}</li>`).join('') || '<li>Aucune vente récente</li>';
  const payments = Object.entries(stats.paymentBreakdown || {}).map(([method, value]) => `<li><strong>${method}</strong> · ${formatMoney(value || 0, currency)}</li>`).join('') || '<li>Aucune donnée</li>';
  const filterForm = `<section class="cm-card cm-section" style="margin-bottom:16px"><h2>Filtres dashboard</h2><form id="dashboardFiltersForm" class="cm-grid cols-4"><select class="cm-select" name="storeId"><option value="">Toutes les boutiques</option>${optionList(stores, filters.storeId || '')}</select><input class="cm-input" type="date" name="from" value="${filters.from || ''}" /><input class="cm-input" type="date" name="to" value="${filters.to || ''}" /><div class="cm-actions-inline"><button class="cm-btn primary" type="submit">Appliquer</button><button class="cm-btn" type="button" id="resetDashboardFiltersBtn">Réinitialiser</button></div></form></section>`;
  return `${filterForm}<div class="cm-grid cols-5">
    ${statCard('Ventes jour', formatMoney(stats.salesTodayTotal ?? 0, currency))}
    ${statCard('Ventes mois', formatMoney(stats.salesMonthTotal ?? 0, currency))}
    ${statCard('Commandes en attente', stats.pendingOrders ?? 0)}
    ${statCard('Stocks faibles', stats.lowStockCount ?? 0)}
    ${statCard('Caisses ouvertes', stats.openCashSessions ?? 0)}
  </div>
  <div class="cm-grid cols-2" style="margin-top:16px">
    <section class="cm-card cm-section"><h2>Top produits</h2><ul class="cm-list">${topProducts}</ul></section>
    <section class="cm-card cm-section"><h2>Paiements</h2><ul class="cm-list">${payments}</ul></section>
  </div>`;
}
