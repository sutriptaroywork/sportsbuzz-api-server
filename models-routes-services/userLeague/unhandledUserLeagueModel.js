const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const MatchLeagueModel = require('../matchLeague/model')

const UnhandledUserLeague = new Schema({
  iDeletedUserLeagueId: { type: Schema.Types.ObjectId },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  oCreationPayload: { type: Object },
  oPlayDeductionPayload: { type: Object },
  oPlayDeductionResponse: { type: Object },
  oError: { type: Object },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now }
})

UnhandledUserLeague.index({ iUserId: 1, iMatchLeagueId: 1 })

const UnhandledUserLeagueModel = GamesDBConnect.model('unhandledUserLeague', UnhandledUserLeague)

UnhandledUserLeagueModel.syncIndexes().then(() => {
  console.log('UnhandledUserLeague Model Indexes Synced')
}).catch((err) => {
  console.log('UnhandledUserLeague Model Indexes Sync Error', err)
})
module.exports = UnhandledUserLeagueModel
