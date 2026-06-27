export function emptyState(title = 'Aucune donnée', message = '') {
  return `<div class="cm-card cm-section"><strong>${title}</strong><p style="color:var(--cm-muted)">${message}</p></div>`;
}
