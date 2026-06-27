export function searchBox({ id = 'search', placeholder = 'Rechercher…' } = {}) {
  return `<input class="cm-search" id="${id}" type="search" placeholder="${placeholder}" />`;
}
