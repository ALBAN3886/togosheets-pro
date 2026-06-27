import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createEmployeeModel } from '../models/employee.model.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function buildEmployeesQuery(db, tenantId, filters = {}) {
  const base = collection(db, tenantCollectionPath(tenantId, COLLECTIONS.EMPLOYEES));
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeIds', 'array-contains', filters.storeId));
  if (filters.role) constraints.push(where('role', '==', filters.role));
  constraints.push(orderBy('displayName', 'asc'));
  return query(base, ...constraints);
}

export async function createEmployee(db, tenantId, payload) {
  const model = createEmployeeModel({ ...payload, tenantId });
  const ref = await addDoc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.EMPLOYEES)), {
    ...model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getEmployee(db, tenantId, employeeId) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.EMPLOYEES), employeeId));
  return docToEntity(snap);
}

export async function listEmployees(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildEmployeesQuery(db, tenantId, filters)));
}

export function watchEmployees(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildEmployeesQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function updateEmployee(db, tenantId, employeeId, patch) {
  await updateDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.EMPLOYEES), employeeId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
