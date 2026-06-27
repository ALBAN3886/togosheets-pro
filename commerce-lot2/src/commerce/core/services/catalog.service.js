import * as categoriesRepo from '../repositories/category.repository.js';
import * as productsRepo from '../repositories/product.repository.js';
import { assertCan } from './role.service.js';

export async function saveProduct(db, context, payload) {
  assertCan(context, 'products', 'write');
  if (payload.id) {
    await productsRepo.updateProduct(db, context.tenantId, payload.id, payload);
    return payload.id;
  }
  return productsRepo.createProduct(db, context.tenantId, payload);
}

export async function saveCategory(db, context, payload) {
  assertCan(context, 'products', 'write');
  if (payload.id) {
    await categoriesRepo.updateCategory(db, context.tenantId, payload.id, payload);
    return payload.id;
  }
  return categoriesRepo.createCategory(db, context.tenantId, payload);
}

export async function publishProduct(db, context, productId, isPublished = true) {
  assertCan(context, 'storefront', 'publish');
  await productsRepo.updateProduct(db, context.tenantId, productId, { isPublished });
}

export async function archiveProduct(db, context, productId) {
  assertCan(context, 'products', 'delete');
  await productsRepo.archiveProduct(db, context.tenantId, productId);
}
