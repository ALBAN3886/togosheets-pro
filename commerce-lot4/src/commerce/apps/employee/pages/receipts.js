import { emptyState } from '../../../shared-ui/components/empty-state.js';
import { formatMoney } from '../../../core/utils/money.js';
import { renderSaleInvoice } from '../../../core/services/invoice.service.js';

export function renderReceiptsPage(sales = [], selectedSaleId = '', meta = {}) {
  if (!sales.length) return emptyState('Aucun ticket', 'Les ventes encaissées apparaîtront ici.');
  const selected = sales.find(item => item.id === selectedSaleId) || sales[0];
  const rows = sales.map(sale => `<button class="cm-receipt-item ${sale.id === selected.id ? 'active' : ''}" data-sale-id="${sale.id}"><strong>${sale.receiptNumber || sale.id}</strong><span>${formatMoney(sale.grandTotal || 0, meta.currency || 'XOF')}</span></button>`).join('');
  return `<div class="cm-grid cols-2"><section class="cm-card cm-section"><h2>Tickets récents</h2><div class="cm-receipt-list">${rows}</div><button class="cm-btn primary" id="printReceiptBtn">Imprimer le ticket</button></section><section class="cm-card cm-section"><h2>Aperçu</h2>${renderSaleInvoice(selected, meta)}</section></div>`;
}
