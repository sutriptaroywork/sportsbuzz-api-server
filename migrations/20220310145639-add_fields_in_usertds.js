'use strict'
const { userType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'usertds',
        'eUserType',
        {
          type: Sequelize.ENUM(userType),
          defaultValue: 'U'
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('usertds', 'eUserType')
    ])
  }
}
