const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')
const data = require('../../data')

const BotCombination = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, index: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  nBotCount: { type: Number }
},
{ timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BotCombination.index({ iMatchLeagueId: 1, iMatchId: 1 })

module.exports = GamesDBConnect.model('botCombinationsLogs', BotCombination)
