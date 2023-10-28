const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { status, bankProvider } = require('../../data')

const Bank = new Schema({
  sCode: { type: String },
  sName: { type: String, required: true },
  eProvider: { type: String, enum: bankProvider, default: 'C' }, // C = cashfree
  eStatus: { type: String, enum: status, default: 'Y' } // Y = Active, N = Inactive
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Bank.index({ eStatus: 1, sName: 1 })

module.exports = StatisticsDBConnect.model('banks', Bank)
