export function productCard(product, priceLabel) {
  return `<div class="cm-card cm-section"><strong>${product.name}</strong><div style="color:var(--cm-muted);margin-top:6px">${product.description || 'Article du catalogue'}</div><div style="font-weight:800;margin-top:10px">${priceLabel}</div><button class="cm-btn primary" data-product-id="${product.id}" style="margin-top:12px">Ajouter</button></div>`;
}
