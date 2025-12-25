const { Profile } = require('../models');
const { sequelize } = require('../models');

async function testCreateUser() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    const testUserData = {
      email: 'testuser@example.com',
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      phone: '555-1234',
      preferredName: 'Testy'
    };
    
    console.log('Testing user creation with data:', testUserData);
    
    const existingUser = await Profile.findOne({ where: { email: testUserData.email } });
    if (existingUser) {
      console.log('User already exists, deleting first...');
      await existingUser.destroy({ force: true });
    }
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(testUserData.password, 12);
    
    const user = await Profile.create({
      email: testUserData.email,
      password: hashedPassword,
      firstName: testUserData.firstName,
      lastName: testUserData.lastName,
      role: testUserData.role,
      phone: testUserData.phone,
      preferredName: testUserData.preferredName
    });
    
    console.log('User created successfully:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      preferredName: user.preferredName
    });
    
    await user.destroy({ force: true });
    console.log('Test user cleaned up successfully.');
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

testCreateUser();
