import * as stockMovementsRepo from '../repositories/stock-movement.repository.js';
export function watchStockMovementsRealtime(db, tenantId, filters, onChange) {
  return stockMovementsRepo.watchStockMovements(db, tenantId, filters, onChange);
}
