import { dataTable } from '../../../shared-ui/components/data-table.js';

export function renderInventoryPage(rows = []) {
  return dataTable([
    { key: 'productId', label: 'Produit' },
    { key: 'quantity', label: 'Qté' },
    { key: 'availableQuantity', label: 'Disponible' },
    { key: 'reorderLevel', label: 'Seuil' },
  ], rows);
}
