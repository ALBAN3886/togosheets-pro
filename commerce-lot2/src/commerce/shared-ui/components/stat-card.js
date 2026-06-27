export function statCard(label, value) {
  return `
    <div class="cm-card cm-stat">
      <div class="cm-stat-label">${label}</div>
      <div class="cm-stat-value">${value}</div>
    </div>
  `;
}
