export function createSaleModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeId: payload.storeId || '',
    cashSessionId: payload.cashSessionId || null,
    sellerEmployeeId: payload.sellerEmployeeId || '',
    sellerName: payload.sellerName || '',
    source: payload.source || 'employee-pos',
    originOrderId: payload.originOrderId || null,
    items: Array.isArray(payload.items) ? payload.items.map(item => ({
      productId: item.productId || item.id || '',
      name: item.name || '',
      qty: Number(item.qty ?? 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      total: Number(item.total ?? (Number(item.qty ?? 0) * Number(item.unitPrice ?? item.price ?? 0))),
    })) : [],
    subtotal: Number(payload.subtotal ?? 0),
    discountTotal: Number(payload.discountTotal ?? 0),
    taxTotal: Number(payload.taxTotal ?? 0),
    grandTotal: Number(payload.grandTotal ?? payload.subtotal ?? 0),
    paymentMethod: payload.paymentMethod || 'cash',
    receiptNumber: payload.receiptNumber || '',
    createdAt: payload.createdAt || null,
  };
}
