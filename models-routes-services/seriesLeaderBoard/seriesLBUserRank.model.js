const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { SeriesLBDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const SeriesLeaderBoardModel = require('../seriesLeaderBoard/model')

const SeriesLBUserRank = new Schema({
  sName: { type: String, required: true },
  iSeriesId: { type: Schema.Types.ObjectId, ref: SeriesLeaderBoardModel },
  iCategoryId: { type: Schema.Types.ObjectId },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sUsername: { type: String, trim: true },
  sProPic: { type: String, trim: true },
  bPrizeCalculated: { type: Boolean, default: false },
  bWinDistribution: { type: Boolean, default: false },
  nUserRank: { type: Number },
  nUserScore: { type: Number },
  nPrize: { type: Number },
  aExtraWin: [{
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  nBonusWin: { type: Number, default: 0 }, // Bonus win
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

SeriesLBUserRank.virtual('oUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})

module.exports = SeriesLBDBConnect.model('series_leader_boards_user_ranks', SeriesLBUserRank)
