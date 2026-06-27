import { collection, doc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, runTransaction } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import { createSaleModel } from '../models/sale.model.js';
import { createStockMovementModel } from '../models/stock-movement.model.js';
import { createInventoryId, createReceiptNumber } from '../utils/ids.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function salesCollection(db, tenantId) { return collection(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES)); }
function stockMovementsCollection(db, tenantId) { return collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STOCK_MOVEMENTS)); }
function inventoryRef(db, tenantId, storeId, productId) { return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY), createInventoryId(storeId, productId)); }
function orderRef(db, tenantId, orderId) { return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId); }

function buildSalesQuery(db, tenantId, filters = {}) {
  const base = salesCollection(db, tenantId);
  const constraints = [];
  if (filters.storeId) constraints.push(where('storeId','==',filters.storeId));
  if (filters.cashSessionId) constraints.push(where('cashSessionId','==',filters.cashSessionId));
  if (filters.paymentMethod) constraints.push(where('paymentMethod','==',filters.paymentMethod));
  constraints.push(orderBy('createdAt','desc'));
  return query(base, ...constraints);
}

export async function getSale(db, tenantId, saleId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES), saleId)));
}

export async function listSales(db, tenantId, filters = {}) {
  return docsToEntities(await getDocs(buildSalesQuery(db, tenantId, filters)));
}

export function watchSales(db, tenantId, filters = {}, onChange) {
  return onSnapshot(buildSalesQuery(db, tenantId, filters), snap => onChange(docsToEntities(snap)));
}

export async function createSaleTransactional(db, tenantId, payload) {
  return runTransaction(db, async tx => {
    const createdAtMs = Date.now();
    const saleDoc = doc(salesCollection(db, tenantId));
    let subtotal = 0;

    for (const item of payload.items || []) {
      const productId = item.productId || item.id;
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      if (qty <= 0) throw new Error(`Quantité invalide pour ${item.name || productId}`);
      const invRef = inventoryRef(db, tenantId, payload.storeId, productId);
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists()) throw new Error(`Stock introuvable pour ${productId}`);
      const inv = invSnap.data() || {};
      const available = Number(inv.availableQuantity ?? inv.quantity ?? 0);
      if (available < qty) throw new Error(`Stock insuffisant pour ${item.name || productId}`);
      subtotal += qty * unitPrice;
      tx.update(invRef, {
        quantity: Number(inv.quantity || 0) - qty,
        availableQuantity: available - qty,
        updatedAt: serverTimestamp()
      });

      const movementRef = doc(stockMovementsCollection(db, tenantId));
      tx.set(movementRef, {
        ...createStockMovementModel({
          tenantId,
          storeId: payload.storeId,
          productId,
          saleId: saleDoc.id,
          orderId: payload.originOrderId || null,
          type: STOCK_MOVEMENT_TYPES.SALE,
          qty: -qty,
          unitPrice,
          total: -(qty * unitPrice),
          note: payload.note || 'Sortie automatique liée à une vente',
          employeeId: payload.sellerEmployeeId || '',
          employeeName: payload.sellerName || ''
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    tx.set(saleDoc, {
      ...createSaleModel({
        ...payload,
        tenantId,
        subtotal,
        grandTotal: Number(payload.grandTotal ?? subtotal),
        receiptNumber: payload.receiptNumber || createReceiptNumber(new Date(createdAtMs), String(createdAtMs).slice(-4))
      }),
      createdAt: serverTimestamp(),
      createdAtMs
    });

    if (payload.originOrderId) {
      tx.update(orderRef(db, tenantId, payload.originOrderId), {
        status: 'completed',
        linkedSaleId: saleDoc.id,
        updatedAt: serverTimestamp()
      });
    }

    return { saleId: saleDoc.id };
  });
}
