'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'userdeposits',
      'iTransactionId',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    )
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'userdeposits',
      'iTransactionId'
    )
  }
}
