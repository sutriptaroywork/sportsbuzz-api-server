const mongoose = require('mongoose')
const Schema = mongoose.Schema
const data = require('../../data')
const TeamModel = require('../team/model')
const MatchModel = require('../match/model')
const PlayerModel = require('../player/model')
const { MatchDBConnect } = require('../../database/mongoose')

const MatchPlayer = new Schema({
  sKey: { type: String, trim: true },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, index: true },
  iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
  sTeamName: { type: String, trim: true },
  iPlayerId: { type: Schema.Types.ObjectId, ref: PlayerModel },
  sImage: { type: String, trim: true },
  sLogoUrl: { type: String, trim: true },
  sName: { type: String, trim: true },
  sTeamKey: { type: String, trim: true },
  eRole: { type: String, enum: data.role, default: 'BATS' },
  nFantasyCredit: { type: Number, default: 9 },
  nScoredPoints: { type: Number, default: 0 },
  nSeasonPoints: { type: Number, default: 0 },
  aPointBreakup: [{
    sKey: { type: String, trim: true },
    sName: { type: String, trim: true },
    nPoint: { type: Number },
    nScoredPoints: { type: Number, default: 0 }
  }],
  nSetBy: { type: Number, default: 0 },
  nCaptainBy: { type: Number, default: 0 },
  nViceCaptainBy: { type: Number, default: 0 },
  bShow: { type: Boolean, default: false },
  bSubstitute: { type: Boolean, default: false },
  bStrikeRateBonus: { type: Boolean, default: false },
  bEconomyBonus: { type: Boolean, default: false },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

MatchPlayer.index({ iMatchId: 1, iTeamId: 1, iPlayerId: 1 }, { unique: true })

const MatchPlayerModel = MatchDBConnect.model('matchplayers', MatchPlayer)

MatchPlayerModel.syncIndexes().then(() => {
  console.log('Match Player Model Indexes Synced')
}).catch((err) => {
  console.log('Match Player Model Indexes Sync Error', err)
})

module.exports = MatchPlayerModel
