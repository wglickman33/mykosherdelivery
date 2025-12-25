'use strict';


module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.showAllTables().then(tables => 
      tables.some(table => table.tableName === 'notifications')
    );

    if (!tableExists) {
      await queryInterface.createTable('notifications', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'profiles',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        read: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        data: {
          type: Sequelize.JSONB
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });

      try {
        await queryInterface.addIndex('notifications', ['user_id'], { name: 'notifications_user_id_idx' });
      } catch (e) {  }
      
      try {
        await queryInterface.addIndex('notifications', ['read'], { name: 'notifications_read_idx' });
      } catch (e) {  }
      
      try {
        await queryInterface.addIndex('notifications', ['type'], { name: 'notifications_type_idx' });
      } catch (e) {  }
      
      try {
        await queryInterface.addIndex('notifications', ['created_at'], { name: 'notifications_created_at_idx' });
      } catch (e) {  }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  }
};