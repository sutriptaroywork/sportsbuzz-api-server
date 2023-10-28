const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')
const MatchLeagueModel = require('../../matchLeague/model')
const UserLeagueModel = require('../../userLeague/model')
const PromocodeModel = require('../model')
const UserModel = require('../../user/model')
const MatchModel = require('../../match/model')

const PromocodeStatistic = new Schema({
  iPromocodeId: { type: Schema.Types.ObjectId, ref: PromocodeModel, required: true },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  idepositId: { type: Number },
  nAmount: { type: Number },
  sTransactionType: { type: String },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  iUserLeagueId: { type: Schema.Types.ObjectId, ref: UserLeagueModel },
  eStatus: { type: String, enum: data.status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PromocodeStatistic.index({ iUserId: 1 })
PromocodeStatistic.index({ iMatchLeagueId: 1 })

const PromocodeStatisticsModel = LeaguesDBConnect.model('Promocodestatistics', PromocodeStatistic)
PromocodeStatisticsModel.syncIndexes().then(() => {
  console.log('PromocodeStatistics Model Indexes Synced')
}).catch((err) => {
  console.log('PromocodeStatistics Model Indexes Sync Error', err)
})

module.exports = PromocodeStatisticsModel
