'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'profiles', key: 'id' },
        onDelete: 'CASCADE'
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('password_reset_tokens', ['token_hash'], {
      name: 'password_reset_tokens_token_hash_idx'
    });
    await queryInterface.addIndex('password_reset_tokens', ['user_id'], {
      name: 'password_reset_tokens_user_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('password_reset_tokens');
  }
};
