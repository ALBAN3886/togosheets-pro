import { monthIso, todayIso } from '../utils/dates.js';
import { sumAmount } from '../utils/money.js';

export function buildDashboardStats({ sales = [], orders = [], inventory = [] } = {}) {
  const today = todayIso();
  const month = monthIso();
  const salesToday = sales.filter(row => {
    const dateStr = row.date || (row.createdAtMs ? new Date(row.createdAtMs).toISOString().slice(0, 10) : '');
    return dateStr === today;
  });
  const salesMonth = sales.filter(row => {
    const dateStr = row.date || (row.createdAtMs ? new Date(row.createdAtMs).toISOString().slice(0, 7) : '');
    return dateStr.startsWith(month);
  });
  const lowStock = inventory.filter(row => Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5));

  return {
    salesTodayTotal: sumAmount(salesToday, 'grandTotal'),
    salesMonthTotal: sumAmount(salesMonth, 'grandTotal'),
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    lowStockCount: lowStock.length,
  };
}
