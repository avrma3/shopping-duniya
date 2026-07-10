const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Import MongoDB models
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB database'))
.catch(err => {
  // Don't exit the process here - on serverless platforms (e.g. Vercel) this
  // function's process is reused across requests, and process.exit() would
  // take down a warm instance instead of just failing the one request.
  console.error('MongoDB connection error:', err);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin-only middleware - re-checks role against the DB so role changes
// take effect immediately without waiting for the user to re-login
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Serializes cart-mutating requests per user so concurrent requests (e.g. a
// double-clicked "Add to cart") can't race on the same Cart document and
// silently lose updates (read-modify-write on cart.items + cart.save()).
const cartLocks = new Map();
function withCartLock(userId, fn) {
  const key = String(userId);
  const previous = cartLocks.get(key) || Promise.resolve();
  const current = previous.then(fn, fn);
  cartLocks.set(key, current);
  current.finally(() => {
    if (cartLocks.get(key) === current) cartLocks.delete(key);
  });
  return current;
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email,
      password_hash: hashedPassword,
      name: `${firstName} ${lastName}`,
      phone
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.name ? user.name.split(' ')[0] : '',
        lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.name ? user.name.split(' ')[0] : '',
        lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Product routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    
    let query = { is_active: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    
    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Product.countDocuments(query)
    ]);

    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      salePrice: product.discount_price || null,
      stock: product.stock,
      categoryId: product.category,
      images: product.images || [],
      tags: product.tags || [],
      isActive: product.is_active,
      createdAt: product.createdAt
    }));

    res.json({
      products: formattedProducts,
      totalProducts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit)
    });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      salePrice: product.discount_price || null,
      stock: product.stock,
      categoryId: product.category,
      images: product.images || [],
      tags: product.tags || [],
      isActive: product.is_active,
      createdAt: product.createdAt
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Category routes
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find({ is_active: true }).sort({ display_order: 1, name: 1 });
    
    const formattedCategories = categories.map(category => ({
      id: category._id,
      name: category.name,
      description: category.description,
      image_url: category.image_url,
      subcategories: category.subcategories || [],
      is_active: category.is_active,
      display_order: category.display_order,
      created_at: category.createdAt,
      updated_at: category.updatedAt
    }));

    res.json(formattedCategories);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cart routes
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user_id: req.user.userId }).populate('items.productId');
    
    if (!cart) {
      return res.json([]);
    }

    // Filter out items with deleted products and format response
    const validItems = cart.items
      .filter(item => item.productId && item.productId.is_active)
      .map(item => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.productId._id,
          name: item.productId.name,
          description: item.productId.description,
          price: item.productId.price,
          salePrice: item.productId.discount_price || null,
          images: item.productId.images || []
        }
      }));
    
    res.json(validItems);
  } catch (error) {
    console.error('Cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  await withCartLock(req.user.userId, async () => {
    try {
      const { productId, quantity = 1 } = req.body;

      // Check if product exists
      const product = await Product.findById(productId);
      if (!product || !product.is_active) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get or create cart for user
      let cart = await Cart.findOne({ user_id: req.user.userId });

      if (!cart) {
        cart = new Cart({
          user_id: req.user.userId,
          items: [],
          total_amount: 0,
          total_items: 0
        });
      }

      // Check if item already exists
      const existingItemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId
      );

      if (existingItemIndex >= 0) {
        // Update existing item quantity
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item with unique ID
        const newItemId = Date.now();
        cart.items.push({
          id: newItemId,
          productId: productId,
          quantity: quantity
        });
      }

      // Update totals
      cart.total_items = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      await cart.save();

      res.json({ message: 'Item added to cart' });
    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.put('/api/cart/:id', authenticateToken, async (req, res) => {
  await withCartLock(req.user.userId, async () => {
    try {
      const { quantity } = req.body;
      const itemId = parseInt(req.params.id);

      const cart = await Cart.findOne({ user_id: req.user.userId });
      if (!cart) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      // Find and update the item
      const itemIndex = cart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      if (quantity > 0) {
        cart.items[itemIndex].quantity = quantity;
      } else {
        cart.items.splice(itemIndex, 1); // Remove item if quantity is 0
      }

      // Update totals
      cart.total_items = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      await cart.save();

      res.json({ message: 'Cart updated' });
    } catch (error) {
      console.error('Update cart error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  await withCartLock(req.user.userId, async () => {
    try {
      const itemId = parseInt(req.params.id);

      const cart = await Cart.findOne({ user_id: req.user.userId });
      if (!cart) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      // Find and remove the item
      const itemIndex = cart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      cart.items.splice(itemIndex, 1);

      // Update totals
      cart.total_items = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      await cart.save();

      res.json({ message: 'Item removed from cart' });
    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// Order routes
app.post('/api/orders', authenticateToken, async (req, res) => {
  await withCartLock(req.user.userId, async () => {
    try {
      const { shippingAddress, paymentMethod } = req.body;

      // Get cart items
      const cart = await Cart.findOne({ user_id: req.user.userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Calculate total and prepare order items
      let totalAmount = 0;
      const orderItems = cart.items.map(item => {
        const price = item.productId.discount_price || item.productId.price;
        totalAmount += price * item.quantity;

        return {
          product_id: item.productId._id,
          quantity: item.quantity,
          price: price
        };
      });

      // Generate order number
      const orderNumber = 'ORD-' + Date.now();

      // Create order
      const order = new Order({
        user_id: req.user.userId,
        order_number: orderNumber,
        items: orderItems,
        total_amount: totalAmount,
        shipping_address: shippingAddress,
        payment_method: paymentMethod
      });

      await order.save();

      // Clear cart
      await Cart.findOneAndDelete({ user_id: req.user.userId });

      res.json({
        message: 'Order placed successfully',
        order: {
          id: order._id,
          orderNumber: order.order_number,
          totalAmount: order.total_amount,
          status: order.status
        }
      });
    } catch (error) {
      console.error('Order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// Get logged-in user's own order history
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ user_id: req.user.userId })
      .populate('items.product_id')
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderNumber: order.order_number,
      items: order.items.map(item => ({
        productId: item.product_id ? item.product_id._id : null,
        name: item.product_id ? item.product_id.name : 'Product removed',
        image: item.product_id && item.product_id.images ? item.product_id.images[0] : null,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount: order.total_amount,
      status: order.status,
      paymentStatus: order.payment_status,
      shippingAddress: order.shipping_address,
      createdAt: order.createdAt
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Order history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===================== ADMIN ROUTES =====================
// All routes below require a valid token AND an admin role

// Dashboard stats & analytics
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalOrders, allOrders] = await Promise.all([
      User.countDocuments({}),
      Product.countDocuments({}),
      Order.countDocuments({}),
      Order.find({}).sort({ createdAt: -1 })
    ]);

    const totalRevenue = allOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total_amount, 0);

    const ordersByStatus = allOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    // Revenue for the last 7 days, bucketed by date (YYYY-MM-DD)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesByDay = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      salesByDay[d.toISOString().slice(0, 10)] = 0;
    }
    allOrders
      .filter(o => o.status !== 'cancelled' && new Date(o.createdAt) >= sevenDaysAgo)
      .forEach(o => {
        const key = new Date(o.createdAt).toISOString().slice(0, 10);
        if (key in salesByDay) salesByDay[key] += o.total_amount;
      });

    const recentOrders = await Order.find({})
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(8);

    const lowStockProducts = await Product.find({ is_active: true, stock: { $lte: 10 } })
      .sort({ stock: 1 })
      .limit(5)
      .select('name stock');

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      ordersByStatus,
      salesByDay: Object.entries(salesByDay).map(([date, amount]) => ({ date, amount })),
      recentOrders: recentOrders.map(o => ({
        id: o._id,
        orderNumber: o.order_number,
        customer: o.user_id ? (o.user_id.name || o.user_id.email) : 'Unknown',
        totalAmount: o.total_amount,
        status: o.status,
        createdAt: o.createdAt
      })),
      lowStockProducts: lowStockProducts.map(p => ({ id: p._id, name: p.name, stock: p.stock }))
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all products (including inactive)
app.get('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const [productsList, totalProducts] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    res.json({
      products: productsList,
      totalProducts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit)
    });
  } catch (error) {
    console.error('Admin products list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create product
app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, discount_price, stock, category, images, tags, is_active, featured } = req.body;

    if (!name || !description || price === undefined || stock === undefined || !category) {
      return res.status(400).json({ error: 'name, description, price, stock and category are required' });
    }

    const product = new Product({
      name,
      description,
      price,
      discount_price: discount_price || undefined,
      stock,
      category,
      images: Array.isArray(images) ? images : (images ? String(images).split(',').map(s => s.trim()).filter(Boolean) : []),
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(s => s.trim()).filter(Boolean) : []),
      is_active: is_active !== undefined ? is_active : true,
      featured: !!featured
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update product
app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, discount_price, stock, category, images, tags, is_active, featured } = req.body;

    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = price;
    if (discount_price !== undefined) update.discount_price = discount_price;
    if (stock !== undefined) update.stock = stock;
    if (category !== undefined) update.category = category;
    if (images !== undefined) update.images = Array.isArray(images) ? images : String(images).split(',').map(s => s.trim()).filter(Boolean);
    if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean);
    if (is_active !== undefined) update.is_active = is_active;
    if (featured !== undefined) update.featured = featured;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete product
app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all orders
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .populate('user_id', 'name email')
        .populate('items.product_id', 'name images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query)
    ]);

    res.json({
      orders: orders.map(o => ({
        id: o._id,
        orderNumber: o.order_number,
        customer: o.user_id ? { name: o.user_id.name, email: o.user_id.email } : null,
        items: o.items.map(item => ({
          name: item.product_id ? item.product_id.name : 'Product removed',
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: o.total_amount,
        status: o.status,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        shippingAddress: o.shipping_address,
        createdAt: o.createdAt
      })),
      totalOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit)
    });
  } catch (error) {
    console.error('Admin orders list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update order status
app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order status updated', order });
  } catch (error) {
    console.error('Admin update order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      User.find({}).select('-password_hash').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments({})
    ]);

    res.json({
      users,
      totalUsers,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / limit)
    });
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: toggle a user's role between 'user' and 'admin'
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.params.id === req.user.userId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User role updated', user });
  } catch (error) {
    console.error('Admin update user role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all categories (including inactive)
app.get('/api/admin/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ display_order: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Admin categories list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: category management
app.post('/api/admin/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, image_url, subcategories, display_order } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'name and description are required' });
    }
    const category = new Category({ name, description, image_url, subcategories, display_order });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Admin create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, image_url, subcategories, display_order, is_active } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (image_url !== undefined) update.image_url = image_url;
    if (subcategories !== undefined) update.subcategories = subcategories;
    if (display_order !== undefined) update.display_order = display_order;
    if (is_active !== undefined) update.is_active = is_active;

    const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Admin update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Admin delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only start a listening server when run directly (e.g. `node app-mongodb.js`
// or `npm start`). On Vercel this file is imported by api/index.js as a
// serverless function handler instead, and must not call listen().
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E-commerce server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the website`);
  });
}

module.exports = app;