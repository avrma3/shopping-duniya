# E-commerce Website

A modern, fully-featured e-commerce website built with Node.js, Express, PostgreSQL, and vanilla JavaScript.

## Overview
Complete e-commerce platform with shopping cart, user authentication, product catalog, and order management. Features a responsive design with modern UI components and real-time interactivity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend (Node.js/Express)
- **Server**: Express 4.18.2 (app-mongodb.js)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based user sessions
- **API**: RESTful endpoints for products, categories, cart, orders

### Frontend (Vanilla JavaScript)
- **HTML**: Semantic, accessible markup (public/index.html)
- **CSS**: Modern responsive design with Flexbox/Grid (public/styles.css)
- **JavaScript**: Interactive features and API integration (public/script.js)

### Database Schema (MongoDB)
- **Users**: Authentication and profile data (models/User.js)
- **Products**: Catalog with images, pricing, stock (models/Product.js)
- **Categories**: Product organization (models/Category.js)
- **Cart**: Shopping cart management (models/Cart.js)
- **Orders**: Order processing and history (models/Order.js)

## Key Components

### API Endpoints
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration
- `/api/products` - Product catalog with filtering
- `/api/categories` - Product categories
- `/api/cart` - Shopping cart management
- `/api/orders` - Order processing

### Frontend Features
- Product browsing and search
- Shopping cart functionality
- User authentication system
- Responsive design for all devices
- Modern UI with smooth animations

## Data Flow
1. Frontend requests data from API endpoints
2. Express server processes requests
3. PostgreSQL database stores/retrieves data
4. JSON responses sent to frontend
5. JavaScript updates UI dynamically

## External Dependencies
- Express 4.18.2 (web framework)
- MongoDB (database)
- Mongoose (MongoDB ODM)
- bcryptjs (password hashing)
- jsonwebtoken (JWT tokens)
- cors (cross-origin requests)
- dotenv (environment variables)
- helmet (security headers)

## Deployment Strategy
- **Server**: Running on port 5000
- **Database**: MongoDB with sample data loaded
- **Static Files**: Served from public/ directory
- **Environment**: Production-ready with security middleware
- **Database Setup**: Run `node setup-mongodb.js` to populate with sample data

## Recent Changes
- ✅ 2024-07-09: Created complete e-commerce website from scratch
- ✅ Database setup with sample products and categories
- ✅ Full authentication system with JWT tokens
- ✅ Modern responsive frontend with shopping cart
- ✅ Fixed Express compatibility issues (downgraded to 4.18.2)
- ✅ Server running successfully on port 5000
- ✅ Fixed cart functionality - authentication and database structure issues resolved
- ✅ Fixed category filtering - now uses category names instead of IDs
- ✅ Added trust proxy configuration for rate limiting
- ✅ Created project zip file for download
- ✅ Migrated from PostgreSQL to MongoDB database
- ✅ Added Mongoose ODM with proper schema models
- ✅ Created MongoDB setup script with sample data
- ✅ Updated workflow to start MongoDB automatically
- ✅ Enhanced authentication system with separate Login and Sign Up buttons
- ✅ Improved UI with better modal designs and styling
- ✅ Added flexible registration - any email can be used for signup
- ✅ Enhanced user experience with form validation and error handling