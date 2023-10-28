const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const LeagueCategoryModel = require('../leagueCategory/model')
const FilterCategoryModel = require('../leagueCategory/filterCategory.model')

const League = new Schema({
  sName: { type: String, trim: true, required: true },
  nMax: { type: Number, required: true },
  nMin: { type: Number, required: true },
  nPrice: { type: Number, required: true },
  nTotalPayout: { type: Number, required: true },
  nDeductPercent: { type: Number },
  nBonusUtil: { type: Number, default: 0 },
  aLeaguePrize: [{
    nRankFrom: { type: Number },
    nRankTo: { type: Number },
    nPrize: { type: Number },
    eRankType: { type: String, enum: data.leagueRankType, default: 'R' }, // R = REAL_MONEY, B = BONUS, E = EXTRA
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  nTotalWinners: { type: Number },
  sPayoutBreakupDesign: { type: String },
  bConfirmLeague: { type: Boolean, default: false },
  bMultipleEntry: { type: Boolean, default: false },
  bAutoCreate: { type: Boolean, default: false },
  bPoolPrize: { type: Boolean, default: false },
  bUnlimitedJoin: { type: Boolean, default: false },
  nPosition: { type: Number },
  nTeamJoinLimit: { type: Number, default: 1 },
  nWinnersCount: { type: Number },
  eStatus: { type: String, enum: data.status, default: 'N' },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sLeagueCategory: { type: String },
  nLoyaltyPoint: { type: Number, default: 0 },
  sFilterCategory: { type: String },
  nMinCashbackTeam: { type: Number, default: 0 },
  nCashbackAmount: { type: Number },
  bCashbackEnabled: { type: Boolean, default: false },
  eCashbackType: { type: String, enum: data.ruleType, default: 'B' }, // C = CASH, B = BONUS
  iLeagueCatId: { type: Schema.Types.ObjectId, ref: LeagueCategoryModel, required: true },
  iFilterCatId: { type: Schema.Types.ObjectId, ref: FilterCategoryModel, required: true },
  nMinTeamCount: { type: Number },
  nBotsCount: { type: Number },
  nCopyBotsPerTeam: { type: Number },
  bBotCreate: { type: Boolean, default: false },
  bCopyBotInit: { type: Boolean, default: false },
  nSameCopyBotTeam: { type: Number },
  nAutoFillSpots: { type: Number, default: 0 },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

League.index({ eCategory: 1 })

module.exports = LeaguesDBConnect.model('leagues', League)
