const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Season = new Schema({
  sName: { type: String },
  sKey: { type: String, required: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  dStartDate: { type: Date },
  dEndDate: { type: Date },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Season.index({ sKey: 1, eCategory: 1, eProvider: 1 }, { unique: true })

const SeasonModel = GamesDBConnect.model('seasons', Season)

SeasonModel.syncIndexes().then(() => {
  console.log('Season Model Indexes Synced')
}).catch((err) => {
  console.log('Season Model Indexes Sync Error', err)
})

module.exports = SeasonModel
