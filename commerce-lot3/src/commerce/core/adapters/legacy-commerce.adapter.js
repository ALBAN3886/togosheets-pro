import { createStoreModel } from '../models/store.model.js';
import { createProductModel } from '../models/product.model.js';

export function mapLegacyCommerceData(ownerUid, legacy = {}) {
  const shops = Array.isArray(legacy.shops) ? legacy.shops : [];
  const articles = Array.isArray(legacy.articles) ? legacy.articles : [];

  return {
    tenant: {
      ownerUid,
      name: 'AET Commerce',
      currency: 'XOF',
      status: 'active',
      country: 'TG',
      timezone: 'Africa/Lome'
    },
    stores: shops.map(shop => ({
      legacyId: shop.id,
      ...createStoreModel({
        tenantId: ownerUid,
        name: shop.name,
        code: shop.code || shop.id,
        type: shop.type || 'retail',
        address: shop.addr || '',
        city: shop.city || '',
        country: shop.country || 'TG',
        stockAlertThreshold: shop.seuil || 5,
        branding: shop.branding || {}
      })
    })),
    employees: shops.flatMap(shop => (Array.isArray(shop.employees) ? shop.employees : []).map(emp => ({
      legacyId: emp.id,
      legacyShopId: shop.id,
      displayName: emp.name || '',
      phone: emp.whatsapp || '',
      role: emp.role || 'employee',
      pinHash: emp.pin || '',
      status: 'active'
    }))),
    products: articles.map(article => ({
      legacyId: article.id,
      legacyShopId: article.shopId,
      ...createProductModel({
        tenantId: ownerUid,
        storeIds: article.shopId ? [article.shopId] : [],
        categoryId: article.cat || article.category || '',
        name: article.name || article.nom || 'Article',
        sku: article.code || '',
        barcode: article.barcode || '',
        description: article.note || '',
        purchasePrice: article.prixA || 0,
        salePrice: article.prixV ?? article.prixVente ?? article.prix ?? 0,
        currency: 'XOF',
        unit: article.unit || 'piece',
        imageUrls: article.imageUrl ? [article.imageUrl] : [],
        isPublished: true,
        isActive: true,
        trackStock: true
      }),
      stock: Number(article.stock || 0),
      reorderLevel: Number(article.seuil || 5)
    }))
  };
}