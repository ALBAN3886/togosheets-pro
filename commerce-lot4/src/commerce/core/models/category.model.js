export function createCategoryModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    name: payload.name || '',
    slug: payload.slug || '',
    description: payload.description || '',
    sortOrder: Number(payload.sortOrder ?? 0),
    isActive: payload.isActive ?? true
  };
}
