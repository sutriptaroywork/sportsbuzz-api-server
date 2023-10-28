const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { commonRule, ruleType, status, rewardOn } = require('../../data')

const CommonRule = new Schema({
  eRule: { type: String, enum: commonRule, required: true, unique: true }, // RB = REGISTER_BONUS, RCB = REFER_CODE_BONUS, RR = REGISTER_REFER, DB = DEPOSIT_BONUS, PLC = PRIVATE_LEAGUE_COMMISSION, LCC =LEAGUE_CREATOR_COMMISSION
  sRuleName: { type: String },
  sDescription: { type: String },
  nAmount: { type: Number, required: true },
  eType: { type: String, enum: ruleType, required: true }, // C = CASH, B = BONUS, W = WITHDRAW
  nMax: { type: Number },
  nMin: { type: Number },
  eStatus: { type: String, enum: status, default: 'N' }, // Y = Active, N = Inactive
  nExpireDays: { type: Number },
  sExternalId: { type: String },
  sRewardOn: { type: String, enum: rewardOn }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
CommonRule.index({ eStatus: 1, eRule: 1 })

module.exports = StatisticsDBConnect.model('commonrules', CommonRule)
