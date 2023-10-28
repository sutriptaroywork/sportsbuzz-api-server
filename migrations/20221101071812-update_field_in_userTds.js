'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn(
        'usertds',
        'iPassbookId',
        {
          type: Sequelize.STRING(24),
          allowNull: true
        }
      ),
      queryInterface.addIndex('passbooks', ['iMatchId'],
        { name: 'passbooks_iMatchId' }),
      queryInterface.addIndex('passbooks', ['iWithdrawId'],
        { name: 'passbooks_iWithdrawId' }),
      queryInterface.addIndex('passbooks', ['iMatchLeagueId'],
        { name: 'passbooks_iMatchLeagueId' }),
      queryInterface.addIndex('passbooks', ['iUserLeagueId'],
        { name: 'passbooks_iUserLeagueId' }),
      queryInterface.addIndex('passbooks', ['eUserType'],
        { name: 'passbooks_eUserType' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn(
        'usertds',
        'iPassbookId',
        {
          type: Sequelize.STRING(24),
          allowNull: false
        }
      ),
      queryInterface.removeIndex('passbooks', ['iMatchId'], { name: 'passbooks_iMatchId' }),
      queryInterface.removeIndex('passbooks', ['iWithdrawId'], { name: 'passbooks_iWithdrawId' }),
      queryInterface.removeIndex('passbooks', ['iMatchLeagueId'], { name: 'passbooks_iMatchLeagueId' }),
      queryInterface.removeIndex('passbooks', ['iUserLeagueId'], { name: 'passbooks_iUserLeagueId' }),
      queryInterface.removeIndex('passbooks', ['eUserType'], { name: 'passbooks_eUserType' })
    ])
  }
}
