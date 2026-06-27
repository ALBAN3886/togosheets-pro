export function createTenantModel(payload = {}) {
  return {
    name: payload.name || 'AET Commerce',
    ownerUid: payload.ownerUid || '',
    status: payload.status || 'active',
    currency: payload.currency || 'XOF',
    country: payload.country || 'TG',
    timezone: payload.timezone || 'Africa/Lome'
  };
}