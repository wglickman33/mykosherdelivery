const { Profile, UserLoginActivity } = require('../models');
const { sequelize } = require('../models');

async function testUserAPI() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    // Test the same query that the API uses
    const whereClause = {};
    const limitNum = 20;
    const offsetNum = 0;
    
    // Get total count for pagination
    const total = await Profile.count({ where: whereClause });
    console.log(`Total users in database: ${total}`);
    
    // Get users with last login information (same as API)
    const users = await Profile.findAll({
      where: whereClause,
      attributes: { 
        exclude: ['password'],
        include: [
          [
            sequelize.literal(`(
              SELECT login_time 
              FROM user_login_activities 
              WHERE user_id = "Profile"."id" 
              ORDER BY login_time DESC 
              LIMIT 1
            )`),
            'last_login'
          ]
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset: offsetNum
    });

    console.log(`\nUsers found: ${users.length}`);
    
    // Transform users to match frontend expectations
    const transformedUsers = users.map(user => {
      const userData = user.toJSON();
      return {
        id: userData.id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email,
        phone_number: userData.phone,
        role: userData.role,
        preferred_name: userData.preferredName || null,
        created_at: userData.createdAt,
        last_login: userData.last_login,
        address: userData.address,
        addresses: userData.addresses,
        primary_address_index: userData.primaryAddressIndex
      };
    });
    
    console.log('\nTransformed users:');
    console.log('==================');
    transformedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Last Login: ${user.last_login || 'Never'}`);
      console.log('---');
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

testUserAPI();
