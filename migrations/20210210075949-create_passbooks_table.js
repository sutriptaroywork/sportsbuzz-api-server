'use strict'
const { transactionType, passbookType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('passbooks', {
      id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
      iUserId: { type: Sequelize.STRING(24), allowNull: false },
      nAmount: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nBonus: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nCash: { type: Sequelize.FLOAT(9, 2), allowNull: false, defaultValue: 0 },
      nOldWinningBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nOldDepositBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nOldTotalBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nNewWinningBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nNewDepositBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nNewTotalBalance: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nOldBonus: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nNewBonus: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      eTransactionType: { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit' }, // ['Bonus', 'Deposit', 'Withdraw', 'Win', 'Play', 'Bonus-Expire', 'Play-Return', 'Win-Return', 'Opening', 'Creator-Bonus', 'TDS']
      dBonusExpiryDate: { type: Sequelize.DATE },
      bIsBonusExpired: { type: Sequelize.BOOLEAN, defaultValue: false },
      iPreviousId: { type: Sequelize.INTEGER },
      iUserLeagueId: { type: Sequelize.STRING(24) },
      iMatchId: { type: Sequelize.STRING(24) },
      iMatchLeagueId: { type: Sequelize.STRING(24) },
      iUserDepositId: { type: Sequelize.STRING(24) },
      iWithdrawId: { type: Sequelize.STRING(24) },
      sRemarks: { type: Sequelize.STRING },
      sCommonRule: { type: Sequelize.STRING },
      eType: { type: Sequelize.ENUM(passbookType), defaultValue: 'Dr' }, // Dr, Cr
      dActivityDate: { type: Sequelize.DATE },
      dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      dUpdatedAt: Sequelize.DATE
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('passbooks')
  }
}
