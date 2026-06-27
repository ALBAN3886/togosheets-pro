export function invoiceMarkup({ title = 'Facture', lines = [], total = '' } = {}) {
  return `<section class="cm-card cm-section"><h2>${title}</h2><ul>${lines.map(line => `<li>${line}</li>`).join('')}</ul><strong>${total}</strong></section>`;
}
