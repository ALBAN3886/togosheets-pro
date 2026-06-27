import { formatMoney } from '../utils/money.js';

export function reportHtml(report = {}, meta = {}) {
  const currency = meta.currency || 'XOF';
  const paymentRows = Object.entries(report.paymentBreakdown || {}).map(([method, value]) => `<tr><td>${method}</td><td>${formatMoney(value, currency)}</td></tr>`).join('') || '<tr><td colspan="2">Aucune donnée</td></tr>';
  const productRows = (report.topProducts || []).map(item => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${formatMoney(item.revenue, currency)}</td></tr>`).join('') || '<tr><td colspan="3">Aucune donnée</td></tr>';
  const title = meta.title || 'Rapport Commerce';
  const subtitle = [meta.storeName || 'Toutes les boutiques', report.from || 'début', report.to || 'aujourd\'hui'].join(' · ');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1,h2{margin:0 0 12px}p{color:#475569}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:10px;border:1px solid #cbd5e1;text-align:left}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.card{border:1px solid #cbd5e1;border-radius:12px;padding:16px}.muted{color:#64748b}</style></head><body><h1>${title}</h1><p class="muted">${subtitle}</p><div class="grid"><div class="card"><strong>CA</strong><div>${formatMoney(report.totalRevenue || 0, currency)}</div></div><div class="card"><strong>Ventes</strong><div>${report.totalSales || 0}</div></div><div class="card"><strong>Articles vendus</strong><div>${report.itemsSold || 0}</div></div><div class="card"><strong>Panier moyen</strong><div>${formatMoney(report.avgTicket || 0, currency)}</div></div></div><h2>Paiements</h2><table><thead><tr><th>Méthode</th><th>Montant</th></tr></thead><tbody>${paymentRows}</tbody></table><h2>Top produits</h2><table><thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead><tbody>${productRows}</tbody></table></body></html>`;
}

export function printSalesReport(report = {}, meta = {}) {
  const html = reportHtml(report, meta);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 200);
  return true;
}
