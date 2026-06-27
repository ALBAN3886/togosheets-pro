import { getCommerceFirebaseApp, getCommerceAuth, onAuthStateChanged } from '../../core/firebase/app.js';
import { createCommerceDb } from '../../core/firebase/firestore.js';
import { getCommerceContext } from '../../core/services/role.service.js';
import { createSale, createSaleFromOrder, openCashSession, closeCashSession, printSaleInvoice } from '../../core/services/index.js';
import { renderAppShell } from '../../shared-ui/components/app-shell.js';
import { renderEmployeeLogin } from './pages/login.js';
import { renderEmployeePos } from './pages/pos.js';
import { renderEmployeeStock } from './pages/stock.js';
import { renderEmployeeOrders } from './pages/orders.js';
import { renderReceiptsPage } from './pages/receipts.js';
import * as productsRepo from '../../core/repositories/product.repository.js';
import * as inventoryRepo from '../../core/repositories/inventory.repository.js';
import * as ordersRepo from '../../core/repositories/order.repository.js';
import * as salesRepo from '../../core/repositories/sale.repository.js';
import * as cashSessionsRepo from '../../core/repositories/cash-session.repository.js';
import { showToast } from '../../shared-ui/components/toast.js';

const app = getCommerceFirebaseApp();
const auth = getCommerceAuth();
const db = createCommerceDb(app);
let context = null;
let state = { products: [], inventory: [], orders: [], sales: [], cashSessions: [], cart: [], selectedReceiptId: '' };

function tenantIdOf(user) {
  const qs = new URLSearchParams(location.search);
  return qs.get('tenant') || qs.get('uid') || user.uid;
}

function currentStoreId() {
  const qs = new URLSearchParams(location.search);
  return qs.get('store') || qs.get('shop') || context?.storeIds?.[0] || '';
}

function activeSession() {
  return state.cashSessions.find(row => row.status === 'open' && row.storeId === currentStoreId()) || null;
}

function sidebar() {
  return `<h2>Espace Employé</h2><nav style="display:grid;gap:10px;margin-top:20px"><a href="#login">Connexion</a><a href="#pos">Caisse</a><a href="#stock">Stock</a><a href="#orders">Commandes</a><a href="#receipts">Tickets</a></nav>`;
}

function frame(content, title = 'Interface Employé') {
  document.getElementById('app').innerHTML = renderAppShell({ title, sidebar: sidebar(), content });
}

function addToCart(productId) {
  const product = state.products.find(row => row.id === productId);
  if (!product) return;
  const existing = state.cart.find(row => row.productId === productId);
  if (existing) existing.qty += 1;
  else state.cart.push({ productId: product.id, name: product.name, qty: 1, unitPrice: Number(product.promoPrice ?? product.salePrice ?? 0) });
}

function updateCartQty(productId, delta) {
  const row = state.cart.find(item => item.productId === productId);
  if (!row) return;
  row.qty = Number(row.qty || 0) + delta;
  if (row.qty <= 0) state.cart = state.cart.filter(item => item.productId !== productId);
}

async function loadData() {
  const storeId = currentStoreId();
  const [products, inventory, orders, sales, cashSessions] = await Promise.all([
    productsRepo.listProducts(db, context.tenantId, { storeId, isActive: true }),
    inventoryRepo.listInventory(db, context.tenantId, { storeId }),
    ordersRepo.listOrders(db, context.tenantId, { storeId, status: 'pending' }),
    salesRepo.listSales(db, context.tenantId, { storeId }),
    cashSessionsRepo.listCashSessions(db, context.tenantId, { storeId })
  ]);
  state = { ...state, products, inventory, orders, sales, cashSessions };
  if (!state.selectedReceiptId && sales[0]?.id) state.selectedReceiptId = sales[0].id;
}

async function renderPage() {
  const page = location.hash.replace('#','') || 'login';
  if (!context) { frame(renderEmployeeLogin({ user: null })); return; }
  if (page === 'pos') {
    frame(renderEmployeePos({ products: state.products, cart: state.cart, session: activeSession() }), 'Caisse');
    document.querySelectorAll('[data-add-product-id]').forEach(btn => btn.onclick = () => { addToCart(btn.dataset.addProductId); renderPage(); });
    document.querySelectorAll('[data-cart-action]').forEach(btn => btn.onclick = () => { updateCartQty(btn.dataset.productId, btn.dataset.cartAction === 'inc' ? 1 : -1); renderPage(); });
    const openForm = document.getElementById('openCashSessionForm');
    if (openForm) openForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await openCashSession(db, context, { storeId: currentStoreId(), openingAmount: Number(fd.get('openingAmount') || 0), note: fd.get('note') || '' });
        await loadData();
        showToast('Caisse ouverte');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur de caisse', 'error');
      }
    };
    const closeForm = document.getElementById('closeCashSessionForm');
    if (closeForm) closeForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const session = activeSession();
        if (!session) return;
        const fd = new FormData(e.target);
        const salesTotal = state.sales.filter(sale => sale.cashSessionId === session.id).reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);
        await closeCashSession(db, context, session.id, { openingAmount: session.openingAmount || 0, expectedClosingAmount: Number(session.openingAmount || 0) + salesTotal, closingAmount: Number(fd.get('closingAmount') || 0), note: fd.get('note') || '' });
        await loadData();
        showToast('Caisse clôturée');
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur de clôture', 'error');
      }
    };
    const saleForm = document.getElementById('createSaleForm');
    if (saleForm) saleForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const session = activeSession();
        if (!session) throw new Error('Ouvrez une caisse avant d\'encaisser');
        if (!state.cart.length) throw new Error('Panier vide');
        const fd = new FormData(e.target);
        const payload = {
          storeId: currentStoreId(),
          cashSessionId: session.id,
          sellerEmployeeId: context.employeeId || context.authUser.uid,
          sellerName: context.authUser.displayName || 'Opérateur',
          source: 'employee-pos',
          paymentMethod: fd.get('paymentMethod') || 'cash',
          items: state.cart.map(item => ({ ...item, total: Number(item.qty || 0) * Number(item.unitPrice || 0) })),
          grandTotal: state.cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0)
        };
        await createSale(db, context, payload);
        state.cart = [];
        await loadData();
        showToast('Vente enregistrée');
        location.hash = '#receipts';
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur d\'encaissement', 'error');
      }
    };
    return;
  }
  if (page === 'stock') { frame(renderEmployeeStock(state.inventory), 'Stock'); return; }
  if (page === 'orders') {
    frame(renderEmployeeOrders(state.orders), 'Commandes');
    document.querySelectorAll('[data-approve-order-id]').forEach(btn => btn.onclick = async () => {
      try {
        const order = state.orders.find(row => row.id === btn.dataset.approveOrderId);
        if (!order) return showToast('Commande introuvable', 'error');
        await createSaleFromOrder(db, context, order, { cashSessionId: activeSession()?.id || null, paymentMethod: 'cash' });
        await loadData();
        showToast('Commande validée');
        location.hash = '#receipts';
        renderPage();
      } catch (err) {
        showToast(err.message || 'Erreur de validation', 'error');
      }
    });
    return;
  }
  if (page === 'receipts') {
    frame(renderReceiptsPage(state.sales, state.selectedReceiptId, { employeeName: context.authUser.displayName || 'Opérateur' }), 'Tickets');
    document.querySelectorAll('[data-sale-id]').forEach(btn => btn.onclick = () => { state.selectedReceiptId = btn.dataset.saleId; renderPage(); });
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) printBtn.onclick = () => {
      const sale = state.sales.find(row => row.id === state.selectedReceiptId) || state.sales[0];
      if (!sale) return showToast('Aucun ticket', 'error');
      printSaleInvoice(sale, { employeeName: context.authUser.displayName || 'Opérateur' });
    };
    return;
  }
  frame(renderEmployeeLogin({ user: context.authUser }), 'Connexion');
}

window.addEventListener('hashchange', renderPage);
onAuthStateChanged(auth, async user => {
  if (!user) { frame(renderEmployeeLogin({ user: null })); return; }
  try {
    context = await getCommerceContext(db, tenantIdOf(user), user);
    await loadData();
    await renderPage();
  } catch (err) {
    frame(`<div class="cm-card cm-section"><strong>Erreur</strong><p>${err.message || 'Impossible de charger l\'espace employé.'}</p></div>`);
  }
});
