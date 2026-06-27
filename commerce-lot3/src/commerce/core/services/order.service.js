import * as ordersRepo from '../repositories/order.repository.js';
import { validateOrderPayload } from '../utils/validation.js';
import { assertCan } from './role.service.js';

export async function placePublicOrder(db, payload) {
  validateOrderPayload(payload);
  return ordersRepo.createOrder(db, payload.tenantId, { ...payload, source: 'storefront', status: 'pending' });
}

export async function updateOrderStatus(db, context, orderId, status, meta = {}) {
  assertCan(context, 'sales', 'write');
  return ordersRepo.updateOrder(db, context.tenantId, orderId, { status, ...meta });
}
