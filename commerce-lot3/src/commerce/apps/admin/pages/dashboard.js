import { statCard } from '../../../shared-ui/components/stat-card.js';
export function renderAdminDashboard(stats = {}) {
  return `<div class="cm-grid cols-4">${statCard('Ventes jour', stats.salesTodayTotal ?? 0)}${statCard('Ventes mois', stats.salesMonthTotal ?? 0)}${statCard('Commandes en attente', stats.pendingOrders ?? 0)}${statCard('Stocks faibles', stats.lowStockCount ?? 0)}</div><div id="adminDashboardExtra" style="margin-top:16px"></div>`;
}
