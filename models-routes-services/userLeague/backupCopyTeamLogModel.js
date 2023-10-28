const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')

const BackupCopyTeamLog = new Schema({
  _id: { type: Schema.Types.ObjectId },
  iUserTeamId: { type: Schema.Types.ObjectId },
  iUserId: { type: Schema.Types.ObjectId },
  iSystemUserId: { type: Schema.Types.ObjectId },
  iSystemUserTeamId: { type: Schema.Types.ObjectId },
  iMatchLeagueId: { type: Schema.Types.ObjectId },
  iMatchId: { type: Schema.Types.ObjectId },
  eTeamType: { type: String },
  sTeamName: { type: String },
  eCategory: { type: String },
  aJoinLogs: { type: Array },
  aTeamLogs: { type: Array },
  dCreatedAt: { type: Date },
  dUpdatedAt: { type: Date },
  aHash: { type: Array },
  bIsUpdated: { type: Boolean },
  __v: { type: Number }
},
{ timestamps: false, _id: false, versionKey: false })

module.exports = GamesDBConnect.model('backupcopyteamlogs', BackupCopyTeamLog)
