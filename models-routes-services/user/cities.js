const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')

const Cities = new Schema({
  id: { type: Number, require: true },
  nStateId: { type: Number, trim: true }, // check
  sName: { type: String, trim: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Cities.index({ sName: 1, nStateId: 1 })

module.exports = StatisticsDBConnect.model('cities', Cities)
