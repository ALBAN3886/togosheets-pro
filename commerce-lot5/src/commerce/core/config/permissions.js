export const COMMERCE_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CLIENT: 'client'
};

export const DEFAULT_PERMISSIONS = {
  owner: {
    stores: ['read','write','delete'],
    products: ['read','write','delete','publish'],
    inventory: ['read','write'],
    sales: ['read','write','delete'],
    employees: ['read','write','delete'],
    roles: ['read','write'],
    storefront: ['browse','publish'],
    cashier: ['open','close','read'],
    reports: ['read'],
    invoices: ['read','print'],
    stockMovements: ['read','write','delete'],
    settings: ['read','write'],
    orders: ['read','write','delete']
  },
  manager: {
    stores: ['read'],
    products: ['read','write','publish'],
    inventory: ['read','write'],
    sales: ['read','write'],
    employees: ['read'],
    roles: ['read'],
    storefront: ['browse','publish'],
    cashier: ['open','close','read'],
    reports: ['read'],
    invoices: ['read','print'],
    stockMovements: ['read','write'],
    settings: ['read'],
    orders: ['read','write']
  },
  employee: {
    stores: ['read'],
    products: ['read'],
    inventory: ['read'],
    sales: ['read','write'],
    employees: [],
    roles: [],
    storefront: ['browse'],
    cashier: ['open','close','read'],
    reports: ['read'],
    invoices: ['read','print'],
    stockMovements: ['read','write'],
    settings: [],
    orders: ['read','write']
  },
  client: {
    storefront: ['browse','order'],
    orders: ['read']
  }
};

export function can(permissionSet, resource, action) {
  return Array.isArray(permissionSet?.[resource]) && permissionSet[resource].includes(action);
}

export function isPrivilegedRole(role) {
  return role === COMMERCE_ROLES.OWNER || role === COMMERCE_ROLES.MANAGER || role === COMMERCE_ROLES.EMPLOYEE;
}
