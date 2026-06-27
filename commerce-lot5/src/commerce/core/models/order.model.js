export function createOrderModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeId: payload.storeId || '',
    source: payload.source || 'storefront',
    status: payload.status || 'pending',
    customer: {
      name: payload.customer?.name || '',
      phone: payload.customer?.phone || '',
      city: payload.customer?.city || '',
      note: payload.customer?.note || ''
    },
    items: Array.isArray(payload.items) ? payload.items.map(item => ({
      productId: item.productId || item.id || '',
      name: item.name || '',
      qty: Number(item.qty ?? 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      total: Number(item.total ?? (Number(item.qty ?? 0) * Number(item.unitPrice ?? item.price ?? 0)))
    })) : [],
    subtotal: Number(payload.subtotal ?? 0),
    discountTotal: Number(payload.discountTotal ?? 0),
    grandTotal: Number(payload.grandTotal ?? payload.subtotal ?? 0)
  };
}
