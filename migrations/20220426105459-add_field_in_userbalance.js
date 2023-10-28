'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userbalances',
        'nTotalLoyaltyPoints',
        {
          type: Sequelize.FLOAT(9, 2), defaultValue: 0
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userbalances', 'nTotalLoyaltyPoints')
    ])
  }
}
