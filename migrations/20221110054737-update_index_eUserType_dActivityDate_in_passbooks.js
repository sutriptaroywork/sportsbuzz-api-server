'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('passbooks', ['eUserType', 'dActivityDate'], { name: 'passbooks_eUserType_dActivityDate' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('passbooks', ['eUserType', 'dActivityDate'], { name: 'passbooks_eUserType_dActivityDate' })
    ])
  }
}
