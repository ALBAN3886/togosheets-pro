import { createStoreModel } from '../models/store.model.js';
import { createProductModel } from '../models/product.model.js';

export function mapLegacyCommerceData(ownerUid, legacy = {}) {
  const shops = Array.isArray(legacy.shops) ? legacy.shops : [];
  const articles = Array.isArray(legacy.articles) ? legacy.articles : [];
  const mouvements = Array.isArray(legacy.mouvements) ? legacy.mouvements : [];

  return {
    tenant: {
      ownerUid,
      name: legacy.shopName || 'AET Commerce',
      currency: legacy.currency || 'XOF',
      status: 'active',
    },
    stores: shops.map(shop => createStoreModel({
      tenantId: ownerUid,
      name: shop.name,
      code: shop.code || shop.id,
      type: shop.type || 'retail',
      address: shop.addr || '',
      city: shop.city || '',
      country: shop.country || 'TG',
      stockAlertThreshold: shop.seuil || 5,
      branding: shop.branding || {},
    })),
    products: articles.map(article => createProductModel({
      tenantId: ownerUid,
      storeIds: article.shopId ? [article.shopId] : [],
      categoryId: article.cat || article.category || '',
      name: article.name || article.nom || 'Article',
      sku: article.code || '',
      barcode: article.barcode || '',
      description: article.note || '',
      purchasePrice: article.prixA || 0,
      salePrice: article.prixV ?? article.prixVente ?? article.prix ?? 0,
      currency: legacy.currency || 'XOF',
      unit: article.unit || 'piece',
      imageUrls: article.imageUrl ? [article.imageUrl] : [],
      isPublished: true,
      isActive: true,
      trackStock: true,
    })),
    stockMovements: mouvements,
  };
}
