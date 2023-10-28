'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('usertds', ['eStatus'])
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('usertds', ['eStatus'])
  }
}
