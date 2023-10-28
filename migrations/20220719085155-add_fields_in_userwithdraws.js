'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userwithdraws',
        'dReversedDate',
        {
          type: Sequelize.DATE
        }
      ),
      queryInterface.addColumn(
        'userwithdraws',
        'bReversed',
        {
          type: Sequelize.BOOLEAN, defaultValue: false
        }
      ),
      queryInterface.addColumn(
        'userwithdraws',
        'sReversedInfo',
        {
          type: Sequelize.TEXT
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userwithdraws', 'dReversedDate'),
      queryInterface.removeColumn('userwithdraws', 'bReversed'),
      queryInterface.removeColumn('userwithdraws', 'sReversedInfo')
    ])
  }
}
