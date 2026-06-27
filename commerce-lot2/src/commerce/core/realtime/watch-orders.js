import * as ordersRepo from '../repositories/order.repository.js';

export function watchPendingOrders(db, tenantId, storeId, onChange) {
  return ordersRepo.watchOrders(db, tenantId, {
    storeId,
    status: 'pending',
  }, onChange);
}
