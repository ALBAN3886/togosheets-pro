import * as salesRepo from '../repositories/sale.repository.js';
export function watchRecentSales(db, tenantId, storeId, onChange) {
  return salesRepo.watchSales(db, tenantId, { storeId }, onChange);
}
