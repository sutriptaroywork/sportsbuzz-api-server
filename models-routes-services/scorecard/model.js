const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const { ObjectId } = mongoose.Schema.Types
const data = require('../../data')
const SeriesLeaderBoardModel = require('../seriesLeaderBoard/model')
const MatchModel = require('../match/model')
const PlayerModel = require('../player/model')
const TeamModel = require('../team/model')

const fullscorecards = new Schema({
  iMatchId: { type: ObjectId, ref: MatchModel, required: true },
  iSeriesId: { type: ObjectId, ref: SeriesLeaderBoardModel },
  sVenue: { type: String, trim: true },
  nLatestInningNumber: Number,
  oToss: {
    sText: { type: String },
    iWinnerTeamId: { type: ObjectId, ref: TeamModel },
    eDecision: { type: String, enum: data.eDecision }
  },
  oTeamScoreA: {
    type: {
      iTeamId: {
        type: ObjectId,
        ref: TeamModel
      },
      sScoresFull: String,
      sScores: String,
      sOvers: String
    }
  },
  oTeamScoreB: {
    type: {
      iTeamId: {
        type: ObjectId,
        ref: TeamModel
      },
      sScoresFull: String,
      sScores: String,
      sOvers: String
    }
  },
  sLiveMatchNote: String,
  sResult: String,
  iMomId: { type: ObjectId, ref: PlayerModel }, // man of the match
  iMosId: { type: ObjectId, ref: PlayerModel }, // man of the series
  bIsFollowOn: { type: Boolean, default: false },
  sWinMargin: String,
  sCurrentOver: String,
  sPreviousOver: String,
  sLastFiveOvers: String,
  sETag: String,
  eProvider: {
    type: String,
    enum: data.matchProvider
  }
},
{
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
}
)

fullscorecards.virtual('oMatch', {
  ref: MatchModel,
  localField: 'iMatchId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oSeries', {
  ref: SeriesLeaderBoardModel,
  localField: 'iSeriesId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oToss.oWinnerTeam', {
  ref: TeamModel,
  localField: 'oToss.iWinnerTeamId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oTeamScoreA.oTeam', {
  ref: TeamModel,
  localField: 'oTeamScoreA.iTeamId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oTeamScoreB.oTeam', {
  ref: TeamModel,
  localField: 'oTeamScoreB.iTeamId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oMom', {
  ref: PlayerModel,
  localField: 'iMomId',
  foreignField: '_id',
  justOne: true
})
fullscorecards.virtual('oMos', {
  ref: PlayerModel,
  localField: 'iMosId',
  foreignField: '_id',
  justOne: true
})

module.exports = MatchDBConnect.model('fullscorecards', fullscorecards)
