import * as salesRepo from '../repositories/sale.repository.js';
import * as ordersRepo from '../repositories/order.repository.js';
import * as inventoryRepo from '../repositories/inventory.repository.js';
import { buildDashboardStats } from '../services/report.service.js';

export function watchDashboardStats(db, tenantId, storeId, onChange) {
  const state = { sales: [], orders: [], inventory: [] };
  const emit = () => onChange(buildDashboardStats(state));

  const unsubSales = salesRepo.watchSales(db, tenantId, { storeId }, rows => { state.sales = rows; emit(); });
  const unsubOrders = ordersRepo.watchOrders(db, tenantId, { storeId }, rows => { state.orders = rows; emit(); });
  const unsubInventory = inventoryRepo.watchInventory(db, tenantId, { storeId }, rows => { state.inventory = rows; emit(); });

  return () => {
    unsubSales?.();
    unsubOrders?.();
    unsubInventory?.();
  };
}
