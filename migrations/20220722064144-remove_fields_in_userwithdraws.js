'use strict'

module.exports = {
  async up (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('userwithdraws', 'sReversedInfo')
    ])
  },

  async down (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn(
        'userwithdraws',
        'sReversedInfo',
        {
          type: Sequelize.TEXT
        }
      )
    ])
  }
}
