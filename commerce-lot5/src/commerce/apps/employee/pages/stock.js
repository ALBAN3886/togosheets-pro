import { dataTable } from '../../../shared-ui/components/data-table.js';
export function renderEmployeeStock(rows = []) {
  return dataTable([{ key:'productId', label:'Produit' },{ key:'availableQuantity', label:'Disponible' },{ key:'reorderLevel', label:'Seuil' }], rows);
}
