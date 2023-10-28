const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const PaymentOption = new Schema({
  sName: { type: String, required: true },
  nOrder: { type: Number },
  sImage: { type: String, trim: true },
  eKey: { type: String, enum: data.paymentOptionsKey, default: 'CASHFREE' },
  sOffer: { type: String },
  bEnable: { type: Boolean, default: false },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PaymentOption.index({ bEnable: 1 })
PaymentOption.index({ eKey: 1, bEnable: 1 })

module.exports = StatisticsDBConnect.model('paymentoptions', PaymentOption)
