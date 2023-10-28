const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { status } = require('../../data')

const CMS = new Schema({
  sTitle: { type: String, required: true },
  sDescription: { type: String },
  sSlug: { type: String, unique: true, required: true },
  sContent: { type: String, required: true },
  sCategory: { type: String },
  nPriority: { type: Number },
  eStatus: { type: String, enum: status, default: 'N' } // Y = Active, N = Inactive
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

CMS.index({ eStatus: 1, sSlug: 1 })

module.exports = StatisticsDBConnect.model('cms', CMS)
