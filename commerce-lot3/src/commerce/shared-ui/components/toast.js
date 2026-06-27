export function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'cm-toast';
  el.dataset.type = type;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
