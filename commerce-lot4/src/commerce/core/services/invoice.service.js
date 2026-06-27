import { formatMoney } from '../utils/money.js';
import { invoiceMarkup } from '../../shared-ui/components/invoice-print.js';

export function buildSaleInvoice(sale, meta = {}) {
  const currency = meta.currency || 'XOF';
  const lines = (sale?.items || []).map(item => ({
    name: item.name || item.productId || 'Article',
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unitPrice || 0),
    total: Number(item.total ?? Number(item.qty || 0) * Number(item.unitPrice || 0))
  }));
  return {
    title: `Ticket ${sale?.receiptNumber || sale?.id || ''}`,
    subtitle: `${meta.tenantName || 'Commerce'} · ${meta.storeName || ''}`.trim(),
    lines,
    totals: {
      subtotal: formatMoney(sale?.subtotal ?? sale?.grandTotal ?? 0, currency),
      discountTotal: formatMoney(sale?.discountTotal ?? 0, currency),
      taxTotal: formatMoney(sale?.taxTotal ?? 0, currency),
      grandTotal: formatMoney(sale?.grandTotal ?? 0, currency)
    },
    footer: `Paiement: ${sale?.paymentMethod || 'cash'} · Vendeur: ${sale?.sellerName || meta.employeeName || '—'}`
  };
}

export function renderSaleInvoice(sale, meta = {}) {
  return invoiceMarkup(buildSaleInvoice(sale, meta));
}

export function printSaleInvoice(sale, meta = {}) {
  const html = renderSaleInvoice(sale, meta);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=860,height=900');
  if (!win) return false;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Impression ticket</title><style>body{font-family:Arial,sans-serif;background:#f8fafc;padding:24px} .cm-invoice{max-width:760px;margin:0 auto}</style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 200);
  return true;
}
