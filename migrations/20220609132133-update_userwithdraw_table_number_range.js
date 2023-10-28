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
        'nAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userwithdraws',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
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
        'nAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userwithdraws',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      )
    ])
  }
}
