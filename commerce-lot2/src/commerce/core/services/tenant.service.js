import * as tenantRepo from '../repositories/tenant.repository.js';

export async function bootstrapTenant(db, tenantId, ownerUid, name = 'AET Commerce') {
  await tenantRepo.createTenant(db, tenantId, {
    ownerUid,
    name,
    status: 'active',
    currency: 'XOF',
    country: 'TG',
    timezone: 'Africa/Lome',
  });
}
