export function createEmployeeModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeIds: Array.isArray(payload.storeIds) ? payload.storeIds : [],
    firebaseUid: payload.firebaseUid || null,
    displayName: payload.displayName || '',
    phone: payload.phone || '',
    role: payload.role || 'employee',
    status: payload.status || 'active',
    pinHash: payload.pinHash || '',
    permissions: {
      canSell: payload.permissions?.canSell ?? true,
      canViewStock: payload.permissions?.canViewStock ?? true,
      canManageProducts: payload.permissions?.canManageProducts ?? false,
      canManageEmployees: payload.permissions?.canManageEmployees ?? false,
      canOpenCash: payload.permissions?.canOpenCash ?? true,
      canCloseCash: payload.permissions?.canCloseCash ?? true
    },
    accessLink: {
      token: payload.accessLink?.token || '',
      expiresAt: payload.accessLink?.expiresAt || null,
      disabledAt: payload.accessLink?.disabledAt || null
    }
  };
}
