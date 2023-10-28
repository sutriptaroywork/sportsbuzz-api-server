'use strict'
const { tdsStatus } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.createTable('usertds', {
        id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
        iUserId: { type: Sequelize.STRING(24), allowNull: false },
        nPercentage: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        nAmount: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
        iPassbookId: { type: Sequelize.STRING(24), allowNull: false },
        eStatus: { type: Sequelize.ENUM(tdsStatus), defaultValue: 'P' },
        dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        dUpdatedAt: Sequelize.DATE
      })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.dropTable('usertds')
    ])
  }
}
