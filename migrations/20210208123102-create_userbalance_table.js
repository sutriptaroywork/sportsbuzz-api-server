'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    queryInterface.createTable('userbalances', {
      id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
      iUserId: { type: Sequelize.STRING(24), allowNull: false },
      nCurrentWinningBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nCurrentDepositBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nCurrentTotalBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nCurrentBonus: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nExpiredBonus: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nTotalBonusEarned: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nTotalDepositAmount: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nTotalDepositCount: { type: Sequelize.INTEGER, defaultValue: 0 },
      nTotalWithdrawAmount: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nTotalWithdrawCount: { type: Sequelize.INTEGER, defaultValue: 0 },
      dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      dUpdatedAt: Sequelize.DATE
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('userbalances')
  }
}
