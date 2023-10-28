'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userdeposits', ['iUserId'], {
      name: 'userdeposits_iUserId'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userdeposits', ['iUserId'], {
      name: 'userdeposits_iUserId'
    })
  }
}
