const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../../database/mongoose')
const UserModel = require('../model')
const SeasonModel = require('../../season/model')

const LeaderShipBoard = new Schema({
  oAllTimeData: {
    sTitle: { type: String, trim: true },
    aData: [{
      iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
      nTotalJoinLeague: { type: Number, default: 0 },
      nUserRank: { type: Number, default: 0 }
    }]
  },
  oMonthData: {
    sTitle: { type: String, trim: true },
    aData: [{
      iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
      nTotalJoinLeague: { type: Number, default: 0 },
      nUserRank: { type: Number, default: 0 }
    }]
  },
  aSeasonData: [{
    sTitle: { type: String, trim: true },
    aData: [{
      iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
      nUserRank: { type: Number, default: 0 },
      nTotalJoinLeague: { type: Number, default: 0 }
    }]
  }],
  aSeasons: [{ type: Schema.Types.ObjectId, ref: SeasonModel }],
  sExternalId: { type: String }
}, {
  timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' }
})

module.exports = GamesDBConnect.model('leadershipboards', LeaderShipBoard)
