const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { status } = require('../../data')

const Sports = new Schema({
  sName: { type: String, trim: true, required: true },
  sKey: { type: String, required: true },
  nPosition: { type: Number },
  eStatus: { type: String, enum: status, default: 'Y' },
  oRule: {
    nMaxPlayerOneTeam: { type: Number }, // maximum player in a team
    nTotalPlayers: { type: Number } // total players
  },
  sScoreInfoLink: { type: String, trim: true },
  sScoreInfoTabName: { type: String },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Sports.index({ sKey: 1, eStatus: 1 })

module.exports = StatisticsDBConnect.model('sports', Sports)
