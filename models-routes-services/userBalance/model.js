
const { DataTypes } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const { userType } = require('../../data')

class UserBalance extends Sequelize.Model {}

UserBalance.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  nCurrentWinningBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nCurrentDepositBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nCurrentTotalBalance: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nCurrentBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nExpiredBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalBonusEarned: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalBonusReturned: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalCashbackReturned: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalWinningAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalDepositAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalDepositCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  nTotalWithdrawAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTotalWithdrawCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  nTotalLoyaltyPoints: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  eUserType: { type: DataTypes.ENUM(userType), defaultValue: 'U' }
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'userbalances',
  indexes: [
    {
      fields: ['iUserId']
    }
  ]
})

module.exports = UserBalance
