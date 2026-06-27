import { getCommerceFirebaseApp, getCommerceAuth, onAuthStateChanged } from '../../core/firebase/app.js';
import { createCommerceDb } from '../../core/firebase/firestore.js';
import { ensureOwnerBootstrap, getCommerceContext, migrateLegacyCommerce, saveStore } from '../../core/services/index.js';
import * as storesRepo from '../../core/repositories/store.repository.js';
import * as categoriesRepo from '../../core/repositories/category.repository.js';
import * as productsRepo from '../../core/repositories/product.repository.js';
import * as inventoryRepo from '../../core/repositories/inventory.repository.js';
import * as employeesRepo from '../../core/repositories/employee.repository.js';
import { saveCategory } from '../../core/services/catalog.service.js';
import { saveProduct } from '../../core/services/catalog.service.js';
import { saveEmployee } from '../../core/services/employee.service.js';
import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderAdminDashboard } from './pages/dashboard.js';
import { renderStoresPage } from './pages/stores.js';
import { renderCategoriesPage } from './pages/categories.js';
import { renderProductsPage } from './pages/products.js';
import { renderInventoryPage } from './pages/inventory.js';
import { renderEmployeesPage } from './pages/employees.js';
import { renderMigrationPage } from './pages/migration.js';
import { storeForm } from './forms/store-form.js';
import { categoryForm } from './forms/category-form.js';
import { productForm } from './forms/product-form.js';
import { employeeForm } from './forms/employee-form.js';
import { showToast } from '../../shared-ui/components/toast.js';
import { watchDashboardStats } from '../../core/realtime/watch-stats.js';

const app = getCommerceFirebaseApp();
const auth = getCommerceAuth();
const db = createCommerceDb(app);
let context = null;
let unsub = null;

function tenantIdOf(user) {
  const qs = new URLSearchParams(location.search);
  return qs.get('tenant') || qs.get('uid') || user.uid;
}

function sidebar() {
  return `<h2>Commerce Admin</h2><nav style="display:grid;gap:10px;margin-top:20px"><a href="#dashboard">Dashboard</a><a href="#stores">Boutiques</a><a href="#categories">Catégories</a><a href="#products">Produits</a><a href="#inventory">Stock</a><a href="#employees">Employés</a><a href="#migration">Migration</a></nav>`;
}

function frame(content, title = 'Administration Commerce') {
  document.getElementById('app').innerHTML = renderAppShell({ title, sidebar: sidebar(), content });
}

async function renderPage() {
  if (!context) return;
  unsub?.();
  unsub = null;
  const page = location.hash.replace('#','') || 'dashboard';
  if (page === 'stores') {
    const rows = await storesRepo.listStores(db, context.tenantId);
    frame(storeForm() + renderStoresPage(rows), 'Boutiques');
    document.getElementById('storeForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await saveStore(db, context, Object.fromEntries(fd.entries()));
      showToast('Boutique enregistrée');
      renderPage();
    };
    return;
  }
  if (page === 'categories') {
    const rows = await categoriesRepo.listCategories(db, context.tenantId);
    frame(categoryForm() + renderCategoriesPage(rows), 'Catégories');
    document.getElementById('categoryForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await saveCategory(db, context, { ...Object.fromEntries(fd.entries()), sortOrder: Number(fd.get('sortOrder') || 0) });
      showToast('Catégorie enregistrée');
      renderPage();
    };
    return;
  }
  if (page === 'products') {
    const [rows, cats, stores] = await Promise.all([productsRepo.listProducts(db, context.tenantId), categoriesRepo.listCategories(db, context.tenantId), storesRepo.listStores(db, context.tenantId)]);
    frame(productForm({}, cats, stores) + renderProductsPage(rows), 'Produits');
    document.getElementById('productForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await saveProduct(db, context, { name: fd.get('name'), sku: fd.get('sku'), salePrice: Number(fd.get('salePrice') || 0), categoryId: fd.get('categoryId') || '', storeIds: fd.get('storeId') ? [fd.get('storeId')] : [], isPublished: !!fd.get('isPublished') });
      showToast('Produit enregistré');
      renderPage();
    };
    return;
  }
  if (page === 'inventory') {
    const rows = await inventoryRepo.listInventory(db, context.tenantId);
    frame(renderInventoryPage(rows), 'Stock');
    return;
  }
  if (page === 'employees') {
    const [rows, stores] = await Promise.all([employeesRepo.listEmployees(db, context.tenantId), storesRepo.listStores(db, context.tenantId)]);
    frame(employeeForm({}, stores) + renderEmployeesPage(rows), 'Employés');
    document.getElementById('employeeForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await saveEmployee(db, context, { displayName: fd.get('displayName'), phone: fd.get('phone'), role: fd.get('role'), storeIds: fd.get('storeId') ? [fd.get('storeId')] : [] });
      showToast('Employé enregistré');
      renderPage();
    };
    return;
  }
  if (page === 'migration') {
    frame(renderMigrationPage(), 'Migration');
    document.getElementById('runMigrationBtn').onclick = async () => {
      const result = await migrateLegacyCommerce(db, context.authUser.uid, context.tenantId);
      document.getElementById('migrationResult').innerHTML = `<strong>${result.migratedStores}</strong> boutiques, <strong>${result.migratedEmployees}</strong> employés, <strong>${result.migratedProducts}</strong> produits migrés.`;
      showToast('Migration terminée');
    };
    return;
  }
  frame(renderAdminDashboard({}), 'Dashboard');
  unsub = watchDashboardStats(db, context.tenantId, null, stats => {
    frame(renderAdminDashboard(stats), 'Dashboard');
  });
}

window.addEventListener('hashchange', renderPage);
onAuthStateChanged(auth, async user => {
  if (!user) {
    frame('<div class="cm-card cm-section">Connectez-vous au compte propriétaire Firebase pour administrer Commerce.</div>');
    return;
  }
  const tenantId = tenantIdOf(user);
  await ensureOwnerBootstrap(db, tenantId, user);
  context = await getCommerceContext(db, tenantId, user);
  await renderPage();
});
