import * as storesRepo from '../../core/repositories/store.repository.js';
export async function saveStore(db, context, payload) {
  return storesRepo.createStore(db, context.tenantId, payload);
}
