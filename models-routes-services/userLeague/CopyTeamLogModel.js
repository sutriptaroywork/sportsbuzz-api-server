const mongoose = require('mongoose')
const Schema = mongoose.Schema
const data = require('../../data')
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')
const UserTeamModel = require('../userTeam/model')
const MatchLeagueModel = require('../matchLeague/model')

const CopyTeamLog = new Schema({
  iUserTeamId: { type: Schema.Types.ObjectId, ref: UserTeamModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iSystemUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iSystemUserTeamId: { type: Schema.Types.ObjectId, ref: UserTeamModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  eTeamType: { type: String, enum: data.copyTeamTypes, default: 'SAME' },
  sTeamName: { type: String, trim: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  aJoinLogs: { type: Array },
  aTeamLogs: { type: Array },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String },
  aHash: { type: Array },
  bIsUpdated: { type: Boolean }
})

CopyTeamLog.index({ iMatchId: 1, iUserId: 1, iMatchLeagueId: 1, iUserTeamId: 1 })
CopyTeamLog.index({ iSystemUserTeamId: 1 })
CopyTeamLog.index({ iUserTeamId: 1 })

CopyTeamLog.virtual('oSystemUserTeam', {
  ref: UserTeamModel,
  localField: 'iSystemUserTeamId',
  foreignField: '_id',
  justOne: true
})

CopyTeamLog.virtual('oSystemUser', {
  ref: UserModel,
  localField: 'iSystemUserId',
  foreignField: '_id',
  justOne: true
})
const CopyTeamLogModel = GamesDBConnect.model('copyteamlogs', CopyTeamLog)

CopyTeamLogModel.syncIndexes().then(() => {
  console.log('CopyTeamLog Model Indexes Synced')
}).catch((err) => {
  console.log('CopyTeamLog Model Indexes Sync Error', err)
})
module.exports = CopyTeamLogModel
