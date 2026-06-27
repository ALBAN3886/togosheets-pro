import * as inventoryRepo from '../repositories/inventory.repository.js';
import * as stockMovementsRepo from '../repositories/stock-movement.repository.js';
import { STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import { assertCan, assertStoreAccess } from './role.service.js';

export async function recordStockAdjustment(db, context, { storeId, productId, deltaQty = 0, unitPrice = 0, note = '' }) {
  assertCan(context, 'stockMovements', 'write');
  assertStoreAccess(context, storeId);
  const qty = Number(deltaQty || 0);
  await inventoryRepo.incrementInventory(db, context.tenantId, storeId, productId, qty);
  return stockMovementsRepo.createStockMovement(db, context.tenantId, {
    storeId,
    productId,
    qty,
    unitPrice: Number(unitPrice || 0),
    total: qty * Number(unitPrice || 0),
    type: qty >= 0 ? STOCK_MOVEMENT_TYPES.RESTOCK : STOCK_MOVEMENT_TYPES.ADJUSTMENT,
    note,
    employeeId: context.employeeId || context.authUser.uid,
    employeeName: context.authUser.displayName || 'Opérateur'
  });
}
