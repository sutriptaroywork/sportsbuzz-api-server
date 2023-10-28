'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userdeposits', ['iUserId', 'iPromocodeId', 'ePaymentStatus'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userdeposits', ['iUserId', 'iPromocodeId', 'ePaymentStatus'])
  }
}
