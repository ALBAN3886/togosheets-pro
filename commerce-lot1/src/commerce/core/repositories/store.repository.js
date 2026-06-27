import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createStoreModel } from '../models/store.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

export async function createStore(db, tenantId, payload) {
  const model = createStoreModel({ ...payload, tenantId });
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES)), {
    ...model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getStore(db, tenantId, storeId) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES), storeId));
  return docToEntity(snap);
}

export async function listStores(db, tenantId, { onlyActive = false } = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES));
  const q = onlyActive
    ? query(base, where('isActive', '==', true), orderBy('name', 'asc'))
    : query(base, orderBy('name', 'asc'));
  return docsToEntities(await getDocs(q));
}

export function watchStores(db, tenantId, { onlyActive = false } = {}, onChange) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES));
  const q = onlyActive
    ? query(base, where('isActive', '==', true), orderBy('name', 'asc'))
    : query(base, orderBy('name', 'asc'));
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
}

export async function updateStore(db, tenantId, storeId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES), storeId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function replaceStore(db, tenantId, storeId, payload) {
  const model = createStoreModel({ ...payload, tenantId });
  await setDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES), storeId), {
    ...model,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteStore(db, tenantId, storeId) {
  await deleteDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES), storeId));
}
