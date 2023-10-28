'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('passbooks', ['iMatchLeagueId'], { name: 'passbooks_iMatcLeagueId' }),
      queryInterface.addIndex('passbooks', ['eTransactionType'], { name: 'passbooks_eTransactionType' }),
      queryInterface.addIndex('usertds', ['iMatchLeagueId'], { name: 'usertds_iMatchLeagueId' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('passbooks', ['iMatchLeagueId'], { name: 'passbooks_iMatcLeagueId' }),
      queryInterface.removeIndex('passbooks', ['eTransactionType'], { name: 'passbooks_eTransactionType' }),
      queryInterface.removeIndex('usertds', ['iMatchLeagueId'], { name: 'usertds_iMatchLeagueId' })
    ])
  }
}
