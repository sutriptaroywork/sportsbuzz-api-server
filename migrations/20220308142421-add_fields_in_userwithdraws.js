'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userwithdraws',
        'dProcessedDate',
        {
          type: Sequelize.DATE
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userwithdraws', 'dProcessedDate')
    ])
  }
}
