const { Profile, UserLoginActivity } = require('../models');
const { sequelize } = require('../models');

async function cleanupUsers() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    const keepUsers = ['willglickman@gmail.com', 'billyglickman@gmail.com'];
    
    const allUsers = await Profile.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'role']
    });
    
    console.log('\nBefore cleanup:');
    console.log('================');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - ${user.role}`);
    });
    
    const usersToDelete = allUsers.filter(user => !keepUsers.includes(user.email));
    
    if (usersToDelete.length === 0) {
      console.log('\nNo users to delete. All users are legitimate.');
      await sequelize.close();
      return;
    }
    
    console.log('\nUsers to be deleted:');
    console.log('====================');
    usersToDelete.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - ${user.role}`);
    });
    
    for (const user of usersToDelete) {
      console.log(`\nDeleting associated data for ${user.email}...`);
      
      const deletedActivities = await UserLoginActivity.destroy({
        where: { userId: user.id }
      });
      console.log(`  - Deleted ${deletedActivities} login activities`);
      
      await user.destroy({ force: true });
      console.log(`  - Deleted user profile`);
    }
    
    const remainingUsers = await Profile.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
      order: [['createdAt', 'ASC']]
    });
    
    console.log('\nAfter cleanup:');
    console.log('==============');
    remainingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - ${user.role}`);
    });
    
    console.log(`\nCleanup complete! Remaining users: ${remainingUsers.length}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

cleanupUsers();
