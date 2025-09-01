require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    console.log('Connecting to MongoDB with URI:', process.env.MONGO_URI);
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    await User.deleteMany({ 
      email: process.env.ADMIN_EMAIL || 'careerpilot@gmail.com' 
    });
    
  
    
    const admin = await User.create({
      name: 'Dev Quest',
      email: process.env.ADMIN_EMAIL || 'careerpilot@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'admin123', 
      role: 'admin'
    });
    
    console.log('✅ Admin created:', {
      id: admin._id,
      email: admin.email,
      role: admin.role
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seedAdmin();