'use strict'
const { userType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    queryInterface.createTable('userleagues', {
      id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },

      nBonusWin: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },
      nFinalAmount: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },
      nPrice: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },
      nPricePaid: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },
      nTdsFee: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },
      nTdsPercentage: { type: Sequelize.FLOAT(12, 2), defaultValue: 0 },

      bTds: { type: Sequelize.BOOLEAN, defaultValue: false },

      iMatchLeagueId: { type: Sequelize.STRING(24), allowNull: false },
      iUserLeagueId: { type: Sequelize.STRING(24), allowNull: false },
      iMatchId: { type: Sequelize.STRING(24), allowNull: false },

      eUserType: { type: Sequelize.ENUM(userType), defaultValue: 'U' },

      iUserId: { type: Sequelize.STRING(24), allowNull: false },
      sMatchName: { type: Sequelize.STRING(24), allowNull: false },
      sUserName: { type: Sequelize.STRING(44), allowNull: false },

      dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      dUpdatedAt: Sequelize.DATE
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('userleagues')
  }
}
