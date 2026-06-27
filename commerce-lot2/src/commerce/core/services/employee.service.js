import * as employeesRepo from '../repositories/employee.repository.js';
import * as rolesRepo from '../repositories/role.repository.js';
import { assertCan } from './role.service.js';

export async function saveEmployee(db, context, payload) {
  assertCan(context, 'employees', 'write');
  if (payload.id) {
    await employeesRepo.updateEmployee(db, context.tenantId, payload.id, payload);
    return payload.id;
  }
  return employeesRepo.createEmployee(db, context.tenantId, payload);
}

export async function issueEmployeeAccessLink(db, context, employeeId) {
  assertCan(context, 'employees', 'write');
  const token = crypto.randomUUID ? crypto.randomUUID() : `emp_${Date.now()}`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await employeesRepo.updateEmployee(db, context.tenantId, employeeId, {
    accessLink: { token, expiresAt, disabledAt: null },
  });
  return { token, expiresAt };
}

export async function bindEmployeeRole(db, context, uid, role, storeIds = [], employeeId = null) {
  assertCan(context, 'roles', 'write');
  return rolesRepo.setRoleBinding(db, context.tenantId, uid, { role, storeIds, employeeId });
}
