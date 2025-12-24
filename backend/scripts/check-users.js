const { Profile } = require('../models');
const { sequelize } = require('../models');

async function checkUsers() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    const users = await Profile.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });
    
    console.log('\nCurrent users in database:');
    console.log('================================');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('---');
    });
    
    console.log(`\nTotal users: ${users.length}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();
