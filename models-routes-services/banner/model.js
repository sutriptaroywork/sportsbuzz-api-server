const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { bannerType, status, bannerScreen, bannerPlace } = require('../../data')

const Banner = new Schema({
  sImage: { type: String, trim: true, required: true },
  eType: { type: String, enum: bannerType, default: 'S' }, // S = SCREEN, l = lINK
  eStatus: { type: String, enum: status, default: 'N' },
  sLink: { type: String, trim: true },
  eScreen: { type: String, enum: bannerScreen, default: 'S' }, // D = DEPOSIT S = SHARE, CR = CONTEST REDIRECT, ST = STATIC
  ePlace: { type: String, enum: bannerPlace, default: 'H' },
  sDescription: { type: String, trim: true },
  nPosition: { type: Number },
  iMatchId: { type: String },
  iMatchLeagueId: { type: String },
  eCategory: { type: String },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Banner.index({ eStatus: 1, ePlace: 1 })

module.exports = StatisticsDBConnect.model('banners', Banner)
