import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createProductModel } from '../models/product.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildProductsQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS));
  const constraints = [];

  if (filters.storeId) constraints.push(where('storeIds', 'array-contains', filters.storeId));
  if (filters.categoryId) constraints.push(where('categoryId', '==', filters.categoryId));
  if (typeof filters.isPublished === 'boolean') constraints.push(where('isPublished', '==', filters.isPublished));
  if (typeof filters.isActive === 'boolean') constraints.push(where('isActive', '==', filters.isActive));

  constraints.push(orderBy('name', 'asc'));
  return query(base, ...constraints);
}

export async function createProduct(db, tenantId, payload) {
  const model = createProductModel({ ...payload, tenantId });
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS)), {
    ...model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getProduct(db, tenantId, productId) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId));
  return docToEntity(snap);
}

export async function listProducts(db, tenantId, filters = {}) {
  const snap = await getDocs(buildProductsQuery(db, tenantId, filters));
  return docsToEntities(snap);
}

export function watchProducts(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildProductsQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function updateProduct(db, tenantId, productId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveProduct(db, tenantId, productId) {
  return updateProduct(db, tenantId, productId, {
    isActive: false,
    isPublished: false,
  });
}

export async function deleteProduct(db, tenantId, productId) {
  await deleteDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId));
}
