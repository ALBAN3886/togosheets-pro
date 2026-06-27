import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import { createSaleModel } from '../models/sale.model.js';
import { createInventoryId, createReceiptNumber } from '../utils/ids.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function salesCollection(db, tenantId) {
  return collection(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES));
}

function inventoryRef(db, tenantId, storeId, productId) {
  return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY), createInventoryId(storeId, productId));
}

function stockMovementRef(db, tenantId, movementId) {
  return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.STOCK_MOVEMENTS), movementId);
}

export async function getSale(db, tenantId, saleId) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES), saleId));
  return docToEntity(snap);
}

export async function listSales(db, tenantId, { storeId } = {}) {
  const base = salesCollection(db, tenantId);
  const q = storeId
    ? query(base, where('storeId', '==', storeId), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'));
  return docsToEntities(await getDocs(q));
}

export function watchSales(db, tenantId, { storeId } = {}, onChange) {
  const base = salesCollection(db, tenantId);
  const q = storeId
    ? query(base, where('storeId', '==', storeId), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
}

export async function createSaleTransactional(db, tenantId, payload) {
  return runTransaction(db, async tx => {
    const createdAtMs = Date.now();
    const saleDoc = doc(salesCollection(db, tenantId));
    const movementIds = [];
    let subtotal = 0;

    for (const item of payload.items || []) {
      const productId = item.productId || item.id;
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const invDocRef = inventoryRef(db, tenantId, payload.storeId, productId);
      const invSnap = await tx.get(invDocRef);

      if (!invSnap.exists()) {
        throw new Error(`Stock introuvable pour ${productId}`);
      }

      const inv = invSnap.data() || {};
      const available = Number(inv.availableQuantity ?? inv.quantity ?? 0);
      if (available < qty) {
        throw new Error(`Stock insuffisant pour ${item.name || productId}`);
      }

      const lineTotal = qty * unitPrice;
      subtotal += lineTotal;

      tx.update(invDocRef, {
        quantity: Number(inv.quantity || 0) - qty,
        availableQuantity: available - qty,
        updatedAt: serverTimestamp(),
      });

      const movementRef = stockMovementRef(db, tenantId, doc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STOCK_MOVEMENTS))).id);
      tx.set(movementRef, {
        tenantId,
        storeId: payload.storeId,
        productId,
        type: STOCK_MOVEMENT_TYPES.SALE,
        qty,
        unitPrice,
        total: lineTotal,
        employeeId: payload.sellerEmployeeId,
        employeeName: payload.sellerName || '',
        createdAt: serverTimestamp(),
        createdAtMs,
      });
      movementIds.push(movementRef.id);
    }

    const saleModel = createSaleModel({
      ...payload,
      tenantId,
      subtotal,
      grandTotal: Number(payload.grandTotal ?? subtotal),
      receiptNumber: payload.receiptNumber || createReceiptNumber(new Date(createdAtMs), String(createdAtMs).slice(-4)),
    });

    tx.set(saleDoc, {
      ...saleModel,
      movementIds,
      createdAt: serverTimestamp(),
      createdAtMs,
    });

    if (payload.originOrderId) {
      tx.update(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), payload.originOrderId), {
        status: 'completed',
        linkedSaleId: saleDoc.id,
        updatedAt: serverTimestamp(),
      });
    }

    return { saleId: saleDoc.id, movementIds };
  });
}
