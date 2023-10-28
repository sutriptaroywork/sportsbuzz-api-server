'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'userdeposits',
      'iPromocodeId',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    )
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'userdeposits',
      'iPromocodeId'
    )
  }
}
