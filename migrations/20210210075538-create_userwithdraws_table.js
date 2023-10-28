'use strict'
const { withdrawPaymentGetaways, paymentStatus, platform } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('userwithdraws', {
      id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
      iUserId: { type: Sequelize.STRING(24), allowNull: false },
      ePaymentGateway: { type: Sequelize.ENUM(withdrawPaymentGetaways), defaultValue: 'PAYTM' },
      ePaymentStatus: { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P' },
      sInfo: { type: Sequelize.STRING },
      nAmount: { type: Sequelize.FLOAT(9, 2), defaultValue: 0 },
      nParentId: { type: Sequelize.INTEGER, defaultValue: 0 },
      iWithdrawalDoneBy: { type: Sequelize.STRING(24) },
      dWithdrawalTime: { type: Sequelize.DATE },
      sIP: { type: Sequelize.STRING },
      ePlatform: { type: Sequelize.ENUM(platform), defaultValue: 'O' },
      dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      dUpdatedAt: Sequelize.DATE
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('userwithdraws')
  }
}
