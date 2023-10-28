'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('passbooks', ['iUserId', 'eTransactionType', 'dCreatedAt'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('passbooks', ['iUserId', 'eTransactionType', 'dCreatedAt'])
  }
}
