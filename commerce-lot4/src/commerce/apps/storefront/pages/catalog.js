import { productCard } from '../../../shared-ui/components/product-card.js';
import { formatMoney } from '../../../core/utils/money.js';
export function renderCatalog(products = [], currency = 'XOF') {
  return `<div class="catalog-grid">${products.map(p => productCard(p, formatMoney(p.promoPrice ?? p.salePrice, currency))).join('')}</div>`;
}
