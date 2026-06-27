export function createStockMovementModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeId: payload.storeId || '',
    productId: payload.productId || '',
    saleId: payload.saleId || null,
    orderId: payload.orderId || null,
    type: payload.type || 'adjustment',
    qty: Number(payload.qty ?? 0),
    unitPrice: Number(payload.unitPrice ?? 0),
    total: Number(payload.total ?? 0),
    note: payload.note || '',
    employeeId: payload.employeeId || '',
    employeeName: payload.employeeName || ''
  };
}
