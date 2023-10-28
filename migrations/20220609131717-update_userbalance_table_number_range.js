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
        'userbalances',
        'nCurrentWinningBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentDepositBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentTotalBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nExpiredBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalBonusEarned',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalWinningAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalDepositAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalWithdrawAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalLoyaltyPoints',
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
        'userbalances',
        'nCurrentWinningBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentDepositBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentTotalBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nCurrentBonus',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'userbalances',
        'nExpiredBonus',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalBonusEarned',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalWinningAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'userbalances',
        'nTotalDepositAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalWithdrawAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'userbalances',
        'nTotalLoyaltyPoints',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      )
    ])
  }
}
