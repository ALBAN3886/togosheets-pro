import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderEmployeeLogin } from './pages/login.js';
import { renderEmployeePos } from './pages/pos.js';
import { renderEmployeeStock } from './pages/stock.js';
import { renderPublicOrders } from './pages/public-orders.js';

const PAGES = {
  login: () => renderEmployeeLogin(),
  pos: () => renderEmployeePos([]),
  stock: () => renderEmployeeStock([]),
  orders: () => renderPublicOrders([]),
};

function sidebar() {
  return `
    <h2>Espace Employé</h2>
    <nav style="display:grid;gap:10px;margin-top:20px">
      <a href="#login">Connexion</a>
      <a href="#pos">Caisse</a>
      <a href="#stock">Stock</a>
      <a href="#orders">Commandes</a>
    </nav>
  `;
}

function render() {
  const page = location.hash.replace('#', '') || 'login';
  document.getElementById('app').innerHTML = renderAppShell({
    title: 'Interface Employé',
    sidebar: sidebar(),
    content: (PAGES[page] || PAGES.login)(),
  });
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
