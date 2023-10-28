'use strict'
const { transactionType } = require('../data')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    await queryInterface.changeColumn('passbooks', 'eTransactionType',
      { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit', comment: 'Bonus, Refer-Bonus, Deposit, Withdraw, Win, Play, Bonus-Expire, Play-Return, Win-Return, Opening, Creator-Bonus, TDS, Withdraw-Return, Cashback-Contest, Cashback-Return, Creator-Bonus-Return, Loyalty-Point, KYC-Bonus' })
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.changeColumn('passbooks', 'eTransactionType',
      { type: Sequelize.ENUM(transactionType), defaultValue: 'Deposit' })
  }
}
