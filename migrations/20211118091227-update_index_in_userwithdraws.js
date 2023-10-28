'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userwithdraws', ['iUserId'], {
      name: 'userwithdraws_iUserId'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userwithdraws', ['iUserId'], {
      name: 'userwithdraws_iUserId'
    })
  }
}
