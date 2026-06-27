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

function matchStore(row, storeId) {
  if (!storeId) return true;
  return row?.storeId === storeId;
}

function filterSales(sales = [], { storeId = '', from = '', to = '' } = {}) {
  return sales.filter(row => matchStore(row, storeId) && inRange(saleDateOf(row), from, to));
}

function filterOrders(orders = [], { storeId = '' } = {}) {
  return orders.filter(row => matchStore(row, storeId));
}

function filterInventory(inventory = [], { storeId = '' } = {}) {
  return inventory.filter(row => matchStore(row, storeId));
}

function filterCashSessions(cashSessions = [], { storeId = '', from = '', to = '' } = {}) {
  return cashSessions.filter(row => {
    const openedDate = row?.openedAt?.toDate ? row.openedAt.toDate().toISOString().slice(0,10) : (row?.openedAtMs ? new Date(row.openedAtMs).toISOString().slice(0,10) : todayIso());
    return matchStore(row, storeId) && inRange(openedDate, from, to);
  });
}

export function buildDashboardStats({ sales = [], orders = [], inventory = [], cashSessions = [], storeId = '', from = '', to = '' } = {}) {
  const today = todayIso();
  const month = monthIso();
  const filteredSales = filterSales(sales, { storeId, from, to });
  const filteredOrders = filterOrders(orders, { storeId });
  const filteredInventory = filterInventory(inventory, { storeId });
  const filteredCashSessions = filterCashSessions(cashSessions, { storeId, from, to });
  const salesToday = filteredSales.filter(row => saleDateOf(row) === today);
  const salesMonth = filteredSales.filter(row => saleDateOf(row).startsWith(month));
  const lowStock = filteredInventory.filter(row => Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5));
  const openSessions = filteredCashSessions.filter(row => row.status === 'open').length;
  return {
    salesTodayTotal: sumAmount(salesToday, 'grandTotal'),
    salesMonthTotal: sumAmount(salesMonth, 'grandTotal'),
    pendingOrders: filteredOrders.filter(order => order.status === 'pending').length,
    lowStockCount: lowStock.length,
    openCashSessions: openSessions
  };
}

export function buildSalesReport({ sales = [], orders = [], inventory = [], cashSessions = [], storeId = '', from = '', to = '' } = {}) {
  const filteredSales = filterSales(sales, { storeId, from, to });
  const filteredOrders = filterOrders(orders, { storeId });
  const filteredInventory = filterInventory(inventory, { storeId });
  const filteredCashSessions = filterCashSessions(cashSessions, { storeId, from, to });
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
  const lowStock = filteredInventory.filter(row => Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5));
  return {
    storeId,
    from,
    to,
    totalRevenue,
    totalSales: filteredSales.length,
    itemsSold,
    avgTicket,
    pendingOrders: filteredOrders.filter(order => order.status === 'pending').length,
    lowStockCount: lowStock.length,
    openCashSessions: filteredCashSessions.filter(row => row.status === 'open').length,
    paymentBreakdown,
    topProducts,
    dailySeries
  };
}
