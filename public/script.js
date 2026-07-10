// Global state
let currentUser = null;
let cart = [];
let products = [];
let categories = [];
let currentPage = 1;
let totalPages = 1;
let currentCategory = '';
let currentSearch = '';

// API endpoints
const API_BASE = '/api';

// ============ Modal helpers ============
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showLoginModal() {
    closeModal('register-modal');
    showModal('login-modal');
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
}

function showRegisterModal() {
    closeModal('login-modal');
    showModal('register-modal');
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.reset();
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    attachEventListeners();
    loadInitialData();
});

function initializeApp() {
    const token = localStorage.getItem('token');
    if (token) {
        currentUser = JSON.parse(localStorage.getItem('user'));
        updateUserUI();
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
            closeMobileNav();
        });
    });
}

function attachEventListeners() {
    document.getElementById('hamburger-btn').addEventListener('click', toggleMobileNav);
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('signup-btn').addEventListener('click', showRegisterModal);
    document.getElementById('cart-btn').addEventListener('click', showCart);
    document.getElementById('orders-btn').addEventListener('click', showOrders);
    document.getElementById('dropdown-orders-btn').addEventListener('click', () => { closeUserDropdown(); showOrders(); });
    document.getElementById('logout-btn').addEventListener('click', () => { closeUserDropdown(); logout(); });
    document.getElementById('user-btn').addEventListener('click', toggleUserDropdown);

    document.getElementById('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(e.target.value); });
    document.getElementById('search-input-mobile').addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(e.target.value); });

    document.getElementById('category-filter').addEventListener('change', handleCategoryFilter);
    document.getElementById('sort-filter').addEventListener('change', handleSort);

    document.getElementById('prev-page').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => changePage(currentPage + 1));

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
        if (!e.target.closest('.user-menu')) closeUserDropdown();
    });

    document.getElementById('checkout-btn').addEventListener('click', showCheckout);
}

function toggleMobileNav() {
    document.getElementById('nav-menu').classList.toggle('mobile-open');
}
function closeMobileNav() {
    document.getElementById('nav-menu').classList.remove('mobile-open');
}

function toggleUserDropdown() {
    document.getElementById('user-dropdown').classList.toggle('open');
}
function closeUserDropdown() {
    document.getElementById('user-dropdown').classList.remove('open');
}

// ============ Load data ============
async function loadInitialData() {
    renderSkeletons();
    try {
        await Promise.all([loadCategories(), loadProducts()]);
        loadCart();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showError('Failed to load data. Please refresh the page.');
    }
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        },
        ...options
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function loadCategories() {
    try {
        categories = await apiRequest('/categories');
        renderCategories();
        populateCategoryFilter();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadProducts() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 12,
            ...(currentCategory && { category: currentCategory }),
            ...(currentSearch && { search: currentSearch })
        });

        const response = await apiRequest(`/products?${params}`);
        products = response.products;
        totalPages = response.totalPages || 1;

        document.getElementById('stat-products').textContent = response.totalProducts ?? products.length;

        renderProducts();
        updatePagination();
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please try again.');
    }
}

async function loadCart() {
    if (!currentUser) {
        cart = [];
        updateCartUI();
        return;
    }
    try {
        cart = await apiRequest('/cart');
        updateCartUI();
    } catch (error) {
        console.error('Error loading cart:', error);
        cart = [];
        updateCartUI();
    }
}

// ============ Render: skeletons ============
function renderSkeletons() {
    const container = document.getElementById('products-grid');
    container.innerHTML = Array.from({ length: 8 }).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-img skeleton-shimmer"></div>
            <div class="skeleton-line skeleton-shimmer w-60"></div>
            <div class="skeleton-line skeleton-shimmer w-40"></div>
        </div>
    `).join('');
}

// ============ Render: categories ============
const CATEGORY_ICONS = {
    'Electronics': 'fa-mobile-screen-button',
    'Fashion': 'fa-shirt',
    'Home & Kitchen': 'fa-house-chimney',
    'Sports': 'fa-basketball',
    'Accessories': 'fa-bag-shopping'
};

function renderCategories() {
    const container = document.getElementById('categories-grid');
    container.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.name}')">
            <div class="category-icon"><i class="fas ${CATEGORY_ICONS[category.name] || 'fa-folder'}"></i></div>
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.description || '')}</p>
        </div>
    `).join('');
}

// ============ Render: products ============
function renderProducts() {
    const container = document.getElementById('products-grid');

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No products found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(product => {
        const hasDiscount = product.salePrice && product.salePrice < product.price;
        const displayPrice = hasDiscount ? product.salePrice : product.price;
        const discount = hasDiscount ? Math.round(((product.price - product.salePrice) / product.price) * 100) : 0;
        const image = product.images && product.images[0];
        const outOfStock = !product.stock || product.stock <= 0;
        const rating = product.rating || 0;

        return `
            <div class="product-card">
                <div class="product-image" onclick="viewProduct('${product.id}')">
                    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<div class="no-image"><i class="fas fa-image"></i></div>`}
                    ${hasDiscount ? `<span class="sale-badge">${discount}% OFF</span>` : ''}
                    ${outOfStock ? `<span class="stock-badge">Out of stock</span>` : ''}
                </div>
                <div class="product-card-content">
                    <span class="product-category-tag">${escapeHtml(product.categoryId || '')}</span>
                    <h3 onclick="viewProduct('${product.id}')">${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description)}</p>
                    ${rating ? `<div class="product-rating"><span class="stars">${renderStars(rating)}</span> ${rating.toFixed(1)}</div>` : ''}
                    <div class="product-price">
                        <span class="current-price">$${displayPrice.toFixed(2)}</span>
                        ${hasDiscount ? `<span class="original-price">$${product.price.toFixed(2)}</span>` : ''}
                    </div>
                    <div class="product-actions">
                        <button class="add-to-cart-btn" onclick="addToCart('${product.id}')" ${outOfStock ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> ${outOfStock ? 'Sold out' : 'Add to cart'}
                        </button>
                        <button class="view-product-btn" onclick="viewProduct('${product.id}')" title="Quick view">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStars(rating) {
    const full = Math.round(rating);
    return Array.from({ length: 5 }).map((_, i) => `<i class="fa${i < full ? 's' : 'r'} fa-star"></i>`).join('');
}

function populateCategoryFilter() {
    const select = document.getElementById('category-filter');
    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');
}

function updatePagination() {
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
}

// ============ Cart UI ============
function updateCartUI() {
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = cartCount;

    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cart-shopping"></i>
                <h3>Your cart is empty</h3>
                <p>Add some products to get started</p>
            </div>
        `;
        cartTotal.textContent = '0.00';
        return;
    }

    let total = 0;
    cartItems.innerHTML = cart.map(item => {
        const price = item.product.salePrice || item.product.price;
        const itemTotal = price * item.quantity;
        total += itemTotal;
        const image = item.product.images && item.product.images[0];

        return `
            <div class="cart-item">
                <div class="cart-item-thumb">
                    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product.name)}">` : ''}
                </div>
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.product.name)}</h4>
                    <p class="cart-item-price">$${price.toFixed(2)} each</p>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    <button class="remove-btn" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    cartTotal.textContent = total.toFixed(2);
    document.getElementById('checkout-total').textContent = total.toFixed(2);
}

// ============ User UI ============
function updateUserUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const ordersBtn = document.getElementById('orders-btn');
    const adminLink = document.getElementById('admin-nav-link');

    if (currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'block';
        ordersBtn.style.display = 'flex';
        document.getElementById('user-name-label').textContent = currentUser.firstName || 'Account';
        document.getElementById('user-avatar').textContent = (currentUser.firstName || 'U').charAt(0).toUpperCase();
        adminLink.style.display = currentUser.role === 'admin' ? 'block' : 'none';
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
        ordersBtn.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

// ============ Event handlers ============
function handleSearch(value) {
    currentSearch = (value || '').trim();
    currentPage = 1;
    loadProducts();
}

function handleCategoryFilter() {
    currentCategory = document.getElementById('category-filter').value;
    currentPage = 1;
    loadProducts();
}

function handleSort() {
    const sortBy = document.getElementById('sort-filter').value;
    switch (sortBy) {
        case 'name':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'price-low':
            products.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
            break;
        case 'price-high':
            products.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
            break;
    }
    renderProducts();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        currentUser = response.user;

        closeModal('login-modal');
        updateUserUI();
        loadCart();
        showSuccess(`Welcome back, ${currentUser.firstName || 'there'}!`);
    } catch (error) {
        showError(error.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('register-firstName').value;
    const lastName = document.getElementById('register-lastName').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await apiRequest('/auth/register', { method: 'POST', body: { firstName, lastName, email, phone, password } });
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        currentUser = response.user;

        closeModal('register-modal');
        updateUserUI();
        loadCart();
        showSuccess('Account created — welcome to Shopping Duniya!');
    } catch (error) {
        showError(error.message);
    }
}

async function handleCheckout(e) {
    e.preventDefault();
    if (!currentUser) {
        showError('Please login to checkout');
        return;
    }

    const shippingAddress = {
        address: document.getElementById('checkout-address').value,
        city: document.getElementById('checkout-city').value,
        state: document.getElementById('checkout-state').value,
        zip: document.getElementById('checkout-zip').value
    };
    const paymentMethod = document.getElementById('checkout-payment').value;

    try {
        await apiRequest('/orders', { method: 'POST', body: { shippingAddress, paymentMethod } });
        closeModal('checkout-modal');
        showSuccess('Order placed successfully!');
        loadCart();
        document.getElementById('checkout-form').reset();
    } catch (error) {
        showError(error.message);
    }
}

// ============ Cart functions ============
async function addToCart(productId) {
    if (!currentUser) {
        showError('Please login to add items to cart');
        showLoginModal();
        return;
    }
    try {
        await apiRequest('/cart', { method: 'POST', body: { productId, quantity: 1 } });
        loadCart();
        showSuccess('Item added to cart');
    } catch (error) {
        showError(error.message);
    }
}

async function updateCartQuantity(cartId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(cartId);
        return;
    }
    try {
        await apiRequest(`/cart/${cartId}`, { method: 'PUT', body: { quantity: newQuantity } });
        loadCart();
    } catch (error) {
        showError(error.message);
    }
}

async function removeFromCart(cartId) {
    try {
        await apiRequest(`/cart/${cartId}`, { method: 'DELETE' });
        loadCart();
        showSuccess('Item removed from cart');
    } catch (error) {
        showError(error.message);
    }
}

// ============ Product detail ============
async function viewProduct(productId) {
    try {
        const product = await apiRequest(`/products/${productId}`);
        showProductDetail(product);
    } catch (error) {
        showError(error.message);
    }
}

function showProductDetail(product) {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-detail-content');

    const hasDiscount = product.salePrice && product.salePrice < product.price;
    const displayPrice = hasDiscount ? product.salePrice : product.price;
    const image = product.images && product.images[0];
    const outOfStock = !product.stock || product.stock <= 0;

    content.innerHTML = `
        <div class="product-detail-content">
            <div class="product-detail-gallery">
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">` : `<div class="no-image"><i class="fas fa-image"></i></div>`}
            </div>
            <div class="product-detail-info">
                <span class="product-category-tag">${escapeHtml(product.categoryId || '')}</span>
                <h2>${escapeHtml(product.name)}</h2>
                <p class="description">${escapeHtml(product.description)}</p>
                <div class="product-detail-price">
                    <span class="current-price">$${displayPrice.toFixed(2)}</span>
                    ${hasDiscount ? `<span class="original-price">$${product.price.toFixed(2)}</span>` : ''}
                </div>
                <div class="product-detail-meta">
                    <span><i class="fas fa-box"></i> ${product.stock} in stock</span>
                    ${product.rating ? `<span><i class="fas fa-star" style="color:#f59e0b"></i> ${product.rating.toFixed(1)} (${product.reviews_count || 0})</span>` : ''}
                </div>
                <div class="product-detail-actions">
                    <button class="add-to-cart-btn" onclick="addToCart('${product.id}')" ${outOfStock ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i> ${outOfStock ? 'Sold out' : 'Add to cart'}
                    </button>
                    <button class="view-product-btn" onclick="closeModal('product-modal')" style="flex:1;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'block';
}

// ============ Orders (My Orders) ============
async function showOrders() {
    if (!currentUser) {
        showError('Please login to view your orders');
        showLoginModal();
        return;
    }

    const list = document.getElementById('orders-list');
    list.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading your orders...</h3></div>`;
    showModal('orders-modal');

    try {
        const orders = await apiRequest('/orders');
        renderOrders(orders);
    } catch (error) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h3>Couldn't load orders</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
}

function renderOrders(orders) {
    const list = document.getElementById('orders-list');

    if (!orders || orders.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No orders yet</h3>
                <p>Your placed orders will show up here</p>
            </div>
        `;
        return;
    }

    list.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-card-header">
                <div>
                    <h4>#${escapeHtml(order.orderNumber)}</h4>
                    <span class="date">${new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
                <span class="status-pill status-${order.status}">${order.status}</span>
            </div>
            <div class="order-items-mini">
                ${order.items.map(item => `
                    <div class="order-item-mini">
                        <span>${escapeHtml(item.name)} × ${item.quantity}</span>
                        <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-card-footer">
                <span style="color:var(--color-ink-faint); font-size:0.85rem;">${order.items.length} item(s)</span>
                <strong>$${order.totalAmount.toFixed(2)}</strong>
            </div>
        </div>
    `).join('');
}

// ============ Navigation ============
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadProducts();
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function filterByCategory(categoryName) {
    currentCategory = categoryName;
    document.getElementById('category-filter').value = currentCategory;
    currentPage = 1;
    loadProducts();
    scrollToProducts();
}

function scrollToProducts() {
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function showCart() {
    showModal('cart-modal');
}

function showCheckout() {
    if (!currentUser) {
        showError('Please login to checkout');
        showLoginModal();
        return;
    }
    if (cart.length === 0) {
        showError('Your cart is empty');
        return;
    }
    closeModal('cart-modal');
    showModal('checkout-modal');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    cart = [];
    updateUserUI();
    updateCartUI();
    showSuccess('Logged out successfully');
}

// ============ Utility ============
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

window.scrollToProducts = scrollToProducts;
