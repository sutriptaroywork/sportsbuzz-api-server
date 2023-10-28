'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'usertds',
        'nEntryFee',
        {
          type: Sequelize.FLOAT(9, 2),
          defaultValue: 0,
          allowNull: false
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('usertds', 'nEntryFee')
    ])
  }
}
