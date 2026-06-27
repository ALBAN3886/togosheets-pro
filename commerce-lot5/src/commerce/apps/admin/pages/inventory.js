import { formatMoney } from '../../../core/utils/money.js';
import { emptyState } from '../../../shared-ui/components/empty-state.js';

function optionList(rows = [], selected = '') {
  return rows.map(row => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${row.name || row.id}</option>`).join('');
}

export function renderInventoryPage(rows = [], { products = [], stores = [], selectedProductId = '', selectedStoreId = '' } = {}, currency = 'XOF') {
  const byProduct = Object.fromEntries(products.map(product => [product.id, product]));
  const setupForm = `<section class="cm-card cm-section"><h2>Initialiser ou corriger un stock</h2><form id="stockSetupForm" class="cm-grid cols-4"><select class="cm-select" name="storeId"><option value="">Boutique</option>${optionList(stores, selectedStoreId)}</select><select class="cm-select" name="productId"><option value="">Produit</option>${optionList(products, selectedProductId)}</select><input class="cm-input" type="number" name="quantity" placeholder="Quantité totale" /><input class="cm-input" type="number" name="reorderLevel" placeholder="Seuil d'alerte" value="5" /><button class="cm-btn primary" type="submit">Enregistrer le stock</button></form></section>`;
  const adjustForm = `<section class="cm-card cm-section"><h2>Ajustement rapide</h2><form id="stockAdjustForm" class="cm-grid cols-5"><select class="cm-select" name="storeId"><option value="">Boutique</option>${optionList(stores, selectedStoreId)}</select><select class="cm-select" name="productId"><option value="">Produit</option>${optionList(products, selectedProductId)}</select><input class="cm-input" type="number" name="deltaQty" placeholder="Variation (+/-)" /><input class="cm-input" type="number" name="unitPrice" placeholder="Valorisation" value="0" /><input class="cm-input" name="note" placeholder="Motif" /><button class="cm-btn" type="submit">Appliquer l'ajustement</button></form></section>`;
  if (!rows.length) {
    return `${setupForm}${adjustForm}${emptyState('Aucun stock enregistré', 'Initialisez le stock d\'un produit pour le voir apparaître ici.')}`;
  }
  const body = rows.map(row => {
    const product = byProduct[row.productId] || null;
    const isLow = Number(row.availableQuantity ?? row.quantity ?? 0) <= Number(row.reorderLevel ?? 5);
    return `<tr>
      <td><strong>${product?.name || row.productId}</strong><div style="color:var(--cm-muted);font-size:12px">${product?.sku || product?.barcode || 'Sans référence'}</div></td>
      <td>${row.storeId || '—'}</td>
      <td>${row.quantity ?? 0}</td>
      <td>${row.availableQuantity ?? 0}</td>
      <td>${row.reorderLevel ?? 5}</td>
      <td><span class="cm-badge ${isLow ? 'danger' : 'success'}">${isLow ? 'Alerte stock' : 'OK'}</span></td>
      <td>${formatMoney(product?.purchasePrice || 0, currency)}</td>
      <td><button class="cm-btn small" data-prefill-stock-product-id="${row.productId}" data-prefill-stock-store-id="${row.storeId}">Utiliser</button></td>
    </tr>`;
  }).join('');
  return `${setupForm}${adjustForm}<section class="cm-card cm-section" style="margin-top:16px"><h2>État des stocks</h2><table class="cm-table"><thead><tr><th>Produit</th><th>Boutique</th><th>Qté</th><th>Disponible</th><th>Seuil</th><th>État</th><th>Coût d'achat</th><th>Action</th></tr></thead><tbody>${body}</tbody></table></section>`;
}
