'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.addIndex('userbalances', ['iUserId'], {
        name: 'userbalances_iUserId'
      })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      await queryInterface.removeIndex('userbalances', ['iUserId'], {
        name: 'userbalances_iUserId'
      })
    ])
  }
}
