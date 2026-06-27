import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

export async function getRoleBinding(db, tenantId, uid) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS), uid));
  return docToEntity(snap);
}

export async function setRoleBinding(db, tenantId, uid, payload) {
  await setDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS), uid), {
    uid,
    role: payload.role,
    storeIds: Array.isArray(payload.storeIds) ? payload.storeIds : [],
    employeeId: payload.employeeId || null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function listRoleBindingsByRole(db, tenantId, role) {
  const q = query(
    collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS)),
    where('role', '==', role)
  );
  return docsToEntities(await getDocs(q));
}

export function watchRoleBindings(db, tenantId, role, onChange) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS));
  const q = role ? query(base, where('role', '==', role)) : base;
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
}

export async function deleteRoleBinding(db, tenantId, uid) {
  await deleteDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ROLE_BINDINGS), uid));
}
