'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'usertds',
        'iMatchLeagueId',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('usertds', 'iMatchLeagueId')
    ])
  }
}
