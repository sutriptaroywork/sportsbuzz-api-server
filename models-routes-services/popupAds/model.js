const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { popupAdsType, popupAdsPlatform, status } = require('../../data')

const popupAds = new Schema({
  sTitle: { type: String, trim: true },
  sImage: { type: String, trim: true, required: true },
  sLink: { type: String, trim: true },
  eType: { type: String, enum: popupAdsType, default: 'E' },
  iMatchId: { type: String },
  iMatchLeagueId: { type: String },
  eCategory: { type: String },
  ePlatform: { type: String, enum: popupAdsPlatform, default: 'ALL' },
  eStatus: { type: String, enum: status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

popupAds.index({ eStatus: 1 })

module.exports = StatisticsDBConnect.model('popupAds', popupAds)
