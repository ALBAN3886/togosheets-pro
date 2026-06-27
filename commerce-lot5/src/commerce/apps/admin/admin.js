import { getCommerceFirebaseApp, getCommerceAuth, onAuthStateChanged } from '../../core/firebase/app.js';
import { createCommerceDb } from '../../core/firebase/firestore.js';
import {
  ensureOwnerBootstrap,
  getCommerceContext,
  migrateLegacyCommerce,
  saveStore,
  buildDashboardStats,
  buildSalesReport,
  printSalesReport,
  setStock,
  recordStockAdjustment
} from '../../core/services/index.js';
import * as storesRepo from '../../core/repositories/store.repository.js';
import * as categoriesRepo from '../../core/repositories/category.repository.js';
import * as productsRepo from '../../core/repositories/product.repository.js';
import * as inventoryRepo from '../../core/repositories/inventory.repository.js';
import * as employeesRepo from '../../core/repositories/employee.repository.js';
import * as ordersRepo from '../../core/repositories/order.repository.js';
import * as salesRepo from '../../core/repositories/sale.repository.js';
import * as cashSessionsRepo from '../../core/repositories/cash-session.repository.js';
import * as stockMovementsRepo from '../../core/repositories/stock-movement.repository.js';
import { saveCategory, saveProduct, publishProduct } from '../../core/services/catalog.service.js';
import { saveEmployee } from '../../core/services/employee.service.js';
import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderAdminDashboard } from './pages/dashboard.js';
import { renderStoresPage } from './pages/stores.js';
import { renderCategoriesPage } from './pages/categories.js';
import { renderProductsPage } from './pages/products.js';
import { renderInventoryPage } from './pages/inventory.js';
import { renderEmployeesPage } from './pages/employees.js';
import { renderMigrationPage } from './pages/migration.js';
import { renderReportsPage } from './pages/reports.js';
import { renderCashSessionsPage } from './pages/cash-sessions.js';
import { renderStockMovementsPage } from './pages/stock-movements.js';
import { storeForm } from './forms/store-form.js';
import { categoryForm } from './forms/category-form.js';
import { productForm } from './forms/product-form.js';
import { employeeForm } from './forms/employee-form.js';
import { showToast } from '../../shared-ui/components/toast.js';

const app = getCommerceFirebaseApp();
const auth = getCommerceAuth();
const db = createCommerceDb(app);
let context = null;
const uiState = {
  productEditId: '',
  inventorySelection: { productId: '', storeId: '' },
  dashboardFilters: { storeId: '', from: '', to: '' },
  reportFilters: { storeId: '', from: '', to: '' }
};

function tenantIdOf(user) {
  const qs = new URLSearchParams(location.search);
  return qs.get('tenant') || qs.get('uid') || user.uid;
}

function sidebar() {
  return `<h2>Commerce Admin</h2><nav style="display:grid;gap:10px;margin-top:20px"><a href="#dashboard">Dashboard</a><a href="#stores">Boutiques</a><a href="#categories">Catégories</a><a href="#products">Produits</a><a href="#inventory">Stock</a><a href="#employees">Employés</a><a href="#reports">Rapports</a><a href="#cash-sessions">Caisses</a><a href="#stock-movements">Mouvements</a><a href="#migration">Migration</a></nav>`;
}

function frame(content, title = 'Administration Commerce') {
  document.getElementById('app').innerHTML = renderAppShell({ title, sidebar: sidebar(), content });
}

function selectedStoreName(stores = [], storeId = '') {
  return stores.find(store => store.id === storeId)?.name || '';
}

async function renderPage() {
  if (!context) return;
  const page = location.hash.replace('#','') || 'dashboard';
  if (page === 'stores') {
    const rows = await storesRepo.listStores(db, context.tenantId);
    frame(storeForm() + renderStoresPage(rows), 'Boutiques');
    document.getElementById('storeForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await saveStore(db, context, Object.fromEntries(fd.entries()));
        showToast('Boutique enregistrée');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur boutique', 'error');
      }
    };
    return;
  }
  if (page === 'categories') {
    const rows = await categoriesRepo.listCategories(db, context.tenantId);
    frame(categoryForm() + renderCategoriesPage(rows), 'Catégories');
    document.getElementById('categoryForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await saveCategory(db, context, { ...Object.fromEntries(fd.entries()), sortOrder: Number(fd.get('sortOrder') || 0) });
        showToast('Catégorie enregistrée');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur catégorie', 'error');
      }
    };
    return;
  }
  if (page === 'products') {
    const [rows, cats, stores] = await Promise.all([
      productsRepo.listProducts(db, context.tenantId),
      categoriesRepo.listCategories(db, context.tenantId),
      storesRepo.listStores(db, context.tenantId)
    ]);
    const draft = rows.find(row => row.id === uiState.productEditId) || {};
    frame(productForm(draft, cats, stores) + renderProductsPage(rows), 'Produits');
    const form = document.getElementById('productForm');
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await saveProduct(db, context, {
          id: fd.get('id') || undefined,
          name: fd.get('name'),
          sku: fd.get('sku'),
          barcode: fd.get('barcode'),
          description: fd.get('description'),
          purchasePrice: Number(fd.get('purchasePrice') || 0),
          salePrice: Number(fd.get('salePrice') || 0),
          categoryId: fd.get('categoryId') || '',
          storeIds: fd.get('storeId') ? [fd.get('storeId')] : [],
          isPublished: !!fd.get('isPublished'),
          isActive: !!fd.get('isActive')
        });
        uiState.productEditId = '';
        showToast(fd.get('id') ? 'Produit mis à jour' : 'Produit enregistré');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur produit', 'error');
      }
    };
    const cancelBtn = document.getElementById('cancelProductEditBtn');
    if (cancelBtn) cancelBtn.onclick = () => { uiState.productEditId = ''; renderPage(); };
    document.querySelectorAll('[data-edit-product-id]').forEach(btn => btn.onclick = () => { uiState.productEditId = btn.dataset.editProductId; renderPage(); });
    document.querySelectorAll('[data-toggle-publish-product-id]').forEach(btn => btn.onclick = async () => {
      try {
        const product = rows.find(row => row.id === btn.dataset.togglePublishProductId);
        if (!product) return;
        await publishProduct(db, context, product.id, !product.isPublished);
        showToast(!product.isPublished ? 'Produit publié' : 'Produit dépublié');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur publication', 'error');
      }
    });
    document.querySelectorAll('[data-toggle-active-product-id]').forEach(btn => btn.onclick = async () => {
      try {
        const product = rows.find(row => row.id === btn.dataset.toggleActiveProductId);
        if (!product) return;
        await productsRepo.updateProduct(db, context.tenantId, product.id, { isActive: !(product.isActive !== false) });
        showToast(product.isActive !== false ? 'Produit désactivé' : 'Produit réactivé');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur statut', 'error');
      }
    });
    return;
  }
  if (page === 'inventory') {
    const [rows, products, stores] = await Promise.all([
      inventoryRepo.listInventory(db, context.tenantId),
      productsRepo.listProducts(db, context.tenantId),
      storesRepo.listStores(db, context.tenantId)
    ]);
    frame(renderInventoryPage(rows, { products, stores, selectedProductId: uiState.inventorySelection.productId, selectedStoreId: uiState.inventorySelection.storeId }), 'Stock');
    const setupForm = document.getElementById('stockSetupForm');
    if (setupForm) setupForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await setStock(db, context, {
          storeId: fd.get('storeId'),
          productId: fd.get('productId'),
          quantity: Number(fd.get('quantity') || 0),
          reorderLevel: Number(fd.get('reorderLevel') || 5)
        });
        uiState.inventorySelection = { storeId: fd.get('storeId') || '', productId: fd.get('productId') || '' };
        showToast('Stock enregistré');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur stock', 'error');
      }
    };
    const adjustForm = document.getElementById('stockAdjustForm');
    if (adjustForm) adjustForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await recordStockAdjustment(db, context, {
          storeId: fd.get('storeId'),
          productId: fd.get('productId'),
          deltaQty: Number(fd.get('deltaQty') || 0),
          unitPrice: Number(fd.get('unitPrice') || 0),
          note: fd.get('note') || ''
        });
        uiState.inventorySelection = { storeId: fd.get('storeId') || '', productId: fd.get('productId') || '' };
        showToast('Ajustement appliqué');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur ajustement', 'error');
      }
    };
    document.querySelectorAll('[data-prefill-stock-product-id]').forEach(btn => btn.onclick = () => {
      uiState.inventorySelection = { productId: btn.dataset.prefillStockProductId || '', storeId: btn.dataset.prefillStockStoreId || '' };
      renderPage();
    });
    return;
  }
  if (page === 'employees') {
    const [rows, stores] = await Promise.all([employeesRepo.listEmployees(db, context.tenantId), storesRepo.listStores(db, context.tenantId)]);
    frame(employeeForm({}, stores) + renderEmployeesPage(rows), 'Employés');
    document.getElementById('employeeForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await saveEmployee(db, context, { displayName: fd.get('displayName'), phone: fd.get('phone'), role: fd.get('role'), storeIds: fd.get('storeId') ? [fd.get('storeId')] : [] });
        showToast('Employé enregistré');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur employé', 'error');
      }
    };
    return;
  }
  if (page === 'reports') {
    const [stores, sales, orders, inventory, cashSessions] = await Promise.all([
      storesRepo.listStores(db, context.tenantId),
      salesRepo.listSales(db, context.tenantId),
      ordersRepo.listOrders(db, context.tenantId),
      inventoryRepo.listInventory(db, context.tenantId),
      cashSessionsRepo.listCashSessions(db, context.tenantId)
    ]);
    const report = buildSalesReport({ sales, orders, inventory, cashSessions, ...uiState.reportFilters });
    frame(renderReportsPage(report, { stores, filters: uiState.reportFilters }), 'Rapports');
    const reportForm = document.getElementById('reportFiltersForm');
    if (reportForm) reportForm.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      uiState.reportFilters = { storeId: fd.get('storeId') || '', from: fd.get('from') || '', to: fd.get('to') || '' };
      renderPage();
    };
    const resetBtn = document.getElementById('resetReportFiltersBtn');
    if (resetBtn) resetBtn.onclick = () => { uiState.reportFilters = { storeId: '', from: '', to: '' }; renderPage(); };
    const printBtn = document.getElementById('printReportBtn');
    if (printBtn) printBtn.onclick = () => printSalesReport(report, { title: 'Rapport Commerce', storeName: selectedStoreName(stores, uiState.reportFilters.storeId) });
    return;
  }
  if (page === 'cash-sessions') {
    const rows = await cashSessionsRepo.listCashSessions(db, context.tenantId);
    frame(renderCashSessionsPage(rows), 'Sessions de caisse');
    return;
  }
  if (page === 'stock-movements') {
    const rows = await stockMovementsRepo.listStockMovements(db, context.tenantId);
    frame(renderStockMovementsPage(rows), 'Mouvements de stock');
    return;
  }
  if (page === 'migration') {
    frame(renderMigrationPage(), 'Migration');
    document.getElementById('runMigrationBtn').onclick = async () => {
      try {
        const result = await migrateLegacyCommerce(db, context.authUser.uid, context.tenantId);
        document.getElementById('migrationResult').innerHTML = `<strong>${result.migratedStores}</strong> boutiques, <strong>${result.migratedEmployees}</strong> employés, <strong>${result.migratedProducts}</strong> produits migrés.`;
        showToast('Migration terminée');
      } catch (err) {
        showToast(err.message || 'Erreur migration', 'error');
      }
    };
    return;
  }
  const [stores, sales, orders, inventory, cashSessions] = await Promise.all([
    storesRepo.listStores(db, context.tenantId),
    salesRepo.listSales(db, context.tenantId),
    ordersRepo.listOrders(db, context.tenantId),
    inventoryRepo.listInventory(db, context.tenantId),
    cashSessionsRepo.listCashSessions(db, context.tenantId)
  ]);
  const dashboardStats = {
    ...buildDashboardStats({ sales, orders, inventory, cashSessions, ...uiState.dashboardFilters }),
    ...buildSalesReport({ sales, orders, inventory, cashSessions, ...uiState.dashboardFilters })
  };
  frame(renderAdminDashboard(dashboardStats, { stores, filters: uiState.dashboardFilters }), 'Dashboard');
  const filtersForm = document.getElementById('dashboardFiltersForm');
  if (filtersForm) filtersForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    uiState.dashboardFilters = { storeId: fd.get('storeId') || '', from: fd.get('from') || '', to: fd.get('to') || '' };
    renderPage();
  };
  const resetDashboardFiltersBtn = document.getElementById('resetDashboardFiltersBtn');
  if (resetDashboardFiltersBtn) resetDashboardFiltersBtn.onclick = () => { uiState.dashboardFilters = { storeId: '', from: '', to: '' }; renderPage(); };
}

window.addEventListener('hashchange', renderPage);
onAuthStateChanged(auth, async user => {
  if (!user) {
    frame('<div class="cm-card cm-section">Connectez-vous au compte propriétaire Firebase pour administrer Commerce.</div>');
    return;
  }
  try {
    const tenantId = tenantIdOf(user);
    await ensureOwnerBootstrap(db, tenantId, user);
    context = await getCommerceContext(db, tenantId, user);
    await renderPage();
  } catch (err) {
    frame(`<div class="cm-card cm-section"><strong>Erreur</strong><p>${err.message || 'Impossible de charger l\'administration Commerce.'}</p></div>`);
  }
});
