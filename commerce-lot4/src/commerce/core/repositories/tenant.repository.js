import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createTenantModel } from '../models/tenant.model.js';
import { docToEntity } from '../utils/mappers.js';

export async function createTenant(db, tenantId, payload) {
  await setDoc(doc(db, COLLECTIONS.TENANTS, tenantId), {
    ...createTenantModel(payload),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function getTenant(db, tenantId) {
  return docToEntity(await getDoc(doc(db, COLLECTIONS.TENANTS, tenantId)));
}

export async function updateTenant(db, tenantId, patch) {
  await updateDoc(doc(db, COLLECTIONS.TENANTS, tenantId), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}
