import { collection, doc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, runTransaction } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { createSaleModel } from '../models/sale.model.js';
import { createInventoryId, createReceiptNumber } from '../utils/ids.js';
import { docToEntity, docsToEntities } from '../utils/mappers.js';
import { tenantCollectionPath } from './_paths.js';

function salesCollection(db, tenantId) { return collection(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES)); }
function inventoryRef(db, tenantId, storeId, productId) { return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY), createInventoryId(storeId, productId)); }
function orderRef(db, tenantId, orderId) { return doc(db, tenantCollectionPath(tenantId, COLLECTIONS.ORDERS), orderId); }

export async function getSale(db, tenantId, saleId) {
  return docToEntity(await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.SALES), saleId)));
}

export async function listSales(db, tenantId, { storeId } = {}) {
  const base = salesCollection(db, tenantId);
  const q = storeId ? query(base, where('storeId','==',storeId), orderBy('createdAt','desc')) : query(base, orderBy('createdAt','desc'));
  return docsToEntities(await getDocs(q));
}

export function watchSales(db, tenantId, { storeId } = {}, onChange) {
  const base = salesCollection(db, tenantId);
  const q = storeId ? query(base, where('storeId','==',storeId), orderBy('createdAt','desc')) : query(base, orderBy('createdAt','desc'));
  return onSnapshot(q, snap => onChange(docsToEntities(snap)));
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
