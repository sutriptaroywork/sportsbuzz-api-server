'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'passbooks',
        'iSeriesId',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      ),
      queryInterface.addColumn(
        'passbooks',
        'iCategoryId',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      ),
      queryInterface.addColumn(
        'passbooks',
        'iTransactionId',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('passbooks', 'iSeriesId'),
      queryInterface.removeColumn('passbooks', 'iCategoryId'),
      queryInterface.removeColumn('passbooks', 'iTransactionId')
    ])
  }
}
