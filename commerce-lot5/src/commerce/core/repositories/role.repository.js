import { collection, doc, getDoc, getDocs, setDoc, query, where, onSnapshot, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

export async function getRoleBinding(db, tenantId, uid) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS), uid)));
}

export async function setRoleBinding(db, tenantId, uid, payload) {
  await setDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS), uid), {
    uid,
    role: payload.role,
    storeIds: Array.isArray(payload.storeIds) ? payload.storeIds : [],
    employeeId: payload.employeeId || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function listRoleBindings(db, tenantId, role = null) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS));
  const q = role ? query(base, where('role','==',role)) : base;
  return docsToEntities(await getDocs(q));
}

export function watchRoleBindings(db, tenantId, role = null, onChange) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS));
  const q = role ? query(base, where('role','==',role)) : base;
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
}
