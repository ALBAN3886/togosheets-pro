import { invoiceMarkup } from '../../../shared-ui/components/invoice-print.js';
export function renderReceiptPreview(sale) {
  return invoiceMarkup({ title: `Ticket ${sale?.receiptNumber || ''}`, lines: (sale?.items || []).map(item => `${item.name} × ${item.qty}`), total: `Total: ${sale?.grandTotal || 0}` });
}
