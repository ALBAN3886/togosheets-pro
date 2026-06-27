import { getCommerceFirebaseApp, getCommerceAuth, onAuthStateChanged } from '../../core/firebase/app.js';
import { createCommerceDb } from '../../core/firebase/firestore.js';
import { getCommerceContext } from '../../core/services/role.service.js';
import { createSaleFromOrder } from '../../core/services/sale.service.js';
import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderEmployeeLogin } from './pages/login.js';
import { renderEmployeePos } from './pages/pos.js';
import { renderEmployeeStock } from './pages/stock.js';
import { renderEmployeeOrders } from './pages/orders.js';
import * as productsRepo from '../../core/repositories/product.repository.js';
import * as inventoryRepo from '../../core/repositories/inventory.repository.js';
import * as ordersRepo from '../../core/repositories/order.repository.js';
import { showToast } from '../../shared-ui/components/toast.js';

const app = getCommerceFirebaseApp();
const auth = getCommerceAuth();
const db = createCommerceDb(app);
let context = null;
let state = { products: [], inventory: [], orders: [] };

function tenantIdOf(user) {
  const qs = new URLSearchParams(location.search);
  return qs.get('tenant') || qs.get('uid') || user.uid;
}

function currentStoreId() {
  const qs = new URLSearchParams(location.search);
  return qs.get('store') || qs.get('shop') || context?.storeIds?.[0] || '';
}

function sidebar() {
  return `<h2>Espace Employé</h2><nav style="display:grid;gap:10px;margin-top:20px"><a href="#login">Connexion</a><a href="#pos">Caisse</a><a href="#stock">Stock</a><a href="#orders">Commandes</a></nav>`;
}

function frame(content, title = 'Interface Employé') {
  document.getElementById('app').innerHTML = renderAppShell({ title, sidebar: sidebar(), content });
}

async function renderPage() {
  const page = location.hash.replace('#','') || 'login';
  if (!context) { frame(renderEmployeeLogin({ user: null })); return; }
  if (page === 'pos') { frame(renderEmployeePos(state.products), 'Caisse'); return; }
  if (page === 'stock') { frame(renderEmployeeStock(state.inventory), 'Stock'); return; }
  if (page === 'orders') {
    frame(renderEmployeeOrders(state.orders) + '<button id="approveFirstOrderBtn" class="cm-btn primary" style="margin-top:16px">Valider la première commande</button>', 'Commandes');
    const btn = document.getElementById('approveFirstOrderBtn');
    if (btn) btn.onclick = async () => {
      const order = state.orders[0];
      if (!order) return showToast('Aucune commande');
      await createSaleFromOrder(db, context, order);
      showToast('Commande validée');
    };
    return;
  }
  frame(renderEmployeeLogin({ user: context.authUser }), 'Connexion');
}

async function loadData() {
  const storeId = currentStoreId();
  const [products, inventory, orders] = await Promise.all([
    productsRepo.listProducts(db, context.tenantId, { storeId, isActive: true }),
    inventoryRepo.listInventory(db, context.tenantId, { storeId }),
    ordersRepo.listOrders(db, context.tenantId, { storeId, status: 'pending' })
  ]);
  state = { products, inventory, orders };
}

window.addEventListener('hashchange', renderPage);
onAuthStateChanged(auth, async user => {
  if (!user) { frame(renderEmployeeLogin({ user: null })); return; }
  context = await getCommerceContext(db, tenantIdOf(user), user);
  await loadData();
  await renderPage();
});
