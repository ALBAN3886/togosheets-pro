import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createInventoryModel } from '../models/inventory.model.js';
import { createInventoryId } from '../utils/ids.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function inventoryDocRef(db, tenantId, storeId, productId) {
  return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY), createInventoryId(storeId, productId));
}

export async function getInventoryByProduct(db, tenantId, storeId, productId) {
  const snap = await getDoc(inventoryDocRef(db, tenantId, storeId, productId));
  return docToEntity(snap);
}

export async function listInventory(db, tenantId, { storeId } = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY));
  const q = storeId ? query(base, where('storeId', '==', storeId)) : base;
  return docsToEntities(await getDocs(q));
}

export function watchInventory(db, tenantId, { storeId } = {}, onChange) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY));
  const q = storeId ? query(base, where('storeId', '==', storeId)) : base;
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
}

export async function setInventoryQuantity(db, tenantId, storeId, productId, payload) {
  const model = createInventoryModel({ ...payload, tenantId, storeId, productId });
  await setDoc(inventoryDocRef(db, tenantId, storeId, productId), {
    ...model,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function incrementInventory(db, tenantId, storeId, productId, delta) {
  await updateDoc(inventoryDocRef(db, tenantId, storeId, productId), {
    quantity: increment(delta),
    availableQuantity: increment(delta),
    updatedAt: serverTimestamp(),
  });
}
