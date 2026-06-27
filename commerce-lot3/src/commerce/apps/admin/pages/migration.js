export function renderMigrationPage() {
  return `<div class="cm-card cm-section"><h3>Migration legacy</h3><p style="color:var(--cm-muted)">Importe les données de l'ancien document commerce_data vers les nouvelles collections.</p><button id="runMigrationBtn" class="cm-btn primary">Lancer la migration</button><div id="migrationResult" style="margin-top:12px"></div></div>`;
}
