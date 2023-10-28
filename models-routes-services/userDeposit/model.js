
const { DataTypes } = require('sequelize')
const db = require('../../database/sequelize')
const { paymentGetaways, paymentStatus, platform, userType } = require('../../data')

class UserDeposit extends db.Sequelize.Model {}

UserDeposit.init({
  id: { type: DataTypes.INTEGER(11), allowNull: false, autoIncrement: true, primaryKey: true },
  iReferenceId: { type: DataTypes.UUIDV4, defaultValue: DataTypes.UUIDV4, unique: true },
  iUserId: { type: DataTypes.STRING(24), allowNull: false },
  ePaymentGateway: { type: DataTypes.ENUM(paymentGetaways), defaultValue: 'ADMIN' },
  ePaymentStatus: { type: DataTypes.ENUM(paymentStatus), defaultValue: 'P' },
  sInfo: { type: DataTypes.TEXT },
  sPromocode: { type: DataTypes.STRING },
  iPromocodeId: { type: DataTypes.STRING },
  iTransactionId: { type: DataTypes.STRING },
  iOrderId: { type: DataTypes.STRING, defaultValue: DataTypes.UUIDV4 },
  nAmount: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  nCash: { type: DataTypes.FLOAT(12, 2), allowNull: false, defaultValue: 0 },
  nBonus: { type: DataTypes.FLOAT(12, 2), defaultValue: 0 },
  eUserType: { type: DataTypes.ENUM(userType), defaultValue: 'U' },
  ePlatform: { type: DataTypes.ENUM(platform), defaultValue: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  dProcessedDate: { type: DataTypes.DATE }
}, {
  sequelize: db.sequelize,
  createdAt: 'dCreatedAt',
  updatedAt: 'dUpdatedAt',
  tableName: 'userdeposits',
  indexes: [
    {
      fields: ['iUserId', 'iPromocodeId', 'ePaymentStatus'] // ePaymentStatus, iPromocodeId
    }
  ]
})

module.exports = UserDeposit
