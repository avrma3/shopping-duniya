const API_BASE = '/api';
let currentAdmin = null;
let salesChart = null;
let statusChart = null;

let productsState = { page: 1, search: '' };
let ordersState = { page: 1, status: '' };
let usersState = { page: 1 };
let categoriesCache = [];

// ============ Auth guard ============
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) return showAccessDenied();

    try {
        currentAdmin = JSON.parse(user);
    } catch (e) {
        return showAccessDenied();
    }

    if (currentAdmin.role !== 'admin') return showAccessDenied();

    document.getElementById('admin-app').style.display = 'flex';
    document.getElementById('admin-name-label').textContent = `${currentAdmin.firstName || 'Admin'}`;
    document.getElementById('admin-avatar').textContent = (currentAdmin.firstName || 'A').charAt(0).toUpperCase();

    attachNav();
    attachForms();
    loadDashboard();
});

function showAccessDenied() {
    document.getElementById('access-denied').style.display = 'flex';
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        ...options
    };
    if (options.body && typeof options.body === 'object') config.body = JSON.stringify(options.body);

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    if (response.status === 403) {
        showAccessDenied();
        document.getElementById('admin-app').style.display = 'none';
        throw new Error('Admin access required');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ============ Nav ============
function attachNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    });
    document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('mobile-open');
    });
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });
}

const VIEW_TITLES = { dashboard: 'Dashboard', products: 'Products', orders: 'Orders', users: 'Users', categories: 'Categories' };

function switchView(view) {
    document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(`view-${view}`).style.display = 'block';
    document.getElementById('view-title').textContent = VIEW_TITLES[view];
    document.querySelector('.sidebar').classList.remove('mobile-open');

    if (view === 'dashboard') loadDashboard();
    if (view === 'products') loadProducts();
    if (view === 'orders') loadOrders();
    if (view === 'users') loadUsers();
    if (view === 'categories') loadCategories();
}

// ============ Dashboard ============
async function loadDashboard() {
    try {
        const stats = await apiRequest('/admin/stats');
        renderStatCards(stats);
        renderSalesChart(stats.salesByDay);
        renderStatusChart(stats.ordersByStatus);
        renderRecentOrders(stats.recentOrders);
        renderLowStock(stats.lowStockProducts);
    } catch (error) {
        showError(error.message);
    }
}

function renderStatCards(stats) {
    const cards = [
        { icon: 'fa-dollar-sign', cls: 'revenue', label: 'Total revenue', value: `$${stats.totalRevenue.toFixed(2)}` },
        { icon: 'fa-receipt', cls: 'orders', label: 'Total orders', value: stats.totalOrders },
        { icon: 'fa-users', cls: 'users', label: 'Total users', value: stats.totalUsers },
        { icon: 'fa-box', cls: 'products', label: 'Total products', value: stats.totalProducts }
    ];
    document.getElementById('stat-cards').innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-card-icon ${c.cls}"><i class="fas ${c.icon}"></i></div>
            <div>
                <div class="stat-card-value">${c.value}</div>
                <div class="stat-card-label">${c.label}</div>
            </div>
        </div>
    `).join('');
}

function renderSalesChart(salesByDay) {
    const ctx = document.getElementById('sales-chart');
    const labels = salesByDay.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const data = salesByDay.map(d => d.amount);

    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.1)',
                fill: true,
                tension: 0.35,
                pointRadius: 3
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => `$${v}` } } }
        }
    });
}

function renderStatusChart(ordersByStatus) {
    const ctx = document.getElementById('status-chart');
    const labels = Object.keys(ordersByStatus);
    const data = Object.values(ordersByStatus);
    const colors = { pending: '#d97706', processing: '#2563eb', shipped: '#4f46e5', delivered: '#16a34a', cancelled: '#dc2626' };

    if (statusChart) statusChart.destroy();

    if (labels.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{ data, backgroundColor: labels.map(l => colors[l] || '#94a3b8') }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

function renderRecentOrders(orders) {
    const container = document.getElementById('recent-orders-list');
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:2rem;"><i class="fas fa-receipt"></i><h3>No orders yet</h3></div>`;
        return;
    }
    container.innerHTML = orders.map(o => `
        <div class="mini-list-item">
            <div><div class="name">#${escapeHtml(o.orderNumber)}</div><div class="sub">${escapeHtml(o.customer)}</div></div>
            <div style="text-align:right;">
                <div class="name">$${o.totalAmount.toFixed(2)}</div>
                <span class="status-pill status-${o.status}">${o.status}</span>
            </div>
        </div>
    `).join('');
}

function renderLowStock(products) {
    const container = document.getElementById('low-stock-list');
    if (!products || products.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:2rem;"><i class="fas fa-check-circle"></i><h3>Stock levels healthy</h3></div>`;
        return;
    }
    container.innerHTML = products.map(p => `
        <div class="mini-list-item">
            <div class="name">${escapeHtml(p.name)}</div>
            <span class="status-pill status-cancelled">${p.stock} left</span>
        </div>
    `).join('');
}

// ============ Products ============
async function loadProducts() {
    const tbody = document.getElementById('products-table-body');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i></td></tr>`;
    try {
        const params = new URLSearchParams({ page: productsState.page, limit: 10, ...(productsState.search && { search: productsState.search }) });
        const res = await apiRequest(`/admin/products?${params}`);
        renderProductsTable(res.products);
        renderPagination('products-pagination', res.currentPage, res.totalPages, p => { productsState.page = p; loadProducts(); });
    } catch (error) {
        showError(error.message);
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--color-ink-faint);">No products found</td></tr>`;
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr>
            <td>${p.images && p.images[0] ? `<img class="table-thumb" src="${escapeHtml(p.images[0])}" alt="">` : `<div class="table-thumb"></div>`}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category)}</td>
            <td>$${p.price.toFixed(2)}${p.discount_price ? ` <span style="color:var(--color-ink-faint); text-decoration:line-through; font-size:0.8em;">$${p.discount_price.toFixed(2)}</span>` : ''}</td>
            <td>${p.stock}</td>
            <td>${p.is_active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
            <td>
                <div class="row-actions">
                    <button class="edit-btn" onclick='openProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'><i class="fas fa-pen"></i></button>
                    <button class="delete-btn" onclick="deleteProduct('${p._id}', '${escapeHtml(p.name).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function attachForms() {
    document.getElementById('product-search').addEventListener('input', debounce(e => {
        productsState.search = e.target.value.trim();
        productsState.page = 1;
        loadProducts();
    }, 350));

    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());
    document.getElementById('product-form').addEventListener('submit', saveProduct);

    document.getElementById('order-status-filter').addEventListener('change', e => {
        ordersState.status = e.target.value;
        ordersState.page = 1;
        loadOrders();
    });

    document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());
    document.getElementById('category-form').addEventListener('submit', saveCategory);
}

function openProductModal(product) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit product' : 'Add product';
    document.getElementById('category-options').innerHTML = categoriesCache.map(c => `<option value="${escapeHtml(c.name)}">`).join('');

    document.getElementById('product-id').value = product ? product._id : '';
    document.getElementById('product-name').value = product ? product.name : '';
    document.getElementById('product-description').value = product ? product.description : '';
    document.getElementById('product-price').value = product ? product.price : '';
    document.getElementById('product-discount-price').value = product && product.discount_price ? product.discount_price : '';
    document.getElementById('product-stock').value = product ? product.stock : '';
    document.getElementById('product-category').value = product ? product.category : '';
    document.getElementById('product-images').value = product && product.images ? product.images.join(', ') : '';
    document.getElementById('product-tags').value = product && product.tags ? product.tags.join(', ') : '';
    document.getElementById('product-active').checked = product ? !!product.is_active : true;
    document.getElementById('product-featured').checked = product ? !!product.featured : false;

    showModal('product-modal');
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const payload = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        discount_price: document.getElementById('product-discount-price').value ? parseFloat(document.getElementById('product-discount-price').value) : undefined,
        stock: parseInt(document.getElementById('product-stock').value, 10),
        category: document.getElementById('product-category').value,
        images: document.getElementById('product-images').value,
        tags: document.getElementById('product-tags').value,
        is_active: document.getElementById('product-active').checked,
        featured: document.getElementById('product-featured').checked
    };

    try {
        if (id) {
            await apiRequest(`/admin/products/${id}`, { method: 'PUT', body: payload });
            showSuccess('Product updated');
        } else {
            await apiRequest('/admin/products', { method: 'POST', body: payload });
            showSuccess('Product created');
        }
        closeModal('product-modal');
        loadProducts();
    } catch (error) {
        showError(error.message);
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await apiRequest(`/admin/products/${id}`, { method: 'DELETE' });
        showSuccess('Product deleted');
        loadProducts();
    } catch (error) {
        showError(error.message);
    }
}

// ============ Orders ============
async function loadOrders() {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i></td></tr>`;
    try {
        const params = new URLSearchParams({ page: ordersState.page, limit: 10, ...(ordersState.status && { status: ordersState.status }) });
        const res = await apiRequest(`/admin/orders?${params}`);
        renderOrdersTable(res.orders);
        renderPagination('orders-pagination', res.currentPage, res.totalPages, p => { ordersState.page = p; loadOrders(); });
    } catch (error) {
        showError(error.message);
    }
}

const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-ink-faint);">No orders found</td></tr>`;
        return;
    }
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>#${escapeHtml(o.orderNumber)}</td>
            <td>${o.customer ? escapeHtml(o.customer.name || o.customer.email) : 'Unknown'}</td>
            <td>${o.items.length} item(s)</td>
            <td>$${o.totalAmount.toFixed(2)}</td>
            <td>
                <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                </select>
            </td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

async function updateOrderStatus(id, status) {
    try {
        await apiRequest(`/admin/orders/${id}/status`, { method: 'PUT', body: { status } });
        showSuccess('Order status updated');
    } catch (error) {
        showError(error.message);
        loadOrders();
    }
}

// ============ Users ============
async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i></td></tr>`;
    try {
        const params = new URLSearchParams({ page: usersState.page, limit: 10 });
        const res = await apiRequest(`/admin/users?${params}`);
        renderUsersTable(res.users);
        renderPagination('users-pagination', res.currentPage, res.totalPages, p => { usersState.page = p; loadUsers(); });
    } catch (error) {
        showError(error.message);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-ink-faint);">No users found</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.phone || '—')}</td>
            <td><span class="role-badge ${u.role}">${u.role}</span></td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="row-actions">
                    <button class="edit-btn" title="${u.role === 'admin' ? 'Revoke admin' : 'Make admin'}" onclick="toggleUserRole('${u._id}', '${u.role}')">
                        <i class="fas ${u.role === 'admin' ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function toggleUserRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`${newRole === 'admin' ? 'Grant' : 'Revoke'} admin access for this user?`)) return;
    try {
        await apiRequest(`/admin/users/${id}/role`, { method: 'PUT', body: { role: newRole } });
        showSuccess('User role updated');
        loadUsers();
    } catch (error) {
        showError(error.message);
    }
}

// ============ Categories ============
async function loadCategories() {
    const tbody = document.getElementById('categories-table-body');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i></td></tr>`;
    try {
        categoriesCache = await apiRequest('/admin/categories');
        renderCategoriesTable(categoriesCache);
    } catch (error) {
        showError(error.message);
    }
}

function renderCategoriesTable(categories) {
    const tbody = document.getElementById('categories-table-body');
    if (categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--color-ink-faint);">No categories found</td></tr>`;
        return;
    }
    tbody.innerHTML = categories.map(c => `
        <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.description || '')}</td>
            <td>${c.display_order}</td>
            <td>${c.is_active ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
            <td>
                <div class="row-actions">
                    <button class="edit-btn" onclick='openCategoryModal(${JSON.stringify(c).replace(/'/g, "&#39;")})'><i class="fas fa-pen"></i></button>
                    <button class="delete-btn" onclick="deleteCategory('${c._id}', '${escapeHtml(c.name).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openCategoryModal(category) {
    document.getElementById('category-modal-title').textContent = category ? 'Edit category' : 'Add category';
    document.getElementById('category-id').value = category ? category._id : '';
    document.getElementById('category-name').value = category ? category.name : '';
    document.getElementById('category-description').value = category ? category.description : '';
    document.getElementById('category-display-order').value = category ? category.display_order : 0;
    showModal('category-modal');
}

async function saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const payload = {
        name: document.getElementById('category-name').value,
        description: document.getElementById('category-description').value,
        display_order: parseInt(document.getElementById('category-display-order').value, 10) || 0
    };
    try {
        if (id) {
            await apiRequest(`/admin/categories/${id}`, { method: 'PUT', body: payload });
            showSuccess('Category updated');
        } else {
            await apiRequest('/admin/categories', { method: 'POST', body: payload });
            showSuccess('Category created');
        }
        closeModal('category-modal');
        loadCategories();
    } catch (error) {
        showError(error.message);
    }
}

async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
        await apiRequest(`/admin/categories/${id}`, { method: 'DELETE' });
        showSuccess('Category deleted');
        loadCategories();
    } catch (error) {
        showError(error.message);
    }
}

// ============ Pagination ============
function renderPagination(containerId, currentPage, totalPages, onChange) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = `
        <button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''} id="${containerId}-prev"><i class="fas fa-chevron-left"></i> Prev</button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''} id="${containerId}-next">Next <i class="fas fa-chevron-right"></i></button>
    `;
    const prevBtn = document.getElementById(`${containerId}-prev`);
    const nextBtn = document.getElementById(`${containerId}-next`);
    if (prevBtn) prevBtn.addEventListener('click', () => onChange(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => onChange(currentPage + 1));
}

// ============ Modal helpers ============
function showModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ============ Utility ============
function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showSuccess(message) { showNotification(message, 'success'); }
function showError(message) { showNotification(message, 'error'); }

function showNotification(message, type) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 200); }, 3000);
}
