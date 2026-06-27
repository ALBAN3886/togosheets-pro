export function productForm(initial = {}, categories = [], stores = []) {
  return `<form id="productForm" class="cm-card cm-section">
    <div class="cm-grid cols-3">
      <input class="cm-input" name="name" placeholder="Produit" value="${initial.name || ''}" />
      <input class="cm-input" name="sku" placeholder="SKU" value="${initial.sku || ''}" />
      <input class="cm-input" name="barcode" placeholder="Code-barres" value="${initial.barcode || ''}" />
      <input class="cm-input" name="salePrice" type="number" placeholder="Prix vente" value="${initial.salePrice || 0}" />
      <input class="cm-input" name="purchasePrice" type="number" placeholder="Prix achat" value="${initial.purchasePrice || 0}" />
      <select class="cm-select" name="categoryId"><option value="">Catégorie</option>${categories.map(cat => `<option value="${cat.id}" ${cat.id === initial.categoryId ? 'selected' : ''}>${cat.name}</option>`).join('')}</select>
      <select class="cm-select" name="storeId"><option value="">Boutique</option>${stores.map(store => `<option value="${store.id}">${store.name}</option>`).join('')}</select>
      <input class="cm-input" name="description" placeholder="Description courte" value="${initial.description || ''}" />
      <label class="cm-inline-check"><input type="checkbox" name="isPublished" ${initial.isPublished ? 'checked' : ''}/> Publié</label>
      <label class="cm-inline-check"><input type="checkbox" name="isActive" ${initial.isActive !== false ? 'checked' : ''}/> Actif</label>
    </div>
    <button class="cm-btn primary" type="submit" style="margin-top:14px">Enregistrer</button>
  </form>`;
}
