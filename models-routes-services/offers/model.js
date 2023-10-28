const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Offer = new Schema({
  sTitle: { type: String, required: true },
  sDescription: { type: String, required: true },
  sImage: { type: String, trim: true },
  sDetail: { type: String },
  eStatus: { type: String, enum: data.status, default: 'N' }, // Y = Active, N = Inactive
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Offer.index({ eStatus: 1 })

module.exports = StatisticsDBConnect.model('offers', Offer)
