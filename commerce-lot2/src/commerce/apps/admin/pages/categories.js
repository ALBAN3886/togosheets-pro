import { dataTable } from '../../../shared-ui/components/data-table.js';

export function renderCategoriesPage(rows = []) {
  return dataTable([
    { key: 'name', label: 'Catégorie' },
    { key: 'slug', label: 'Slug' },
    { key: 'sortOrder', label: 'Ordre' },
    { key: 'isActive', label: 'Active' },
  ], rows);
}
