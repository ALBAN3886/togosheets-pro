import { dataTable } from '../../../shared-ui/components/data-table.js';

export function renderEmployeesPage(rows = []) {
  return dataTable([
    { key: 'displayName', label: 'Nom' },
    { key: 'role', label: 'Rôle' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'status', label: 'Statut' },
  ], rows);
}
