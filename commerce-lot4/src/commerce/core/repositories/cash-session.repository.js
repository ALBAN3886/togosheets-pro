import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createCashSessionModel } from '../models/cash-session.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildCashSessionsQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.CASH_SESSIONS));
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeId','==',filters.storeId));
  if (filters.status) constraints.push(where('status','==',filters.status));
  if (filters.employeeId) constraints.push(where('employeeId','==',filters.employeeId));
  constraints.push(orderBy('openedAt','desc'));
  return query(base, ...constraints);
}

export async function createCashSession(db, tenantId, payload) {
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.CASH_SESSIONS)), {
    ...createCashSessionModel({ ...payload, tenantId }),
    openedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getCashSession(db, tenantId, sessionId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.CASH_SESSIONS), sessionId)));
}

export async function listCashSessions(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildCashSessionsQuery(db, tenantId, filters)));
}

export function watchCashSessions(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildCashSessionsQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function closeCashSession(db, tenantId, sessionId, patch = {}) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.CASH_SESSIONS), sessionId), {
    ...patch,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
