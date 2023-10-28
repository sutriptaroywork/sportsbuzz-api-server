const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../../database/mongoose')
const data = require('../../../data')
const UserModel = require('../../user/model')
const BannerModel = require('../model')

const BannerStatistic = new Schema({
  iBannerId: { type: Schema.Types.ObjectId, ref: BannerModel, required: true },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, required: true },
  eStatus: { type: String, enum: data.status, default: 'Y' }, // Y = Active, N = Inactive
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BannerStatistic.index({ iBannerId: 1 })

module.exports = StatisticsDBConnect.model('Bannerstatistics', BannerStatistic)
