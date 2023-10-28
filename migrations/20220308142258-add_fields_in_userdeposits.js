'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userdeposits',
        'dProcessedDate',
        {
          type: Sequelize.DATE
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userdeposits', 'dProcessedDate')
    ])
  }
}
