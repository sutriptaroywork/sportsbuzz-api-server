const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { FantasyTeamConnect } = require('../../database/mongoose')
const { category, userType } = require('../../data')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')
const MatchPlayerModel = require('../matchPlayer/model')
const MatchTeamsModel = require('../matchTeams/model')

const UserTeam = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sName: { type: String, trim: true, required: true },
  iCaptainId: { type: Schema.Types.ObjectId, ref: MatchPlayerModel, required: true },
  iViceCaptainId: { type: Schema.Types.ObjectId, ref: MatchPlayerModel, required: true },
  nTotalPoints: { type: Number },
  sHash: { type: String, trim: true },
  bPointCalculated: { type: Boolean, default: false },
  eCategory: { type: String, enum: category, default: 'CRICKET' },
  eType: { type: String, enum: userType, default: 'U' }, // U = USER B = BOT
  bSwapped: { type: Boolean, default: false }, // it's true when combination bot replaced with copy bot userTeam and vice versa.
  bIsDuplicated: { type: Boolean, default: false },
  iIsDuplicatedFromUserTeamId: { type: Schema.Types.ObjectId },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

UserTeam.index({ iMatchId: 1, sHash: 1, bPointCalculated: 1 })
UserTeam.index({ iMatchId: 1, iUserId: 1, sName: 1, _id: 1 })
UserTeam.index({ iCaptainId: 1, iMatchId: 1, iUserId: 1, iViceCaptainId: 1, sHash: 1, _id: 1 })
UserTeam.index({ iCaptainId: 1, iViceCaptainId: 1, sHash: 1, _id: 1 })
UserTeam.index({ eType: 1 })

const UserTeamModel = FantasyTeamConnect.model('userteams', UserTeam)

UserTeam.virtual('oUser', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})
UserTeam.virtual('oMatch', {
  ref: MatchModel,
  localField: 'iMatchId',
  foreignField: '_id',
  justOne: true
})

UserTeam.virtual('oMatchTeamHash', {
  ref: MatchTeamsModel,
  localField: 'sHash',
  foreignField: 'sHash',
  justOne: true
})

UserTeam.statics.filterData = function(userTeam) {
  userTeam.sHash = undefined
  userTeam.dCreatedAt = undefined
  userTeam.dUpdatedAt = undefined
  userTeam.__v = undefined
  userTeam.eType = undefined
  userTeam.bPointCalculated = undefined
}
UserTeamModel.syncIndexes().then(() => {
  console.log('User Team Model Indexes Synced')
}).catch((err) => {
  console.log('User Team Model Indexes Sync Error', err)
})

module.exports = UserTeamModel
