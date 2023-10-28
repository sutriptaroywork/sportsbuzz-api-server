'use strict'
const { category } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userleagues',
        'eCategory',
        {
          type: Sequelize.ENUM(category),
          defaultValue: 'CRICKET'
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userleagues', 'eCategory')
    ])
  }
}
