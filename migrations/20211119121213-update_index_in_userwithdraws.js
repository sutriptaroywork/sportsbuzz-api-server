'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userwithdraws', ['iUserId', 'ePaymentStatus'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userwithdraws', ['iUserId', 'ePaymentStatus'])
  }
}
