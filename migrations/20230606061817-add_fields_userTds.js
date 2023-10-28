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
        'nTaxableAmount',
        {
          type: Sequelize.FLOAT(9, 2), defaultValue: 0
        }
      ),
      queryInterface.addColumn(
        'usertds',
        'bIsEOFY',
        {
          type: Sequelize.BOOLEAN, defaultValue: false
        }
      )
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
      queryInterface.removeColumn('usertds', 'nTaxableAmount'),
      queryInterface.removeColumn('usertds', 'bIsEOFY')
    ])
  }
}
