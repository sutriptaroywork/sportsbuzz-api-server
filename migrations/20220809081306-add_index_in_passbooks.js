'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.addIndex('passbooks', ['iUserId', 'iUserLeagueId', 'eTransactionType', 'iUserDepositId', 'iWithdrawId'],
        { unique: true, name: 'passbooks_unique' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.removeIndex('passbooks', ['iUserId', 'iUserLeagueId', 'eTransactionType', 'iUserDepositId', 'iWithdrawId'], { unique: true, name: 'passbooks_unique' })
    ])
  }
}
