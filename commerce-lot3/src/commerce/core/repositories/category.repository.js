import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createCategoryModel } from '../models/category.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

export async function createCategory(db, tenantId, payload) {
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES)), { ...createCategoryModel({ ...payload, tenantId }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function listCategories(db, tenantId) {
  return docsToEntities(await getDocs(query(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES)), orderBy('sortOrder','asc'))));
}

export async function getCategory(db, tenantId, categoryId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES), categoryId)));
}

export function watchCategories(db, tenantId, onChange) {
  return onSnapshot(query(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES)), orderBy('sortOrder','asc')), snap => onChange(docsToEntities(snap)));
}

export async function updateCategory(db, tenantId, categoryId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES), categoryId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteCategory(db, tenantId, categoryId) {
  await deleteDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.CATEGORIES), categoryId));
}
