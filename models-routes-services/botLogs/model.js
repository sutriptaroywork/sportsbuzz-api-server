const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const MatchLeagueModel = require('../matchLeague/model')
const MatchModel = require('../match/model')
const AdminModel = require('../admin/model')
const data = require('../../data')

const BotLog = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, index: true },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel, index: true },
  nTeams: { type: Number }, // total team requested for bot submission by admin.
  nSuccess: { type: Number, default: 0 }, // total successfully bot submission number
  nErrors: { type: Number, default: 0 }, // total bot submission failure number
  nReplaces: { type: Number, default: 0 }, // total combination bot submission in replacement of copy bots
  bInstantAdd: { type: Boolean, default: false },
  bEdit: { type: Boolean, default: false },
  eType: { type: String, enum: data.botLogsTypeForJoinLeague, default: 'U' }, // U = USER B = BOT CB = COPY BOT, CMB = COMBINATION BOT, SCB = Swapped Copy Bots with Combination Bots
  iAdminId: { type: Schema.Types.ObjectId },
  aError: [{ type: Object }], // bot submission error
  nPopCount: { type: Number, default: 0 },
  nQueuePushCount: { type: Number, default: 0 },
  nSchedulerPushCount: { type: Number, default: 0 },
  nJoinSubmitCount: { type: Number, default: 0 },
  nTeamCreated: { type: Number, default: 0 },
  aBaseTeams: { type: Array },
  aExtraError: [{ type: Object }],
  bCMBSub: { type: Schema.Types.Boolean, default: false }
},
{ timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BotLog.index({ iMatchLeagueId: 1 })
BotLog.index({ iMatchId: 1 })

BotLog.virtual('oAdmin', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

module.exports = GamesDBConnect.model('botlogs', BotLog)
