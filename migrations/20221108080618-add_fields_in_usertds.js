'use strict'
const { userLeagueTransactionType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userleagues',
        'eTransactionType',
        {
          type: Sequelize.ENUM(userLeagueTransactionType),
          defaultValue: 'Win'
        }
      ),
      queryInterface.addIndex('userleagues', ['iMatchLeagueId', 'eTransactionType'], { name: 'userleagues_transaction_type' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userleagues', 'eTransactionType'),
      queryInterface.removeIndex('userleagues', ['iMatchLeagueId', 'eTransactionType'], { name: 'userleagues_transaction_type' })
    ])
  }
}
