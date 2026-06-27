import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderProductsPage(rows = [], currency = 'XOF') {
  if (!rows.length) return emptyState('Aucun produit', 'Ajoutez vos premiers articles au catalogue Commerce.');
  const items = rows.map(row => `<tr>
    <td>
      <strong>${row.name || '—'}</strong>
      <div style="color:var(--cm-muted);font-size:12px">${row.sku || row.barcode || 'Sans référence'}</div>
      <div style="color:var(--cm-muted);font-size:12px">${row.description || ''}</div>
    </td>
    <td>${formatMoney(row.salePrice || 0, currency)}</td>
    <td>${formatMoney(row.purchasePrice || 0, currency)}</td>
    <td>${row.categoryId || '—'}</td>
    <td>${Array.isArray(row.storeIds) && row.storeIds.length ? row.storeIds.join(', ') : '—'}</td>
    <td><span class="cm-badge ${row.isPublished ? 'success' : 'warning'}">${row.isPublished ? 'Publié' : 'Brouillon'}</span></td>
    <td><span class="cm-badge ${row.isActive !== false ? 'success' : 'danger'}">${row.isActive !== false ? 'Actif' : 'Inactif'}</span></td>
    <td>
      <div class="cm-actions-inline">
        <button class="cm-btn small" data-edit-product-id="${row.id}">Modifier</button>
        <button class="cm-btn small" data-toggle-publish-product-id="${row.id}">${row.isPublished ? 'Dépublier' : 'Publier'}</button>
        <button class="cm-btn small" data-toggle-active-product-id="${row.id}">${row.isActive !== false ? 'Désactiver' : 'Réactiver'}</button>
      </div>
    </td>
  </tr>`).join('');
  return `<section class="cm-card cm-section"><h2>Catalogue produits</h2><table class="cm-table"><thead><tr><th>Produit</th><th>Prix vente</th><th>Prix achat</th><th>Catégorie</th><th>Boutiques</th><th>Publication</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${items}</tbody></table></section>`;
}
