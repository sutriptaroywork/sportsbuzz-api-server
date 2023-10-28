'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('passbooks', ['eTransactionType', 'dCreatedAt'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('passbooks', ['eTransactionType', 'dCreatedAt'])
  }
}
