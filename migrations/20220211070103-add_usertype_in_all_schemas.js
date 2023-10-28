'use strict'
const { userType } = require('../data')

module.exports = {
  async up (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'passbooks',
        'eUserType',
        {
          type: Sequelize.ENUM(userType),
          defaultValue: 'U'
        }
      ),
      queryInterface.addColumn(
        'userbalances',
        'eUserType',
        {
          type: Sequelize.ENUM(userType),
          defaultValue: 'U'
        }
      ),
      queryInterface.addColumn(
        'userwithdraws',
        'eUserType',
        {
          type: Sequelize.ENUM(userType),
          defaultValue: 'U'
        }
      ),
      queryInterface.addColumn(
        'userdeposits',
        'eUserType',
        {
          type: Sequelize.ENUM(userType),
          defaultValue: 'U'
        }
      )
    ])
  },

  async down (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'eUserType'),
      queryInterface.removeColumn('userbalances', 'eUserType'),
      queryInterface.removeColumn('userwithdraws', 'eUserType'),
      queryInterface.removeColumn('userdeposits', 'eUserType')
    ])
  }
}
