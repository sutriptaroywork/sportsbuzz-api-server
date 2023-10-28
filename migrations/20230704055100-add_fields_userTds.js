'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    return Promise.all([
      queryInterface.addColumn(
        'usertds',
        'iTransactionId',
        {
          type: Sequelize.STRING, defaultValue: null
        }
      ),
      queryInterface.renameColumn('usertds', 'nTaxableAmount', 'nWithdrawAmount')
    ])
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    return Promise.all([
      queryInterface.removeColumn('usertds', 'iTransactionId'),
      queryInterface.renameColumn('usertds', 'nWithdrawAmount', 'nTaxableAmount')
    ])
  }
}
