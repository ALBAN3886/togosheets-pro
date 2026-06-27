export function createInventoryModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeId: payload.storeId || '',
    productId: payload.productId || '',
    quantity: Number(payload.quantity ?? 0),
    reservedQuantity: Number(payload.reservedQuantity ?? 0),
    availableQuantity: Number(payload.availableQuantity ?? (Number(payload.quantity ?? 0) - Number(payload.reservedQuantity ?? 0))),
    reorderLevel: Number(payload.reorderLevel ?? 5),
    updatedAt: payload.updatedAt || null,
  };
}
