'use strict'
const { payoutStatus, paymentStatus } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userwithdraws', 'ePaymentStatus',
        { type: Sequelize.ENUM(payoutStatus), defaultValue: 'P', comment: 'P = pending, S = success, C = cancelled, R = refunded, I = Initiated' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('userwithdraws', 'ePaymentStatus',
        { type: Sequelize.ENUM(paymentStatus), defaultValue: 'P', comment: 'P = pending, S = success, C = cancelled, R = refunded' })
    ])
  }
}
