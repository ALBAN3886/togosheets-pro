import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderStockMovementsPage(rows = [], currency = 'XOF') {
  if (!rows.length) return emptyState('Aucun mouvement de stock', 'Les ajustements et ventes généreront des lignes ici.');
  const body = rows.map(row => `<tr>
    <td>${row.productId || '—'}</td>
    <td>${row.type || '—'}</td>
    <td>${row.qty || 0}</td>
    <td>${formatMoney(row.total || 0, currency)}</td>
    <td>${row.employeeName || '—'}</td>
    <td>${row.note || '—'}</td>
  </tr>`).join('');
  return `<section class="cm-card cm-section"><h2>Mouvements de stock</h2><table class="cm-table"><thead><tr><th>Produit</th><th>Type</th><th>Qté</th><th>Total</th><th>Opérateur</th><th>Note</th></tr></thead><tbody>${body}</tbody></table></section>`;
}
