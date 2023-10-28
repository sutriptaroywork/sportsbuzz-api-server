const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const ScorePoint = new Schema({
  sKey: { type: String, trim: true, required: true },
  sName: { type: String, trim: true, required: true },
  sType: { type: String, trim: true },
  aPoint: [{
    nRangeFrom: { type: Number },
    nRangeTo: { type: Number },
    nMinValue: { type: Number },
    nBonus: { type: Number, required: true }
  }],
  nPoint: { type: Number },
  bMulti: { type: Boolean, default: false },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  eFormat: { type: String, enum: data.format, default: 'ODI' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

ScorePoint.index({ eCategory: 1, eFormat: 1 })

module.exports = MatchDBConnect.model('scorepoints', ScorePoint)
