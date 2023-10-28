const { DataTypes } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const { tdsStatus, userType, category } = require('../../data')

class UserTds extends Sequelize.Model {}

UserTds.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  nPercentage: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  nOriginalAmount: { type: DataTypes.FLOAT(9, 2), allowNull: false }, // original amount
  nAmount: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 }, // TDS amount
  nActualAmount: { type: DataTypes.FLOAT(9, 2), allowNull: false }, // actual amount (nOriginalAmount - nAmount)
  nEntryFee: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 }, // Entry fee of contest
  nWithdrawAmount: { type: DataTypes.FLOAT(9, 2), defaultValue: 0 },
  iPassbookId: { type: DataTypes.STRING(24) },
  iTransactionId: { type: DataTypes.STRING(24) },
  eStatus: { type: DataTypes.ENUM(tdsStatus), defaultValue: 'P' },
  eUserType: { type: DataTypes.ENUM(userType), defaultValue: 'U' },
  iMatchLeagueId: { type: DataTypes.STRING(24) },
  iMatchId: { type: DataTypes.STRING(24) },
  eCategory: { type: DataTypes.ENUM(category), defaultValue: 'CRICKET' },
  bIsEOFY: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'usertds',
  indexes: [
    {
      fields: ['iUserId', 'eStatus']
    }
  ]
})

module.exports = UserTds
