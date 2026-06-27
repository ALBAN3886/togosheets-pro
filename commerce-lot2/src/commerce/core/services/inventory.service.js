import * as inventoryRepo from '../repositories/inventory.repository.js';
import { assertCan } from './role.service.js';

export async function setStock(db, context, { storeId, productId, quantity, reorderLevel = 5 }) {
  assertCan(context, 'inventory', 'write');
  return inventoryRepo.setInventoryQuantity(db, context.tenantId, storeId, productId, {
    quantity,
    availableQuantity: quantity,
    reorderLevel,
  });
}

export async function adjustStock(db, context, { storeId, productId, delta }) {
  assertCan(context, 'inventory', 'write');
  return inventoryRepo.incrementInventory(db, context.tenantId, storeId, productId, delta);
}
