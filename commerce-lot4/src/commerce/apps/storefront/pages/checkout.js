export function renderCheckoutForm() {
  return `<form id="publicCheckoutForm" class="cm-card cm-section"><h2>Finaliser la commande</h2><div class="cm-grid cols-3"><input class="cm-input" name="name" placeholder="Nom complet" /><input class="cm-input" name="phone" placeholder="Téléphone" /><input class="cm-input" name="city" placeholder="Ville / Adresse" /></div><textarea class="cm-textarea" name="note" placeholder="Notes" style="margin-top:12px"></textarea><button class="cm-btn primary" type="submit" style="margin-top:14px">Envoyer la commande</button></form>`;
}
