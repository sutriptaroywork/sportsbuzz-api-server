const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const PayoutOption = new Schema({
  sTitle: { type: String, required: true },
  eType: { type: String, enum: data.payoutOptionType, default: 'STD' },
  sImage: { type: String, trim: true },
  eKey: { type: String, enum: data.payoutOptionKey, default: 'CASHFREE' },
  sInfo: { type: String },
  nWithdrawFee: { type: Number, default: 0 },
  nMinAmount: { type: Number, default: 0 },
  nMaxAmount: { type: Number, default: 0 },
  bEnable: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PayoutOption.index({ eStatus: 1, eKey: 1 })

module.exports = StatisticsDBConnect.model('payoutoptions', PayoutOption)
