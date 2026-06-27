function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function invoiceMarkup({ title = 'Facture', subtitle = '', lines = [], totals = {}, footer = '' } = {}) {
  return `<section class="cm-invoice cm-card cm-section">
    <header class="cm-invoice-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></header>
    <table class="cm-table"><thead><tr><th>Article</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead><tbody>${lines.map(line => `<tr><td>${esc(line.name || '')}</td><td>${esc(line.qty ?? '')}</td><td>${esc(line.unitPrice ?? '')}</td><td>${esc(line.total ?? '')}</td></tr>`).join('')}</tbody></table>
    <div class="cm-invoice-totals">
      <div><span>Sous-total</span><strong>${esc(totals.subtotal || '—')}</strong></div>
      <div><span>Remise</span><strong>${esc(totals.discountTotal || '—')}</strong></div>
      <div><span>Taxes</span><strong>${esc(totals.taxTotal || '—')}</strong></div>
      <div class="grand"><span>Total</span><strong>${esc(totals.grandTotal || '—')}</strong></div>
    </div>
    <footer class="cm-invoice-foot">${esc(footer)}</footer>
  </section>`;
}
