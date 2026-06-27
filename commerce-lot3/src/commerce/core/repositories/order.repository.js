import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createOrderModel } from '../models/order.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildOrdersQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS));
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeId','==',filters.storeId));
  if (filters.status) constraints.push(where('status','==',filters.status));
  constraints.push(orderBy('createdAt','desc'));
  return query(base, ...constraints);
}

export async function createOrder(db, tenantId, payload) {
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS)), { ...createOrderModel({ ...payload, tenantId }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function getOrder(db, tenantId, orderId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId)));
}

export async function listOrders(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildOrdersQuery(db, tenantId, filters)));
}

export function watchOrders(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildOrdersQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function updateOrder(db, tenantId, orderId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId), { ...patch, updatedAt: serverTimestamp() });
}
