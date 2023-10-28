const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { status } = require('../../data')
const { StatisticsDBConnect } = require('../../database/mongoose')

const Country = new Schema({
  sName: { type: String, trim: true, required: true },
  sCode: { type: String, trim: true, required: true },
  sPrefixDial: { type: String, trim: true, required: true },
  eStatus: { type: String, enum: status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Country.index({ sName: 1 }, { unique: true })
Country.index({ sCode: 1 }, { unique: true })
Country.index({ sPrefixDial: 1 }, { unique: true })

module.exports = StatisticsDBConnect.model('countries', Country)
