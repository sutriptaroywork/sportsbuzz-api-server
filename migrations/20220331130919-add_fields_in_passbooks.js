'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'passbooks',
        'bCreatorBonusReturn',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      ),
      queryInterface.addColumn(
        'passbooks',
        'bWinReturn',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'bCreatorBonusReturn'),
      queryInterface.removeColumn('passbooks', 'bWinReturn')
    ])
  }
}
