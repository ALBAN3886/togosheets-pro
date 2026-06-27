import { DEFAULT_PERMISSIONS, can as canAction, COMMERCE_ROLES } from '../config/permissions.js';
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
    employeeId: binding?.employeeId || null,
    can(resource, action) {
      return canAction(permissions, resource, action);
    },
  };
}

export function assertCan(context, resource, action) {
  if (!context?.can(resource, action)) {
    throw new Error(`Permission refusée: ${resource}.${action}`);
  }
}
