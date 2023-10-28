const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const { status } = require('../../data')

const Team = new Schema({
  sKey: { type: String, trim: true, required: true },
  sName: { type: String, trim: true },
  sShortName: { type: String, trim: true },
  sThumbUrl: { type: String, trim: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  eStatus: { type: String, enum: status, default: 'Y' }, // Y = Active, N = Inactive
  sLogoUrl: { type: String, trim: true },
  sImage: { type: String, trim: true },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  sExternalId: { type: String },
  sColorCode: { type: String },
  bIsNameUpdated: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Team.index({ sKey: 1, eCategory: 1, eProvider: 1 }, { unique: true })
const TeamModel = MatchDBConnect.model('teams', Team)
module.exports = TeamModel
