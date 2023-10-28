'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('userwithdraws', ['eUserType', 'dWithdrawalTime'], { name: 'userwithdraws_eUserType_dWithdrawalTime' }),
      queryInterface.addIndex('userdeposits', ['eUserType', 'dUpdatedAt'], { name: 'userdeposits_eUserType_dUpdatedAt' })
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('userwithdraws', ['eUserType', 'dWithdrawalTime'], { name: 'userwithdraws_eUserType_dWithdrawalTime' }),
      queryInterface.removeIndex('userdeposits', ['eUserType', 'dUpdatedAt'], { name: 'userdeposits_eUserType_dUpdatedAt' })
    ])
  }
}
