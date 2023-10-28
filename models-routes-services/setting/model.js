const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { status } = require('../../data')

const Setting = new Schema({
  sTitle: { type: String, required: true },
  sKey: { type: String, required: true, unique: true },
  nMax: { type: Number },
  nMin: { type: Number },
  sLogo: { type: String },
  nPosition: { type: Number },
  sImage: { type: String },
  sDescription: { type: String },
  sShortName: { type: String, trim: true },
  eStatus: { type: String, enum: status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String },
  sValue: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
Setting.index({ sTitle: 1 })
Setting.index({ sKey: 1 })

module.exports = StatisticsDBConnect.model('settings', Setting)
