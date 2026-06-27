import { monthIso, todayIso } from '../utils/dates.js';
import { sumAmount } from '../utils/money.js';

function saleDateOf(row) {
  return row.date || (row.createdAtMs ? new Date(row.createdAtMs).toISOString().slice(0,10) : todayIso());
}

function inRange(dateStr, from, to) {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function buildDashboardStats({ sales = [], orders = [], inventory = [], cashSessions = [] } = {}) {
  const today = todayIso();
  const month = monthIso();
  const salesToday = sales.filter(row => saleDateOf(row) === today);
  const salesMonth = sales.filter(row => saleDateOf(row).startsWith(month));
  const lowStock = inventory.filter(row => Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5));
  const openSessions = cashSessions.filter(row => row.status === 'open').length;
  return {
    salesTodayTotal: sumAmount(salesToday, 'grandTotal'),
    salesMonthTotal: sumAmount(salesMonth, 'grandTotal'),
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    lowStockCount: lowStock.length,
    openCashSessions: openSessions
  };
}

export function buildSalesReport({ sales = [], orders = [], inventory = [], cashSessions = [], from = '', to = '' } = {}) {
  const filteredSales = sales.filter(row => inRange(saleDateOf(row), from, to));
  const totalRevenue = sumAmount(filteredSales, 'grandTotal');
  const itemsSold = filteredSales.reduce((sum, sale) => sum + (sale.items || []).reduce((lineSum, line) => lineSum + Number(line.qty || 0), 0), 0);
  const avgTicket = filteredSales.length ? totalRevenue / filteredSales.length : 0;
  const paymentBreakdown = filteredSales.reduce((acc, sale) => {
    const key = sale.paymentMethod || 'cash';
    acc[key] = (acc[key] || 0) + Number(sale.grandTotal || 0);
    return acc;
  }, {});
  const topProductsMap = {};
  filteredSales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const key = item.productId || item.name || 'unknown';
      if (!topProductsMap[key]) topProductsMap[key] = { productId: item.productId || '', name: item.name || key, qty: 0, revenue: 0 };
      topProductsMap[key].qty += Number(item.qty || 0);
      topProductsMap[key].revenue += Number(item.total ?? Number(item.qty || 0) * Number(item.unitPrice || 0));
    });
  });
  const topProducts = Object.values(topProductsMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const dailySeriesMap = {};
  filteredSales.forEach(sale => {
    const key = saleDateOf(sale);
    dailySeriesMap[key] = (dailySeriesMap[key] || 0) + Number(sale.grandTotal || 0);
  });
  const dailySeries = Object.entries(dailySeriesMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, total]) => ({ date, total }));
  const lowStock = inventory.filter(row => Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5));
  return {
    from,
    to,
    totalRevenue,
    totalSales: filteredSales.length,
    itemsSold,
    avgTicket,
    pendingOrders: orders.filter(order => order.status === 'pending').length,
    lowStockCount: lowStock.length,
    openCashSessions: cashSessions.filter(row => row.status === 'open').length,
    paymentBreakdown,
    topProducts,
    dailySeries
  };
}
