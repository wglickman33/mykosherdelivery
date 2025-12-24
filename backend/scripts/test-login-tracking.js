const { Profile, UserLoginActivity } = require('../models');
const { sequelize } = require('../models');

async function testLoginTracking() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    // Check current login activities
    const loginActivities = await UserLoginActivity.findAll({
      include: [{
        model: Profile,
        as: 'user',
        attributes: ['email', 'firstName', 'lastName']
      }],
      order: [['loginTime', 'DESC']],
      limit: 10
    });
    
    console.log('\nRecent login activities:');
    console.log('========================');
    
    if (loginActivities.length === 0) {
      console.log('No login activities found.');
    } else {
      loginActivities.forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.user?.email || 'Unknown User'}`);
        console.log(`   Time: ${activity.loginTime}`);
        console.log(`   IP: ${activity.ipAddress || 'N/A'}`);
        console.log(`   Success: ${activity.success ? 'Yes' : 'No'}`);
        console.log(`   User Agent: ${activity.userAgent ? activity.userAgent.substring(0, 50) + '...' : 'N/A'}`);
        console.log('---');
      });
    }
    
    // Check if we have any users
    const users = await Profile.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName'],
      order: [['createdAt', 'ASC']]
    });
    
    console.log('\nCurrent users:');
    console.log('==============');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName})`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

testLoginTracking();
