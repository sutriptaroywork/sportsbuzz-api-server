'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('userdeposits', ['eUserType', 'dCreatedAt'], { name: 'userdeposits_eUserType_dCreatedAt' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('userdeposits', ['eUserType', 'dCreatedAt'], { name: 'userdeposits_eUserType_dCreatedAt' })
    ])
  }
}
