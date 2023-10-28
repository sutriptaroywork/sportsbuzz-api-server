'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userdeposits',
        'iOrderId',
        {
          type: Sequelize.STRING
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userdeposits', 'iOrderId')
    ])
  }
}
