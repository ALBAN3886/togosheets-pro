import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderProductsPage(rows = [], currency = 'XOF') {
  if (!rows.length) return emptyState('Aucun produit', 'Ajoutez vos premiers articles au catalogue Commerce.');
  const items = rows.map(row => `<tr>
    <td><strong>${row.name || '—'}</strong><div style="color:var(--cm-muted);font-size:12px">${row.sku || row.barcode || 'Sans référence'}</div></td>
    <td>${formatMoney(row.salePrice || 0, currency)}</td>
    <td>${formatMoney(row.purchasePrice || 0, currency)}</td>
    <td>${row.categoryId || '—'}</td>
    <td><span class="cm-badge ${row.isPublished ? 'success' : 'warning'}">${row.isPublished ? 'Publié' : 'Brouillon'}</span></td>
    <td><span class="cm-badge ${row.isActive !== false ? 'success' : 'danger'}">${row.isActive !== false ? 'Actif' : 'Inactif'}</span></td>
  </tr>`).join('');
  return `<section class="cm-card cm-section"><h2>Catalogue produits</h2><table class="cm-table"><thead><tr><th>Produit</th><th>Prix vente</th><th>Prix achat</th><th>Catégorie</th><th>Publication</th><th>Statut</th></tr></thead><tbody>${items}</tbody></table></section>`;
}
