'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userwithdraws',
        'iTransactionId',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userwithdraws', 'iTransactionId')
    ])
  }
}
