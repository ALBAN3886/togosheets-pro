import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createProductModel } from '../models/product.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildProductsQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS));
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeIds','array-contains',filters.storeId));
  if (filters.categoryId) constraints.push(where('categoryId','==',filters.categoryId));
  if (typeof filters.isPublished === 'boolean') constraints.push(where('isPublished','==',filters.isPublished));
  if (typeof filters.isActive === 'boolean') constraints.push(where('isActive','==',filters.isActive));
  constraints.push(orderBy('name','asc'));
  return query(base, ...constraints);
}

export async function createProduct(db, tenantId, payload) {
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS)), { ...createProductModel({ ...payload, tenantId }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function getProduct(db, tenantId, productId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId)));
}

export async function listProducts(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildProductsQuery(db, tenantId, filters)));
}

export function watchProducts(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildProductsQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function updateProduct(db, tenantId, productId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteProduct(db, tenantId, productId) {
  await deleteDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS), productId));
}
