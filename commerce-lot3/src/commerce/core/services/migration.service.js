import { writeBatch, doc, collection, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS } from '../config/collections.js';
import { tenantCollectionPath } from '../repositories/_paths.js';
import { getLegacyCommerceData } from '../legacy/legacy-source.repository.js';
import { mapLegacyCommerceData } from '../adapters/legacy-commerce.adapter.js';
import * as tenantRepo from '../repositories/tenant.repository.js';
import * as rolesRepo from '../repositories/role.repository.js';
import { createInventoryId } from '../utils/ids.js';

export async function migrateLegacyCommerce(db, ownerUid, tenantId = ownerUid) {
  const legacy = await getLegacyCommerceData(db, ownerUid);
  if (!legacy) throw new Error('Aucune donnée legacy commerce_data trouvée');
  const mapped = mapLegacyCommerceData(ownerUid, legacy);

  await tenantRepo.createTenant(db, tenantId, mapped.tenant);
  await rolesRepo.setRoleBinding(db, tenantId, ownerUid, { role: 'owner', storeIds: [], employeeId: null });

  const batch = writeBatch(db);
  const storeIdMap = new Map();

  mapped.stores.forEach((store, index) => {
    const ref = doc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.STORES)));
    storeIdMap.set(store.legacyId, ref.id);
    batch.set(ref, { ...store, tenantId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  mapped.employees?.forEach(employee => {
    const ref = doc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.EMPLOYEES)));
    const nextStoreId = storeIdMap.get(employee.legacyShopId);
    batch.set(ref, {
      tenantId,
      storeIds: nextStoreId ? [nextStoreId] : [],
      firebaseUid: null,
      displayName: employee.displayName,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
      pinHash: employee.pinHash,
      permissions: {
        canSell: true,
        canViewStock: true,
        canManageProducts: employee.role === 'manager',
        canManageEmployees: false,
        canOpenCash: true,
        canCloseCash: true
      },
      accessLink: { token: '', expiresAt: null, disabledAt: null },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  mapped.products.forEach(product => {
    const ref = doc(collection(db, tenantCollectionPath(tenantId, COLLECTIONS.PRODUCTS)));
    const nextStoreId = storeIdMap.get(product.legacyShopId);
    batch.set(ref, {
      ...product,
      tenantId,
      storeIds: nextStoreId ? [nextStoreId] : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    if (nextStoreId) {
      const invRef = doc(db, tenantCollectionPath(tenantId, COLLECTIONS.INVENTORY), createInventoryId(nextStoreId, ref.id));
      batch.set(invRef, {
        tenantId,
        storeId: nextStoreId,
        productId: ref.id,
        quantity: Number(product.stock || 0),
        reservedQuantity: 0,
        availableQuantity: Number(product.stock || 0),
        reorderLevel: Number(product.reorderLevel || 5),
        updatedAt: serverTimestamp()
      });
    }
  });

  await batch.commit();
  return {
    migratedStores: mapped.stores.length,
    migratedEmployees: mapped.employees?.length || 0,
    migratedProducts: mapped.products.length,
    tenantId
  };
}
