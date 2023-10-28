'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('passbooks', ['iUserId'], {
      name: 'passbooks_iUserId'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('passbooks', ['iUserId'], {
      name: 'passbooks_iUserId'
    })
  }
}
