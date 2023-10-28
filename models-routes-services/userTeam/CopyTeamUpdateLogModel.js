const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const UserTeamModel = require('./model')
const MatchModel = require('../match/model')

const CopyTeamUpdateLog = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iUserTeamId: { type: Schema.Types.ObjectId, ref: UserTeamModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  oPayload: { type: Object },
  oCVCData: { type: Object },
  aSystemUserTeamIds: { type: Array },
  aUserTeamPlayers: { type: Array },
  nCopyTeamCount: { type: Number, default: 0 },
  nSameEditCount: { type: Number, default: 0 },
  nRotateCount: { type: Number, default: 0 },
  nRandomEditCount: { type: Number, default: 0 },
  nEditCount: { type: Number, default: 0 },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now }
})

CopyTeamUpdateLog.index({ iMatchId: 1, iUserId: 1, iMatchLeagueId: 1, iUserTeamId: 1 })
CopyTeamUpdateLog.index({ iUserTeamId: 1 })

const CopyTeamUpdateLogModel = GamesDBConnect.model('copyteamupdatelogs', CopyTeamUpdateLog)

CopyTeamUpdateLogModel.syncIndexes().then(() => {
  console.log('CopyTeamUpdateLog Model Indexes Synced')
}).catch((err) => {
  console.log('CopyTeamUpdateLog Model Indexes Sync Error', err)
})
module.exports = CopyTeamUpdateLogModel
