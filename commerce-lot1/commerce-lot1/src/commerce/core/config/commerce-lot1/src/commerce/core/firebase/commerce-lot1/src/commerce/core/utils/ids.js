export function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createInventoryId(storeId, productId) {
  return `${storeId}_${productId}`;
}

export function createReceiptNumber(date = new Date(), serial = '0001') {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `AET-${y}${m}${d}-${serial}`;
}
