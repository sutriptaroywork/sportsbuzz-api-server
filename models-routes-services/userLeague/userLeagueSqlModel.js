const { DataTypes } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const { userType, userLeagueTransactionType, category } = require('../../data')

class UserLeague extends Sequelize.Model {}

UserLeague.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },

  nBonusWin: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nFinalAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nPrice: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nPricePaid: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },

  nTdsFee: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nTdsPercentage: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },

  bTds: { type: DataTypes.BOOLEAN, defaultValue: false },

  iMatchLeagueId: { type: DataTypes.STRING(24), allowNull: false },
  iUserLeagueId: { type: DataTypes.STRING(24), allowNull: false },
  iMatchId: { type: DataTypes.STRING(24), allowNull: false },
  sMatchName: { type: DataTypes.STRING(24), allowNull: false },
  sUserName: { type: DataTypes.STRING(44), allowNull: false },

  eUserType: { type: DataTypes.ENUM(userType), defaultValue: 'U' },
  eCategory: { type: DataTypes.ENUM(category), defaultValue: 'CRICKET' },
  eTransactionType: { type: DataTypes.ENUM(userLeagueTransactionType), defaultValue: 'Win' } // 'Win', 'Play'
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'userleagues',
  indexes: [
    {
      fields: ['iUserId']
    }
  ]
})

module.exports = UserLeague
