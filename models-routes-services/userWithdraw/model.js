
const { DataTypes } = require('sequelize')
const { sequelize, Sequelize } = require('../../database/sequelize')
const { withdrawPaymentGetaways, payoutStatus, platform, userType } = require('../../data')

class UserWithdraw extends Sequelize.Model {}

UserWithdraw.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  ePaymentGateway: { type: DataTypes.ENUM(withdrawPaymentGetaways), defaultValue: 'PAYTM' },
  ePaymentStatus: { type: DataTypes.ENUM(payoutStatus), defaultValue: 'P' }, // pending success cancelled refunded initiated
  sInfo: { type: DataTypes.TEXT },
  nAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nParentId: { type: DataTypes.INTEGER, defaultValue: 0 },
  iWithdrawalDoneBy: { type: DataTypes.STRING(24) },
  dWithdrawalTime: { type: DataTypes.DATE },
  nWithdrawFee: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  sIP: { type: DataTypes.STRING },
  eUserType: { type: DataTypes.ENUM(userType), defaultValue: 'U' },
  ePlatform: { type: DataTypes.ENUM(platform), defaultValue: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  dProcessedDate: { type: DataTypes.DATE },
  dReversedDate: { type: DataTypes.DATE },
  bReversed: { type: DataTypes.BOOLEAN, defaultValue: false },
  // sReversedInfo: { type: DataTypes.TEXT },
  iTransactionId: { type: DataTypes.STRING }
}, {
  sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'userwithdraws',
  indexes: [
    {
      fields: ['iUserId', 'ePaymentStatus'] // ePaymentStatus
    }
  ]
})

module.exports = UserWithdraw
