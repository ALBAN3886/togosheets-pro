export function renderEmployeeLogin(state = {}) {
  return `<section class="cm-card cm-section"><h2>Espace Employé</h2><p style="color:var(--cm-muted)">${state.user ? `Connecté: ${state.user.email || state.user.uid}` : 'Connectez-vous avec un compte Firebase autorisé.'}</p></section>`;
}