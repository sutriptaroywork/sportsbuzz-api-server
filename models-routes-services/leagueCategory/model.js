const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../database/mongoose')

const LeagueCategory = new Schema({
  sTitle: { type: String, trim: true, required: true },
  nPosition: { type: Number, required: true },
  sRemark: { type: String, trim: true },
  sKey: { type: String },
  sImage: { type: String },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

LeagueCategory.index({ sKey: 1 })

module.exports = LeaguesDBConnect.model('leaguecategories', LeagueCategory)
