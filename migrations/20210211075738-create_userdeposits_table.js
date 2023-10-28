'use strict'
const { paymentGetaways, paymentStatus, platform } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('userdeposits', {
      id: { type: Sequelize.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
      iUserId: { type: Sequelize.STRING(24), allowNull: false },
      ePaymentGateway: { type: Sequelize.ENUM(paymentGetaways), defaultValue: 'ADMIN' },
      ePaymentStatus: { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P' },
      sInfo: { type: Sequelize.STRING },
      sPromocode: { type: Sequelize.STRING },
      nAmount: { type: Sequelize.INTEGER, defaultValue: 0 },
      nCash: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      nBonus: { type: Sequelize.INTEGER, defaultValue: 0 },
      ePlatform: { type: Sequelize.ENUM(platform), defaultValue: 'O' },
      dCreatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      dUpdatedAt: Sequelize.DATE
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('userdeposits')
  }
}
