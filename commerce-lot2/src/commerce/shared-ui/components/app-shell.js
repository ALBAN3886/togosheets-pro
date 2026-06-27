export function renderAppShell({ title = 'Commerce', sidebar = '', content = '' } = {}) {
  return `
    <div class="cm-shell">
      <aside class="cm-sidebar">${sidebar}</aside>
      <main class="cm-main">
        <div class="cm-toolbar"><h1>${title}</h1></div>
        ${content}
      </main>
    </div>
  `;
}
