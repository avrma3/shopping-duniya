const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

async function setupMongoDB() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    
    console.log('Cleared existing data');

    // Create categories
    const categories = [
      {
        name: 'Electronics',
        description: 'Latest electronic gadgets and devices',
        subcategories: [
          { name: 'Smartphones', description: 'Latest smartphones' },
          { name: 'Laptops', description: 'Laptops and computers' },
          { name: 'Headphones', description: 'Audio devices' }
        ],
        is_active: true,
        display_order: 1
      },
      {
        name: 'Fashion',
        description: 'Trendy clothing and accessories',
        subcategories: [
          { name: "Men's Clothing", description: "Men's fashion" },
          { name: "Women's Clothing", description: "Women's fashion" },
          { name: 'Footwear', description: 'Shoes and sandals' }
        ],
        is_active: true,
        display_order: 2
      },
      {
        name: 'Home & Kitchen',
        description: 'Home appliances and kitchen essentials',
        image_url: '/images/home-kitchen.jpg',
        is_active: true,
        display_order: 3
      },
      {
        name: 'Sports',
        description: 'Sports equipment and apparel',
        image_url: '/images/sports.jpg',
        is_active: true,
        display_order: 4
      },
      {
        name: 'Accessories',
        description: 'Bags, cases, and other accessories',
        image_url: '/images/accessories.jpg',
        is_active: true,
        display_order: 5
      }
    ];

    const createdCategories = await Category.insertMany(categories);
    console.log(`Created ${createdCategories.length} categories`);

    // Create sample products
    const products = [
      {
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with titanium design, A17 Pro chip, and advanced camera system',
        price: 999.99,
        discount_price: 899.99,
        stock: 30,
        category: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop'
        ],
        tags: ['smartphone', 'apple', 'iphone', 'mobile'],
        is_active: true,
        featured: true
      },
      {
        name: 'Samsung Galaxy S24',
        description: 'Premium Android smartphone with AI features and excellent camera',
        price: 799.99,
        discount_price: 699.99,
        stock: 25,
        category: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=400&h=300&fit=crop'
        ],
        tags: ['smartphone', 'samsung', 'android', 'mobile'],
        is_active: true,
        featured: true
      },
      {
        name: 'Nike Air Max 270',
        description: 'Comfortable running shoes with maximum cushioning and modern design',
        price: 150.00,
        discount_price: 120.00,
        stock: 75,
        category: 'Sports',
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=300&fit=crop'
        ],
        tags: ['shoes', 'nike', 'running', 'sports'],
        is_active: true,
        featured: true
      },
      {
        name: 'Gaming Laptop RTX 4080',
        description: 'High-performance gaming laptop with RTX 4080 graphics and 32GB RAM',
        price: 2499.99,
        discount_price: 2199.99,
        stock: 15,
        category: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=300&fit=crop'
        ],
        tags: ['laptop', 'gaming', 'computer', 'rtx'],
        is_active: true,
        featured: true
      },
      {
        name: 'Wireless Earbuds Pro',
        description: 'Premium wireless earbuds with active noise cancellation and long battery life',
        price: 199.99,
        discount_price: 149.99,
        stock: 60,
        category: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=300&fit=crop'
        ],
        tags: ['earbuds', 'wireless', 'audio', 'music'],
        is_active: true,
        featured: true
      },
      {
        name: 'Designer Backpack',
        description: 'Stylish and durable backpack perfect for work and travel',
        price: 89.99,
        discount_price: 69.99,
        stock: 40,
        category: 'Accessories',
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=400&h=300&fit=crop'
        ],
        tags: ['backpack', 'travel', 'work', 'accessories'],
        is_active: true,
        featured: true
      },
      {
        name: 'Smartwatch Series 9',
        description: 'Advanced smartwatch with health monitoring and fitness tracking',
        price: 399.99,
        discount_price: 349.99,
        stock: 35,
        category: 'Electronics',
        images: [
          'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1579586337278-3f436f25d4d6?w=400&h=300&fit=crop'
        ],
        tags: ['smartwatch', 'fitness', 'health', 'wearable'],
        is_active: true,
        featured: true
      },
      {
        name: 'Instant Pot Duo',
        description: 'Multi-functional electric pressure cooker for quick and healthy meals',
        price: 89.99,
        discount_price: 79.99,
        stock: 50,
        category: 'Home & Kitchen',
        images: [
          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1574781330855-d0db393ee2c1?w=400&h=300&fit=crop'
        ],
        tags: ['kitchen', 'cooking', 'appliance', 'pressure cooker'],
        is_active: true,
        featured: true
      }
    ];

    // Add more sample products
    const additionalProducts = [
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 199.99,
        discount_price: 149.99,
        stock: 50,
        category: 'Electronics',
        images: ['./images/headphones-1.jpg', './images/headphones-2.jpg'],
        tags: ['electronics', 'audio', 'wireless'],
        is_active: true
      },
      {
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with multiple compartments',
        price: 79.99,
        discount_price: 59.99,
        stock: 25,
        category: 'Accessories',
        images: ['./images/backpack-1.jpg', './images/backpack-2.jpg'],
        tags: ['accessories', 'travel', 'laptop'],
        is_active: true
      },
      {
        name: 'Running Shoes',
        description: 'Comfortable running shoes for all terrains',
        price: 129.99,
        discount_price: 99.99,
        stock: 60,
        category: 'Sports',
        images: ['./images/shoes-1.jpg', './images/shoes-2.jpg'],
        tags: ['sports', 'footwear', 'running'],
        is_active: true
      },
      {
        name: 'Coffee Maker',
        description: 'Automatic coffee maker with programmable settings',
        price: 159.99,
        discount_price: 119.99,
        stock: 20,
        category: 'Home & Kitchen',
        images: ['./images/coffee-maker-1.jpg', './images/coffee-maker-2.jpg'],
        tags: ['kitchen', 'appliances', 'coffee'],
        is_active: true
      }
    ];

    const allProducts = [...products, ...additionalProducts];
    const createdProducts = await Product.insertMany(allProducts);
    console.log(`Created ${createdProducts.length} products`);

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password_hash: hashedPassword,
      phone: '1234567890',
      is_verified: true
    });
    
    await testUser.save();
    console.log('Created test user: test@example.com / password123');

    console.log('✅ MongoDB setup completed successfully!');
    console.log('📊 Database populated with sample data');
    console.log('🔐 Test user created: test@example.com / password123');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupMongoDB();
}

module.exports = setupMongoDB;