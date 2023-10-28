'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userbalances',
        'nTotalBonusReturned',
        {
          type: Sequelize.FLOAT(12, 2), defaultValue: 0
        }
      ),
      queryInterface.addColumn(
        'userbalances',
        'nTotalCashbackReturned',
        {
          type: Sequelize.FLOAT(12, 2), defaultValue: 0
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userbalances', 'nTotalBonusReturned'),
      queryInterface.removeColumn('userbalances', 'nTotalCashbackReturned')
    ])
  }
}
