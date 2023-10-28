const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MatchModel = require('../match/model')
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const MatchLeagueModel = require('../matchLeague/model')

const CombinationPlayers = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  aMatchPlayers: [{ type: Schema.Types.ObjectId }],
  aOldMatchPlayers: [{ type: Schema.Types.ObjectId }],
  bLineUpsUpdated: { type: Schema.Types.Boolean, default: false },
  bBotCreated: { type: Schema.Types.Boolean, default: false },
  oRules: { type: Schema.Types.Object },
  dTeamEditedAt: { type: Schema.Types.Date },
  eTeamEdited: { type: Schema.Types.String, enum: data.editCMBPlayers, default: 'P' },
  bCMBSub: { type: Schema.Types.Boolean, default: false },
  aError: [{
    sMessage: Schema.Types.String,
    aPlayers: Schema.Types.Array,
    // aMatchLeague: [{
    //   iId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
    //   nTotalTeamEdited: { type: Schema.Types.Number, default: 0 },
    //   nTotalTeam: { type: Schema.Types.Number, default: 0 }
    // }],
    dDate: Schema.Types.Date,
    nTotalTeamEdited: { type: Schema.Types.Number, default: 0 },
    nTotalTeam: { type: Schema.Types.Number, default: 0 }
  }],
  aSuccess: [{
    sMessage: Schema.Types.String,
    aPlayers: Schema.Types.Array,
    // aMatchLeague: [{
    //   iId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
    //   nTotalTeamEdited: { type: Schema.Types.Number, default: 0 },
    //   nTotalTeam: { type: Schema.Types.Number, default: 0 }
    // }],
    dDate: Schema.Types.Date,
    nTotalTeamEdited: { type: Schema.Types.Number, default: 0 },
    nTotalTeam: { type: Schema.Types.Number, default: 0 }
  }],
  nTotalTeamEdited: { type: Schema.Types.Number, default: 0 },
  nTotalTeam: { type: Schema.Types.Number, default: 0 }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

CombinationPlayers.index({ iMatchId: 1, iMatchLeagueId: 1, bCMBSub: 1 }, { unique: true })

CombinationPlayers.virtual('oMatchLeague', {
  ref: MatchLeagueModel,
  localField: 'iMatchLeagueId',
  foreignField: '_id',
  justOne: true
})

const CombinationPlayersModel = MatchDBConnect.model('combinationplayers', CombinationPlayers)

CombinationPlayersModel.syncIndexes().then(() => {
  console.log('Combination Players Model Indexes Synced')
}).catch((err) => {
  console.log('Combination Players Indexes Sync Error', err)
})

module.exports = CombinationPlayersModel
