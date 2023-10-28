const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../../database/mongoose')
const { ObjectId } = mongoose.Schema.Types
const { eProvider, eBattingPosition, eDismissal, eBowlingPosition, category } = require('../../../data')
const MatchModel = require('../../match/model')
const PlayerModel = require('../../player/model')
const TeamModel = require('../../team/model')

// From match live API & Scorecards mix
const liveinnings = new Schema({
  iMatchId: { type: ObjectId, required: true, ref: MatchModel },
  sInningId: { type: String },
  nInningNumber: { type: Number },
  sName: String,
  sShortName: String,
  sResultStr: { type: String },
  sStatusStr: { type: String },
  iBattingTeamId: { type: ObjectId },
  iFieldingTeamId: { type: ObjectId, ref: TeamModel },
  aActiveBatters: [{ // From Live match API
    iBatterId: { type: ObjectId, ref: PlayerModel },
    nRuns: Number,
    nBallFaced: Number,
    nFours: Number,
    nSixes: Number,
    sStrikeRate: String
  }],
  aActiveBowlers: [{ // From Live match API
    iBowlerId: { type: ObjectId, ref: PlayerModel },
    sOvers: String,
    nRunsConceded: Number,
    nWickets: Number,
    nMaidens: Number,
    sEcon: String
  }],
  aBatters: [{
    iBatterId: { type: ObjectId, ref: PlayerModel },
    bIsBatting: { type: Boolean, default: false },
    ePosition: { type: String, enum: eBattingPosition },
    nRuns: Number,
    nBallFaced: Number,
    nFours: Number,
    nSixes: Number,
    nDots: Number,
    nSingles: Number,
    nDoubles: Number,
    nThree: Number,
    nFives: Number,
    sHowOut: String,
    eDismissal: { type: String, enum: eDismissal },
    sStrikeRate: String,
    iBowlerId: { type: ObjectId, ref: PlayerModel },
    iFirstFielderId: { type: ObjectId, ref: PlayerModel },
    iSecondFielderId: { type: ObjectId, ref: PlayerModel },
    iThirdFielderId: { type: ObjectId, ref: PlayerModel }
  }],
  aBowlers: [{
    iBowlerId: { type: ObjectId, ref: PlayerModel },
    bIsBowling: { type: Boolean, default: false },
    ePosition: { type: String, enum: eBowlingPosition },
    sOvers: String,
    nMaidens: { type: Number, default: 0 },
    nRunsConducted: { type: Number, default: 0 },
    nWickets: { type: Number, default: 0 },
    nNoBalls: { type: Number, default: 0 },
    nWides: { type: Number, default: 0 },
    nDotBalls: { type: Number, default: 0 },
    sEcon: String,
    nBowled: { type: Number, default: 0 },
    nLbw: { type: Number, default: 0 }
  }],
  aFielders: [{
    iFielderId: { type: ObjectId, ref: PlayerModel },
    nCatches: { type: Number, default: 0 },
    nRunoutThrow: { type: Number, default: 0 },
    nRunoutCatcher: { type: Number, default: 0 },
    nRunoutDirect: { type: Number, default: 0 },
    bIsSubstitute: { type: Boolean, default: false },
    nStumping: { type: Number, default: 0 }
  }],
  oLastWicket: {
    iBatterId: { type: ObjectId, ref: PlayerModel },
    nRuns: Number,
    nBallFaced: Number,
    sHowOut: String,
    nScoreDismissal: Number,
    sOverDismissal: String,
    iBowlerId: { type: ObjectId, ref: PlayerModel },
    eDismissal: { type: String, enum: eDismissal },
    nWicketNumber: Number
  },
  aFOWs: [{
    iBatterId: { type: ObjectId, ref: PlayerModel },
    nRuns: Number,
    nBallFaced: Number,
    nHowOut: Number,
    nScoreDismissal: Number,
    sOverDismissal: String,
    iBowlerId: { type: ObjectId, ref: PlayerModel },
    eDismissal: { type: String, enum: eDismissal },
    nWicketNumber: Number
  }],
  oExtraRuns: {
    nByes: Number,
    nLegByes: Number,
    nWides: Number,
    nNoBalls: Number,
    nPenalty: Number,
    nTotal: Number
  },
  oEquations: {
    nRuns: Number,
    nWickets: Number,
    sOvers: String,
    nBowlersUsed: Number,
    sRunRate: String
  },
  oCurrentPartnership: {
    nRuns: Number,
    nBalls: Number,
    sOvers: String,
    aBatters: [{
      iBatterId: { type: ObjectId, ref: PlayerModel },
      nRuns: Number,
      nBalls: Number
    }]
  },
  sRecentScores: String, // Match Live API
  sLastFiveOvers: String, // Match Live API
  sLastTenOvers: String, // Match Live API
  eCategory: { type: String, enum: category, default: 'CRICKET' },
  eProvider: { type: String, enum: eProvider }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
}).index({ iMatchId: 1 })

liveinnings.index({ sInningId: 1, eCategory: 1, eProvider: 1 }, { unique: true })

liveinnings.virtual('oMatch', {
  ref: MatchModel,
  localField: 'iMatchId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('oBattingTeam', {
  ref: TeamModel,
  localField: 'iBattingTeamId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('oFieldingTeam', {
  ref: TeamModel,
  localField: 'iFieldingTeamId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBatters.oBatter', {
  ref: PlayerModel,
  localField: 'aBatters.iBatterId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBatters.oBowler', {
  ref: PlayerModel,
  localField: 'aBatters.iBowlerId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBatters.oFirstFielder', {
  ref: PlayerModel,
  localField: 'aBatters.iFirstFielderId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBatters.oSecondFielder', {
  ref: PlayerModel,
  localField: 'aBatters.iSecondFielderId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBatters.oThirdFielder', {
  ref: PlayerModel,
  localField: 'aBatters.iThirdFielderId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aBowlers.oBowler', {
  ref: PlayerModel,
  localField: 'aBowlers.iBowlerId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aFielders.oFielder', {
  ref: PlayerModel,
  localField: 'aFielders.iFielderId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('oLastWicket.oBatter', {
  ref: PlayerModel,
  localField: 'oLastWicket.iBatterId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('oLastWicket.oBowler', {
  ref: PlayerModel,
  localField: 'oLastWicket.iBowlerId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aFOWs.oBatter', {
  ref: PlayerModel,
  localField: 'aFOWs.iBatterId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aFOWs.oBowler', {
  ref: PlayerModel,
  localField: 'aFOWs.iBowlerId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('oCurrentPartnership.aBatters.oBatter', {
  ref: PlayerModel,
  localField: 'oCurrentPartnership.aBatters.iBatterId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aActiveBatters.oBatter', {
  ref: PlayerModel,
  localField: 'aActiveBatters.iBatterId',
  foreignField: '_id',
  justOne: true
})
liveinnings.virtual('aActiveBowlers.oBowler', {
  ref: PlayerModel,
  localField: 'aActiveBowlers.iBowlerId',
  foreignField: '_id',
  justOne: true
})

module.exports = MatchDBConnect.model('liveinnings', liveinnings, 'liveinnings')
