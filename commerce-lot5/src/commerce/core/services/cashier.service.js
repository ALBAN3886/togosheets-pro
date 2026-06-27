import * as cashSessionsRepo from '../repositories/cash-session.repository.js';
import { CASH_SESSION_STATUS } from '../config/constants.js';
import { assertCan, assertStoreAccess } from './role.service.js';

export async function openCashSession(db, context, { storeId, openingAmount = 0, note = '' }) {
  assertCan(context, 'cashier', 'open');
  assertStoreAccess(context, storeId);
  return cashSessionsRepo.createCashSession(db, context.tenantId, {
    storeId,
    employeeId: context.employeeId || context.authUser.uid,
    employeeName: context.authUser.displayName || 'Opérateur',
    openingAmount: Number(openingAmount || 0),
    note,
    status: CASH_SESSION_STATUS.OPEN
  });
}

export async function closeCashSession(db, context, sessionId, { openingAmount = 0, expectedClosingAmount = 0, closingAmount = 0, note = '' }) {
  assertCan(context, 'cashier', 'close');
  const differenceAmount = Number(closingAmount || 0) - Number(expectedClosingAmount || 0);
  return cashSessionsRepo.closeCashSession(db, context.tenantId, sessionId, {
    status: CASH_SESSION_STATUS.CLOSED,
    openingAmount: Number(openingAmount || 0),
    expectedClosingAmount: Number(expectedClosingAmount || 0),
    closingAmount: Number(closingAmount || 0),
    differenceAmount,
    note
  });
}
