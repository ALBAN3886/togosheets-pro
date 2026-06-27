import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderAdminDashboard } from './pages/dashboard.js';
import { renderStoresPage } from './pages/stores.js';
import { renderCategoriesPage } from './pages/categories.js';
import { renderProductsPage } from './pages/products.js';
import { renderInventoryPage } from './pages/inventory.js';
import { renderEmployeesPage } from './pages/employees.js';
import { renderReportsPage } from './pages/reports.js';

const PAGES = {
  dashboard: () => renderAdminDashboard({ salesTodayTotal: 0, salesMonthTotal: 0, pendingOrders: 0, lowStockCount: 0 }),
  stores: () => renderStoresPage([]),
  categories: () => renderCategoriesPage([]),
  products: () => renderProductsPage([]),
  inventory: () => renderInventoryPage([]),
  employees: () => renderEmployeesPage([]),
  reports: () => renderReportsPage(),
};

function sidebar() {
  return `
    <h2>Commerce Admin</h2>
    <nav style="display:grid;gap:10px;margin-top:20px">
      <a href="#dashboard">Dashboard</a>
      <a href="#stores">Boutiques</a>
      <a href="#categories">Catégories</a>
      <a href="#products">Produits</a>
      <a href="#inventory">Stock</a>
      <a href="#employees">Employés</a>
      <a href="#reports">Rapports</a>
    </nav>
  `;
}

function render() {
  const page = location.hash.replace('#', '') || 'dashboard';
  const content = (PAGES[page] || PAGES.dashboard)();
  document.getElementById('app').innerHTML = renderAppShell({
    title: 'Administration Commerce',
    sidebar: sidebar(),
    content,
  });
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
