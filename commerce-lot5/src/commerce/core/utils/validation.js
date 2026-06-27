export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function requireString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} requis`);
}

export function requireArray(value, label) {
  assert(Array.isArray(value), `${label} doit être une liste`);
}

export function validateOrderPayload(payload) {
  requireString(payload?.tenantId, 'tenantId');
  requireString(payload?.storeId, 'storeId');
  requireArray(payload?.items, 'items');
  assert(payload.items.length > 0, 'La commande doit contenir au moins un article');
}

export function validateSalePayload(payload) {
  requireString(payload?.tenantId, 'tenantId');
  requireString(payload?.storeId, 'storeId');
  requireArray(payload?.items, 'items');
  assert(payload.items.length > 0, 'La vente doit contenir au moins un article');
}
