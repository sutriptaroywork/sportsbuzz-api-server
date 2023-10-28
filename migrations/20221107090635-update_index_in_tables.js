'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('userdeposits', ['dUpdatedAt']),
      queryInterface.addIndex('userdeposits', ['ePaymentStatus', 'dUpdatedAt'], { name: 'userdeposits_status' }),
      queryInterface.addIndex('userdeposits', ['ePaymentGateway', 'dUpdatedAt'], { name: 'userdeposits_gateway' }),
      queryInterface.addIndex('userdeposits', ['ePaymentStatus', 'ePaymentGateway', 'dUpdatedAt'], { name: 'userdeposits_status_gateway' }),

      queryInterface.addIndex('userwithdraws', ['dWithdrawalTime'], { name: 'userwithdraws_time' }),
      queryInterface.addIndex('userwithdraws', ['ePaymentStatus', 'dWithdrawalTime'], { name: 'userwithdraws_status' }),
      queryInterface.addIndex('userwithdraws', ['ePaymentGateway', 'dWithdrawalTime'], { name: 'userwithdraws_gateway' }),
      queryInterface.addIndex('userwithdraws', ['ePaymentStatus', 'ePaymentGateway', 'dWithdrawalTime'], { name: 'userwithdraws_status_gateway' }),

      queryInterface.addIndex('passbooks', ['eTransactionType'], { name: 'passbooks_transaction_type' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('userdeposits', ['dUpdatedAt', 'dCreatedAt']),
      queryInterface.removeIndex('userdeposits', ['ePaymentStatus', 'dUpdatedAt'], { name: 'userdeposits_status' }),
      queryInterface.removeIndex('userdeposits', ['ePaymentGateway', 'dUpdatedAt'], { name: 'userdeposits_gateway' }),
      queryInterface.removeIndex('userdeposits', ['ePaymentStatus', 'ePaymentGateway', 'dUpdatedAt'], { name: 'userdeposits_status_gateway' }),

      queryInterface.removeIndex('userwithdraws', ['dWithdrawalTime'], { name: 'userwithdraws_time' }),
      queryInterface.removeIndex('userwithdraws', ['ePaymentStatus', 'dWithdrawalTime'], { name: 'userwithdraws_status' }),
      queryInterface.removeIndex('userwithdraws', ['ePaymentGateway', 'dWithdrawalTime'], { name: 'userwithdraws_gateway' }),
      queryInterface.removeIndex('userwithdraws', ['ePaymentStatus', 'ePaymentGateway', 'dWithdrawalTime'], { name: 'userwithdraws_status_gateway' }),

      queryInterface.removeIndex('passbooks', ['eTransactionType'], { name: 'passbooks_transaction_type' })
    ])
  }
}
