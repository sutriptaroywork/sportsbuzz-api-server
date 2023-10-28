const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const LeagueModel = require('../league/model')
const MatchModel = require('../match/model')

const Promocode = new Schema({
  sName: { type: String, required: true },
  sCode: { type: String, required: true },
  sInfo: { type: String, trim: true },
  bIsPercent: { type: Boolean, default: false },
  nAmount: { type: Number },
  bShow: { type: Boolean, default: false }, // if eStatus is Y and this flag is false, no need to show in front, but it's active for users.
  // for e.g.: there is any social media campaign run by marketing team and users whoever has seen the post, that user can apply promocode from their post to this platform.
  eStatus: { type: String, enum: data.status, default: 'N' }, // Y = Active, N = Inactive
  nMinAmount: { type: Number },
  nMaxAmount: { type: Number },
  aLeagues: [{ type: Schema.Types.ObjectId, ref: LeagueModel }],
  aMatches: [{ type: Schema.Types.ObjectId, ref: MatchModel }],
  eType: { type: String, enum: data.promocodeTypes, default: 'DEPOSIT' },
  nMaxAllow: { type: Number },
  bMaxAllowForAllUser: { type: Boolean, default: false },
  // Promocode to be used Only N number of times by all the users so that i can generated limited use promocode
  nPerUserUsage: { type: Number, default: 1 },
  dStartTime: { type: Date },
  dExpireTime: { type: Date },
  nBonusExpireDays: { type: Number },
  eOfferType: { type: String, enum: data.promoOffer },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Promocode.index({ sCode: 1, eStatus: 1, bShow: 1, eType: 1 })

module.exports = LeaguesDBConnect.model('promocodes', Promocode)
