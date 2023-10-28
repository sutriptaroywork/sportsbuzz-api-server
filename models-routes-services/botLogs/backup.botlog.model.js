const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')

const BackupBotLog = new Schema({
  _id: { type: Schema.Types.ObjectId },
  iMatchId: { type: Schema.Types.ObjectId },
  iMatchLeagueId: { type: Schema.Types.ObjectId },
  nTeams: { type: Number },
  nSuccess: { type: Number },
  nErrors: { type: Number },
  nReplaces: { type: Number },
  bInstantAdd: { type: Boolean },
  bEdit: { type: Boolean },
  eType: { type: String },
  iAdminId: { type: Schema.Types.ObjectId },
  aError: [{ type: Object }],
  nPopCount: { type: Number },
  nQueuePushCount: { type: Number },
  nSchedulerPushCount: { type: Number },
  nJoinSubmitCount: { type: Number },
  nTeamCreated: { type: Number },
  aBaseTeams: { type: Array },
  aExtraError: [{ type: Object }],
  dCreatedAt: { type: Date },
  dUpdatedAt: { type: Date },
  __v: { type: Number }
},
{ timestamps: false, _id: false, versionKey: false })

module.exports = GamesDBConnect.model('backupbotlogs', BackupBotLog)
