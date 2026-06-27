import { emptyState } from '../../../shared-ui/components/empty-state.js';

export function renderEmployeePos(products = []) {
  if (!products.length) return emptyState('Aucun article', 'Le catalogue de caisse est vide.');
  return `<section class="cm-card cm-section"><h2>Point de vente</h2><p>${products.length} article(s) disponibles en caisse.</p></section>`;
}
