import * as tenantRepo from '../repositories/tenant.repository.js';
import * as settingsRepo from '../repositories/settings.repository.js';
import { SETTINGS_DOCS } from '../config/collections.js';

export async function bootstrapTenant(db, tenantId, ownerUid, name = 'AET Commerce') {
  await tenantRepo.createTenant(db, tenantId, {
    ownerUid,
    name,
    status: 'active',
    currency: 'XOF',
    country: 'TG',
    timezone: 'Africa/Lome'
  });
  await settingsRepo.saveSettings(db, tenantId, SETTINGS_DOCS.GENERAL, {
    currency: 'XOF',
    locale: 'fr-FR'
  });
}
