'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userdeposits', ['iPromocodeId', 'ePaymentStatus'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userdeposits', ['iPromocodeId', 'ePaymentStatus'])
  }
}
