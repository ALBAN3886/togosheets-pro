export function createCashSessionModel(payload = {}) {
  return {
    tenantId: payload.tenantId || '',
    storeId: payload.storeId || '',
    employeeId: payload.employeeId || '',
    employeeName: payload.employeeName || '',
    openingAmount: Number(payload.openingAmount ?? 0),
    closingAmount: payload.closingAmount == null ? null : Number(payload.closingAmount),
    expectedClosingAmount: payload.expectedClosingAmount == null ? null : Number(payload.expectedClosingAmount),
    differenceAmount: payload.differenceAmount == null ? null : Number(payload.differenceAmount),
    note: payload.note || '',
    status: payload.status || 'open'
  };
}
