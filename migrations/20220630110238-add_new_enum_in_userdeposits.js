'use strict'
const { paymentGetaways } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userdeposits', 'ePaymentGateway',
        { type: Sequelize.ENUM(paymentGetaways), defaultValue: 'ADMIN', comment: 'PAYTM, ADMIN, CASHFREE, CASHFREE_UPI' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userdeposits', 'ePaymentGateway',
        { type: Sequelize.ENUM(paymentGetaways), defaultValue: 'ADMIN', comment: 'PAYTM, ADMIN, CASHFREE' })
    ])
  }
}
