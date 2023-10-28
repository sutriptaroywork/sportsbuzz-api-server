'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userbalances',
        'nTotalWinningAmount',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0,
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userbalances', 'nTotalWinningAmount')
    ])
  }
}
