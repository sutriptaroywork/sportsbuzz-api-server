'use strict'

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    return queryInterface.sequelize.query(
      'ALTER TABLE passbooks MODIFY sRemarks VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'
    )
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    return queryInterface.sequelize.query(
      'ALTER TABLE passbooks MODIFY sRemarks VARCHAR(255) CHARACTER SET utf8mb4_0900_ai_ci COLLATE utf8mb4;'
    )
  }
}
