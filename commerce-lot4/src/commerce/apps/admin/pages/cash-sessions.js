import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderCashSessionsPage(rows = [], currency = 'XOF') {
  if (!rows.length) return emptyState('Aucune session de caisse', 'Les ouvertures/fermetures apparaîtront ici.');
  const body = rows.map(row => `<tr>
    <td>${row.employeeName || row.employeeId || '—'}</td>
    <td>${row.storeId || '—'}</td>
    <td>${formatMoney(row.openingAmount || 0, currency)}</td>
    <td>${formatMoney(row.closingAmount || 0, currency)}</td>
    <td>${formatMoney(row.differenceAmount || 0, currency)}</td>
    <td><span class="cm-badge ${row.status === 'open' ? 'warning' : 'success'}">${row.status || '—'}</span></td>
  </tr>`).join('');
  return `<section class="cm-card cm-section"><h2>Sessions de caisse</h2><table class="cm-table"><thead><tr><th>Employé</th><th>Boutique</th><th>Ouverture</th><th>Clôture</th><th>Écart</th><th>Statut</th></tr></thead><tbody>${body}</tbody></table></section>`;
}
