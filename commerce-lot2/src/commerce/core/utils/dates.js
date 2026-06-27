export function nowMs() {
  return Date.now();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthIso() {
  return new Date().toISOString().slice(0, 7);
}

export function formatDateFR(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
