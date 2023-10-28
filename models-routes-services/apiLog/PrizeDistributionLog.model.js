const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')

const PrizeDistributionLog = new Schema({
  sKey: { type: String, required: true },
  aData: { type: Array }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PrizeDistributionLog.index({ sKey: 1 })

module.exports = MatchDBConnect.model('prizedistributionlogs', PrizeDistributionLog)
