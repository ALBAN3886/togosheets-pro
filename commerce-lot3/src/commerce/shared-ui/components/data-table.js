export function dataTable(columns = [], rows = []) {
  const head = columns.map(col => `<th>${col.label}</th>`).join('');
  const body = rows.map(row => `<tr>${columns.map(col => `<td>${row[col.key] ?? '—'}</td>`).join('')}</tr>`).join('');
  return `<table class="cm-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
