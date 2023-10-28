'use strict'
const { passbookStatus } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'passbooks',
        'eStatus',
        {
          type: Sequelize.ENUM(passbookStatus),
          defaultValue: 'CMP',
          allowNull: false
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'eStatus')
    ])
  }
}
