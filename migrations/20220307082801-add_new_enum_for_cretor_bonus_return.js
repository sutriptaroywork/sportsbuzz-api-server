'use strict'
const { transactionType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('passbooks', 'eTransactionType',
        { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit', comment: 'Bonus, Refer-Bonus, Deposit, Withdraw, Win, Play, Bonus-Expire, Play-Return, Win-Return, Opening, Creator-Bonus, TDS, Withdraw-Return, Cashback-Contest, Cashback-Return, Creator-Bonus-Return' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('passbooks', 'eTransactionType',
        { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit', comment: 'Bonus, Refer-Bonus, Deposit, Withdraw, Win, Play, Bonus-Expire, Play-Return, Win-Return, Opening, Creator-Bonus, TDS, Withdraw-Return, Cashback-Contest' })
    ])
  }
}
