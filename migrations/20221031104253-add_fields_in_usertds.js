'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'usertds',
        'iMatchId',
        {
          type: Sequelize.STRING(24),
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('usertds', 'iMatchId')
    ])
  }
}
