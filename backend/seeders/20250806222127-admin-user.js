'use strict';

const bcrypt = require('bcryptjs');


module.exports = {
  async up (queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('MKDAdmin2024!', 12);
    
    await queryInterface.bulkInsert('profiles', [{
      id: '3192771f-3011-49bb-b71d-4a764b54ef9d',
      email: 'willglickman@gmail.com',
      password: hashedPassword,
      first_name: 'William',
      last_name: 'Glickman',
      phone: '516-639-9257',
      addresses: JSON.stringify([
        {
          "zip": "11598",
          "city": "Woodmere", 
          "state": "NY",
          "street": "676 Longacre Ave",
          "is_primary": true
        },
        {
          "zip": "11598",
          "city": "Woodmere",
          "state": "NY", 
          "street": "898 Lakeside Dr",
          "is_primary": false
        }
      ]),
      primary_address_index: 0,
      role: 'admin',
      created_at: new Date('2025-06-23T15:41:25.574Z'),
      updated_at: new Date('2025-08-03T03:42:49.523Z')
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('profiles', {
      email: 'willglickman@gmail.com'
    }, {});
  }
};
