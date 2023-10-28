const mongoose = require('mongoose')
const Schema = mongoose.Schema
const data = require('../../data')
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')
const UserTeamModel = require('../userTeam/model')
const MatchLeagueModel = require('../matchLeague/model')
const PromocodeModel = require('../promocode/model')

const UserLeague = new Schema({
  iUserTeamId: { type: Schema.Types.ObjectId, ref: UserTeamModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  nTotalPayout: { type: Number },
  nPoolPrice: { type: Boolean, default: false },
  nTotalPoints: { type: Number },
  sPayoutBreakupDesign: { type: String },
  nRank: { type: Number },
  nPrice: { type: Number }, // Real Money win
  aExtraWin: [{
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  nBonusWin: { type: Number, default: 0 }, // Bonus win
  sUserName: { type: String, trim: true },
  eType: { type: String, enum: data.userTypeForJoinLeague, default: 'U' }, // U = USER B = BOT CB = COPY BOT, CMB = COMBINATION BOT
  sProPic: { type: String, trim: true },
  sTeamName: { type: String, trim: true, default: 'T1' },
  sMatchName: { type: String, trim: true },
  sLeagueName: { type: String, trim: true },
  ePlatform: { type: String, enum: data.platform, required: true, default: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  iPromocodeId: { type: Schema.Types.ObjectId, ref: PromocodeModel },
  nPromoDiscount: { type: Number },
  nOriginalPrice: { type: Number },
  nPricePaid: { type: Number },
  actualCashUsed: { type: Number },
  actualBonusUsed: { type: Number },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  bPointCalculated: { type: Boolean, default: false },
  bRankCalculated: { type: Boolean, default: false },
  bPrizeCalculated: { type: Boolean, default: false },
  bWinDistributed: { type: Boolean, default: false },
  sExternalId: { type: String },
  bCancelled: { type: Boolean, default: false },
  bSwapped: { type: Boolean, default: false }, // it's true when combination bot replaced with copy bot userLeague and vice versa.
  bIsDuplicated: { type: Boolean, default: false },
  bAfterMinJoin: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// UserLeague.index({ iMatchLeagueId: 1, nRank: 1 })
UserLeague.index({ iMatchId: 1, iUserId: 1, iMatchLeagueId: 1, nRank: 1 })
UserLeague.index({ iMatchLeagueId: 1, eType: 1, bCancelled: 1 })
UserLeague.index({ iUserTeamId: 1, nRank: 1 })
UserLeague.index({ iUserId: 1, eCategory: 1, dCreatedAt: -1, nPrice: 1, nTotalPoints: 1 })
// UserLeague.index({ iUserId: 1, eCategory: 1, dCreatedAt: -1, nPrice: 1, nTotalPoints: 1 })
// UserLeague.index({ iMatchLeagueId: 1, iUserId: 1, iUserTeamId: 1 })
UserLeague.index({ iMatchLeagueId: 1, iUserId: 1, bCancelled: 1 })
// UserLeague.index({ iMatchLeagueId: 1, iUserId: 1, nRank: 1 })
UserLeague.index({ iMatchLeagueId: 1, bCancelled: 1, 'aExtraWin.0': 1 })
UserLeague.index({ iMatchLeagueId: 1, bCancelled: 1, nPrice: 1 })
UserLeague.index({ iMatchLeagueId: 1, bCancelled: 1, nBonusWin: 1 })
UserLeague.index({ iMatchLeagueId: 1, iUserTeamId: 1, bCancelled: 1 })
UserLeague.index({ iMatchId: 1, iMatchLeagueId: 1, bCancelled: 1, nTotalPoints: -1 })
UserLeague.index({ iMatchId: 1, iUserId: 1, iUserTeamId: 1 })
// UserLeague.index({ eCategory: 1, dCreatedAt: -1, iUserId: 1, nPrice: 1, nTotalPoints: 1 })
UserLeague.index({ iMatchLeagueId: 1, bCancelled: 1, nRank: 1 })
UserLeague.index({ iUserId: 1, iUserTeamId: 1, iMatchLeagueId: 1 }, { unique: true })
UserLeague.index({ iMatchLeagueId: 1, nRank: 1, iUserId: 1 })
UserLeague.virtual('oUserTeam', {
  ref: UserTeamModel,
  localField: 'iUserTeamId',
  foreignField: '_id',
  justOne: true
})
UserLeague.virtual('oUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})
UserLeague.virtual('oMatchLeague', {
  ref: MatchLeagueModel,
  localField: 'iMatchLeagueId',
  foreignField: '_id',
  justOne: true
})

const UserLeagueModel = GamesDBConnect.model('userleagues', UserLeague)

UserLeagueModel.syncIndexes().then(() => {
  console.log('User League Model Indexes Synced')
}).catch((err) => {
  console.log('User League Model Indexes Sync Error', err)
})

module.exports = UserLeagueModel
