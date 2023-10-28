'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'passbooks',
        'sPromocode',
        {
          type: Sequelize.STRING
        }
      ),
      queryInterface.addColumn(
        'passbooks',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      ),
      queryInterface.addColumn(
        'userwithdraws',
        'nWithdrawFee',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'sPromocode'),
      queryInterface.removeColumn('passbooks', 'nWithdrawFee'),
      queryInterface.removeColumn('userwithdraws', 'nWithdrawFee')
    ])
  }
}
