const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')
const { paymentOptionsKey, withdrawPaymentGetaways, platform, transactionLogType } = require('../../data')
const eGateway = [...new Set(paymentOptionsKey.concat(withdrawPaymentGetaways))]

const TransactionLog = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  iPassbookId: { type: Number },
  iDepositId: { type: Number },
  iOrderId: { type: String },
  iWithdrawId: { type: Number },
  iTransactionId: { type: String },
  ePlatform: { type: String, enum: platform },
  eGateway: { type: String, enum: eGateway },
  eType: { type: String, enum: transactionLogType },
  oBody: { type: Object },
  oReq: { type: Object },
  oRes: { type: Object }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = StatisticsDBConnect.model('transactionlogs', TransactionLog)
