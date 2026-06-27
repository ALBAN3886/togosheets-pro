import { emptyState } from '../../../shared-ui/components/empty-state.js';
import { formatMoney } from '../../../core/utils/money.js';

export function renderEmployeePos({ products = [], cart = [], session = null, currency = 'XOF' } = {}) {
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);
  const sessionCard = session
    ? `<section class="cm-card cm-section"><h2>Caisse ouverte</h2><p>Session <strong>${session.id}</strong></p><p>Fond de caisse: <strong>${formatMoney(session.openingAmount || 0, currency)}</strong></p><form id="closeCashSessionForm" class="cm-inline-form"><input class="cm-input" type="number" step="0.01" name="closingAmount" placeholder="Montant de clôture" /><input class="cm-input" name="note" placeholder="Note de clôture" /><button class="cm-btn" type="submit">Clôturer</button></form></section>`
    : `<section class="cm-card cm-section"><h2>Ouvrir une caisse</h2><form id="openCashSessionForm" class="cm-inline-form"><input class="cm-input" type="number" step="0.01" name="openingAmount" placeholder="Fond de caisse" /><input class="cm-input" name="note" placeholder="Note d'ouverture" /><button class="cm-btn primary" type="submit">Ouvrir</button></form></section>`;

  const cartRows = cart.length
    ? cart.map(item => `<li class="cm-cart-row"><div><strong>${item.name}</strong><div style="font-size:12px;color:var(--cm-muted)">${formatMoney(item.unitPrice || 0, currency)}</div></div><div class="cm-qty-actions"><button class="cm-qty-btn" data-cart-action="dec" data-product-id="${item.productId}">−</button><span>${item.qty}</span><button class="cm-qty-btn" data-cart-action="inc" data-product-id="${item.productId}">+</button></div></li>`).join('')
    : '<li>Aucun article dans le panier</li>';

  const productsMarkup = products.length
    ? products.map(product => `<button class="cm-product-tile" data-add-product-id="${product.id}"><strong>${product.name}</strong><span>${formatMoney(product.promoPrice ?? product.salePrice ?? 0, currency)}</span></button>`).join('')
    : emptyState('Aucun article', 'Le catalogue de caisse est vide.');

  return `<div class="cm-grid cols-2">${sessionCard}<section class="cm-card cm-section"><h2>Panier</h2><ul class="cm-list">${cartRows}</ul><div class="cm-total-row"><strong>Total</strong><strong>${formatMoney(cartTotal, currency)}</strong></div><form id="createSaleForm" class="cm-inline-form"><select class="cm-select" name="paymentMethod"><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="card">Carte</option><option value="bank_transfer">Virement</option></select><button class="cm-btn primary" type="submit" ${cart.length && session ? '' : 'disabled'}>Encaisser</button></form></section></div><section class="cm-card cm-section" style="margin-top:16px"><h2>Catalogue caisse</h2><div class="cm-product-grid">${productsMarkup}</div></section>`;
}
