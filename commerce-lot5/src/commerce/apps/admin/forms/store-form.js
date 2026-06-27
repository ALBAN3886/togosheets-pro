export function storeForm(initial = {}) {
  return `<form id="storeForm" class="cm-card cm-section"><div class="cm-grid cols-3"><input class="cm-input" name="name" placeholder="Nom boutique" value="${initial.name || ''}" /><input class="cm-input" name="city" placeholder="Ville" value="${initial.city || ''}" /><input class="cm-input" name="phone" placeholder="Téléphone" value="${initial.phone || ''}" /></div><button class="cm-btn primary" type="submit" style="margin-top:14px">Enregistrer</button></form>`;
}
