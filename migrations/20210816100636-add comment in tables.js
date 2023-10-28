'use strict'
const { withdrawPaymentGetaways, paymentStatus, platform, transactionType, passbookType, paymentGetaways } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('passbooks', 'eTransactionType',
        { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit', comment: 'Bonus, Refer-Bonus, Deposit, Withdraw, Win, Play, Bonus-Expire, Play-Return, Win-Return, Opening, Creator-Bonus, TDS, Withdraw-Return' }),
      queryInterface.changeColumn('passbooks', 'eType',
        { type: Sequelize.ENUM(passbookType), defaultValue: 'Dr', comment: 'Dr, Cr' }),
      //
      queryInterface.changeColumn('userwithdraws', 'ePaymentGateway',
        { type: Sequelize.ENUM(withdrawPaymentGetaways), defaultValue: 'PAYTM', comment: 'ADMIN, PAYTM, AMAZON, CASHFREE' }),
      queryInterface.changeColumn('userwithdraws', 'ePaymentStatus',
        { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P', comment: 'P = pending, S = success, C = cancelled, R = refunded' }),
      queryInterface.changeColumn('userwithdraws', 'ePlatform',
        { type: Sequelize.ENUM(platform), defaultValue: 'O', comment: 'A = Android, I = iOS, W = Web, O = Other, AD = Admin' }),
      //
      queryInterface.changeColumn('userdeposits', 'ePaymentGateway',
        { type: Sequelize.ENUM(paymentGetaways), defaultValue: 'ADMIN', comment: 'PAYTM, ADMIN, CASHFREE' }),
      queryInterface.changeColumn('userdeposits', 'ePaymentStatus',
        { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P', comment: 'P = pending, S = success, C = cancelled, R = refunded' }),
      queryInterface.changeColumn('userdeposits', 'ePlatform',
        { type: Sequelize.ENUM(platform), defaultValue: 'O', comment: 'A = Android, I = iOS, W = Web, O = Other, AD = Admin' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('passbooks', 'eTransactionType',
        { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit' }),
      queryInterface.changeColumn('passbooks', 'eType',
        { type: Sequelize.ENUM(passbookType), defaultValue: 'Dr' }),
      //
      queryInterface.changeColumn('userwithdraws', 'ePaymentGateway',
        { type: Sequelize.ENUM(withdrawPaymentGetaways), defaultValue: 'PAYTM' }),
      queryInterface.changeColumn('userwithdraws', 'ePaymentStatus',
        { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P' }),
      queryInterface.changeColumn('userwithdraws', 'ePlatform',
        { type: Sequelize.ENUM(platform), defaultValue: 'O' }),
      //
      queryInterface.changeColumn('userdeposits', 'ePaymentGateway',
        { type: Sequelize.ENUM(paymentGetaways), defaultValue: 'ADMIN' }),
      queryInterface.changeColumn('userdeposits', 'ePaymentStatus',
        { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P' }),
      queryInterface.changeColumn('userdeposits', 'ePlatform',
        { type: Sequelize.ENUM(platform), defaultValue: 'O' })
    ])
  }
}
