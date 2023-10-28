const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const TeamModel = require('../team/model')
const SeriesLeaderBoardModel = require('../seriesLeaderBoard/model')
const SeasonModel = require('../season/model')

const Match = new Schema({
  sKey: { type: String, trim: true },
  eFormat: { type: String, enum: data.format },
  sName: { type: String, trim: true },
  sSponsoredText: { type: String, trim: true },
  sSeasonKey: { type: String, trim: true },
  sVenue: { type: String, trim: true },
  eStatus: { type: String, enum: data.matchStatus, default: 'P' },
  dStartDate: { type: Date, required: true },
  oHomeTeam: {
    iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
    sKey: { type: String, trim: true, required: true },
    sName: { type: String, trim: true },
    sShortName: { type: String },
    sImage: { type: String, trim: true },
    nScore: { type: String },
    bIsNameUpdated: { type: Boolean, default: false }
  },
  oAwayTeam: {
    iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
    sKey: { type: String, trim: true, required: true },
    sName: { type: String, trim: true },
    sShortName: { type: String },
    sImage: { type: String, trim: true },
    nScore: { type: String },
    bIsNameUpdated: { type: Boolean, default: false }
  },
  sWinning: { type: String },
  iTossWinnerId: { type: Schema.Types.ObjectId, ref: TeamModel },
  eTossWinnerAction: { type: String, enum: data.matchTossWinnerAction },
  bMatchOnTop: { type: Boolean, default: false },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sInfo: { type: String, trim: true },
  nLatestInningNumber: { type: Number },
  aPlayerRole: [{
    sName: { type: String, trim: true, required: true },
    sFullName: { type: String, trim: true },
    nMax: { type: Number, required: true },
    nMin: { type: Number, required: true },
    nPosition: { type: Number }
  }],
  bScorecardShow: { type: Boolean, default: false },
  sLeagueText: { type: String },
  sSeasonName: { type: String, trim: true },
  nMaxTeamLimit: { type: Number },
  iSeriesId: { type: Schema.Types.ObjectId, ref: SeriesLeaderBoardModel },
  iSeasonId: { type: Schema.Types.ObjectId, ref: SeasonModel },
  bDisabled: { type: Boolean, default: false },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  bLineupsOut: { type: Boolean, default: false },
  bSpecial: { type: Boolean, default: false },
  sFantasyPost: { type: String },
  sStreamUrl: { type: String, trim: true },
  nRankCount: { type: Number, default: 0 },
  nPrizeCount: { type: Number, default: 0 },
  nWinDistCount: { type: Number, default: 0 },
  dWinDistAt: { type: Date },
  sStatusNote: { type: String },
  sExternalId: { type: String },
  nPrice: { type: Schema.Types.Number, default: 0 },
  isMegaContest: { type: Boolean, default: false },
  bIsNameUpdated: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// As expected to give these two index as a unique but not given.
Match.index({ sKey: 1, eCategory: 1 }, { unique: true })
Match.index({ sKey: 1, eCategory: 1, eProvider: 1 }, { unique: true })
Match.index({ eCategory: 1, eStatus: 1, sKey: 1 })
Match.index({ eStatus: 1, dStartDate: 1 })
Match.index({ iSeriesId: 1, eStatus: 1 })

Match.virtual('oSeries', {
  ref: SeriesLeaderBoardModel,
  localField: 'iSeriesId',
  foreignField: '_id',
  justOne: true
})

Match.virtual('oSeason', {
  ref: SeasonModel,
  localField: 'iSeasonId',
  foreignField: '_id',
  justOne: true
})

const MatchModel = MatchDBConnect.model('matches', Match)

MatchModel.syncIndexes().then(() => {
  console.log('Match Model Indexes Synced')
}).catch((err) => {
  console.log('Match Model Indexes Sync Error', err)
})

module.exports = MatchModel
