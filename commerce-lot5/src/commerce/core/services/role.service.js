import { DEFAULT_PERMISSIONS, COMMERCE_ROLES, can as canAction } from '../config/permissions.js';
import * as rolesRepo from '../repositories/role.repository.js';

export async function getCommerceContext(db, tenantId, authUser) {
  if (!authUser?.uid) throw new Error('Utilisateur non authentifié');
  const binding = await rolesRepo.getRoleBinding(db, tenantId, authUser.uid);
  const role = binding?.role || COMMERCE_ROLES.CLIENT;
  const permissions = DEFAULT_PERMISSIONS[role] || {};
  return {
    tenantId,
    authUser,
    binding,
    role,
    permissions,
    storeIds: binding?.storeIds || [],
    employeeId: binding?.employeeId || authUser.uid,
    isOwner: role === COMMERCE_ROLES.OWNER,
    isManager: role === COMMERCE_ROLES.MANAGER,
    isEmployee: role === COMMERCE_ROLES.EMPLOYEE,
    can(resource, action) {
      return canAction(permissions, resource, action);
    }
  };
}

export function assertCan(context, resource, action) {
  if (!context?.can(resource, action)) throw new Error(`Permission refusée: ${resource}.${action}`);
}

export function hasStoreAccess(context, storeId) {
  if (!storeId) return true;
  if (context?.role === COMMERCE_ROLES.OWNER) return true;
  if (!Array.isArray(context?.storeIds) || context.storeIds.length === 0) return false;
  return context.storeIds.includes(storeId);
}

export function assertStoreAccess(context, storeId) {
  if (!hasStoreAccess(context, storeId)) throw new Error(`Accès refusé à la boutique ${storeId}`);
}
