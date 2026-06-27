import * as ordersRepo from '../repositories/order.repository.js';
import { validateOrderPayload } from '../utils/validation.js';
import { assertCan } from './role.service.js';

export async function placePublicOrder(db, payload) {
  validateOrderPayload(payload);
  return ordersRepo.createStorefrontOrder(db, payload.tenantId, payload);
}

export async function updateOrderStatus(db, context, orderId, status, meta = {}) {
  assertCan(context, 'sales', 'write');
  return ordersRepo.updateOrderStatus(db, context.tenantId, orderId, status, meta);
}
