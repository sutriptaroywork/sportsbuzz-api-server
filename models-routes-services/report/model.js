const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { ReportDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')

const Report = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, required: true },

  oPrivate: {
    nLeague: { type: Number, default: 0 },
    nCancelLeague: { type: Number, default: 0 },
    nRunLeague: { type: Number, default: 0 },
    nTeamJoin: { type: Number, default: 0 },

    nAmount: { type: Number, default: 0 },
    nBonus: { type: Number, default: 0 }, // remove
    nCash: { type: Number, default: 0 }, // remove

    nDistAmount: { type: Number, default: 0 },
    nDistBonus: { type: Number, default: 0 },
    nAdminCommission: { type: Number, default: 0 },
    nCreatorCommission: { type: Number, default: 0 },
    nCreatorBonusGst: { type: Number, default: 0 }
  },
  oPublic: {
    nLeague: { type: Number, default: 0 },
    nCancelLeague: { type: Number, default: 0 },
    nRunLeague: { type: Number, default: 0 },
    nTeamJoin: { type: Number, default: 0 },
    nAmount: { type: Number, default: 0 },
    nBotAmount: { type: Number, default: 0 },
    nBonus: { type: Number, default: 0 },
    nBotBonus: { type: Number, default: 0 },
    nCash: { type: Number, default: 0 },
    nBotCash: { type: Number, default: 0 },
    nDistAmount: { type: Number, default: 0 },
    nDistBonus: { type: Number, default: 0 },
    nBotDistAmount: { type: Number, default: 0 },
    nBotDistBonus: { type: Number, default: 0 },
    nPromoDiscount: { type: Number, default: 0 },
    nBotPromoDiscount: { type: Number, default: 0 },
    nCashbackCash: { type: Number, default: 0 },
    nBotCashbackCash: { type: Number, default: 0 },
    nCashbackBonus: { type: Number, default: 0 },
    nBotCashbackBonus: { type: Number, default: 0 },
    nCashbackReturnCash: { type: Number, default: 0 },
    nBotCashbackReturnCash: { type: Number, default: 0 },
    nCashbackReturnBonus: { type: Number, default: 0 },
    nBotCashbackReturnBonus: { type: Number, default: 0 }
  },
  nLeague: { type: Number, default: 0 },
  nCancelLeague: { type: Number, default: 0 },
  nRunLeague: { type: Number, default: 0 },
  nTeamJoin: { type: Number, default: 0 },

  nAmount: { type: Number, default: 0 },
  nBonus: { type: Number, default: 0 },
  nCash: { type: Number, default: 0 },

  nDistAmount: { type: Number, default: 0 },
  nDistBonus: { type: Number, default: 0 },
  nProfitWithBonus: { type: Number, default: 0 },
  nProfitWithoutBonus: { type: Number, default: 0 },
  nPromoDiscount: { type: Number, default: 0 },

  nTotalTeam: { type: Number, default: 0 },
  nTotalUserCount: { type: Number, default: 0 },

  nCashbackCash: { type: Number, default: 0 },
  nBotCashbackCash: { type: Number, default: 0 },
  nCashbackBonus: { type: Number, default: 0 },
  nBotCashbackBonus: { type: Number, default: 0 },
  nCashbackReturnCash: { type: Number, default: 0 },
  nBotCashbackReturnCash: { type: Number, default: 0 },
  nCashbackReturnBonus: { type: Number, default: 0 },
  nBotCashbackReturnBonus: { type: Number, default: 0 },

  nPlayReturnCash: { type: Number, default: 0 },
  nBotPlayReturnCash: { type: Number, default: 0 },
  nPlayReturnBonus: { type: Number, default: 0 },
  nBotPlayReturnBonus: { type: Number, default: 0 },

  aTopSpendUser: [{
    iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
    sUsername: { type: String, trim: true, required: true },
    sEmail: { type: String, trim: true },
    sMobNum: { type: String, trim: true, required: true },
    nTeams: { type: Number, default: 0 },
    nLeagueJoin: { type: Number, default: 0 }, // distinct matchleagues or all userleagues
    nLeagueJoinAmount: { type: Number, default: 0 },
    nBonusUtil: { type: Number, default: 0 },
    eType: { type: String }
  }],
  aTopEarnedUser: [{
    iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
    sUsername: { type: String, trim: true, required: true },
    sEmail: { type: String, trim: true },
    sMobNum: { type: String, trim: true, required: true },
    nTeams: { type: Number, default: 0 },
    nLeagueJoin: { type: Number, default: 0 },
    nLeagueJoinAmount: { type: Number, default: 0 },
    nBonusUtil: { type: Number, default: 0 },
    nTotalEarned: { type: Number },
    eType: { type: String }
  }],
  aTopLoosedUser: [{
    iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
    sUsername: { type: String, trim: true, required: true },
    sEmail: { type: String, trim: true },
    sMobNum: { type: String, trim: true, required: true },
    nTeams: { type: Number, default: 0 },
    nLeagueJoin: { type: Number, default: 0 },
    nLeagueJoinAmount: { type: Number, default: 0 },
    nBonusUtil: { type: Number, default: 0 },
    nTotalLoss: { type: Number },
    eType: { type: String }
  }],
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Report.index({ iMatchId: 1 })

module.exports = ReportDBConnect.model('reports', Report)
