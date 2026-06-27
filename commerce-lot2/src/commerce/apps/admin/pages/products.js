import { dataTable } from '../../../shared-ui/components/data-table.js';

export function renderProductsPage(rows = []) {
  return dataTable([
    { key: 'name', label: 'Produit' },
    { key: 'sku', label: 'SKU' },
    { key: 'salePrice', label: 'Prix vente' },
    { key: 'isPublished', label: 'Publié' },
  ], rows);
}
