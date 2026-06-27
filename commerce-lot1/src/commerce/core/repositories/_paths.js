import { COLLECTIONS } from '../config/collections.js';

export function tenantDocPath(tenantId) {
  return `${COLLECTIONS.TENANTS}/${tenantId}`;
}

export function tenantCollectionPath(tenantId, collectionName) {
  return `${tenantDocPath(tenantId)}/${collectionName}`;
}
