import * as storesRepo from '../repositories/store.repository.js';
import { assertCan } from './role.service.js';

export async function saveStore(db, context, payload) {
  assertCan(context, 'stores', 'write');
  if (payload.id) {
    await storesRepo.updateStore(db, context.tenantId, payload.id, payload);
    return payload.id;
  }
  return storesRepo.createStore(db, context.tenantId, payload);
}
