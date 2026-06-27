import * as productsRepo from '../repositories/product.repository.js';

export function watchPublishedProducts(db, tenantId, storeId, onChange) {
  return productsRepo.watchProducts(db, tenantId, {
    storeId,
    isPublished: true,
    isActive: true,
  }, onChange);
}
