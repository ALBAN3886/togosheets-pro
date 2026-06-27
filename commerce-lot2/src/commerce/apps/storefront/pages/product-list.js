import { productCard } from '../../../shared-ui/components/product-card.js';
import { formatMoney } from '../../../core/utils/money.js';

export function renderProductList(products = [], currency = 'XOF') {
  return `<div class="catalog-grid">${products.map(product => productCard(product, formatMoney(product.salePrice, currency))).join('')}</div>`;
}
