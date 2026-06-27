export function formatMoney(value, currency = 'XOF', locale = 'fr-FR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XOF' ? 0 : 2
  }).format(Number(value || 0));
}

export function sumAmount(items = [], field = 'total') {
  return items.reduce((sum, item) => sum + Number(item?.[field] || 0), 0);
}
