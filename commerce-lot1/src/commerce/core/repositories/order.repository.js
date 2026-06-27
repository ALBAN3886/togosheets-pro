import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createOrderModel } from '../models/order.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildOrdersQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS));
  const constraints = [];

  if (filters.storeId) constraints.push(where('storeId', '==', filters.storeId));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.source) constraints.push(where('source', '==', filters.source));

  constraints.push(orderBy('createdAt', 'desc'));
  return query(base, ...constraints);
}

export async function createStorefrontOrder(db, tenantId, payload) {
  const model = createOrderModel({ ...payload, tenantId, source: 'storefront' });
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS)), {
    ...model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getOrder(db, tenantId, orderId) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId));
  return docToEntity(snap);
}

export async function listOrders(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildOrdersQuery(db, tenantId, filters)));
}

export function watchOrders(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildOrdersQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function updateOrderStatus(db, tenantId, orderId, status, meta = {}) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId), {
    status,
    ...meta,
    updatedAt: serverTimestamp(),
  });
}
