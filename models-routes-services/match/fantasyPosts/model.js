const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')

const FantasyPost = new Schema({
  sTitle: { type: String, required: true },
  sSlug: { type: String, unique: true, required: true },
  sContent: { type: String, required: true },
  iFantasyPostId: { type: String, required: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

FantasyPost.index({ iFantasyPostId: 1 })
FantasyPost.index({ sSlug: 1 })

module.exports = MatchDBConnect.model('fantasy_posts', FantasyPost)
