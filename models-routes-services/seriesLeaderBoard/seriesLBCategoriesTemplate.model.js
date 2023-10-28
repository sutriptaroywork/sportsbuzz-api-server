const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { SeriesLBDBConnect } = require('../../database/mongoose')
const { seriesLBCategoriesTemplateType } = require('../../data')

const SeriesLBCategoriesTemplate = new Schema({
  sName: { type: String, required: true },
  eType: { type: String, enum: seriesLBCategoriesTemplateType, default: 'CONTEST_JOIN' },
  sInfo: { type: String },
  sImage: { type: String },
  sColumnText: { type: String },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = SeriesLBDBConnect.model('series_leader_board_categories_templates', SeriesLBCategoriesTemplate)
