module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn(
        'passbooks',
        'iTransactionId',
        {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          unique: true,
          allowNull: true
        }
      )
    ])
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn(
        'passbooks',
        'iTransactionId',
        {
          type: Sequelize.STRING,
          defaultValue: Sequelize.UUIDV4,
          unique: true,
          allowNull: true
        }
      )
    ])
  }
}
