'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'userdeposits',
        'iReferenceId',
        {
          type: Sequelize.DataTypes.UUID, defaultValue: Sequelize.DataTypes.UUIDV4, unique: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('userdeposits', 'iReferenceId')
    ])
  }
}
