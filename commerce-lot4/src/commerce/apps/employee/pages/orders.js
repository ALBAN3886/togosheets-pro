import { emptyState } from '../../../shared-ui/components/empty-state.js';
import { formatMoney } from '../../../core/utils/money.js';

export function renderEmployeeOrders(rows = [], currency = 'XOF') {
  if (!rows.length) return emptyState('Aucune commande à traiter', 'Les commandes publiques en attente apparaîtront ici.');
  const body = rows.map(row => `<tr>
    <td>${row.id}</td>
    <td>${row.customer?.name || 'Client'}</td>
    <td>${formatMoney(row.grandTotal || 0, currency)}</td>
    <td><span class="cm-badge ${row.status === 'pending' ? 'warning' : 'success'}">${row.status}</span></td>
    <td><button class="cm-btn primary" data-approve-order-id="${row.id}">Valider</button></td>
  </tr>`).join('');
  return `<section class="cm-card cm-section"><h2>Commandes en attente</h2><table class="cm-table"><thead><tr><th>Commande</th><th>Client</th><th>Total</th><th>Statut</th><th>Action</th></tr></thead><tbody>${body}</tbody></table></section>`;
}
