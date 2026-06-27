import { collection, addDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createStockMovementModel } from '../models/stock-movement.model.js';
import { docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildStockMovementQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STOCK_MOVEMENTS));
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeId','==',filters.storeId));
  if (filters.productId) constraints.push(where('productId','==',filters.productId));
  if (filters.type) constraints.push(where('type','==',filters.type));
  constraints.push(orderBy('createdAt','desc'));
  return query(base, ...constraints);
}

export async function createStockMovement(db, tenantId, payload) {
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STOCK_MOVEMENTS)), {
    ...createStockMovementModel({ ...payload, tenantId }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function listStockMovements(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildStockMovementQuery(db, tenantId, filters)));
}

export function watchStockMovements(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildStockMovementQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}
