import { emptyState } from '../../../shared-ui/components/empty-state.js';
import { formatMoney, sumAmount } from '../../../core/utils/money.js';
export function renderCart(items = [], currency = 'XOF') {
  if (!items.length) return emptyState('Panier vide', 'Ajoutez des produits pour préparer votre commande.');
  return `<section class="cm-card cm-section"><h2>Panier</h2><ul>${items.map(item => `<li>${item.name} × ${item.qty}</li>`).join('')}</ul><strong>Total: ${formatMoney(sumAmount(items), currency)}</strong></section>`;
}
