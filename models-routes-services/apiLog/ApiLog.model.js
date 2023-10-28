const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const MatchModel = require('../match/model')

const ApiLog = new Schema({
  sKey: { type: String },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  eType: { type: String, enum: data.apiLogType },
  sUrl: { type: String },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  oData: { type: Object },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }, autoIndex: true })

ApiLog.index({ iMatchId: 1, dCreatedAt: -1 })
const ApiLogModel = MatchDBConnect.model('apilogs', ApiLog)

ApiLogModel.syncIndexes().then(() => {
  console.log('ApiLogModel Indexes Synced')
}).catch((err) => {
  console.log('ApiLogModel Indexes Sync Error', err)
})

module.exports = MatchDBConnect.model('apilogs', ApiLog)
