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
        'passbooks',
        'nAmount',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nCash',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldWinningBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nOldDepositBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldTotalBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nNewWinningBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nNewDepositBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nNewTotalBalance',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nNewBonus',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(12, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nLoyaltyPoint',
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
        'passbooks',
        'nAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nBonus',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nCash',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldWinningBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nOldDepositBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldTotalBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nNewWinningBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nNewDepositBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nNewTotalBalance',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nOldBonus',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),

      queryInterface.changeColumn(
        'passbooks',
        'nNewBonus',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.changeColumn(
        'passbooks',
        'nLoyaltyPoint',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      )
    ])
  }
}
