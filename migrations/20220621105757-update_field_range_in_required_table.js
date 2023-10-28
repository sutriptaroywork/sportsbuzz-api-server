'use strict'

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    return Promise.all([
      queryInterface.changeColumn(
        'userwithdraws',
        'sInfo',
        {
          type: Sequelize.TEXT
        }
      ),

      queryInterface.changeColumn(
        'userdeposits',
        'nAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'nCash',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'nBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'sInfo',
        {
          type: Sequelize.TEXT
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'sRemarks',
        {
          type: Sequelize.TEXT
        }
      )
    ])
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    return Promise.all([
      queryInterface.changeColumn(
        'userwithdraws',
        'sInfo',
        {
          type: Sequelize.STRING
        }
      ),

      queryInterface.changeColumn(
        'userdeposits',
        'nAmount',
        {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'nCash',
        {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'nBonus',
        {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userdeposits',
        'sInfo',
        {
          type: Sequelize.STRING
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'sRemarks',
        {
          type: Sequelize.TEXT
        }
      )
    ])
  }
}
