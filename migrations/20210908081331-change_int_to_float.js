'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userdeposits', 'nAmount', { type: Sequelize.FLOAT(9, 2), defaultValue: 0 }),
      queryInterface.changeColumn('userdeposits', 'nCash', { type: Sequelize.FLOAT(9, 2), allowNull: false, defaultValue: 0 }),
      queryInterface.changeColumn('userdeposits', 'nBonus', { type: Sequelize.FLOAT(9, 2), defaultValue: 0 })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userdeposits', 'nAmount', { type: Sequelize.INTEGER, defaultValue: 0 }),
      queryInterface.changeColumn('userdeposits', 'nCash', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }),
      queryInterface.changeColumn('userdeposits', 'nBonus', { type: Sequelize.INTEGER, defaultValue: 0 })
    ])
  }
}
