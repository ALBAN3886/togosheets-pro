import { dataTable } from '../../../shared-ui/components/data-table.js';
export function renderStoresPage(rows = []) {
  return dataTable([{ key:'name', label:'Boutique' },{ key:'city', label:'Ville' },{ key:'phone', label:'Téléphone' },{ key:'isActive', label:'Active' }], rows);
}
