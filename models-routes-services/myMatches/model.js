const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')
const UserLeagueModel = require('../userLeague/model')

const MyMatch = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  aMatchLeagueId: [{ type: Schema.Types.ObjectId, ref: MatchLeagueModel, default: [] }],
  aCMatchLeagueId: [{ type: Schema.Types.ObjectId, ref: MatchLeagueModel, default: [] }], // created private league ids
  aMatchLeagueCashback: [{
    iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
    nAmount: { type: Number },
    nTeams: { type: Number },
    eType: { type: String, enum: data.ruleType } // C = CASH, B = BONUS
  }],
  nTeams: { type: Number },
  nJoinedLeague: { type: Number },
  nWinnings: { type: Number, default: 0 },
  aMatchLeagueWins: [{
    iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
    iUserLeagueId: { type: Schema.Types.ObjectId, ref: UserLeagueModel },
    nRealCash: { type: Number },
    nBonus: { type: Number },
    aExtraWin: [{
      sInfo: { type: String },
      sImage: { type: String, trim: true }
    }]
  }],
  aExtraWin: [{
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  nBonusWin: { type: Number, default: 0 },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, required: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  eMatchStatus: { type: String, enum: data.matchStatus, default: 'U' },
  dStartDate: { type: Date, required: true },
  eType: { type: String, enum: data.userType, default: 'U' },
  sExternalId: { type: String }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }
})

MyMatch.virtual('oMatch', {
  ref: MatchModel,
  localField: 'iMatchId',
  foreignField: '_id'
})

// MyMatch.index({ iUserId: 1, iMatchId: 1 })
// MyMatch.index({ iMatchId: 1 })
MyMatch.index({ iMatchId: 1, iUserId: 1 })
MyMatch.index({ aMatchLeagueId: 1, iMatchId: 1 })
// MyMatch.index({ iUserId: 1, eCategory: 1, eMatchStatus: 1, dStartDate: -1 })
MyMatch.index({ iUserId: 1, eCategory: 1, dStartDate: -1, eMatchStatus: 1 })

const MyMatchModel = GamesDBConnect.model('mymatches', MyMatch)

MyMatchModel.syncIndexes().then(() => {
  console.log('MyMatch Model Indexes Synced')
}).catch((err) => {
  console.log('MyMatch Model Indexes Sync Error', err)
})

module.exports = MyMatchModel
