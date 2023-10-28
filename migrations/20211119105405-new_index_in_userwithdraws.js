'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('userwithdraws', ['ePaymentStatus'], {
      name: 'userwithdraws_ePaymentStatus'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('userwithdraws', ['ePaymentStatus'], {
      name: 'userwithdraws_ePaymentStatus'
    })
  }
}
