export function createStoreModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    name: payload.name || '',
    code: payload.code || '',
    type: payload.type || 'retail',
    address: payload.address || '',
    city: payload.city || '',
    country: payload.country || 'TG',
    phone: payload.phone || '',
    isActive: payload.isActive ?? true,
    stockAlertThreshold: Number(payload.stockAlertThreshold ?? 5),
    branding: {
      logoUrl: payload.branding?.logoUrl || '',
      coverUrl: payload.branding?.coverUrl || '',
      accentColor: payload.branding?.accentColor || '#10b981',
      slogan: payload.branding?.slogan || ''
    }
  };
}
