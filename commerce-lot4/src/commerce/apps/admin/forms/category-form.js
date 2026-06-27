export function categoryForm(initial = {}) {
  return `<form id="categoryForm" class="cm-card cm-section"><div class="cm-grid cols-3"><input class="cm-input" name="name" placeholder="Nom catégorie" value="${initial.name || ''}" /><input class="cm-input" name="slug" placeholder="slug" value="${initial.slug || ''}" /><input class="cm-input" name="sortOrder" type="number" placeholder="Ordre" value="${initial.sortOrder || 0}" /></div><button class="cm-btn primary" type="submit" style="margin-top:14px">Enregistrer</button></form>`;
}
