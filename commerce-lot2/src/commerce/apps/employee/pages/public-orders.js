import { dataTable } from '../../../shared-ui/components/data-table.js';

export function renderPublicOrders(rows = []) {
  return dataTable([
    { key: 'id', label: 'Commande' },
    { key: 'status', label: 'Statut' },
    { key: 'grandTotal', label: 'Montant' },
  ], rows);
}
