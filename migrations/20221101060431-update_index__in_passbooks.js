'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.addIndex('passbooks', ['eTransactionType', 'iMatchId'])
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.removeIndex('passbooks', ['eTransactionType', 'iMatchId'])
    ])
  }
}
