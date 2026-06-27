import { renderStorefrontHome } from './pages/home.js';
import { renderProductList } from './pages/product-list.js';
import { renderCart } from './pages/cart.js';
import { renderCheckoutForm } from './pages/checkout.js';

function render() {
  const fakeProducts = [];
  document.getElementById('app').innerHTML = `
    ${renderStorefrontHome('Boutique Publique')}
    ${renderProductList(fakeProducts, 'XOF')}
    ${renderCart([], 'XOF')}
    ${renderCheckoutForm()}
  `;
}

window.addEventListener('DOMContentLoaded', render);
