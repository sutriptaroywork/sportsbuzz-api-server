const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { platform } = require('../../data')
const { ReportDBConnect } = require('../../database/mongoose')

const AppDownload = new Schema({
  iAppId: { type: String, required: true }, // uniqueId during app download
  ePlatform: { type: String, enum: platform, required: true },
  sIpAddress: { type: String },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }, autoIndex: true })

AppDownload.index({ iAppId: 1 })

module.exports = ReportDBConnect.model('appdownloads', AppDownload)
