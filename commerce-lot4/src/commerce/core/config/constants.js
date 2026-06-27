export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  READY: 'ready',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export const SALE_SOURCES = {
  STOREFRONT: 'storefront',
  EMPLOYEE_POS: 'employee-pos',
  ADMIN: 'admin'
};

export const CASH_SESSION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed'
};

export const STOCK_MOVEMENT_TYPES = {
  ADJUSTMENT: 'adjustment',
  SALE: 'sale',
  RETURN: 'return',
  RESTOCK: 'restock',
  TRANSFER: 'transfer'
};

export const PAYMENT_METHODS = ['cash', 'mobile_money', 'card', 'bank_transfer', 'other'];
