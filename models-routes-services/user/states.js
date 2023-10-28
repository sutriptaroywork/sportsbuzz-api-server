const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const States = new Schema({
  id: { type: Number, require: true }, // check need to work on it
  nCountryId: { type: Number, trim: true }, // check
  sName: { type: String, trim: true },
  eStatus: { type: String, enum: data.status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

States.index({ sName: 1 })

module.exports = StatisticsDBConnect.model('states', States)
