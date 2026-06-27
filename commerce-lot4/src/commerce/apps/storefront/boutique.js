import { getCommerceFirebaseApp } from '../../core/firebase/app.js';
import { createCommerceDb } from '../../core/firebase/firestore.js';
import { watchPublishedProducts } from '../../core/realtime/watch-products.js';
import { placePublicOrder } from '../../core/services/order.service.js';
import { renderStorefrontHome } from './pages/home.js';
import { renderCatalog } from './pages/catalog.js';
import { renderCart } from './pages/cart.js';
import { renderCheckoutForm } from './pages/checkout.js';
import { on } from '../../core/utils/dom.js';
import { showToast } from '../../shared-ui/components/toast.js';

const app = getCommerceFirebaseApp();
const db = createCommerceDb(app);
const params = new URLSearchParams(location.search);
const tenantId = params.get('tenant') || params.get('uid') || '';
const storeId = params.get('store') || params.get('shop') || '';
const state = { products: [], cart: [] };

function render() {
  document.getElementById('app').innerHTML = `${renderStorefrontHome('Boutique Publique')}${renderCatalog(state.products)}${renderCart(state.cart)}${renderCheckoutForm()}`;
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const row = state.cart.find(item => item.id === productId);
  if (row) row.qty += 1;
  else state.cart.push({ id: product.id, productId: product.id, name: product.name, qty: 1, total: Number(product.promoPrice ?? product.salePrice ?? 0), unitPrice: Number(product.promoPrice ?? product.salePrice ?? 0) });
  render();
}

async function submitOrder(form) {
  if (!state.cart.length) throw new Error('Panier vide');
  const fd = new FormData(form);
  const items = state.cart.map(item => ({ productId: item.productId, name: item.name, qty: item.qty, unitPrice: item.unitPrice, total: item.qty * item.unitPrice }));
  await placePublicOrder(db, {
    tenantId,
    storeId,
    customer: { name: fd.get('name') || '', phone: fd.get('phone') || '', city: fd.get('city') || '', note: fd.get('note') || '' },
    items,
    subtotal: items.reduce((sum, item) => sum + item.total, 0),
    grandTotal: items.reduce((sum, item) => sum + item.total, 0)
  });
  state.cart = [];
  render();
  showToast('Commande envoyée');
}

watchPublishedProducts(db, tenantId, storeId, products => { state.products = products; render(); });
document.addEventListener('DOMContentLoaded', () => {
  render();
  on(document, 'click', '[data-product-id]', (_, target) => addToCart(target.dataset.productId));
  document.addEventListener('submit', e => {
    if (e.target.id === 'publicCheckoutForm') {
      e.preventDefault();
      submitOrder(e.target).catch(err => showToast(err.message || 'Erreur', 'error'));
    }
  });
});
