import * as cashSessionsRepo from '../repositories/cash-session.repository.js';
export function watchCashSessionsRealtime(db, tenantId, filters, onChange) {
  return cashSessionsRepo.watchCashSessions(db, tenantId, filters, onChange);
}
