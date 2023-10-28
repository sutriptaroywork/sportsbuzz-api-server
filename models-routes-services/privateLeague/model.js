const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const PrivateLeaguePrize = new Schema({
  nPrizeNo: { type: Number },
  sTitle: { type: String },
  aPrizeBreakups: [{
    nRankFrom: { type: Number },
    nRankTo: { type: Number },
    nPrizePer: { type: Number } // In V2 for nPrize
  }],
  eStatus: { type: String, enum: data.status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
PrivateLeaguePrize.index({ nPrizeNo: 1, eStatus: 1 })

module.exports = GamesDBConnect.model('privateleagueprizes', PrivateLeaguePrize)
