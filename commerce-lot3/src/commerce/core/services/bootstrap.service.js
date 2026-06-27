import { bootstrapTenant } from './tenant.service.js';
import * as rolesRepo from '../repositories/role.repository.js';

export async function ensureOwnerBootstrap(db, tenantId, authUser) {
  await bootstrapTenant(db, tenantId, authUser.uid, 'AET Commerce');
  await rolesRepo.setRoleBinding(db, tenantId, authUser.uid, {
    role: 'owner',
    storeIds: [],
    employeeId: null
  });
}
