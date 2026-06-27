export function stockBadge(quantity, threshold = 5) {
  const tone = quantity <= 0 ? 'danger' : quantity <= threshold ? 'warning' : 'success';
  return `<span class="cm-badge ${tone}">Stock: ${quantity}</span>`;
}
