export const COMMERCE_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CLIENT: 'client',
};

export const COMMERCE_RESOURCES = {
  STORES: 'stores',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  SALES: 'sales',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  EMPLOYEES: 'employees',
  ROLES: 'roles',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  STOREFRONT: 'storefront',
  CASHIER: 'cashier',
};

export const DEFAULT_PERMISSIONS = {
  [COMMERCE_ROLES.OWNER]: {
    stores: ['read', 'write', 'delete'],
    products: ['read', 'write', 'delete'],
    inventory: ['read', 'write'],
    purchases: ['read', 'write'],
    sales: ['read', 'write', 'refund'],
    customers: ['read', 'write', 'delete'],
    suppliers: ['read', 'write', 'delete'],
    employees: ['read', 'write', 'delete'],
    roles: ['read', 'write'],
    reports: ['read'],
    settings: ['read', 'write'],
    storefront: ['publish'],
    cashier: ['open', 'close'],
  },
  [COMMERCE_ROLES.MANAGER]: {
    stores: ['read'],
    products: ['read', 'write'],
    inventory: ['read', 'write'],
    purchases: ['read', 'write'],
    sales: ['read', 'write'],
    customers: ['read', 'write'],
    suppliers: ['read', 'write'],
    employees: ['read'],
    roles: ['read'],
    reports: ['read'],
    settings: ['read'],
    storefront: ['publish'],
    cashier: ['open', 'close'],
  },
  [COMMERCE_ROLES.EMPLOYEE]: {
    stores: ['read'],
    products: ['read'],
    inventory: ['read'],
    purchases: [],
    sales: ['read', 'write'],
    customers: ['read', 'write'],
    suppliers: [],
    employees: [],
    roles: [],
    reports: [],
    settings: [],
    storefront: [],
    cashier: ['open', 'close'],
  },
  [COMMERCE_ROLES.CLIENT]: {
    storefront: ['browse', 'order'],
    ownOrders: ['read'],
  },
};

export function can(permissionSet, resource, action) {
  return Array.isArray(permissionSet?.[resource]) && permissionSet[resource].includes(action);
}
