// Creates (or promotes) an admin user without touching any other data.
// Usage: node create-admin.js <email> <password> [name]
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

async function createAdmin() {
  const [, , emailArg, passwordArg, nameArg] = process.argv;
  const email = emailArg || 'admin@example.com';
  const password = passwordArg || 'admin123';
  const name = nameArg || 'Admin';

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    let user = await User.findOne({ email });

    if (user) {
      user.role = 'admin';
      await user.save();
      console.log(`Existing user promoted to admin: ${email}`);
    } else {
      const password_hash = await bcrypt.hash(password, 10);
      user = new User({
        name,
        email,
        password_hash,
        role: 'admin',
        is_verified: true
      });
      await user.save();
      console.log(`Admin user created: ${email} / ${password}`);
    }
  } catch (error) {
    console.error('Failed to create admin:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createAdmin();
