import * as inventoryRepo from '../repositories/inventory.repository.js';

export function watchStoreStock(db, tenantId, storeId, onChange) {
  return inventoryRepo.watchInventory(db, tenantId, { storeId }, onChange);
}
