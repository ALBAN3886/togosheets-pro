export function createProductModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeIds: Array.isArray(payload.storeIds) ? payload.storeIds : [],
    categoryId: payload.categoryId || '',
    name: payload.name || '',
    sku: payload.sku || '',
    barcode: payload.barcode || '',
    description: payload.description || '',
    purchasePrice: Number(payload.purchasePrice ?? 0),
    salePrice: Number(payload.salePrice ?? 0),
    promoPrice: payload.promoPrice == null ? null : Number(payload.promoPrice),
    currency: payload.currency || 'XOF',
    unit: payload.unit || 'piece',
    imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
    isPublished: payload.isPublished ?? false,
    isActive: payload.isActive ?? true,
    trackStock: payload.trackStock ?? true,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
  };
}
