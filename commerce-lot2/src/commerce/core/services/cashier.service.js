import { CASH_SESSION_STATUS } from '../config/constants.js';
import { assertCan } from './role.service.js';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from '../firebase/firestore.js';
import { tenantCollectionPath } from '../repositories/_paths.js';
import { COLLECTIONS } from '../config/collections.js';

export async function openCashSession(db, context, { storeId, openingAmount = 0, note = '' }) {
  assertCan(context, 'cashier', 'open');
  const ref = await addDoc(collection(db, tenantCollectionPath(context.tenantId, COLLECTIONS.CASH_SESSIONS)), {
    tenantId: context.tenantId,
    storeId,
    employeeId: context.employeeId || context.authUser.uid,
    employeeName: context.authUser.displayName || 'Opérateur',
    openingAmount: Number(openingAmount || 0),
    closingAmount: null,
    status: CASH_SESSION_STATUS.OPEN,
    note,
    openedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function closeCashSession(db, context, sessionId, { closingAmount = 0, note = '' }) {
  assertCan(context, 'cashier', 'close');
  await updateDoc(doc(db, tenantCollectionPath(context.tenantId, COLLECTIONS.CASH_SESSIONS), sessionId), {
    closingAmount: Number(closingAmount || 0),
    note,
    status: CASH_SESSION_STATUS.CLOSED,
    closedAt: serverTimestamp(),
  });
}
