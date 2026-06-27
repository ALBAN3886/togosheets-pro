export function renderCheckoutForm() {
  return `
    <section class="cm-card cm-section">
      <h2>Finaliser la commande</h2>
      <div class="cm-grid">
        <input class="cm-search" placeholder="Nom complet" />
        <input class="cm-search" placeholder="Téléphone" />
        <input class="cm-search" placeholder="Ville / Adresse" />
      </div>
    </section>
  `;
}
