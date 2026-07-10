# E-commerce Website - Complete Project

## Overview
A fully functional e-commerce website with MongoDB backend, user authentication, shopping cart, and responsive design.

## Features
- ✅ User Authentication (Login/Register)
- ✅ Product Catalog with Categories
- ✅ Shopping Cart Management
- ✅ Order Processing
- ✅ Responsive Design
- ✅ Search and Filter Functionality
- ✅ Modern UI with Modal System

## Technologies Used
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Authentication**: JWT tokens
- **Database**: MongoDB with sample data

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup MongoDB
Make sure MongoDB is running, then populate with sample data:
```bash
node setup-mongodb.js
```

### 3. Start the Application
```bash
./start-mongodb.sh && node app-mongodb.js
```

Or run individually:
```bash
# Start MongoDB
./start-mongodb.sh

# Start the application
node app-mongodb.js
```

The application will be available at `http://localhost:5000`

## Test Accounts
- **Email**: test@example.com, **Password**: password123
- **Email**: avirma0304@gmail.com, **Password**: password123
- **Email**: john.doe@example.com, **Password**: password123
- **Email**: jane.smith@gmail.com, **Password**: password123

## Project Structure
```
├── app-mongodb.js          # Main server file
├── models/                 # MongoDB models
│   ├── User.js
│   ├── Product.js
│   ├── Category.js
│   ├── Cart.js
│   └── Order.js
├── public/                 # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── setup-mongodb.js        # Database setup script
├── start-mongodb.sh        # MongoDB startup script
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/products` - Get products with filters
- `GET /api/categories` - Get all categories
- `GET /api/cart` - Get user's cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove cart item
- `POST /api/orders` - Place order

## Recent Fixes
- ✅ Fixed modal close button functionality
- ✅ Resolved JavaScript scope issues
- ✅ Enhanced authentication system
- ✅ Improved responsive design
- ✅ Fixed cart management

## Support
For any issues or questions, please refer to the code comments or contact support.

---
**Created**: July 2024  
**Last Updated**: July 9, 2025