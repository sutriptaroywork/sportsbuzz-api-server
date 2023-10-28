'use strict'
const { category } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('passbooks', 'eCategory', { type: Sequelize.STRING }),
      queryInterface.addColumn('usertds', 'eCategory', { type: Sequelize.ENUM(category), defaultValue: 'CRICKET' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'eCategory'),
      queryInterface.removeColumn('usertds', 'eCategory')
    ])
  }
}
