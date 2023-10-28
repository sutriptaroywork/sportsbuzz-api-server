const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')

const BackupBotCombination = new Schema({
  _id: { type: Schema.Types.ObjectId },
  iMatchId: { type: Schema.Types.ObjectId },
  eCategory: { type: String },
  iMatchLeagueId: { type: Schema.Types.ObjectId },
  nBotCount: { type: Number },
  dCreatedAt: { type: Date },
  dUpdatedAt: { type: Date },
  __v: { type: Number }
},
{ timestamps: false, _id: false, versionKey: false })

module.exports = GamesDBConnect.model('backupBotCombinationsLogs', BackupBotCombination)
