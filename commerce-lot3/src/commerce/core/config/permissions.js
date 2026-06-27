export const COMMERCE_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CLIENT: 'client'
};

export const DEFAULT_PERMISSIONS = {
  owner: {
    stores: ['read','write','delete'],
    products: ['read','write','delete'],
    inventory: ['read','write'],
    sales: ['read','write'],
    employees: ['read','write','delete'],
    roles: ['read','write'],
    storefront: ['publish'],
    cashier: ['open','close']
  },
  manager: {
    stores: ['read'],
    products: ['read','write'],
    inventory: ['read','write'],
    sales: ['read','write'],
    employees: ['read'],
    roles: ['read'],
    storefront: ['publish'],
    cashier: ['open','close']
  },
  employee: {
    stores: ['read'],
    products: ['read'],
    inventory: ['read'],
    sales: ['read','write'],
    employees: [],
    roles: [],
    storefront: [],
    cashier: ['open','close']
  },
  client: {
    storefront: ['browse','order']
  }
};

export function can(permissionSet, resource, action) {
  return Array.isArray(permissionSet?.[resource]) && permissionSet[resource].includes(action);
}
