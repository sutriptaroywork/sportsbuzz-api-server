const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const PlayerRole = new Schema({
  aRole: [{
    eKey: { type: String },
    sName: { type: String, trim: true },
    sFullName: { type: String, trim: true },
    nMax: { type: Number },
    nMin: { type: Number },
    nPosition: { type: Number }
  }],
  nCaptainPoint: { type: Number },
  nViceCaptainPoint: { type: Number },
  eCategory: { type: String, enum: data.category, default: 'CRICKET', unique: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PlayerRole.index({ eCategory: 1 })
module.exports = MatchDBConnect.model('playerroles', PlayerRole)
