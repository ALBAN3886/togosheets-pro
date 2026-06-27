import * as salesRepo from '../repositories/sale.repository.js';
import { validateSalePayload } from '../utils/validation.js';
import { assertCan, assertStoreAccess } from './role.service.js';

export async function createSale(db, context, payload) {
  assertCan(context, 'sales', 'write');
  assertStoreAccess(context, payload.storeId);
  validateSalePayload({ ...payload, tenantId: context.tenantId });
  return salesRepo.createSaleTransactional(db, context.tenantId, payload);
}

export async function createSaleFromOrder(db, context, order, extra = {}) {
  assertCan(context, 'sales', 'write');
  assertStoreAccess(context, order.storeId);
  return salesRepo.createSaleTransactional(db, context.tenantId, {
    storeId: order.storeId,
    sellerEmployeeId: context.employeeId || context.authUser.uid,
    sellerName: context.authUser.displayName || 'Opérateur',
    originOrderId: order.id,
    source: 'employee-pos',
    items: order.items,
    paymentMethod: extra.paymentMethod || 'cash',
    cashSessionId: extra.cashSessionId || null,
    note: extra.note || 'Commande publique validée en caisse',
    grandTotal: order.grandTotal || order.total || 0
  });
}
