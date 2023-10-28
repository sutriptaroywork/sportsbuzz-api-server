const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { status } = require('../../data')

const EmailTemplate = new Schema({
  sTitle: { type: String, required: true },
  sDescription: { type: String, required: true },
  sSlug: { type: String, unique: true, required: true },
  sSubject: { type: String, required: true },
  sContent: { type: String, required: true },
  eStatus: { type: String, enum: status, default: 'N' }, // Y = Active, N = Inactive
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

EmailTemplate.index({ eStatus: 1 })

module.exports = StatisticsDBConnect.model('emailtemplates', EmailTemplate)
