'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('usertds', ['iUserId', 'eStatus'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('usertds', ['iUserId', 'eStatus'])
  }
}
